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

/* Fusionne une sauvegarde dans les données locales. Renvoie le nombre d'éléments mis à jour.
   opts.remoteWins : la version GitHub remplace celle de l'appareil, même si celle-ci est plus récente.
   opts.adoptPlanning : prendre la semaine type distante si celle de l'appareil n'a jamais été modifiée depuis la synchro (première connexion). */
async function mergeBackup(data, opts){
  opts = opts || {};
  if (!data) return 0;
  flushSave();
  let n = 0;
  for (const s of (Array.isArray(data.sessions) ? data.sessions : [])){
    if (!s || !s.id || !s.date || !Array.isArray(s.items)) continue;
    const i = sessions.findIndex(x => x.id === s.id), cur = i >= 0 ? sessions[i] : null;
    if (cur && !opts.remoteWins && (s.ts || 0) <= (cur.ts || 0)) continue;
    if (cur && opts.remoteWins && JSON.stringify(cur) === JSON.stringify(s)) continue;
    if (i >= 0) sessions[i] = s; else sessions.push(s);
    if (session && session.id === s.id) session = s;
    await store.write('sessions/' + s.id, s); n++;
  }
  const rts = data.planningTs || 0;
  const take = data.planning && (rts > planTs() || opts.remoteWins || (opts.adoptPlanning && planTs() <= 1));
  if (take && JSON.stringify(data.planning) !== JSON.stringify(planning)){ planning = data.planning; await store.write('config/planning', { days:planning, ts:Math.max(rts, 1) }); n++; }
  else if (take) lsSet('pds_planning_ts', Math.max(rts, 1));
  return n;
}

/* Date de la semaine type locale. Une semaine type réglée avant l'arrivée de la synchronisation n'a pas de date :
   on lui donne 1, pour qu'elle passe devant la semaine type par défaut (0) d'un appareil qui ne l'a jamais modifiée,
   sans passer devant une modification datée. */
function planTs(){ return lsGet('pds_planning_ts') || (lsGet('pds_planning') ? 1 : 0); }

let syncBusy = false, lastPull = 0;
function syncState(txt, s){ document.querySelectorAll('.sync').forEach(x => { x.dataset.s = s; x.querySelector('.syncTxt').textContent = txt; }); }
/* Toucher l'indicateur de synchro force la récupération de la dernière version. */
document.addEventListener('click', e => { if (e.target.closest('.sync') && ghCfg()) ghPull(true); });
/* Ordinateur : repasser sur la fenêtre de l'app ne déclenche pas toujours `visibilitychange`. */
window.addEventListener('focus', () => ghPull());
function deviceName(){ const m = navigator.userAgentData ? navigator.userAgentData.mobile : /Android|iPhone|iPad/i.test(navigator.userAgent); return m ? 'le téléphone' : 'l’ordinateur'; }

/* Récupère la dernière version (ouverture de l'app, retour dans l'app). Silencieux sauf en cas de changement. */
async function ghPull(force, opts){
  const cfg = ghCfg(); if (!cfg || syncBusy) return;
  // Petit délai anti-rafale seulement : revenir dans l'app doit suffire à voir la dernière version.
  // La saisie en cours est enregistrée par mergeBackup (flushSave) avant la fusion, donc rien n'est perdu.
  if (!force && Date.now() - lastPull < 2000) return;
  syncBusy = true; lastPull = Date.now();
  try {
    syncState('Synchronisation…', 'busy');
    const { data } = await ghRead(cfg);
    const n = await mergeBackup(data, opts);
    lsSet('pds_github_ok', Date.now()); syncState('Synchronisé avec GitHub', 'cloud');
    if (opts && opts.remoteWins) toast(n ? 'Cet appareil a repris la version GitHub (' + n + ' élément(s))' : 'Cet appareil était déjà identique à GitHub');
    if (n){ if (!document.querySelector('.sheet')){ if (tab === 'sess') loadSession(); else RENDER[tab](); } if (!opts || !opts.remoteWins) toast('Données mises à jour depuis GitHub'); }
  } catch(e){ syncState(e.status === 0 ? 'Hors ligne' : 'Synchro en erreur', e.status === 0 ? 'local' : 'err'); if (e.status && e.status !== 0) toast(e.message); }
  finally { syncBusy = false; }
}

/* Sauvegarder vers GitHub : relire, fusionner, écraser. Réessaie une fois si un autre appareil a écrit entre-temps. */
async function ghPush(){
  const cfg = ghCfg(); if (!cfg) return false;
  if (syncBusy){ toast('Synchronisation déjà en cours…'); return true; }
  syncBusy = true; syncState('Envoi vers GitHub…', 'busy');
  try {
    for (let attempt = 0; attempt < 3; attempt++){
      if (attempt) await new Promise(r => setTimeout(r, 1500 * attempt));   // GitHub met parfois quelques secondes à voir la version précédente
      const { data, sha } = await ghRead(cfg);
      await mergeBackup(data);
      const body = { message:'Sauvegarde depuis ' + deviceName() + ' · ' + new Date().toLocaleString('fr-FR'), content:b64encode(JSON.stringify(backupPayload(), null, 2)) };
      if (sha) body.sha = sha;
      try { await gh(cfg, repoPath(cfg) + '/contents/' + GH_FILE, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body) }); }
      catch(e){ if ((e.status === 409 || e.status === 422) && attempt < 2) continue; throw e; }
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
  if (cur.repo && cur.token){
    say('Connecté à ' + cur.repo + (lsGet('pds_github_ok') ? ' · dernière synchro réussie ' + new Date(lsGet('pds_github_ok')).toLocaleString('fr-FR') : '') + '.');
    // Comparaison appareil / GitHub : permet de voir tout de suite s'il y a un écart, et de quel côté.
    const cmp = el('div','card'); cmp.style.cssText = 'padding:12px 14px;margin:0 0 14px;font-size:13px;color:var(--ink-2);display:grid;gap:6px';
    cmp.textContent = 'Comparaison avec GitHub…'; box.insertBefore(cmp, msg);
    const fmt = t => t > 1 ? new Date(t).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : 'jamais modifiée depuis la synchro';
    ghRead(cur).then(({ data }) => {
      cmp.innerHTML = '';
      if (!data){ cmp.textContent = 'Rien sur GitHub pour l’instant : touche Sauvegarder.'; return; }
      flushSave();
      const remoteById = new Map((data.sessions || []).map(s => [s.id, s]));
      const onlyHere = sessions.filter(s => !remoteById.has(s.id)).length, onlyThere = [...remoteById.keys()].filter(id => !sessions.some(s => s.id === id)).length;
      const diff = sessions.filter(s => remoteById.has(s.id) && JSON.stringify(remoteById.get(s.id)) !== JSON.stringify(s)).length;
      const samePlan = JSON.stringify(data.planning) === JSON.stringify(planning);
      const line = t => cmp.append(el('div', null, t));
      line('Dernière sauvegarde sur GitHub : ' + (data.exported ? new Date(data.exported).toLocaleString('fr-FR') : '–'));
      line('Semaine type : ' + (samePlan ? 'identique ✓' : 'DIFFÉRENTE (ici : ' + fmt(planTs()) + ' · GitHub : ' + fmt(data.planningTs || 0) + ')'));
      line('Séances : ' + sessions.length + ' ici, ' + remoteById.size + ' sur GitHub' + (onlyHere || onlyThere || diff ? ' · ' + [onlyHere && onlyHere + ' seulement ici', onlyThere && onlyThere + ' seulement sur GitHub', diff && diff + ' différente(s)'].filter(Boolean).join(', ') : ' · identiques ✓'));
      if (!samePlan || onlyThere || diff){
        const fix = el('button','btn sm','Reprendre la version GitHub sur cet appareil'); fix.type = 'button'; fix.style.justifySelf = 'start'; fix.style.marginTop = '4px';
        fix.onclick = async () => { if (!confirm('Remplacer la semaine type et les séances de cet appareil par celles de GitHub ? Les séances qui n’existent qu’ici sont gardées.')) return; close(); await ghPull(true, { remoteWins:true }); };
        cmp.append(fix);
      }
    }).catch(e => { cmp.textContent = e.message; });
  }
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
      await ghPull(true, { adoptPlanning:true });
      await ghPush();
    } catch(e){ ok.disabled = false; say(e.message, true); }
  };
  const sp = el('span'); sp.style.flex = '1'; foot.append(off, sp, cancel, ok); box.append(foot);
}
