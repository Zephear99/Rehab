"use strict";
/* ================= synchronisation GitHub =================
   La sauvegarde est un fichier JSON dans un dépôt GitHub PRIVÉ, écrit avec une clé d'accès
   limitée à ce dépôt. La clé reste dans le navigateur de l'appareil (localStorage) : elle n'est
   jamais dans le code publié.
   - Sauvegarder : on relit le fichier distant, on fusionne, puis on l'écrase avec le résultat.
     Relire d'abord évite d'effacer ce qu'un autre appareil a envoyé entre-temps.
   - À l'ouverture et au retour dans l'app : on relit le fichier distant et on fusionne.
   Fusion : pour chaque séance, la version modifiée le plus récemment gagne ; idem pour la semaine type. */
const GH_API = 'https://api.github.com';
const GH_FILE = 'sauvegarde.json';
const ghCfg = () => { const c = lsGet('pds_github'); return c && c.repo && c.token ? c : null; };

const b64encode = str => { const by = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < by.length; i += 0x8000) bin += String.fromCharCode.apply(null, by.subarray(i, i + 0x8000)); return btoa(bin); };
const b64decode = b64 => new TextDecoder().decode(Uint8Array.from(atob(String(b64).replace(/\s/g, '')), c => c.charCodeAt(0)));

class GhError extends Error { constructor(status, msg){ super(msg); this.status = status; } }
async function gh(cfg, path, opts){
  let r;
  try { r = await fetch(GH_API + path, Object.assign({ cache:'no-store' }, opts, { headers:Object.assign({ Accept:'application/vnd.github+json', Authorization:'Bearer ' + cfg.token, 'X-GitHub-Api-Version':'2022-11-28' }, (opts || {}).headers) })); }
  catch(e){ throw new GhError(0, 'Pas de connexion à GitHub. Tes données restent enregistrées sur cet appareil.'); }
  if (r.ok) return r.status === 204 ? null : r.json();
  const why = { 401:'Clé GitHub refusée : elle a peut-être expiré. Mets-la à jour dans Réglages → Synchronisation GitHub.',
    403:'Accès refusé par GitHub : vérifie que la clé a le droit « Contents : Read and write » sur ce dépôt.',
    404:'Dépôt introuvable : vérifie son nom, et que la clé a bien accès à ce dépôt.' }[r.status];
  throw new GhError(r.status, why || 'GitHub a répondu une erreur ' + r.status + '.');
}
const repoPath = cfg => '/repos/' + cfg.repo.split('/').map(encodeURIComponent).join('/');

/* Lit le fichier distant : { data, sha }, ou { data:null, sha:null } s'il n'existe pas encore. */
async function ghRead(cfg){
  let meta;
  try { meta = await gh(cfg, repoPath(cfg) + '/contents/' + GH_FILE); }
  catch(e){ if (e.status === 404){ await gh(cfg, repoPath(cfg)); return { data:null, sha:null }; } throw e; }
  // Au-delà de 1 Mo, l'API ne renvoie pas le contenu avec le reste : on le demande à part.
  const b64 = meta.content && meta.encoding === 'base64' ? meta.content : (await gh(cfg, repoPath(cfg) + '/git/blobs/' + meta.sha)).content;
  let data = null; try { data = JSON.parse(b64decode(b64)); } catch(e){ throw new GhError(-1, 'Le fichier ' + GH_FILE + ' du dépôt est illisible.'); }
  return { data, sha:meta.sha };
}

/* Fusionne une sauvegarde dans les données locales. Renvoie le nombre d'éléments mis à jour. */
async function mergeBackup(data){
  if (!data) return 0;
  flushSave();
  let n = 0;
  for (const s of (Array.isArray(data.sessions) ? data.sessions : [])){
    if (!s || !s.id || !s.date || !Array.isArray(s.items)) continue;
    const i = sessions.findIndex(x => x.id === s.id), cur = i >= 0 ? sessions[i] : null;
    if (cur && (s.ts || 0) <= (cur.ts || 0)) continue;
    if (i >= 0) sessions[i] = s; else sessions.push(s);
    if (session && session.id === s.id) session = s;
    await store.write('sessions/' + s.id, s); n++;
  }
  const rts = data.planningTs || 0;
  if (data.planning && rts > (lsGet('pds_planning_ts') || 0)){ planning = data.planning; await store.write('config/planning', { days:planning, ts:rts }); n++; }
  return n;
}

let syncBusy = false, lastPull = 0;
function syncState(txt, s){ document.querySelectorAll('.sync').forEach(x => { x.dataset.s = s; x.querySelector('.syncTxt').textContent = txt; }); }
function deviceName(){ const m = navigator.userAgentData ? navigator.userAgentData.mobile : /Android|iPhone|iPad/i.test(navigator.userAgent); return m ? 'le téléphone' : 'l’ordinateur'; }

/* Récupère la dernière version (ouverture de l'app, retour dans l'app). Silencieux sauf en cas de changement. */
async function ghPull(force){
  const cfg = ghCfg(); if (!cfg || syncBusy) return;
  if (!force && Date.now() - lastPull < 60000) return;
  if (document.activeElement && document.activeElement.closest('input,textarea')) return;
  syncBusy = true; lastPull = Date.now();
  try {
    syncState('Synchronisation…', 'busy');
    const { data } = await ghRead(cfg);
    const n = await mergeBackup(data);
    lsSet('pds_github_ok', Date.now()); syncState('Synchronisé avec GitHub', 'cloud');
    if (n){ if (!document.querySelector('.sheet')){ if (tab === 'sess') loadSession(); else RENDER[tab](); } toast('Données mises à jour depuis GitHub'); }
  } catch(e){ syncState(e.status === 0 ? 'Hors ligne' : 'Synchro en erreur', e.status === 0 ? 'local' : 'err'); if (e.status && e.status !== 0) toast(e.message); }
  finally { syncBusy = false; }
}

/* Sauvegarder vers GitHub : relire, fusionner, écraser. Réessaie une fois si un autre appareil a écrit entre-temps. */
async function ghPush(){
  const cfg = ghCfg(); if (!cfg) return false;
  if (syncBusy){ toast('Synchronisation déjà en cours…'); return true; }
  syncBusy = true; syncState('Envoi vers GitHub…', 'busy');
  try {
    for (let attempt = 0; attempt < 2; attempt++){
      const { data, sha } = await ghRead(cfg);
      await mergeBackup(data);
      const body = { message:'Sauvegarde depuis ' + deviceName() + ' · ' + new Date().toLocaleString('fr-FR'), content:b64encode(JSON.stringify(backupPayload(), null, 2)) };
      if (sha) body.sha = sha;
      try { await gh(cfg, repoPath(cfg) + '/contents/' + GH_FILE, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body) }); }
      catch(e){ if ((e.status === 409 || e.status === 422) && attempt === 0) continue; throw e; }
      markBackedUp('GitHub · ' + cfg.repo); lsSet('pds_github_ok', Date.now()); lastPull = Date.now();
      syncState('Synchronisé avec GitHub', 'cloud'); toast('Sauvegardé sur GitHub'); if (!document.querySelector('.sheet')) RENDER[tab]();
      return true;
    }
  } catch(e){ syncState(e.status === 0 ? 'Hors ligne' : 'Synchro en erreur', e.status === 0 ? 'local' : 'err'); toast(e.message); }
  finally { syncBusy = false; }
  return true;
}

/* Réglages : nom du dépôt et clé. On refuse un dépôt public, qui exposerait les données à tout le monde. */
function openGithub(){
  const cur = lsGet('pds_github') || {};
  const { box, close } = sheet('Synchronisation', 'Sauvegarde sur GitHub');
  const intro = el('p', null, 'Le bouton Sauvegarder envoie tes données dans un dépôt GitHub privé, et chaque appareil récupère la dernière version à l’ouverture. La clé reste sur cet appareil : fais la même configuration sur ton téléphone et ton ordinateur.');
  intro.style.cssText = 'margin:0 0 14px;font-size:13.5px;color:var(--ink-2)'; box.append(intro);
  const field = (lab, input, help) => { const w = el('label'); w.style.cssText = 'display:grid;gap:6px;margin-bottom:14px'; const t = el('span','eyebrow', lab); w.append(t, input);
    if (help){ const h = el('span', null, help); h.style.cssText = 'font-size:12.5px;color:var(--ink-3)'; w.append(h); } box.append(w); };
  const st = 'width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--line-2);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit';
  const repo = el('input'); repo.type = 'text'; repo.autocomplete = 'off'; repo.autocapitalize = 'off'; repo.spellcheck = false; repo.placeholder = 'Zephear99/rehab-donnees'; repo.value = cur.repo || ''; repo.style.cssText = st;
  field('Dépôt privé', repo, 'Sous la forme pseudo/nom-du-depot.');
  const tok = el('input'); tok.type = 'password'; tok.autocomplete = 'off'; tok.placeholder = cur.token ? 'Clé enregistrée (laisser vide pour la garder)' : 'github_pat_…'; tok.style.cssText = st;
  field('Clé d’accès (fine-grained token)', tok, 'Ne la partage avec personne, pas même dans un chat.');
  const msg = el('p','vres'); box.append(msg);
  const say = (t, bad) => { msg.textContent = t; msg.className = 'vres' + (bad ? ' bad' : ''); };
  if (cur.repo && cur.token) say('Connecté à ' + cur.repo + (lsGet('pds_github_ok') ? ' · dernière synchro réussie ' + new Date(lsGet('pds_github_ok')).toLocaleString('fr-FR') : '') + '.');
  const foot = el('div','sheet-foot');
  const off = el('button','btn ghost','Déconnecter'); off.type = 'button'; off.hidden = !cur.token;
  off.onclick = () => { lsSet('pds_github', null); lsSet('pds_github_ok', null); syncUI(); toast('Synchronisation GitHub désactivée sur cet appareil'); close(); };
  const cancel = el('button','btn ghost','Annuler'); cancel.type = 'button'; cancel.onclick = close;
  const ok = el('button','btn','Connecter'); ok.type = 'button';
  ok.onclick = async () => {
    const cfg = { repo:repo.value.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$|\/+$/g, ''), token:tok.value.trim() || cur.token || '' };
    if (!/^[\w.-]+\/[\w.-]+$/.test(cfg.repo)) return say('Nom de dépôt invalide : écris pseudo/nom-du-depot.', true);
    if (!cfg.token) return say('Colle la clé d’accès.', true);
    ok.disabled = true; say('Vérification…');
    try {
      const info = await gh(cfg, repoPath(cfg));
      if (!info.private){ ok.disabled = false; return say('Ce dépôt est PUBLIC : tes données de santé seraient visibles par tout le monde. Rends-le privé (Settings → Danger Zone → Change visibility) ou utilise un autre dépôt.', true); }
      if (info.permissions && !info.permissions.push){ ok.disabled = false; return say('La clé peut lire ce dépôt mais pas y écrire : donne-lui « Contents : Read and write ».', true); }
      lsSet('pds_github', cfg); close(); toast('Connecté à ' + cfg.repo);
      await ghPull(true);
      await ghPush();
    } catch(e){ ok.disabled = false; say(e.message, true); }
  };
  const sp = el('span'); sp.style.flex = '1'; foot.append(off, sp, cancel, ok); box.append(foot);
}
