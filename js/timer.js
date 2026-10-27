"use strict";
/* ================= minuteur ================= */
const settings = Object.assign({ autoRest:false, signal:'both', restMus:90, lockScreen:true }, lsGet('pds_settings') || {});
if (settings.sound === false && !(lsGet('pds_settings') || {}).signal) settings.signal = 'none';
delete settings.sound;
const canVibrate = typeof navigator.vibrate === 'function';
const saveSettings = () => lsSet('pds_settings', settings);
const T = { mode:'down', total:0, end:0, start:0, label:'', running:false, iv:null, rang:false, pausedLeft:null, last:0 };
const AUTO_STOP = 120;   // secondes de dépassement avant arrêt automatique
const fmtDur = s => { s = Math.max(0, Math.round(s)); return s >= 60 ? Math.floor(s/60) + ':' + String(s%60).padStart(2,'0') : s + ' s'; };
const fmtClock = s => { const neg = s < 0; s = Math.abs(Math.round(s)); return (neg ? '+' : '') + Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); };
let audioCtx = null, wakeLock = null, hapLabel = null, vibState = null;   // vibState : null (pas testé), 'ok', 'blocked'

/* Retour haptique de secours pour iPhone (iOS 18 et plus) : basculer un interrupteur
   natif fait vibrer le téléphone, alors que Safari ne fournit pas navigator.vibrate. */
function iosHaptic(n){
  try {
    if (!hapLabel){
      const inp = document.createElement('input'); inp.type = 'checkbox'; inp.setAttribute('switch', ''); inp.id = 'hapSwitch'; inp.tabIndex = -1;
      inp.setAttribute('aria-hidden', 'true'); inp.style.cssText = 'position:fixed;left:-200px;top:0;opacity:0;pointer-events:none';
      hapLabel = document.createElement('label'); hapLabel.htmlFor = 'hapSwitch'; hapLabel.setAttribute('aria-hidden', 'true'); hapLabel.style.cssText = 'position:fixed;left:-200px;top:0';
      document.body.append(inp, hapLabel);
    }
    for (let i = 0; i < n; i++) setTimeout(() => hapLabel.click(), i * 220);
  } catch(e){}
}
/* Renvoie true si le navigateur a accepté de vibrer. Un navigateur qui bloque
   le vibreur (cadre claude.ai, économie d'énergie…) renvoie false sans erreur. */
function vibrate(pattern){
  let ok = false;
  if (canVibrate){ try { ok = navigator.vibrate(pattern) === true; } catch(e){ ok = false; } }
  else iosHaptic(Array.isArray(pattern) ? Math.ceil(pattern.length / 2) : 1);
  if (canVibrate) vibState = ok ? 'ok' : 'blocked';
  return ok;
}
function playBeep(){
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, .22, .44].forEach(t => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      const t0 = audioCtx.currentTime + t; g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.25, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + .18); o.start(t0); o.stop(t0 + .2); });
  } catch(e){}
}
function flashScreen(){
  const f = el('div','tflash'); document.body.append(f); setTimeout(() => f.remove(), 1700);
}
function signalEnd(){
  const snd = settings.signal === 'both' || settings.signal === 'sound', vib = settings.signal === 'both' || settings.signal === 'vibrate';
  // Chrome refuse de faire vibrer une page qui n'est pas à l'écran (téléphone verrouillé, autre app) :
  // dans ce cas, ou si le vibreur a été refusé, c'est une notification système qui fait vibrer.
  const vOk = vib && vibrate([500, 200, 500, 200, 500]);
  if (settings.signal !== 'none' && (document.hidden || (vib && !vOk))) notifyEnd();
  if (snd) playBeep();
  if (settings.signal !== 'none') flashScreen();
}

/* ---- Notification de fin (Android) ---- */
const canNotify = 'Notification' in window && 'serviceWorker' in navigator;
function askNotify(){
  if (canNotify && Notification.permission === 'default'){ try { Notification.requestPermission(); } catch(e){} }
}
async function notifyEnd(){
  if (!canNotify || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration(); if (!reg) return false;
    await reg.showNotification(T.mode === 'down' ? 'Repos terminé' : 'Chrono', { body:T.label + ' · touche pour revenir à la séance', tag:'pds-timer', renotify:true,
      requireInteraction:true, vibrate:[500, 200, 500, 200, 500], icon:'icon-192.png', badge:'icon-192.png' });
    return true;
  } catch(e){ return false; }
}
async function clearNotify(){
  if (!canNotify) return;
  try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) (await reg.getNotifications({ tag:'pds-timer' })).forEach(n => n.close()); } catch(e){}
}

/* ---- Minuteur sur l'écran verrouillé (Android) ----
   Une page web ne peut pas créer de widget d'écran verrouillé. On passe donc par le lecteur multimédia
   d'Android : l'app « joue » un son inaudible en boucle, et Android affiche le lecteur sur l'écran verrouillé
   et dans le volet de notifications, avec le temps restant en titre et une barre de progression.
   Effet secondaire utile : tant que ce son joue, Chrome ne met pas l'app en pause, donc le signal de fin
   (son, notification qui vibre) part même téléphone verrouillé.
   Revers : comme tout lecteur, il met en pause la musique d'une autre app (Spotify…) pendant le minuteur. */
const canLockScreen = 'mediaSession' in navigator && typeof MediaMetadata === 'function';
let bgAudio = null, bgLast = '';
function quietWavURL(){
  // 6 s, mono, 8 kHz, 16 bits, à ±1 sur 32 768 : inaudible, mais pas un silence parfait (que certains
  // navigateurs ignorent). Android n'affiche le lecteur que pour un média d'au moins 5 s.
  const n = 8000 * 6, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, i & 1 ? 1 : -1, true);
  return URL.createObjectURL(new Blob([buf], { type:'audio/wav' }));
}
function bgStart(){
  if (!settings.lockScreen || !canLockScreen) return;
  try {
    if (!bgAudio){
      bgAudio = new Audio(quietWavURL()); bgAudio.loop = true;
      const ms = navigator.mediaSession, on = (a, fn) => { try { ms.setActionHandler(a, fn); } catch(e){} };
      on('play', () => { if (T.running && T.pausedLeft != null) togglePause(); });
      on('pause', () => { if (T.running && T.pausedLeft == null && !isOver()) togglePause(); else if (isOver()) stopTimer(); });
      on('stop', stopTimer);
      on('seekforward', () => addTime(15));
    }
    bgLast = '';
    const pr = bgAudio.play(); if (pr && pr.catch) pr.catch(() => {});
  } catch(e){}
}
function bgStop(){
  if (!bgAudio) return;
  try { bgAudio.pause(); const ms = navigator.mediaSession; ms.metadata = null; ms.playbackState = 'none'; if (ms.setPositionState) ms.setPositionState(); } catch(e){}
}
function bgPaint(){
  if (!bgAudio || !T.running) return;
  const left = timerLeft(), over = isOver(), paused = T.pausedLeft != null;
  const title = over ? 'Repos terminé' : fmtClock(left) + (paused ? ' · en pause' : T.mode === 'down' ? ' · repos' : ' · chrono');
  if (title === bgLast) return; bgLast = title;
  try {
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({ title, artist:T.label, album:'Programme de sport',
      artwork:[{ src:'icon-192.png', sizes:'192x192', type:'image/png' }, { src:'icon-512.png', sizes:'512x512', type:'image/png' }] });
    ms.playbackState = paused ? 'paused' : 'playing';
    if (ms.setPositionState){
      if (T.mode === 'down' && !over){ const d = Math.max(1, T.total); ms.setPositionState({ duration:d, position:Math.min(d, Math.max(0, d - left)), playbackRate:1 }); }
      else if (T.mode === 'up'){ const d = Math.max(60, Math.ceil((left + 1) / 60) * 60); ms.setPositionState({ duration:d, position:Math.min(d, Math.max(0, left)), playbackRate:1 }); }
      else ms.setPositionState();
    }
  } catch(e){}
  if (paused){ if (!bgAudio.paused) bgAudio.pause(); }
  else if (bgAudio.paused){ const pr = bgAudio.play(); if (pr && pr.catch) pr.catch(() => {}); }
}
async function keepAwake(on){
  try { if (on && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
        if (!on && wakeLock){ await wakeLock.release(); wakeLock = null; } } catch(e){ wakeLock = null; }
}
function timerLeft(){ if (T.pausedLeft != null) return T.pausedLeft; return T.mode === 'down' ? (T.end - Date.now()) / 1000 : (Date.now() - T.start) / 1000; }
const isOver = () => T.running && T.mode === 'down' && timerLeft() <= 0;
function startTimer(sec, label){
  if (settings.signal === 'both' || settings.signal === 'sound'){ try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume && audioCtx.resume(); } catch(e){} }
  T.mode = 'down'; T.total = sec; T.last = sec; T.end = Date.now() + sec * 1000; T.label = label || 'Repos'; T.running = true; T.rang = false; T.pausedLeft = null;
  timerStarted();
}
function startChrono(){ T.mode = 'up'; T.start = Date.now(); T.label = 'Chrono'; T.running = true; T.pausedLeft = null; T.rang = false; timerStarted(); }
// Appelé dans le geste de l'utilisateur : c'est le seul moment où Chrome autorise à lancer le son et à demander les notifications.
function timerStarted(){ clearNotify(); if (settings.lockScreen) askNotify(); bgStart(); tickLoop(); keepAwake(true); }
function stopTimer(){ T.running = false; T.pausedLeft = null; clearInterval(T.iv); T.iv = null; keepAwake(false); bgStop(); clearNotify(); paintTimer(); }
// Retour dans l'app : l'écran a pu se verrouiller, ce qui libère le maintien de l'écran allumé.
document.addEventListener('visibilitychange', () => { if (!document.hidden && T.running){ keepAwake(true); clearNotify(); paintTimer(); } });
function restartTimer(){ startTimer(T.last || settings.restMus, T.label); }
function togglePause(){
  if (!T.running || isOver()) return;
  if (T.pausedLeft == null){ T.pausedLeft = timerLeft(); clearInterval(T.iv); T.iv = null; }
  else { if (T.mode === 'down') T.end = Date.now() + T.pausedLeft * 1000; else T.start = Date.now() - T.pausedLeft * 1000; T.pausedLeft = null; tickLoop(); }
  paintTimer();
}
function addTime(s){ if (!T.running || T.mode !== 'down') return; if (T.pausedLeft != null) T.pausedLeft += s; else { if (isOver()) T.end = Date.now(); T.end += s * 1000; } T.total += s; T.rang = false; paintTimer(); }
function tickLoop(){
  clearInterval(T.iv);
  T.iv = setInterval(() => {
    const left = timerLeft();
    if (T.mode === 'down' && !T.rang && left <= 0){ T.rang = true; signalEnd(); }
    if (T.mode === 'down' && left <= -AUTO_STOP){ stopTimer(); return; }
    paintTimer();
  }, 250);
  paintTimer();
}
const ICON_STOP = '<rect x="7" y="7" width="10" height="10" rx="1.5"/>';
function paintTimer(){
  bgPaint();
  let pill = $('#timerPill');
  if (!T.running){ if (pill) pill.remove(); }
  else {
    if (!pill){
      pill = el('div','timer-pill'); pill.id = 'timerPill'; pill.setAttribute('role','group'); pill.setAttribute('aria-label','Minuteur');
      const open = el('button','tp-open'); open.type = 'button'; open.onclick = () => isOver() ? stopTimer() : openTimer();
      const stop = el('button','tp-stop'); stop.type = 'button'; stop.innerHTML = svgI(ICON_STOP); stop.append(el('span', null, 'Arrêter')); stop.onclick = stopTimer;
      stop.setAttribute('aria-label','Arrêter le minuteur');
      pill.append(open, stop); document.body.append(pill);
    }
    const left = timerLeft(), over = isOver();
    pill.classList.toggle('over', over);
    const open = pill.querySelector('.tp-open');
    open.innerHTML = svgI(ICON.timer);
    const tx = el('span','tp-txt'); tx.append(el('b', null, fmtClock(left)), el('small', null, over ? 'Repos terminé' : T.pausedLeft != null ? 'En pause' : T.mode === 'down' ? 'Repos' : 'Chrono'));
    open.append(tx);
    open.setAttribute('aria-label', over ? 'Repos terminé, toucher pour arrêter' : 'Minuteur ' + fmtClock(left) + ', ouvrir les réglages');
  }
  const big = $('#tBig');
  if (big){
    const left = T.running ? timerLeft() : 0, over = isOver();
    const frac = !T.running ? 0 : T.mode === 'down' ? Math.max(0, left) / (T.total || 1) : (left % 60) / 60;
    big.innerHTML = ringSVG(over ? 1 : frac, 210, 4, over ? 'var(--crit)' : 'var(--accent)') + `<div class="in"><b>${T.running ? fmtClock(left) : '0:00'}</b><span>${T.running ? (T.pausedLeft != null ? 'En pause' : T.mode === 'down' ? (over ? 'Repos terminé' : 'Repos') : 'Chrono') : 'Prêt'}</span></div>`;
    const ctl = $('#tMain');
    if (ctl){
      const key = !T.running ? 'idle' : over ? 'over' : T.pausedLeft != null ? 'paused' : 'run';
      if (ctl.dataset.k !== key){
        ctl.dataset.k = key; ctl.innerHTML = '';
        const mk = (cls, txt, fn, icon) => { const b = el('button', cls); b.type = 'button'; if (icon) b.innerHTML = svgI(icon); b.append(txt); b.onclick = fn; ctl.append(b); return b; };
        if (key === 'idle'){ mk('btn big', 'Lancer ' + fmtDur(settings.restMus), () => startTimer(settings.restMus, 'Repos ' + fmtDur(settings.restMus)), ICON.play); }
        else if (key === 'over'){ mk('btn big stop', 'Arrêter', stopTimer, ICON_STOP); mk('btn ghost big', 'Relancer ' + fmtDur(T.last), restartTimer); }
        else { mk('btn big stop', 'Arrêter', stopTimer, ICON_STOP); mk('btn ghost big', key === 'paused' ? 'Reprendre' : 'Pause', togglePause); }
      }
    }
    const lb = $('#tLabel'); if (lb) lb.textContent = T.running ? T.label : 'Choisis une durée';
  }
}
function openTimer(){
  const { box, close } = sheet('Minuteur', null);
  const lb = el('h2'); lb.id = 'tLabel'; lb.style.cssText = 'font-size:20px;margin:4px 0 0'; box.append(lb);
  const c = el('div','tclock'); const ring = el('div','ring'); ring.id = 'tBig'; c.append(ring); box.append(c);
  const main = el('div','tmain'); main.id = 'tMain'; box.append(main);
  const pr = el('div','presets'); pr.style.marginTop = '14px';
  [30, 45, 60, 90, 120, 180].forEach(s => { const b = el('button','btn ghost sm' + (s === settings.restMus ? ' pick' : ''), fmtDur(s)); b.type = 'button'; b.onclick = () => startTimer(s, 'Repos ' + fmtDur(s)); pr.append(b); });
  box.append(pr);
  const row = el('div','presets'); row.style.marginTop = '8px';
  const plus = el('button','btn ghost sm','+15 s'); plus.type = 'button'; plus.onclick = () => addTime(15);
  const ch = el('button','btn ghost sm','Chrono (tenue)'); ch.type = 'button'; ch.onclick = startChrono;
  row.append(plus, ch); box.append(row);
  const opts = el('div','tset');
  const segRow = (title, sub, choices, key, after) => {
    const row = el('div','row'); const d = el('div'); d.append(el('div','t', title)); if (sub){ const m = el('div','m', sub); d.append(m); }
    const sg = el('div','seg'); sg.setAttribute('role','group'); sg.setAttribute('aria-label', title);
    choices.forEach(([v, l]) => { const b = el('button', null, l); b.type = 'button'; b.setAttribute('aria-pressed', String(settings[key] === v));
      b.onclick = () => { settings[key] = v; saveSettings(); [...sg.children].forEach(x => x.setAttribute('aria-pressed', String(x === b))); if (after) after(v); }; sg.append(b); });
    row.append(d, sg); return row;
  };
  const sigRow = segRow('Signal de fin', 'Joué à la fin du repos, avec un flash de l’écran.', [['both','Son + vibreur'],['vibrate','Vibreur seul'],['sound','Son seul'],['none','Aucun']], 'signal',
    v => { if (v === 'vibrate' || v === 'both') testVib(); });
  opts.append(sigRow);
  const vt = el('div','vibtest');
  const tb = el('button','btn ghost sm','Tester le vibreur'); tb.type = 'button'; tb.onclick = () => testVib();
  const res = el('p','vres'); vt.append(tb, res); opts.append(vt);
  function testVib(){
    const ok = vibrate([300, 120, 300]);
    res.className = 'vres ' + (ok || !canVibrate ? '' : 'bad');
    res.textContent = !canVibrate
      ? 'Safari sur iPhone ne donne pas accès au vibreur. L’app tente un retour haptique (iOS 18 et plus, mode silencieux désactivé). Si rien ne vibre, choisis « Son seul » : le flash de l’écran reste actif.'
      : ok ? 'Le navigateur a accepté la demande. Si le téléphone n’a pas vibré, vérifie que les vibrations sont activées dans les réglages du téléphone (mode Ne pas déranger, économie d’énergie).'
           : 'Le vibreur est bloqué ici : le navigateur refuse de faire vibrer une page affichée à l’intérieur de claude.ai. Utilise « Son seul », ou la version installée de l’app, où le vibreur fonctionne sur Android.';
  }
  if (vibState === 'blocked'){ res.className = 'vres bad'; res.textContent = 'La dernière vibration a été refusée par le navigateur. Touche « Tester le vibreur » pour en savoir plus.'; }
  opts.append(segRow('Repos en musculation', 'Durée lancée par le bouton Repos des exercices de musculation.', [[60,'1:00'],[90,'1:30'],[120,'2:00']], 'restMus',
    () => { [...pr.children].forEach(b => b.classList.toggle('pick', b.textContent === fmtDur(settings.restMus))); const m = $('#tMain'); if (m) m.dataset.k = ''; paintTimer(); if (tab === 'sess') renderSess(); }));
  if (canLockScreen) opts.append(segRow('Écran verrouillé', 'Affiche le temps restant sur l’écran verrouillé et fait vibrer à la fin, même téléphone verrouillé. Met en pause la musique d’une autre app pendant le minuteur.',
    [[true,'Afficher'],[false,'Non']], 'lockScreen', v => { if (v){ askNotify(); if (T.running) bgStart(); } else bgStop(); }));
  opts.append(segRow('Repos automatique', 'Lance le minuteur dès qu’un exercice est coché.', [[true,'Oui'],[false,'Non']], 'autoRest'));
  const note = el('p','vres');
  note.textContent = settings.lockScreen && canLockScreen
    ? (canNotify && Notification.permission === 'denied' ? 'Notifications bloquées : téléphone verrouillé, la fin du repos ne vibrera pas. Réactive-les dans les réglages du site (cadenas dans la barre d’adresse) ou de l’app.' : 'Pour vibrer téléphone verrouillé, l’app envoie une notification : accepte-la quand Chrome la demande.')
    : 'Garde l’écran allumé pendant le repos : un téléphone verrouillé met la page en pause et aucun signal ne part.';
  opts.append(note);
  box.append(opts);
  const foot = el('div','sheet-foot'); const cl = el('button','btn ghost','Fermer'); cl.type = 'button'; cl.onclick = close; foot.append(cl); box.append(foot);
  paintTimer();
}
