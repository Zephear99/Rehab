"use strict";
/* ================= démarrage ================= */
async function refresh(){
  const [cfg, list] = await Promise.all([store.getPlanning(), store.listSessions()]);
  if (cfg) planning = cfg;
  if (list){
    const local = new Map(sessions.map(s => [s.id, s]));
    sessions = list.map(s => { const l = local.get(s.id); return l && (l.ts || 0) > (s.ts || 0) ? l : s; });
    local.forEach((s, id) => { if (!sessions.some(x => x.id === id)) sessions.push(s); });
  }
}
async function boot(){
  $('#sideDate').textContent = cap1(new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'short' }));
  buildNav();
  const want = (location.hash || '').replace('#','') || lsGet('pds_tab') || 'sess';
  go(RENDER[want] ? want : 'sess');
  await store.init();
  await refresh();
  loaded = true;
  if (session && session.id === 's_' + iso(viewDate)) session = null;
  loadSession();
  RENDER[tab]();
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden){ flushSave(); return; }
    if (document.activeElement && document.activeElement.closest('input,textarea')) return;
    if (store.pending) return;
    const before = JSON.stringify(session);
    await refresh();
    const fresh = sessions.find(s => s.id === session.id);
    if (fresh && JSON.stringify(fresh) !== before){ session = fresh; }
    if (!document.querySelector('.sheet')) RENDER[tab]();
  });
  window.addEventListener('pagehide', flushSave);
  window.addEventListener('hashchange', () => { const h = location.hash.replace('#',''); if (RENDER[h] && h !== tab) go(h); });
}
/* ================= application installée ================= */
/* Mises à jour : le navigateur relit sw.js sans cache HTTP, et on vérifie aussi à chaque retour dans l'app
   (une app installée reste souvent ouverte des jours en arrière-plan). Quand une nouvelle version prend
   la main pendant que l'app est ouverte, on propose de recharger plutôt que de couper une séance en cours. */
if ('serviceWorker' in navigator) window.addEventListener('load', () => {
  const hadSW = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache:'none' }).then(reg => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadSW || document.getElementById('updNag')) return;
    const b = el('div','banner info'); b.id = 'updNag'; b.style.cssText = 'margin:12px 0 0;align-items:center'; b.innerHTML = svgI(ICON.info);
    const r = el('button','btn sm','Recharger'); r.type = 'button'; r.style.marginLeft = 'auto'; r.onclick = () => { flushSave(); location.reload(); };
    b.append(el('span', null, 'Nouvelle version de l’app disponible.'), r); $('.page').prepend(b);
  });
});
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch(e){}
function backupNag(){
  if (document.getElementById('backupNag')) return;
  const n = sessions.filter(s => s && (s.done || (s.items || []).some(i => i.done))).length; if (!n) return;
  const last = lsGet('pds_lastExport') || 0, days = Math.floor((Date.now() - last) / 86400000);
  if (last && days < 7) return;
  const b = el('div','banner warn'); b.id = 'backupNag'; b.style.margin = '12px 0 0'; b.innerHTML = svgI(ICON.warn);
  const t = el('span', null, (last ? 'Dernière sauvegarde il y a ' + days + ' jours. ' : 'Aucune sauvegarde pour l’instant. ') + 'Tes données ne sont que sur cet appareil.');
  const a = el('button','btn sm','Sauvegarder'); a.type = 'button'; a.style.marginLeft = 'auto'; a.onclick = () => saveBackup();
  b.style.alignItems = 'center'; b.append(t, a); $('.page').prepend(b);
}
boot().then(backupNag).catch(e => { const b = el('div','banner crit'); b.style.margin = '16px 0'; b.textContent = 'Démarrage impossible : ' + (e && e.message || e); $('.page').prepend(b); });
