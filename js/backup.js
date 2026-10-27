"use strict";
/* ================= export / import / réglages ================= */
/* Contenu commun à la sauvegarde et à l'export. */
function backupPayload(){
  flushSave();
  return { app:'carnet-de-reprise', version:2, exported:new Date().toISOString(), planning,
    sessions:sessions.filter(s => s.done || s.items.some(i => i.done || i.sets.some(hasVal))) };
}
function markBackedUp(name){
  lsSet('pds_lastExport', Date.now()); if (name) lsSet('pds_backupName', name);
  const bk = document.getElementById('backupNag'); if (bk) bk.remove();
}
function download(json, filename){
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type:'application/json' })); a.download = filename;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000); return true; }
  catch(e){ toast('Export indisponible dans cette vue'); return false; }
}

/* Petit magasin IndexedDB : localStorage ne sait pas garder le lien vers un fichier (FileSystemFileHandle). */
const idb = {
  open(){ return new Promise((res, rej) => { const r = indexedDB.open('pds', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async run(mode, fn){ const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('kv', mode); const r = fn(t.objectStore('kv')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); },
  get(k){ return this.run('readonly', s => s.get(k)).catch(() => null); },
  set(k, v){ return this.run('readwrite', s => s.put(v, k)).catch(() => null); },
  del(k){ return this.run('readwrite', s => s.delete(k)).catch(() => null); },
};
const BACKUP_NAME = 'programme-de-sport-sauvegarde.json';
const canOverwrite = typeof window.showSaveFilePicker === 'function';
let backupHandle = null;   // copie en mémoire, au cas où IndexedDB serait indisponible

/* Sauvegarder : écrit toujours dans le même fichier, en remplaçant son contenu.
   Le premier appui demande où créer le fichier ; les suivants l'écrasent directement
   (Chrome peut redemander l'autorisation d'écrire, une fois par ouverture de l'app).
   Navigateur sans accès aux fichiers : on télécharge sous un nom fixe, sans pouvoir écraser. */
async function saveBackup(pickNew){
  const json = JSON.stringify(backupPayload(), null, 2);
  if (!canOverwrite){
    if (download(json, BACKUP_NAME)){ markBackedUp(); toast('Sauvegarde téléchargée'); }
    return;
  }
  let h = pickNew ? null : backupHandle || await idb.get('backupHandle');
  if (h){
    try { const o = { mode:'readwrite' }; if ((await h.queryPermission(o)) !== 'granted' && (await h.requestPermission(o)) !== 'granted') h = null; }
    catch(e){ h = null; }
  }
  if (!h){
    try { h = await window.showSaveFilePicker({ suggestedName:BACKUP_NAME, types:[{ description:'Sauvegarde', accept:{ 'application/json':['.json'] } }] }); }
    catch(e){ if (e && e.name === 'AbortError') return; if (download(json, BACKUP_NAME)){ markBackedUp(); toast('Sauvegarde téléchargée'); } return; }
    backupHandle = h; await idb.set('backupHandle', h);
  }
  try {
    const w = await h.createWritable(); await w.write(json); await w.close();
    markBackedUp(h.name); toast('Sauvegarde mise à jour : ' + h.name);
  } catch(e){
    // Fichier supprimé ou déplacé depuis : on oublie le lien, le prochain appui en recrée un.
    backupHandle = null; await idb.del('backupHandle'); lsSet('pds_backupName', null);
    toast('Fichier de sauvegarde introuvable. Touche à nouveau « Sauvegarder » pour en choisir un.');
  }
}
/* Exporter : une copie datée à part, sans toucher au fichier de sauvegarde. */
async function exportData(){
  const json = JSON.stringify(backupPayload(), null, 2), filename = `programme-de-sport-${iso(new Date())}.json`;
  let dl = null; try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch(e){ dl = null; }
  if (dl){ try { await dl.save({ filename, data:json }); markBackedUp(); } catch(e){ if (e && e.code !== 'declined') toast('Export impossible : ' + (e.message || e.code)); } return; }
  if (download(json, filename)) markBackedUp();
}
function backupInfo(){
  const last = lsGet('pds_lastExport'), name = lsGet('pds_backupName');
  if (!last) return 'Aucune sauvegarde pour l’instant';
  const d = Math.floor((Date.now() - last) / 86400000);
  return 'Dernière : ' + (d === 0 ? 'aujourd’hui' : d === 1 ? 'hier' : 'il y a ' + d + ' jours') + (name ? ' · ' + name : '');
}
function importData(){ const f = $('#importFile'); f.value = ''; f.click(); }
$('#importFile').onchange = async ev => {
  const file = ev.target.files && ev.target.files[0]; if (!file) return;
  let data; try { data = JSON.parse(await file.text()); } catch(e){ toast('Fichier illisible : choisis un export JSON de l’application.'); return; }
  const inc = Array.isArray(data.sessions) ? data.sessions.filter(s => s && s.id && s.date && Array.isArray(s.items)) : [];
  const { box, close } = sheet('Importer', 'Restaurer une sauvegarde');
  const p = el('p', null, `${inc.length} séance(s)${data.planning ? ' et une semaine type' : ''} trouvée(s) dans « ${file.name} ». Pour une même date, la version la plus récente est gardée.`);
  p.style.cssText = 'margin:0 0 12px;font-size:14px;color:var(--ink-2)'; box.append(p);
  const lab = el('label','opt'); const cb = el('input'); cb.type = 'checkbox'; cb.id = 'impPlan'; cb.checked = !!data.planning; cb.disabled = !data.planning;
  const d = el('div'); d.append(el('div','t','Remplacer aussi la semaine type'), el('div','m','Sinon, seul l’historique des séances est importé.')); lab.append(cb, d); box.append(lab);
  const foot = el('div','sheet-foot'); const c = el('button','btn ghost','Annuler'); c.type = 'button'; c.onclick = close;
  const ok = el('button','btn','Importer'); ok.type = 'button';
  ok.onclick = async () => {
    ok.disabled = true; let n = 0;
    for (const s of inc){ const cur = sessions.find(x => x.id === s.id); if (!cur || (s.ts || 0) >= (cur.ts || 0)){ const i = sessions.findIndex(x => x.id === s.id); if (i >= 0) sessions[i] = s; else sessions.push(s); await store.write('sessions/' + s.id, s); n++; } }
    if (cb.checked && data.planning){ planning = data.planning; await store.write('config/planning', { days:planning }); }
    close(); loadSession(); go(tab, true); toast(n + ' séance(s) importée(s)');
  };
  foot.append(c, ok); box.append(foot);
};
function openTheme(){
  const cur = currentTheme(); const { box, close } = sheet('Apparence', 'Thème');
  THEMES.forEach(th => {
    const lab = el('label','opt theme-opt'); const r = el('input'); r.type = 'radio'; r.name = 'theme'; r.id = 'th_' + th.id; r.checked = th.id === cur;
    const sw = el('span','sw'); th.sw.forEach(c => { const d = el('span'); d.style.background = c; sw.append(d); });
    const nm = el('div'); nm.style.flex = '1'; nm.append(el('div','t', th.nom)); if (th.m) nm.append(el('div','m', th.m));
    r.onchange = () => { applyTheme(th.id); if (tab === 'hist') renderHist(); };
    lab.append(r, sw, nm); box.append(lab);
  });
  const foot = el('div','sheet-foot'); const b = el('button','btn','Fermer'); b.type = 'button'; b.onclick = close; foot.append(b); box.append(foot);
}
function openMenu(){
  const { box, close } = sheet('Réglages', 'Données et apparence');
  const info = el('div','banner info'); info.innerHTML = svgI(ICON.info);
  info.append(el('span', null, store.mode === 'local' ? 'Tes données sont enregistrées sur cet appareil. Touche « Sauvegarder » après tes séances pour garder une copie à jour.' : 'Tes données sont synchronisées : retrouve-les sur ton téléphone et ton ordinateur en ouvrant ce même lien.'));
  box.append(info);
  const g = el('div','stack'); g.style.marginTop = '14px';
  [['Thème', 'Clair, sombre, bleu nuit, rouge, noir rétro', () => { close(); openTheme(); }],
   ['Minuteur', 'Repos, chrono et signal sonore', () => { close(); openTimer(); }],
   ['Sauvegarder', backupInfo() + (canOverwrite ? '. Remplace le fichier de sauvegarde.' : '. Ce navigateur ne peut pas remplacer un fichier : un nouveau est téléchargé.'), () => { close(); saveBackup(); }],
   ...(canOverwrite && lsGet('pds_backupName') ? [['Changer de fichier de sauvegarde', 'Choisir un autre emplacement pour les prochaines sauvegardes', () => { close(); saveBackup(true); }]] : []),
   ['Exporter une copie datée', 'Fichier JSON à part, le fichier de sauvegarde n’est pas modifié', () => { close(); exportData(); }],
   ['Importer une sauvegarde', 'Restaure un export JSON', () => { close(); importData(); }]].forEach(([t, m, fn]) => {
    const b = el('button','opt'); b.type = 'button'; b.style.cssText = 'width:100%;text-align:left;background:var(--surface);font:inherit;color:inherit;margin:0';
    const d = el('div'); d.append(el('div','t', t), el('div','m', m)); b.append(d); b.onclick = fn; g.append(b); });
  box.append(g);
  const foot = el('div','sheet-foot'); const b = el('button','btn','Fermer'); b.type = 'button'; b.onclick = close; foot.append(b); box.append(foot);
}
$('#sbSave').onclick = () => saveBackup(); $('#mSave').onclick = () => saveBackup(); $('#sbExport').onclick = exportData; $('#sbImport').onclick = importData; $('#sbTheme').onclick = openTheme;
$('#mMenu').onclick = openMenu; $('#mTimer').onclick = openTimer;
