"use strict";
/* ================= données ================= */
const CAT = CATALOG;
const PROGS = CAT.programs, EXOS = CAT.exercises, REGLES = CAT.regles || [];
const PBY = Object.fromEntries(PROGS.map(p => [p.id, p]));
const EBY = Object.fromEntries(EXOS.map(e => [e.id, e]));
const CAT_ORDER = ['Rééducation','Mobilité','Proprioception','Musculation'];
const CAT_CLS = { 'Mobilité':'c-mob', 'Rééducation':'c-reh', 'Musculation':'c-mus', 'Proprioception':'c-pro' };
const CAT_VAR = { 'Mobilité':'--cat-mob', 'Rééducation':'--cat-reh', 'Musculation':'--cat-mus', 'Proprioception':'--cat-pro' };
const catRank = c => { const i = CAT_ORDER.indexOf(c); return i < 0 ? 98 : i; };
function progRank(id){ const p = PBY[id]; return p ? [catRank(p.cat), PROGS.indexOf(p)] : [99, 99]; }
function bySeq(ga, gb){ const a = progRank(ga), b = progRank(gb); return a[0] - b[0] || a[1] - b[1]; }
const sortSlots = sl => sl.slice().sort((x, y) => bySeq(x.prog, y.prog));
const allCats = () => { const pr = [...new Set(PROGS.map(p => p.cat))]; return CAT_ORDER.filter(c => pr.includes(c)).concat(pr.filter(c => !CAT_ORDER.includes(c))); };
const exCount = pid => EXOS.filter(e => e.prog === pid).length;
const DAYS = [['mon','Lundi'],['tue','Mardi'],['wed','Mercredi'],['thu','Jeudi'],['fri','Vendredi'],['sat','Samedi'],['sun','Dimanche']];

/* ================= utilitaires ================= */
const $ = s => document.querySelector(s);
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c; if (txt != null) n.textContent = txt; return n; };
const svgI = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  sess:'<path d="M3 12h3M18 12h3M6 8v8M18 8v8M9 10v4M15 10v4M9 12h6"/>',
  plan:'<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  lib:'<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10v16H5.5A1.5 1.5 0 0 1 4 18.5zM14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14z"/>',
  hist:'<path d="M4 20V11M10 20V5M16 20v-6M22 20H2"/>',
  rules:'<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chev:'<path d="M6 9l6 6 6-6"/>',
  warn:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.1"/>',
  play:'<path d="M7 5l12 7-12 7z"/>',
  timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 2h4"/>',
  ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  left:'<path d="M15 6l-6 6 6 6"/>', right:'<path d="M9 6l6 6-6 6"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  star:'<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z"/>',
};
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseISO = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const dayKey = d => DAYS[(d.getDay()+6)%7][0];
const fmtLong = d => d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
const fmtShort = s => parseISO(s).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'});
const weekLbl = d => 'Semaine ' + Number(isoWeek(d).slice(-2));
const cap1 = s => s.replace(/^./, c => c.toUpperCase());
function isoWeek(d){ const t = new Date(d.getFullYear(),d.getMonth(),d.getDate());
  t.setDate(t.getDate()+3-((t.getDay()+6)%7)); const w1 = new Date(t.getFullYear(),0,4);
  return t.getFullYear()+'-S'+String(1+Math.round(((t-w1)/86400000-3+((w1.getDay()+6)%7))/7)).padStart(2,'0'); }
function weekStart(d){ const t = new Date(d.getFullYear(),d.getMonth(),d.getDate()); t.setDate(t.getDate()-((t.getDay()+6)%7)); return t; }
const thaw = o => (o == null ? null : JSON.parse(JSON.stringify(o)));
const lsGet = k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch(e){ return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } };
const hasVal = s => !!(s && (s.r || s.c || s.t));
function toast(msg){ const t = el('div','toast',msg); document.body.append(t); setTimeout(() => t.remove(), 2600); }

/* ================= thèmes ================= */
const THEMES = [
  { id:'auto',       nom:'Automatique', m:'Porcelaine le jour, Graphite la nuit, selon l’appareil', sw:['#F4F5F3','#18191B'] },
  { id:'porcelaine', nom:'Porcelaine',  m:'Clair, gris froid, accent ardoise', sw:['#FFFFFF','#2E4A62'] },
  { id:'sable',      nom:'Sable',       m:'Clair, gris chaud, accent olive', sw:['#FBFAF7','#55603F'] },
  { id:'encre',      nom:'Encre',       m:'Noir et blanc, contraste maximal', sw:['#FFFFFF','#0A0A0A'] },
  { id:'graphite',   nom:'Graphite',    m:'Sombre neutre, accent bleu acier', sw:['#18191B','#AFC0D2'] },
  { id:'nuit',       nom:'Nuit',        m:'Bleu nuit, accent or pâle', sw:['#121925','#D2BC88'] },
  { id:'foret',      nom:'Forêt',       m:'Vert très sombre, accent sauge', sw:['#141B17','#A8C2AE'] },
];
/* `data-theme` appartient au lecteur claude.ai : le choix de l'utilisateur passe par `data-skin`. */
function currentTheme(){ let t = null; try { t = localStorage.getItem('pds_theme') || localStorage.getItem('cr_theme'); } catch(e){}
  t = ({ light:'porcelaine', dark:'graphite', clair:'porcelaine', sombre:'graphite', bleu:'nuit', rouge:'sable', retro:'graphite' })[t] || t; return THEMES.some(x => x.id === t) ? t : 'auto'; }
function applyTheme(id){
  if (id === 'auto') document.documentElement.removeAttribute('data-skin');
  else document.documentElement.setAttribute('data-skin', id);
  try { localStorage.setItem('pds_theme', id); } catch(e){}
}
applyTheme(currentTheme());

/* ================= stockage ================= */
/* Dans claude.ai : base partagée (téléphone et ordinateur voient les mêmes données).
   Ouvert hors de claude.ai : stockage local du navigateur. */
const store = {
  db:null, mode:'pending', pending:0,
  async init(){
    let db = null;
    try { if (window.claude && typeof window.claude.use === 'function') db = await window.claude.use('db'); } catch(e){ db = null; }
    this.db = db; this.mode = db ? 'cloud' : 'local'; syncUI();
  },
  async getPlanning(){
    if (this.db){ try { const s = await this.db.doc('config/planning').get(); return s.exists ? (thaw(s.data()) || {}).days || null : null; } catch(e){ return null; } }
    const v = lsGet('pds_planning'); return v && v.days || null;
  },
  async listSessions(){
    if (this.db){
      try { const snap = await this.db.collection('sessions').orderBy('date','desc').limit(1000).get();
        return snap.docs.map(d => thaw(d.data())).filter(s => s && s.id && s.date); }
      catch(e){ this.mode = 'err'; syncUI(); return null; }
    }
    return Object.values(lsGet('pds_sessions') || {});
  },
  q: Promise.resolve(),
  write(path, body){
    if (!this.db){
      if (path === 'config/planning') lsSet('pds_planning', body);
      else { const all = lsGet('pds_sessions') || {}; all[body.id] = body; lsSet('pds_sessions', all); }
      return Promise.resolve(true);
    }
    const copy = thaw(body);
    this.pending++; syncUI();
    this.q = this.q.then(() => this.db.doc(path).set(copy)).then(() => { this.pending--; if (this.mode === 'err') this.mode = 'cloud'; syncUI(); return true; },
      e => { this.pending--; this.mode = 'err'; syncUI(e); return false; });
    return this.q;
  },
};
function syncUI(e){
  const s = store.pending ? 'busy' : store.mode;
  const txt = { pending:'Connexion…', cloud:'Synchronisé', busy:'Enregistrement…', local:'Sur cet appareil', err:(e && e.code === 'invalid_argument') ? 'Lecture seule' : 'Non enregistré' }[s];
  document.querySelectorAll('.sync').forEach(n => { n.dataset.s = s; n.querySelector('.syncTxt').textContent = txt; });
  document.querySelectorAll('[data-save-state]').forEach(n => { n.textContent = s === 'busy' ? 'Enregistrement…' : s === 'err' ? txt : 'Enregistré'; });
}

/* ================= état ================= */
const DEFAULT_PLANNING = {
  mon:{progs:[{prog:'reeduc-e1',sem:null},{prog:'mob-hanches',sem:1}]},
  tue:{progs:[{prog:'reeduc-e1',sem:null},{prog:'mob-chevilles',sem:1}]},
  wed:{progs:[{prog:'reeduc-e1',sem:null},{prog:'mob-colonne',sem:1}]},
  thu:{progs:[{prog:'reeduc-e1',sem:null},{prog:'mob-genoux',sem:1}]},
  fri:{progs:[{prog:'reeduc-e1',sem:null},{prog:'mob-epaules',sem:1}]},
  sat:{progs:[{prog:'mob-poignets',sem:1}]},
  sun:{progs:[]}
};
let planning = thaw(DEFAULT_PLANNING);
let sessions = [];
let session = null;
let viewDate = new Date();
let tab = 'sess';
let loaded = false;
let COLLAPSED = new Set(lsGet('pds_collapsed') || []);
const saveCollapsed = () => lsSet('pds_collapsed', [...COLLAPSED]);

/* ================= construction des séances ================= */
function prescOf(e){ if (e.rep == null && e.serie == null) return '–'; if (e.serie == null) return String(e.rep); return `${e.serie} × ${e.rep}`; }
function nSets(e){
  const s = Number(e.serie); if (Number.isFinite(s) && s > 0 && s <= 10) return s;
  const m = /^\s*(\d+)\s*[×x]/.exec(String(e.rep == null ? '' : e.rep));
  if (m){ const n = Number(m[1]); if (n > 0 && n <= 10) return n; }
  return 3;
}
/* Temps de repos conseillé, lu dans la consigne de l'exercice puis dans celle du programme. */
function restOf(e){
  if ((PBY[e.prog] || {}).cat === 'Musculation') return settings.restMus;
  const pick = (txt, re) => { const m = re.exec(txt || ''); if (!m) return null; const v = Number(m[1]); return /min/.test(m[2]) ? v * 60 : v; };
  let r = pick(e.desc, /Repos\s*:\s*(\d+)(?:\s*[-–]\s*\d+)?\s*(s|min|')/i);
  if (r == null){ const p = PBY[e.prog]; (p && p.meta || []).some(t => (r = pick(t, /Repos\s*(\d+)(?:\s*[-–]\s*\d+)?\s*(s|min)/i)) != null); }
  if (r == null){ const p = PBY[e.prog]; r = p && p.cat === 'Mobilité' ? 30 : 60; }
  return r;
}
function lastValuesFor(exId, dateStr){
  const past = sessions.filter(s => s && s.done && s.date < dateStr && Array.isArray(s.items)).sort((a, b) => a.date < b.date ? 1 : -1);
  for (const s of past){ const it = s.items.find(i => i.exId === exId); if (it && Array.isArray(it.sets) && it.sets.some(hasVal)) return { date:s.date, sets:it.sets }; }
  return null;
}
function exosFor(slots){
  const out = [];
  sortSlots(slots).forEach(sl => {
    const p = PBY[sl.prog]; if (!p) return;
    let list = EXOS.filter(e => e.prog === sl.prog);
    if (p.cat === 'Mobilité' && sl.sem != null && sl.sem !== '') list = list.filter(e => String(e.sem) === String(sl.sem));
    out.push(...list);
  });
  return out;
}
function blankItem(e, dateStr){
  const prev = lastValuesFor(e.id, dateStr);
  const sets = Array.from({ length: prev ? Math.max(1, prev.sets.length) : nSets(e) }, (_, i) => {
    const p = prev && prev.sets[i]; return p ? { r:p.r || '', c:p.c || '', t:p.t || '' } : { r:'', c:'', t:'' }; });
  return { exId:e.id, sets, douleur:null, done:false, from: prev ? prev.date : null };
}
function newSession(date, slots){
  const d = iso(date);
  return { id:'s_'+d, date:d, week:isoWeek(date), slots:slots.map(s => ({...s})), items:exosFor(slots).map(e => blankItem(e, d)),
           douleur24:null, rpe:null, note:'', done:false, ts:Date.now() };
}
function syncItems(){
  const want = exosFor(session.slots), keep = new Map(session.items.map(i => [i.exId, i]));
  session.items = want.map(e => keep.get(e.id) || blankItem(e, session.date));
}
const isStored = s => sessions.some(x => x.id === s.id);
let saveTimer = null;
function saveSessionSoon(){
  document.querySelectorAll('[data-save-state]').forEach(n => n.textContent = 'Modifié…');
  clearTimeout(saveTimer);
  const s = session;
  saveTimer = setTimeout(() => commitSession(s), 650);
}
function commitSession(s){
  if (!s) return; s.ts = Date.now();
  const i = sessions.findIndex(x => x.id === s.id); if (i >= 0) sessions[i] = s; else sessions.push(s);
  store.write('sessions/' + s.id, s);
}
function flushSave(){ if (saveTimer){ clearTimeout(saveTimer); saveTimer = null; commitSession(session); } }
function loadSession(){
  flushSave();
  const id = 's_' + iso(viewDate);
  const stored = sessions.find(s => s.id === id);
  if (stored) session = stored;
  else session = newSession(viewDate, ((planning[dayKey(viewDate)] || {}).progs || []).map(s => ({...s})));
  if (tab === 'sess') renderSess();
}

/* ================= navigation ================= */
const TABS = [['sess','Séance'],['plan','Planning'],['lib','Bibliothèque'],['hist','Historique'],['rules','Règles']];
function buildNav(){
  const side = $('#sideNav'), bot = $('#tabNav');
  TABS.forEach(([k, l], i) => {
    const a = el('button','navb'); a.type = 'button'; a.dataset.tab = k; a.setAttribute('aria-selected','false');
    a.innerHTML = svgI(ICON[k]); a.append(el('span', null, l), el('span','k', String(i+1))); a.onclick = () => go(k); side.append(a);
    const b = el('button'); b.type = 'button'; b.dataset.tab = k; b.setAttribute('aria-selected','false');
    b.innerHTML = svgI(ICON[k]); b.append(el('span', null, l)); b.onclick = () => go(k); bot.append(b);
  });
}
const RENDER = { sess:() => renderSess(), plan:() => renderPlan(), lib:() => renderLib(), hist:() => renderHist(), rules:() => renderRules() };
function go(t, keepScroll){
  if (!RENDER[t]) t = 'sess';
  if (tab === 'sess' && t !== 'sess') flushSave();
  tab = t;
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  TABS.forEach(([k]) => { $('#p-'+k).hidden = k !== t; });
  RENDER[t]();
  lsSet('pds_tab', t);
  if (!keepScroll) window.scrollTo({ top:0, behavior:'instant' });
}
document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select') || e.metaKey || e.ctrlKey || e.altKey) return;
  const i = Number(e.key); if (i >= 1 && i <= TABS.length && !document.querySelector('.sheet')) go(TABS[i-1][0]);
  if (e.key === 'Escape'){ const s = document.querySelectorAll('.sheet'); if (s.length) s[s.length-1].remove(); }
});

/* ================= composants ================= */
function catChip(p, extra){
  const c = el('span','chip ' + (CAT_CLS[p.cat] || 'c-pro')); c.append(el('span','dot'), document.createTextNode(p.label + (extra || ''))); return c;
}
const slotLabel = sl => (sl.sem != null && sl.sem !== '' ? ' · S' + sl.sem : '');
function painColor(v){ return v == null ? '' : v <= 3 ? 'var(--ok)' : v <= 5 ? 'var(--warn)' : 'var(--crit)'; }
function paintPain(row, val, neutral){
  [...row.children].forEach((b, i) => { const on = val === i; b.setAttribute('aria-pressed', String(on)); b.style.background = on ? (neutral ? 'var(--accent)' : painColor(i)) : ''; });
}
function painScale(get, set, opts){
  opts = opts || {};
  const row = el('div','pain' + (opts.big ? ' big' : ''));
  for (let i = 0; i <= 10; i++){
    const b = el('button', null, String(i)); b.type = 'button';
    b.setAttribute('aria-label', (opts.label || 'Douleur') + ' ' + i + ' sur 10');
    b.onclick = () => { set(get() === i ? null : i); paintPain(row, get(), opts.neutral); if (opts.after) opts.after(); };
    row.append(b);
  }
  paintPain(row, get(), opts.neutral);
  return row;
}
function ringSVG(frac, size, stroke, color){
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${stroke}"/>`
    + `<circle class="arc" cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color || 'var(--accent)'}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0, Math.min(1, frac)))}" style="transition:stroke-dashoffset .3s ease"/></svg>`;
}
function sheet(eyebrow, title){
  const ov = el('div','sheet'); const box = el('div','sheet-in'); box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
  if (eyebrow) box.append(el('div','eyebrow', eyebrow));
  if (title) box.append(el('h2', null, title));
  ov.append(box); ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.append(ov); return { ov, box, close:() => ov.remove() };
}

/* Sélecteur de programmes, partagé par la semaine type et l'ajustement d'une journée. */
function programPicker({ eyebrow, title, note, current, okLabel, onOk }){
  const cur = new Map((current || []).map(s => [s.prog, s]));
  const { box, close } = sheet(eyebrow, title);
  if (note){ const n = el('p', null, note); n.style.cssText = 'margin:-6px 0 14px;font-size:13px;color:var(--ink-3)'; box.append(n); }
  const inputs = [];
  allCats().forEach(cat => {
    const h = el('div','eyebrow', cat); h.style.margin = '6px 0 8px'; box.append(h);
    PROGS.filter(p => p.cat === cat).forEach(p => {
      const lab = el('label','opt');
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = cur.has(p.id); cb.id = 'pk_' + p.id;
      const b2 = el('div'); b2.style.minWidth = '0';
      b2.append(el('div','t', p.label));
      b2.append(el('div','m', exCount(p.id) + ' exercices' + (p.blocs && p.blocs.length ? ' · blocs A/B/C' : '')));
      let sel = null;
      if (p.sems && p.sems.length > 1){
        sel = el('select'); sel.id = 'pks_' + p.id; sel.setAttribute('aria-label','Semaine pour ' + p.label);
        const o0 = el('option', null, 'Toutes les semaines'); o0.value = ''; sel.append(o0);
        p.sems.forEach(s => { const o = el('option', null, 'Semaine ' + s); o.value = s; sel.append(o); });
        const ex = cur.get(p.id); if (ex && ex.sem != null) sel.value = String(ex.sem);
        sel.onclick = e => e.preventDefault();
        sel.onchange = () => { cb.checked = true; };
        b2.append(sel);
      }
      lab.append(cb, b2); box.append(lab); inputs.push({ p, cb, sel });
    });
  });
  const foot = el('div','sheet-foot');
  const cancel = el('button','btn ghost','Annuler'); cancel.type = 'button'; cancel.onclick = close;
  const ok = el('button','btn', okLabel || 'Enregistrer'); ok.type = 'button';
  ok.onclick = () => {
    const out = inputs.filter(x => x.cb.checked).map(x => ({ prog:x.p.id, sem: x.sel && x.sel.value !== '' ? Number(x.sel.value) : null }));
    close(); onOk(sortSlots(out));
  };
  foot.append(cancel, ok); box.append(foot);
}

/* ================= SÉANCE ================= */
function sessionStats(s){
  const items = s.items.filter(i => EBY[i.exId]);
  const done = items.filter(i => i.done).length;
  const series = items.reduce((a, i) => a + i.sets.filter(hasVal).length, 0);
  const pains = items.map(i => i.douleur).filter(v => v != null);
  return { total:items.length, done, series, maxPain: pains.length ? Math.max(...pains) : null };
}
function renderSess(){
  const r = $('#p-sess'); r.innerHTML = '';
  if (!session || !loaded){
    const c = el('div','card'); c.style.marginTop = '20px';
    const e = el('div','empty'); e.append(el('strong', null, 'Chargement de ta séance'));
    e.append(document.createTextNode('Récupération de tes données enregistrées.')); c.append(e); r.append(c); return;
  }
  const isToday = iso(viewDate) === iso(new Date());
  const ph = el('div','ph');
  const tt = el('div'); tt.append(el('span','eyebrow', isToday ? "Aujourd'hui · " + weekLbl(viewDate) : weekLbl(viewDate)));
  tt.append(el('h1', null, cap1(fmtLong(viewDate)))); ph.append(tt);
  const nav = el('div','tools daynav');
  const prev = el('button','btn ghost sm'); prev.type = 'button'; prev.innerHTML = svgI(ICON.left); prev.title = 'Jour précédent'; prev.setAttribute('aria-label','Jour précédent');
  prev.onclick = () => { viewDate.setDate(viewDate.getDate()-1); loadSession(); };
  const tdy = el('button','btn ghost sm',"Aujourd'hui"); tdy.type = 'button'; tdy.disabled = isToday;
  tdy.onclick = () => { viewDate = new Date(); loadSession(); };
  const next = el('button','btn ghost sm'); next.type = 'button'; next.innerHTML = svgI(ICON.right); next.title = 'Jour suivant'; next.setAttribute('aria-label','Jour suivant');
  next.onclick = () => { viewDate.setDate(viewDate.getDate()+1); loadSession(); };
  nav.append(prev, tdy, next); ph.append(nav); r.append(ph);

  // Version installée, encore vide : on propose de reprendre l'historique exporté depuis claude.ai.
  if (store.mode === 'local' && !sessions.length){
    const b = el('div','banner info'); b.style.cssText = 'margin-bottom:14px;border:1px solid var(--line);padding:12px 14px;align-items:center;flex-wrap:wrap';
    b.innerHTML = svgI(ICON.info);
    const t = el('span', null, 'Première ouverture sur cet appareil. Pour retrouver tes séances, exporte-les depuis l’app sur claude.ai puis importe le fichier ici.'); t.style.flex = '1 1 220px';
    const ib = el('button','btn sm','Importer une sauvegarde'); ib.type = 'button'; ib.onclick = importData;
    b.append(t, ib); r.append(b);
  }

  /* --- synthèse --- */
  const st = sessionStats(session);
  const hero = el('div','card hero');
  const ring = el('div','ring'); ring.id = 'heroRing';
  ring.innerHTML = ringSVG(st.total ? st.done / st.total : 0, 108, 3) + `<div class="in"><b>${st.done}</b><span>sur ${st.total}</span></div>`;
  const right = el('div'); right.style.minWidth = '0';
  const status = el('span', 'status ' + (session.done ? 'done' : st.total ? 'run' : 'rest'));
  if (session.done){ status.innerHTML = svgI(ICON.check); status.querySelector('svg').style.cssText = 'width:13px;height:13px'; }
  status.append(session.done ? 'Séance terminée' : st.total ? (st.done ? 'En cours' : 'À faire') : 'Repos');
  right.append(status);
  const facts = el('div','facts'); facts.style.marginTop = '10px'; facts.id = 'heroFacts';
  const fact = (k, v) => { const f = el('div','fact'); f.append(el('div','k',k), el('div','v',v)); return f; };
  facts.append(fact('Exercices', st.total), fact('Séries saisies', st.series), fact('Douleur max', st.maxPain == null ? '–' : st.maxPain + '/10'));
  right.append(facts);
  const progs = el('div','progs');
  if (!session.slots.length) progs.append(el('span','chip','Aucun programme'));
  sortSlots(session.slots).forEach(sl => { const p = PBY[sl.prog]; if (p) progs.append(catChip(p, slotLabel(sl))); });
  const acts = el('div','acts');
  const adj = el('button','btn ghost sm'); adj.type = 'button'; adj.innerHTML = svgI(ICON.edit); adj.append('Ajuster la journée');
  adj.onclick = () => programPicker({ eyebrow:'Séance du ' + fmtShort(session.date), title:'Ajuster la journée', note:'Ne modifie que cette journée. La semaine type reste inchangée.',
    current:session.slots, okLabel:'Appliquer', onOk:slots => { session.slots = slots; syncItems(); saveSessionSoon(); renderSess(); } });
  const tm = el('button','btn ghost sm'); tm.type = 'button'; tm.innerHTML = svgI(ICON.timer); tm.append('Minuteur'); tm.onclick = () => openTimer();
  acts.append(adj, tm);
  hero.append(ring, right, progs, acts);
  r.append(hero);
  if (st.total){
    // Intensité par muscle : nombre d'exercices qui le sollicitent (principal = 1, en soutien = ½).
    const W = {}, N = {};
    session.items.forEach(i => { const e = EBY[i.exId]; if (!e) return; const mu = musOf(e);
      mu.p.forEach(k => { W[k] = (W[k] || 0) + 1; N[k] = (N[k] || 0) + 1; }); mu.s.forEach(k => { W[k] = (W[k] || 0) + .5; N[k] = (N[k] || 0) + 1; }); });
    const wmax = Math.max(1, ...Object.values(W)), nw = {}; for (const k in W) nw[k] = W[k] / wmax;
    const mc = el('details','card muscard'); const pref = lsGet('pds_mus_open'); mc.open = pref == null ? true : pref;
    let ready = false; setTimeout(() => { ready = true; }, 300); mc.ontoggle = () => { if (ready) lsSet('pds_mus_open', mc.open); };
    const sm = el('summary'); sm.append(el('span', null, 'Muscles sollicités'), el('span','hint', Object.keys(W).length + ' groupes musculaires')); mc.append(sm);
    const body = el('div','mc-body'); const fig = el('div','mc-fig'); fig.innerHTML = bodyMap([], [], { weights:nw, aria:'Muscles sollicités par la séance' });
    const lst = el('div','mc-list');
    const ranked = Object.keys(W).sort((x, y) => W[y] - W[x]);
    const grp = (t, keys, c) => { if (!keys.length) return; const hh = el('div','lg-h'); hh.append(el('i', c), document.createTextNode(t)); const l = el('div','lg-l');
      keys.forEach(k => l.append(el('span','chip', musLabel(k) + ' · ' + N[k]))); lst.append(hh, l); };
    grp('Les plus travaillés', ranked.filter(k => nw[k] >= .5), 'p'); grp('Aussi sollicités', ranked.filter(k => nw[k] < .5), 's');
    const nt = el('p','vres', 'Le chiffre indique le nombre d’exercices de la séance qui sollicitent ce muscle.'); lst.append(nt);
    body.append(fig, lst); mc.append(body); r.append(mc);
  }

  if (session.done && session.douleur24 != null && session.douleur24 >= 4){
    const b = el('div','banner crit'); b.style.marginTop = '12px'; b.innerHTML = svgI(ICON.warn);
    b.append(el('span', null, 'Douleur encore élevée à 24-48 h : la charge était trop forte. Reviens au palier précédent, pas à zéro.')); r.append(b);
  }

  if (!st.total){
    const c = el('div','card'); c.style.marginTop = '14px';
    const e = el('div','empty'); e.append(el('strong', null, 'Journée de repos'));
    e.append(document.createTextNode('Rien de prévu dans ta semaine type. Ajuste la journée si tu veux quand même bouger.'));
    c.append(e); r.append(c);
  } else {
    const ordered = session.items.filter(i => EBY[i.exId]).sort((a, b) => bySeq(EBY[a.exId].prog, EBY[b.exId].prog));
    const groups = [];
    ordered.forEach(it => { const pid = EBY[it.exId].prog; let g = groups[groups.length-1]; if (!g || g.pid !== pid){ g = { pid, items:[] }; groups.push(g); } g.items.push(it); });
    let idx = 0;
    groups.forEach(g => {
      const p = PBY[g.pid] || { label:'Exercices retirés du programme', cat:'' };
      const wrap = el('div','grp');
      const h = el('div','grp-h');
      const btn = el('button','grp-btn'); btn.type = 'button';
      btn.innerHTML = `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON.chev}</svg>`;
      const tx = el('span'); const ct = el('span','cat', p.cat || ''); ct.style.color = CAT_VAR[p.cat] ? `var(${CAT_VAR[p.cat]})` : 'var(--ink-3)';
      tx.append(ct, el('h2', null, p.label)); btn.append(tx);
      const cnt = el('span','cnt'); cnt.dataset.progCount = g.pid;
      h.append(btn, cnt); wrap.append(h);
      const bar = el('div','bar'); bar.dataset.progBar = g.pid; bar.append(el('i')); wrap.append(bar);
      const body = el('div','card');
      if ((p.meta && p.meta.length) || (p.blocs && p.blocs.length)) body.append(consignes(p));
      g.items.forEach(it => body.append(exBlock(it, EBY[it.exId], idx++)));
      wrap.append(body);
      const paint = () => { const open = !COLLAPSED.has(g.pid); btn.setAttribute('aria-expanded', String(open)); body.hidden = !open; };
      btn.onclick = () => { if (COLLAPSED.has(g.pid)) COLLAPSED.delete(g.pid); else COLLAPSED.add(g.pid); saveCollapsed(); paint(); };
      paint(); r.append(wrap);
    });
    updateCounts();

    const fin = el('div','card bilan');
    const t = el('div'); t.append(el('div','eyebrow','Bilan de la séance')); const h3 = el('h3', null, 'Comment ça s’est passé ?'); h3.style.cssText = 'font-size:18px;font-stretch:108%;margin-top:4px'; t.append(h3); fin.append(t);
    const row2 = el('div','row2');
    const p24 = el('div'); p24.append(el('div','eyebrow','Douleur à 24 h (/10)'));
    const h24 = el('div','phint'); h24.hidden = true;
    const s24 = painScale(() => session.douleur24, v => { session.douleur24 = v; saveSessionSoon(); }, { big:true, label:'Douleur à 24 h', after:() => hint24() });
    s24.style.marginTop = '8px'; p24.append(s24, h24);
    const hint24 = () => { const v = session.douleur24; h24.hidden = v == null; h24.className = 'phint' + (v >= 4 ? ' crit' : '');
      h24.style.color = v != null && v <= 3 ? 'var(--ok)' : ''; h24.style.marginTop = '8px';
      h24.innerHTML = svgI(v >= 4 ? ICON.warn : ICON.info);
      h24.append(el('span', null, v == null ? '' : v <= 3 ? 'Revenue à la normale : charge bien dosée, tu peux progresser.' : 'Encore élevée : reviens au palier précédent, pas à zéro.')); };
    hint24();
    const rpe = el('div'); rpe.append(el('div','eyebrow','RPE de la séance (/10)'));
    const sr = painScale(() => session.rpe, v => { session.rpe = v; saveSessionSoon(); }, { big:true, neutral:true, label:'RPE' }); sr.style.marginTop = '8px'; rpe.append(sr);
    row2.append(p24, rpe); fin.append(row2);
    const ta = el('textarea','notes'); ta.id = 'sessNote'; ta.placeholder = 'Ressenti, adaptation, matériel…'; ta.value = session.note || '';
    ta.setAttribute('aria-label','Notes de séance'); ta.oninput = () => { session.note = ta.value; saveSessionSoon(); };
    fin.append(ta);
    const bar = el('div','save-bar');
    const done = el('button', session.done ? 'btn ghost' : 'btn'); done.type = 'button';
    done.innerHTML = svgI(ICON.check); done.append(session.done ? 'Séance terminée · rouvrir' : 'Terminer la séance');
    done.onclick = () => { session.done = !session.done; flushSave(); commitSession(session); renderSess(); if (session.done) toast('Séance enregistrée dans l’historique'); };
    const ss = el('span','save-state'); ss.dataset.saveState = ''; ss.textContent = isStored(session) ? 'Enregistré' : 'Pas encore modifiée';
    bar.append(done, ss); fin.append(bar); r.append(fin);
  }

  if (REGLES.length){
    const d = el('details'); d.className = 'card'; d.style.cssText = 'margin-top:14px;padding:4px 16px';
    const sm = el('summary', null, 'Règles du plan · ' + REGLES.length); sm.style.cssText = 'cursor:pointer;padding:10px 0;font-size:13.5px;font-weight:600;color:var(--ink-2)';
    d.append(sm);
    const ul = el('ul'); ul.style.cssText = 'margin:0 0 12px;padding-left:18px;display:grid;gap:7px';
    REGLES.forEach(x => { const li = el('li'); li.style.cssText = 'font-size:13px;color:var(--ink-2)'; const b = el('b', null, x.r); b.style.color = 'var(--ink)'; li.append(b, document.createTextNode(' : ' + x.d)); ul.append(li); });
    d.append(ul); r.append(d);
  }
}
function consignes(p){
  const box = el('div','consignes');
  const d = el('details'); const pref = lsGet('pds_cons_' + p.id + '_closed'); d.open = pref == null ? window.innerWidth >= 640 : !pref;
  // L'ouverture initiale déclenche aussi `toggle` : on n'enregistre que les gestes de l'utilisateur.
  let ready = false; setTimeout(() => { ready = true; }, 300);
  d.ontoggle = () => { if (ready) lsSet('pds_cons_' + p.id + '_closed', !d.open); };
  d.append(el('summary', null, 'Consignes du programme'));
  const body = el('div','body');
  (p.meta || []).forEach(txt => {
    const warn = /^À ÉVITER|ATTENTION/i.test(txt);
    const b = el('div','banner ' + (warn ? 'warn' : 'info')); b.innerHTML = svgI(warn ? ICON.warn : ICON.info); b.append(el('span', null, txt)); body.append(b);
  });
  if (p.blocs && p.blocs.length) body.append(blocList(p.blocs));
  d.append(body); box.append(d); return box;
}
function blocList(blocs){
  const g = el('div','blocs');
  blocs.forEach(bl => { const row = el('div','blocrow');
    row.append(el('span','bl', bl.bloc), el('span','num', bl.sems || ''), el('b', null, bl.presc || ''));
    const o = el('span','o', bl.obj || ''); row.append(o); g.append(row); });
  return g;
}
function updateCounts(){
  document.querySelectorAll('[data-prog-count]').forEach(n => {
    const pid = n.dataset.progCount; const its = session.items.filter(i => EBY[i.exId] && EBY[i.exId].prog === pid);
    const d = its.filter(i => i.done).length; n.textContent = d + ' / ' + its.length; n.classList.toggle('all', d === its.length && d > 0);
    const b = document.querySelector(`[data-prog-bar="${pid}"] i`); if (b) b.style.width = (its.length ? d / its.length * 100 : 0) + '%';
  });
  const st = sessionStats(session);
  const ring = $('#heroRing'); if (ring){ ring.innerHTML = ringSVG(st.total ? st.done / st.total : 0, 108, 3) + `<div class="in"><b>${st.done}</b><span>sur ${st.total}</span></div>`; }
  const f = $('#heroFacts'); if (f){ const v = f.querySelectorAll('.v'); v[1].textContent = st.series; v[2].textContent = st.maxPain == null ? '–' : st.maxPain + '/10'; }
}

/* Les consignes arrivent en une ligne (« explication · Tempo : … · Repos : … »).
   On les range par rubrique pour lire d'un coup d'œil le tempo, puis le geste. */
function instrOf(e){
  let tempo = null, repos = null, alt = null, src = null; const expl = [], vig = [];
  String(e.desc || '').split(/\s+·\s+/).filter(Boolean).forEach(sg => {
    let m;
    if ((m = /^Tempo\s*:\s*(.+)$/i.exec(sg))) tempo = m[1];
    else if ((m = /^Repos\s*:\s*(.+)$/i.exec(sg))) repos = m[1];
    else if ((m = /^Alternative[^:]*:\s*(.+)$/i.exec(sg))) alt = m[1];
    else {
      const t = sg.replace(/^Adapté de «\s*([^»]+?)\s*»\.?\s*/i, (_, x) => { src = x; return ''; });
      t.split(/(?<=[.!])\s+(?=[A-ZÀ-ÖØ-Þ«])/).forEach(x => { x = x.trim(); if (x) (/\b(PAS|JAMAIS|STOP|SEULEMENT|ATTENTION)\b/.test(x) ? vig : expl).push(x); });
    }
  });
  if (!tempo){ const m = /tempo\s+(\d+-\d+-\d+)/i.exec(e.nom || ''); if (m) tempo = m[1] + ' (descente, pause, montée en secondes)'; }
  const rows = [];
  const mu = musOf(e);
  if (mu.p.length) rows.push(['Muscles', mu.p.map(musLabel).join(', ') + (mu.s.length ? ' · en soutien : ' + mu.s.map(musLabel).join(', ').toLowerCase() : ''), 'strong']);
  if (tempo) rows.push(['Tempo', cap1(tempo), 'strong']);
  if (expl.length) rows.push(['Explication', expl.join(' ')]);
  if (vig.length) rows.push(['Vigilance', vig.join(' '), 'vig']);
  const fmtRep = x => x.replace(/(\d)s\b/g, '$1 s');
  if ((PBY[e.prog] || {}).cat === 'Musculation') rows.push(['Repos', fmtDur(settings.restMus) + ' au minuteur' + (repos ? ' · plan : ' + fmtRep(repos) : '')]);
  else if (repos) rows.push(['Repos', fmtRep(repos)]);
  if (alt) rows.push(['Alternative', cap1(alt.replace(/\.$/, ''))]);
  if (src) rows.push(['Origine', 'Adapté de « ' + src + ' »']);
  return rows;
}
function instrList(e){
  const rows = instrOf(e); if (!rows.length) return null;
  const dl = el('dl','instr');
  rows.forEach(([k, v, c]) => { dl.append(el('dt', c === 'vig' ? 'vig' : '', k), el('dd', c || '', v)); });
  return dl;
}
const numv = x => { const v = parseFloat(String(x == null ? '' : x).replace(',', '.')); return Number.isFinite(v) ? v : null; };
const fmtN = v => String(v).replace('.', ',');
/* Séances terminées où l'exercice a été renseigné, de la plus ancienne à la plus récente. */
function histOf(exId, beforeDate){
  return sessions.filter(x => x.done && Array.isArray(x.items) && (!beforeDate || x.date < beforeDate)).sort((a, b) => a.date < b.date ? -1 : 1)
    .map(x => { const it = x.items.find(i => i.exId === exId); return it && it.sets.some(hasVal) ? { date:x.date, sets:it.sets, douleur:it.douleur } : null; }).filter(Boolean);
}
/* Meilleures valeurs ; 1RM estimé par la formule d'Epley (charge × (1 + reps / 30)). */
function bestsOf(list){
  const b = { c:0, t:0, r:0, orm:0 };
  list.forEach(h => h.sets.forEach(x => { const c = numv(x.c), t = numv(x.t), r = numv(x.r);
    if (c) b.c = Math.max(b.c, c); if (t) b.t = Math.max(b.t, t); if (r) b.r = Math.max(b.r, r);
    if (c && r && r <= 30) b.orm = Math.max(b.orm, c * (1 + r / 30)); }));
  return b;
}
function isRecord(it, e, date){
  const prev = histOf(e.id, date); if (!prev.length) return false;
  const b = bestsOf(prev), cur = bestsOf([{ sets:it.sets }]);
  if (b.c) return cur.c > b.c;
  if (b.t) return cur.t > b.t;
  return b.r > 0 && cur.r > b.r;
}
const setTxt = x => { const out = []; if (x.r) out.push(x.r + (x.c ? ' × ' + x.c + ' kg' : ' reps')); else if (x.c) out.push(x.c + ' kg'); if (x.t) out.push(x.t + ' s'); return out.join(' · '); };
function openExercise(e){
  const p = PBY[e.prog] || {}, mu = musOf(e);
  const { box } = sheet(p.label || 'Exercice', e.nom); box.classList.add('exsheet');
  const meta = el('div','meta'); meta.append(el('span','presc', prescOf(e)));
  if (e.sem != null) meta.append(el('span', null, 'Semaine ' + e.sem));
  if (e.cible) meta.append(el('span', null, e.cible));
  if (e.url){ const a = el('a','vid'); a.href = e.url; a.target = '_blank'; a.rel = 'noopener'; a.innerHTML = svgI(ICON.play); a.append('Voir la vidéo'); meta.append(a); }
  box.append(meta);
  const fig = el('div','bigbody'); fig.innerHTML = bodyMap(mu.p, mu.s, { aria:'Muscles sollicités : ' + mu.p.map(musLabel).join(', ') }); box.append(fig);
  const leg = el('div','muslegend');
  [['Principaux', mu.p, 'p'], ['En soutien', mu.s, 's']].forEach(([t, list, c]) => { if (!list.length) return;
    const g = el('div'); const hh = el('div','lg-h'); hh.append(el('i', c), document.createTextNode(t)); g.append(hh);
    const l = el('div','lg-l'); list.forEach(k => l.append(el('span','chip', musLabel(k)))); g.append(l); leg.append(g); });
  box.append(leg);
  const ins = instrList(e); if (ins){ const hh = el('div','eyebrow','Consignes'); hh.style.marginTop = '22px'; box.append(hh, ins); }
  const hist = histOf(e.id), b = bestsOf(hist);
  const rh = el('div','eyebrow','Records'); rh.style.marginTop = '24px'; box.append(rh);
  const rec = el('div','recs');
  const rc = (k, v) => { const c = el('div','rec'); c.append(el('div','k', k), el('div','v', v)); rec.append(c); };
  rc('Séances', String(hist.length)); rc('Charge max', b.c ? fmtN(b.c) + ' kg' : '–'); rc('Tenue max', b.t ? fmtN(b.t) + ' s' : '–');
  rc(b.orm ? '1RM estimé' : 'Reps max', b.orm ? fmtN(Math.round(b.orm * 10) / 10) + ' kg' : b.r ? fmtN(b.r) : '–');
  box.append(rec);
  if (hist.length >= 2){
    const k = b.c ? 'c' : b.t ? 't' : 'r', unit = { c:' kg', t:' s', r:'' }[k];
    const card = chartCard('Progression · ' + { c:'charge', t:'tenue', r:'répétitions' }[k], 'Meilleure valeur de chaque séance.'); card.style.marginTop = '12px';
    const pts = hist.map(hh => ({ d:hh.date, v:Math.max(0, ...hh.sets.map(x => numv(x[k]) || 0)) })).filter(x => x.v > 0).slice(-15)
      .map(x => ({ l:fmtShort(x.d), s:fmtShort(x.d).slice(0,5), v:x.v }));
    if (pts.length >= 2){ lineChart(card, pts, { unit }); box.append(card); }
  }
  const hh = el('div','eyebrow','Historique'); hh.style.marginTop = '24px'; box.append(hh);
  if (!hist.length){ const n = el('p','vres','Pas encore de séance terminée avec cet exercice.'); n.style.marginTop = '8px'; box.append(n); }
  else { const l = el('div','exhist');
    hist.slice().reverse().slice(0, 10).forEach(x => { const row = el('div','eh'); row.append(el('div','d', fmtShort(x.date)));
      const v = el('div','s'); x.sets.filter(hasVal).forEach(st => v.append(el('span', null, setTxt(st)))); row.append(v); l.append(row); });
    box.append(l); }
  const foot = el('div','sheet-foot'); const cl = el('button','btn ghost','Fermer'); cl.type = 'button'; cl.onclick = () => box.parentNode.remove(); foot.append(cl); box.append(foot);
}
function exBlock(it, e, idx){
  const box = el('div','ex' + (it.done ? ' is-done' : ''));
  const h = el('div','ex-h'); const left = el('div','main');
  const mu = musOf(e);
  const th = el('button','thumb'); th.type = 'button'; th.innerHTML = bodyMap(mu.p, mu.s, { labels:false });
  th.setAttribute('aria-label', 'Fiche et muscles : ' + e.nom); th.onclick = () => openExercise(e);
  const nm = el('button','t tlink', e.nom); nm.type = 'button'; nm.onclick = () => openExercise(e); left.append(nm);
  const m = el('div','meta');
  m.append(el('span','presc', prescOf(e)));
  if (e.sem != null) m.append(el('span', null, 'Semaine ' + e.sem));
  if (e.cible) m.append(el('span', null, e.cible));
  if (e.groupe) m.append(el('span', null, e.groupe));
  if (e.seance && e.seance !== 'Toutes') m.append(el('span', null, 'Séance ' + e.seance));
  if (e.url){ const a = el('a','vid'); a.href = e.url; a.target = '_blank'; a.rel = 'noopener'; a.innerHTML = svgI(ICON.play); a.append('Vidéo'); m.append(a); }
  let carry = null;
  if (it.from){ carry = el('span','chip carry', 'repris du ' + fmtShort(it.from)); m.append(carry); }
  const dropCarry = () => { if (it.from){ it.from = null; if (carry){ carry.remove(); carry = null; } } };
  const pr = el('span','chip pr'); pr.innerHTML = svgI(ICON.star); pr.append('Record'); m.append(pr);
  const sDate = session.date; const checkPR = () => { pr.hidden = !isRecord(it, e, sDate); }; checkPR();
  left.append(m);
  const ins = instrList(e); if (ins) left.append(ins);
  const tick = el('button','tick'); tick.type = 'button'; tick.innerHTML = svgI(ICON.check);
  tick.setAttribute('aria-pressed', String(!!it.done)); tick.setAttribute('aria-label', 'Marquer fait : ' + e.nom); tick.title = 'Fait';
  tick.onclick = () => { it.done = !it.done; tick.setAttribute('aria-pressed', String(it.done)); box.classList.toggle('is-done', it.done); saveSessionSoon(); updateCounts();
    if (it.done && settings.autoRest) startTimer(restOf(e), e.nom); };
  h.append(th, left, tick); box.append(h);

  const sets = el('div','sets');
  function buildSets(){
    sets.innerHTML = '';
    const hd = el('div','setrow'); hd.append(el('div','sethead','#'), el('div','sethead','Reps'), el('div','sethead','Charge kg'), el('div','sethead','Tenue s'), el('div','sethead','')); sets.append(hd);
    it.sets.forEach((s, si) => {
      const row = el('div','setrow'); row.append(el('div','lbl', String(si+1)));
      ['r','c','t'].forEach(k => {
        const i2 = el('input'); i2.type = 'text'; i2.inputMode = 'decimal'; i2.autocomplete = 'off'; i2.value = s[k] || ''; i2.id = `set_${idx}_${si}_${k}`;
        i2.setAttribute('aria-label', `Série ${si+1} ${k==='r'?'répétitions':k==='c'?'charge':'tenue'} - ${e.nom}`);
        i2.oninput = () => { s[k] = i2.value; dropCarry(); saveSessionSoon(); updateCounts(); checkPR(); };
        row.append(i2);
      });
      const rm = el('button','rm','×'); rm.type = 'button'; rm.title = 'Retirer la série'; rm.setAttribute('aria-label','Retirer la série ' + (si+1));
      rm.onclick = () => { if (it.sets.length <= 1) return; it.sets.splice(si, 1); saveSessionSoon(); buildSets(); updateCounts(); };
      row.append(rm); sets.append(row);
    });
  }
  buildSets(); box.append(sets);

  const foot = el('div','ex-foot');
  const add = el('button','btn ghost sm','+ Série'); add.type = 'button';
  add.onclick = () => { const last = it.sets[it.sets.length-1]; it.sets.push(last ? { ...last } : { r:'', c:'', t:'' }); saveSessionSoon(); buildSets(); updateCounts();
    const rows = sets.querySelectorAll('.setrow'); const l = rows[rows.length-1]; if (l) l.querySelector('input').focus(); };
  const wipe = el('button','btn ghost sm','Vider'); wipe.type = 'button'; wipe.title = 'Effacer les valeurs de cet exercice';
  wipe.onclick = () => { it.sets.forEach(s => { s.r = ''; s.c = ''; s.t = ''; }); dropCarry(); saveSessionSoon(); buildSets(); updateCounts(); };
  const rs = restOf(e);
  const rest = el('button','btn ghost sm'); rest.type = 'button'; rest.innerHTML = svgI(ICON.timer); rest.append('Repos ' + fmtDur(rs));
  rest.title = 'Lancer le minuteur de repos'; rest.onclick = () => startTimer(rs, e.nom);
  foot.append(add, wipe, rest, el('span','sp'));
  const pw = el('div','painw'); pw.append(el('span','eyebrow','Douleur'));
  const hint = el('div','phint'); hint.hidden = true;
  const showHint = () => { const v = it.douleur; hint.hidden = !(v != null && v > 3); hint.className = 'phint' + (v >= 6 ? ' crit' : '');
    hint.innerHTML = svgI(ICON.warn); hint.append(el('span', null, 'Au-delà de 3/10 pendant l’exercice : allège la charge ou l’amplitude.')); };
  pw.append(painScale(() => it.douleur, v => { it.douleur = v; saveSessionSoon(); updateCounts(); }, { label:'Douleur ' + e.nom, after:showHint }));
  foot.append(pw, hint); showHint();
  box.append(foot);
  return box;
}

/* ================= carte musculaire ================= */
/* Silhouette stylisée vue de face et de dos (repère 200 × 400 par vue).
   Chaque muscle est décrit pour le côté gauche puis reflété. */
const BODY = {
  base:{
    front:['M100 12C87 12 79 22 79 35C79 48 88 57 100 57Z', 'M40 214C33 216 31 230 35 240C38 246 46 245 48 238C50 230 49 220 46 214Z',
           'M70 290C70 284 90 284 91 290C92 298 90 304 81 305C72 305 69 298 70 290Z', 'M68 378C66 386 70 392 80 392C88 392 90 386 87 378Z'],
    back:['M100 12C87 12 79 22 79 35C79 48 88 57 100 57Z', 'M40 214C33 216 31 230 35 240C38 246 46 245 48 238C50 230 49 220 46 214Z',
          'M70 292C70 286 90 286 91 292C92 300 90 304 81 305C72 305 69 299 70 292Z', 'M70 368C68 378 70 390 80 390C88 390 90 380 87 368Z'],
  },
  front:{
    neck:['M90 54L100 56L100 68L92 66Z'],
    traps:['M90 58C86 64 80 69 72 72L92 74L92 66Z'],
    delts_front:['M72 74C61 73 51 81 48 98L57 101C59 91 64 85 72 82Z'],
    chest:['M98 78L98 118C86 124 70 120 61 108C59 96 63 87 75 80Z'],
    biceps:['M49 104C45 117 45 132 49 147L58 147C60 132 61 117 59 104Z'],
    forearms:['M48 151C40 168 36 188 35 210L46 212C50 192 56 171 59 151Z'],
    abs:['M98 123L86 125C84 145 84 166 88 186L98 189Z'],
    obliques:['M83 125L65 115C64 138 68 160 75 178L86 186C82 166 82 145 83 125Z'],
    hipflex:['M98 193L88 190L76 182C78 195 84 205 93 212L98 214Z'],
    quads:['M74 194C65 219 64 251 68 284L91 285C94 258 94 231 92 215C85 209 79 202 74 194Z'],
    adductors:['M94 216C96 232 96 249 93 266L98 260L98 217Z'],
    tibialis:['M73 308C69 330 69 352 73 374L80 374C80 352 81 330 81 308Z'],
    calves:['M84 309C91 325 91 346 86 368L82 368C83 347 83 327 83 309Z'],
  },
  back:{
    neck:['M90 54L100 56L100 64L92 63Z'],
    traps:['M100 58L91 60C86 67 79 71 70 74C82 80 92 92 100 118Z'],
    delts_rear:['M69 75C58 74 50 82 47 98L57 101C59 91 63 85 71 81Z'],
    upperback:['M72 81C66 89 64 99 66 110C77 107 87 106 96 108C92 96 84 87 72 81Z'],
    lats:['M66 113C66 133 72 151 84 168L96 158C96 140 96 125 96 111C86 109 76 110 66 113Z'],
    lowerback:['M100 138L97 140L97 160L86 172C87 180 92 186 100 189Z'],
    triceps:['M49 104C45 117 45 132 49 147L58 147C60 132 61 117 59 104Z'],
    forearms:['M48 151C40 168 36 188 35 210L46 212C50 192 56 171 59 151Z'],
    abductors:['M85 184C75 181 68 187 66 199C71 194 77 191 86 190Z'],
    glutes:['M98 193L87 191C74 193 67 204 68 219C74 229 88 231 98 227Z'],
    hamstrings:['M70 224C66 248 68 269 72 290L91 290C94 268 94 247 94 230C86 233 76 231 70 224Z'],
    adductors:['M95 230C96 245 96 256 94 267L98 262L98 230Z'],
    calves:['M72 307C66 327 68 347 76 366L87 366C93 347 93 327 86 307Z'],
  },
};
/* p : muscles principaux, s : secondaires. Avec `weights` (muscle → 0..1),
   la carte devient une carte de fréquence : plus c'est foncé, plus c'est travaillé. */
function bodyMap(p, s, opts){
  opts = opts || {};
  const P = new Set(p || []), S = new Set(s || []), W = opts.weights || null;
  const fill = k => {
    if (W){ const w = W[k] || 0; return w ? `color-mix(in srgb,var(--mus-1) ${Math.round(25 + w * 75)}%,var(--body-m))` : 'var(--body-m)'; }
    return P.has(k) ? 'var(--mus-1)' : S.has(k) ? 'var(--mus-2)' : 'var(--body-m)';
  };
  const view = (name, dx) => {
    const half = side => {
      let out = BODY.base[name].map(d => `<path d="${d}" fill="var(--body-base)"/>`).join('');
      for (const k in BODY[name]) BODY[name][k].forEach(d => {
        out += `<path d="${d}" fill="${fill(k)}" data-m="${k}"><title>${(CAT.muscles || {})[k] || k}</title></path>`; });
      return out;
    };
    return `<g transform="translate(${dx} 0)"><g>${half()}</g><g transform="translate(200 0) scale(-1 1)">${half()}</g>`
      + (opts.labels === false ? '' : `<text x="100" y="412" text-anchor="middle" fill="var(--ink-3)" font-size="12" font-family="Instrument Sans, sans-serif" letter-spacing="1.5">${name === 'front' ? 'FACE' : 'DOS'}</text>`) + '</g>';
  };
  const h = opts.labels === false ? 400 : 420;
  return `<svg class="body" viewBox="0 0 410 ${h}" role="img" aria-label="${opts.aria || 'Carte des muscles sollicités'}" stroke="var(--surface)" stroke-width="1.6" stroke-linejoin="round">${view('front', 0)}${view('back', 210)}</svg>`;
}
const musLabel = k => (CAT.muscles || {})[k] || k;
const musOf = e => (e && e.mus) || { p:[], s:[] };



/* ================= PLANNING ================= */
function renderPlan(){
  const r = $('#p-plan'); r.innerHTML = '';
  const ph = el('div','ph'); const t = el('div'); t.append(el('span','eyebrow','Semaine type'), el('h1', null, 'Planning')); ph.append(t); r.append(ph);
  const intro = el('p', null, 'Associe un ou plusieurs programmes à chaque jour. Ils sont proposés automatiquement dans la séance du jour, dans l’ordre imposé : rééducation, mobilité, proprioception, puis musculation.');
  intro.style.cssText = 'margin:-4px 0 16px;color:var(--ink-2);font-size:14px;max-width:68ch'; r.append(intro);

  const ws = weekStart(new Date());
  const doneSet = new Set(sessions.filter(s => s.done).map(s => s.date));
  const active = DAYS.filter(([k]) => ((planning[k] || {}).progs || []).length).length;
  const reeducDays = DAYS.filter(([k]) => ((planning[k] || {}).progs || []).some(s => (PBY[s.prog] || {}).cat === 'Rééducation')).length;
  const doneWeek = DAYS.filter((_, i) => { const d = new Date(ws); d.setDate(d.getDate()+i); return doneSet.has(iso(d)); }).length;
  const sum = el('div','wsum');
  [['Jours d’entraînement', active, '/ 7'], ['Jours de rééducation', reeducDays, '/ 7'], ['Faites cette semaine', doneWeek, '/ ' + active]].forEach(([k, v, u]) => {
    const c = el('div','card stat'); c.append(el('div','k',k)); const vv = el('div','v', String(v)); vv.append(el('span','u',u)); c.append(vv); sum.append(c); });
  r.append(sum);

  const sh = el('div','sh'); sh.append(el('h2', null, 'Cette semaine')); sh.append(el('span','hint', weekLbl(new Date()))); r.append(sh);
  const wk = el('div','week'); const tk = iso(new Date());
  DAYS.forEach(([k, label], i) => {
    const date = new Date(ws); date.setDate(date.getDate()+i);
    const d = el('div','card day' + (iso(date) === tk ? ' today' : ''));
    const left = el('div'); left.append(el('div','dn', label));
    const dd = el('div','dd'); dd.append(document.createTextNode(date.toLocaleDateString('fr-FR',{ day:'numeric', month:'short' })));
    if (iso(date) === tk) dd.append(el('span', null, '· aujourd’hui'));
    if (doneSet.has(iso(date))){ const ok = el('span','ok','✓ fait'); dd.append(ok); }
    left.append(dd);
    const slots = el('div','slots'); const cur = (planning[k] && planning[k].progs) || [];
    if (!cur.length) slots.append(el('span','none','Repos'));
    sortSlots(cur).forEach(sl => { const p = PBY[sl.prog]; if (p) slots.append(catChip(p, slotLabel(sl))); });
    const b = el('button','btn ghost sm','Modifier'); b.type = 'button';
    b.onclick = () => programPicker({ eyebrow:label, title:'Programmes du jour', current:cur, onOk:progs => {
      planning[k] = { progs }; store.write('config/planning', { days:planning }); renderPlan(); toast(label + ' mis à jour');
      if (k === dayKey(new Date()) && session && !session.done && iso(viewDate) === iso(new Date()) && !session.items.some(i => i.sets.some(hasVal))){
        session.slots = progs.map(s => ({...s})); syncItems(); if (isStored(session)) saveSessionSoon(); }
    } });
    d.append(left, slots, b); wk.append(d);
  });
  r.append(wk);
}

/* ================= BIBLIOTHÈQUE ================= */
let libF = { prog:'', sem:'', q:'', cat:'' };
function renderLib(){
  const r = $('#p-lib'); r.innerHTML = '';
  const visible = PROGS;
  const ph = el('div','ph'); const t = el('div'); t.append(el('span','eyebrow', EXOS.filter(e => PBY[e.prog]).length + ' exercices · ' + PROGS.length + ' programmes'), el('h1', null, 'Bibliothèque')); ph.append(t); r.append(ph);

  const cs = el('div','catseg');
  [['', 'Tout']].concat(allCats().map(c => [c, c])).forEach(([v, l]) => {
    const b = el('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(libF.cat === v));
    if (v){ const d = el('span','dot'); d.style.background = `var(${CAT_VAR[v] || '--ink-3'})`; b.append(d); }
    b.append(l); b.onclick = () => { libF.cat = v; if (libF.prog && PBY[libF.prog].cat !== v && v) libF.prog = ''; libF.sem = ''; renderLib(); };
    cs.append(b);
  });
  r.append(cs);

  if (!libF.prog){
    const g = el('div','pgrid');
    visible.filter(p => !libF.cat || p.cat === libF.cat).forEach(p => {
      const c = el('button','card pcard'); c.type = 'button';
      const pz = el('div','pz'); const dt = el('i'); dt.style.background = `var(${CAT_VAR[p.cat] || '--ink-3'})`; pz.append(dt, document.createTextNode(p.cat + (p.zone ? ' · ' + p.zone : '')));
      c.append(pz, el('div','pn', p.label));
      c.append(el('div','pm', exCount(p.id) + ' exercices' + (p.sems && p.sems.length > 1 ? ' · ' + p.sems.length + ' semaines' : '') + (p.blocs && p.blocs.length ? ' · blocs A/B/C' : '')));
      c.onclick = () => { libF.prog = p.id; libF.sem = ''; renderLib(); };
      g.append(c);
    });
    r.append(g);
  }

  const f = el('div','filters');
  const sp = el('select','f'); sp.id = 'libProg'; sp.setAttribute('aria-label','Programme');
  const a0 = el('option', null, 'Tous les programmes'); a0.value = ''; sp.append(a0);
  PROGS.filter(p => !libF.cat || p.cat === libF.cat).forEach(p => { const o = el('option', null, p.label); o.value = p.id; sp.append(o); });
  sp.value = libF.prog; sp.onchange = () => { libF.prog = sp.value; libF.sem = ''; renderLib(); };
  const ss = el('select','f'); ss.id = 'libSem'; ss.setAttribute('aria-label','Semaine');
  const b0 = el('option', null, 'Toutes les semaines'); b0.value = ''; ss.append(b0);
  const sems = [...new Set(EXOS.filter(e => PBY[e.prog] && (!libF.prog || e.prog === libF.prog) && (!libF.cat || PBY[e.prog].cat === libF.cat)).map(e => e.sem).filter(s => s != null))].sort((a, b) => a - b);
  sems.forEach(s => { const o = el('option', null, 'Semaine ' + s); o.value = s; ss.append(o); });
  ss.value = libF.sem; ss.disabled = !sems.length; ss.onchange = () => { libF.sem = ss.value; renderList(); };
  const q = el('input','f'); q.type = 'search'; q.id = 'libQ'; q.placeholder = 'Rechercher un exercice, une cible…'; q.value = libF.q; q.setAttribute('aria-label','Rechercher');
  q.oninput = () => { libF.q = q.value; renderList(); };
  f.append(q, sp, ss); r.append(f);

  if (libF.prog){
    const p = PBY[libF.prog];
    const hd = el('div','sh'); hd.style.marginTop = '6px';
    const back = el('button','btn ghost sm'); back.type = 'button'; back.innerHTML = svgI(ICON.left); back.append('Tous les programmes'); back.onclick = () => { libF.prog = ''; libF.sem = ''; renderLib(); };
    const h2 = el('h2', null, p.label); hd.append(back, h2); r.append(hd);
    const info = el('div','stack'); info.style.marginBottom = '12px';
    (p.meta || []).forEach(txt => { const warn = /^À ÉVITER|ATTENTION/i.test(txt); const b = el('div','banner ' + (warn ? 'warn' : 'info')); b.innerHTML = svgI(warn ? ICON.warn : ICON.info); b.append(el('span', null, txt)); info.append(b); });
    if (p.blocs && p.blocs.length){ const c = el('div','card'); c.style.padding = '12px 14px'; c.append(el('div','eyebrow','Progression par blocs')); const bl = blocList(p.blocs); bl.style.marginTop = '8px'; c.append(bl); info.append(c); }
    if (info.children.length) r.append(info);
  }
  const count = el('div','eyebrow'); count.style.margin = '4px 2px 8px'; r.append(count);
  const list = el('div','card'); r.append(list);
  renderList();

  function renderList(){
    list.innerHTML = '';
    const needle = libF.q.trim().toLowerCase();
    const rows = EXOS.filter(e => PBY[e.prog] && (!libF.cat || PBY[e.prog].cat === libF.cat) && (!libF.prog || e.prog === libF.prog) && (!libF.sem || String(e.sem) === String(libF.sem)) &&
      (!needle || [e.nom, e.desc, e.cible, e.groupe, PBY[e.prog].label].some(x => (x || '').toLowerCase().includes(needle))))
      .sort((a, b) => bySeq(a.prog, b.prog) || (a.sem || 0) - (b.sem || 0) || (a.ord || 0) - (b.ord || 0));
    count.textContent = rows.length + ' exercice' + (rows.length > 1 ? 's' : '');
    if (!rows.length){ const e2 = el('div','empty'); e2.append(el('strong', null, 'Aucun résultat')); e2.append(document.createTextNode('Essaie un autre mot ou enlève un filtre.')); list.append(e2); return; }
    rows.forEach(e => {
      const p = PBY[e.prog]; const row = el('div','lib-row');
      const left = el('div'); left.style.minWidth = '0';
      const nm = el('button','t tlink', e.nom); nm.type = 'button'; nm.onclick = () => openExercise(e); left.append(nm); const ins = instrList(e); if (ins) left.append(ins);
      const m = el('div','m'); if (!libF.prog) m.append(catChip(p));
      if (e.sem != null) m.append(el('span','chip', 'Semaine ' + e.sem));
      if (e.ord != null && p.cat === 'Rééducation') m.append(el('span','chip', 'Item ' + e.ord));
      if (e.cible) m.append(el('span','chip line', e.cible));
      if (e.groupe) m.append(el('span','chip line', e.groupe));
      if (e.seance) m.append(el('span','chip', 'Séance ' + e.seance));
      left.append(m);
      const right = el('div','r'); right.append(el('div','presc', prescOf(e)));
      if (e.url){ const a = el('a','vid'); a.href = e.url; a.target = '_blank'; a.rel = 'noopener'; a.innerHTML = svgI(ICON.play); a.append('Vidéo'); a.style.fontSize = '12.5px'; right.append(a); }
      const th = el('button','thumb'); th.type = 'button'; th.innerHTML = bodyMap(musOf(e).p, musOf(e).s, { labels:false }); th.setAttribute('aria-label','Fiche et muscles : ' + e.nom); th.onclick = () => openExercise(e);
      row.append(th, left, right); list.append(row);
    });
  }
}

/* ================= graphiques ================= */
const NS = 'http://www.w3.org/2000/svg';
function svgEl(t, a){ const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); return n; }
/* Sur téléphone, un repère plus étroit garde des libellés lisibles. */
const chartW = () => window.innerWidth < 560 ? 360 : 520;
function chartCard(title, cap){ const c = el('div','card chart'); c.append(el('h3', null, title), el('div','cap', cap)); return c; }
function noData(c, txt){ const e = el('div','empty'); e.style.padding = '26px 8px'; e.append(document.createTextNode(txt || 'Les données apparaîtront après ta première séance terminée.')); c.append(e); return c; }
/* Maximum d'axe divisible en 4 graduations rondes (1, 2, 5 × 10^n). */
function niceMax(v){ if (v <= 0) return 4; const raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p * 4; }
function barChart(card, data, opts){
  opts = opts || {};
  const W = chartW(), H = 200, ml = 34, mr = 8, mt = 12, mb = 26, iw = W - ml - mr, ih = H - mt - mb;
  const max = niceMax(Math.max(opts.min || 1, ...data.map(d => d.v)));
  const s = svgEl('svg', { viewBox:`0 0 ${W} ${H}`, role:'img', 'aria-label':card.querySelector('h3').textContent });
  for (let i = 0; i <= 4; i++){ const v = max * i / 4, y = mt + ih - ih * i / 4;
    s.append(svgEl('line', { x1:ml, x2:W-mr, y1:y, y2:y, stroke:'var(--line)', 'stroke-width':1, 'stroke-dasharray': i ? '2 3' : '' }));
    const tx = svgEl('text', { x:ml-7, y:y+3.5, 'text-anchor':'end', fill:'var(--ink-3)', 'font-size':10, 'font-family':'Instrument Sans, sans-serif' }); tx.textContent = Math.round(v * 10) / 10; s.append(tx); }
  const slot = iw / data.length, bw = Math.max(6, Math.min(30, slot - 8));
  data.forEach((d, i) => {
    const x = ml + slot * (i + .5) - bw / 2, bh = d.v / max * ih, last = i === data.length - 1;
    const g = svgEl('g', {});
    g.append(svgEl('rect', { x, y:mt+ih-bh, width:bw, height:Math.max(bh, d.v > 0 ? 2 : 0), rx:4, fill:'var(--accent)', opacity: last ? 1 : .55 }));
    g.append(svgEl('rect', { x:ml + slot * i, y:mt, width:slot, height:ih, fill:'transparent' }));
    g.addEventListener('pointerenter', ev => showTip(card, ev, `${d.l} · ${d.v}${opts.unit || ''}`)); g.addEventListener('pointerleave', () => hideTip(card));
    s.append(g);
    if (d.v > 0 && data.length <= 12){ const vt = svgEl('text', { x:x + bw/2, y:mt+ih-bh-5, 'text-anchor':'middle', fill:'var(--ink-2)', 'font-size':10, 'font-family':'Instrument Sans, sans-serif' }); vt.textContent = d.v; s.append(vt); }
    const t = svgEl('text', { x:ml + slot * (i + .5), y:H-8, 'text-anchor':'middle', fill: last ? 'var(--ink)' : 'var(--ink-3)', 'font-size':10, 'font-family':'Instrument Sans, sans-serif' }); t.textContent = d.s || d.l; s.append(t);
  });
  card.append(s); addTip(card); return card;
}
function lineChart(card, data, opts){
  opts = opts || {};
  const W = chartW(), H = 200, ml = 34, mr = 14, mt = 18, mb = 26, iw = W - ml - mr, ih = H - mt - mb;
  const vals = data.map(d => d.v);
  const max = opts.max != null ? opts.max : niceMax(Math.max(1, ...vals)), min = opts.min != null ? opts.min : 0;
  const X = i => data.length === 1 ? ml + iw / 2 : ml + iw * i / (data.length - 1);
  const Y = v => mt + ih - (v - min) / (max - min || 1) * ih;
  const s = svgEl('svg', { viewBox:`0 0 ${W} ${H}`, role:'img', 'aria-label':card.querySelector('h3').textContent });
  if (opts.band){ s.append(svgEl('rect', { x:ml, y:Y(opts.band[1]), width:iw, height:Y(opts.band[0]) - Y(opts.band[1]), fill:'var(--ok)', opacity:.08 }));
    const bt = svgEl('text', { x:W-mr, y:Y(opts.band[1]) - 4, 'text-anchor':'end', fill:'var(--ok)', 'font-size':9.5, 'font-family':'Instrument Sans, sans-serif' }); bt.textContent = opts.bandLabel || ''; s.append(bt); }
  for (let i = 0; i <= 4; i++){ const v = min + (max - min) * i / 4, y = Y(v);
    s.append(svgEl('line', { x1:ml, x2:W-mr, y1:y, y2:y, stroke:'var(--line)', 'stroke-width':1, 'stroke-dasharray': i ? '2 3' : '' }));
    const t = svgEl('text', { x:ml-7, y:y+3.5, 'text-anchor':'end', fill:'var(--ink-3)', 'font-size':10, 'font-family':'Instrument Sans, sans-serif' }); t.textContent = Math.round(v * 10) / 10; s.append(t); }
  const d = data.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  s.append(svgEl('path', { d: d + ` L${X(data.length-1).toFixed(1)},${mt+ih} L${X(0).toFixed(1)},${mt+ih} Z`, fill:'var(--accent)', opacity:.1 }));
  s.append(svgEl('path', { d, fill:'none', stroke:'var(--accent)', 'stroke-width':2.2, 'stroke-linejoin':'round', 'stroke-linecap':'round' }));
  const every = Math.ceil(data.length / 6);
  data.forEach((p, i) => {
    const last = i === data.length - 1;
    s.append(svgEl('circle', { cx:X(i), cy:Y(p.v), r:last ? 5 : 3, fill:last ? 'var(--accent)' : 'var(--surface)', stroke:'var(--accent)', 'stroke-width':2 }));
    const hw = data.length > 1 ? iw / (data.length - 1) / 2 : iw / 2;
    const hit = svgEl('rect', { x:X(i)-hw, y:mt, width:hw*2, height:ih, fill:'transparent' });
    hit.addEventListener('pointerenter', ev => showTip(card, ev, `${p.l} · ${p.v}${opts.unit || ''}`)); hit.addEventListener('pointerleave', () => hideTip(card)); s.append(hit);
    if (i % every === 0 || last){ const t = svgEl('text', { x:X(i), y:H-8, 'text-anchor': data.length === 1 ? 'middle' : i === 0 ? 'start' : last ? 'end' : 'middle', fill:'var(--ink-3)', 'font-size':10, 'font-family':'Instrument Sans, sans-serif' }); t.textContent = p.s || p.l; s.append(t); }
  });
  const lp = data[data.length-1];
  const lbl = svgEl('text', { x:X(data.length-1) - (data.length > 1 ? 0 : -8), y:Y(lp.v) - 11, 'text-anchor': data.length > 1 ? 'end' : 'start', fill:'var(--ink)', 'font-size':12, 'font-weight':600, 'font-family':'Instrument Sans, sans-serif' });
  lbl.textContent = lp.v + (opts.unit || ''); s.append(lbl);
  card.append(s); addTip(card); return card;
}
function addTip(card){ if (!card.querySelector('.tip')) card.append(el('div','tip')); }
function showTip(card, ev, text){ const t = card.querySelector('.tip'); if (!t) return; const r = card.getBoundingClientRect();
  t.textContent = text; t.style.opacity = '1'; t.style.left = Math.min(Math.max(8, ev.clientX - r.left - 50), r.width - 150) + 'px'; t.style.top = Math.max(4, ev.clientY - r.top - 36) + 'px'; }
function hideTip(card){ const t = card.querySelector('.tip'); if (t) t.style.opacity = '0'; }

/* ================= HISTORIQUE ================= */
let histEx = '', histMetric = 'c';
const nSeries = s => s.items.reduce((a, i) => a + i.sets.filter(hasVal).length, 0);
function renderHist(){
  const r = $('#p-hist'); r.innerHTML = '';
  const done = sessions.filter(s => s.done).sort((a, b) => a.date < b.date ? 1 : -1);
  const ph = el('div','ph'); const t = el('div'); t.append(el('span','eyebrow', done.length + ' séance' + (done.length > 1 ? 's' : '') + ' terminée' + (done.length > 1 ? 's' : '')), el('h1', null, 'Historique')); ph.append(t); r.append(ph);

  const now = new Date(), m0 = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = done.filter(s => parseISO(s.date) >= m0);
  const last7 = done.filter(s => (now - parseISO(s.date)) / 86400000 <= 7);
  const pains = last7.map(s => s.douleur24).filter(v => v != null);
  const avgPain = pains.length ? (pains.reduce((a, b) => a + b, 0) / pains.length).toFixed(1).replace('.', ',') : '–';
  let streak = 0; { const set = new Set(done.map(s => s.date)); const d = new Date(); if (!set.has(iso(d))) d.setDate(d.getDate()-1); while (set.has(iso(d))){ streak++; d.setDate(d.getDate()-1); } }
  const st = el('div','stats');
  const mk = (k, v, u) => { const c = el('div','card stat'); c.append(el('div','k', k)); const vv = el('div','v', String(v)); if (u) vv.append(el('span','u', u)); c.append(vv); return c; };
  st.append(mk('Séances ce mois', thisMonth.length), mk('Séries ce mois', thisMonth.reduce((a, s) => a + nSeries(s), 0)), mk('Douleur 24 h · 7 j', avgPain, '/10'), mk('Série en cours', streak, streak > 1 ? 'jours' : 'jour'));
  r.append(st);

  const ch = el('div','charts');
  const wk = {};
  done.forEach(s => { const k = s.week || isoWeek(parseISO(s.date)); (wk[k] = wk[k] || { n:0, sets:0 }); wk[k].n++; wk[k].sets += nSeries(s); });
  const weeks = []; { const d = weekStart(new Date()); for (let i = 9; i >= 0; i--){ const dd = new Date(d); dd.setDate(dd.getDate() - i*7); const k = isoWeek(dd); weeks.push({ l:k.replace('-',' '), s:'S' + k.slice(-2), v:(wk[k] || {}).n || 0, sets:(wk[k] || {}).sets || 0 }); } }
  const c1 = chartCard('Séances par semaine', 'Régularité sur les 10 dernières semaines.'); done.length ? barChart(c1, weeks, { min:3, unit:' séance(s)' }) : noData(c1); ch.append(c1);
  const c2 = chartCard('Volume hebdomadaire', 'Séries renseignées par semaine.'); done.length ? barChart(c2, weeks.map(w => ({ l:w.l, s:w.s, v:w.sets })), { min:10, unit:' séries' }) : noData(c2); ch.append(c2);

  const c3 = chartCard('Douleur à 24 h', 'Échelle 0-10 relevée en fin de séance. La zone verte (0-3) est acceptable ; la tendance compte plus que le point.');
  const pd = done.slice().reverse().filter(s => s.douleur24 != null).slice(-15).map(s => ({ l:fmtShort(s.date), s:fmtShort(s.date).slice(0,5), v:s.douleur24 }));
  pd.length ? lineChart(c3, pd, { max:10, min:0, unit:'/10', band:[0,3], bandLabel:'zone acceptable' }) : noData(c3, 'Note ta douleur à 24 h dans le bilan de séance pour suivre sa tendance.'); ch.append(c3);

  const c4 = chartCard('Progression par exercice', 'Valeur maximale relevée, séance après séance : c’est la charge qui progresse, pas le mouvement.');
  const MET = { c:['Charge', ' kg'], t:['Tenue', ' s'], r:['Reps', ''] };
  const series = { c:{}, t:{}, r:{} };
  done.forEach(s => s.items.forEach(i => { ['c','t','r'].forEach(k => {
    const v = i.sets.map(x => parseFloat(String(x[k] || '').replace(',', '.'))).filter(Number.isFinite);
    if (v.length) (series[k][i.exId] = series[k][i.exId] || []).push({ date:s.date, v:Math.max(...v) }); }); }));
  const avail = k => Object.keys(series[k]).filter(id => series[k][id].length >= 2 && EBY[id] && series[k][id].some(p => p.v > 0));
  if (!avail(histMetric).length) histMetric = ['c','t','r'].find(k => avail(k).length) || 'c';
  const ids = avail(histMetric).sort((a, b) => bySeq(EBY[a].prog, EBY[b].prog) || EBY[a].nom.localeCompare(EBY[b].nom));
  if (ids.length){
    const ctl = el('div','ctl');
    const seg = el('div','seg');
    ['c','t','r'].forEach(k => { const b = el('button', null, MET[k][0]); b.type = 'button'; b.setAttribute('aria-pressed', String(k === histMetric)); b.disabled = !avail(k).length;
      if (b.disabled) b.style.opacity = '.4'; b.onclick = () => { histMetric = k; renderHist(); }; seg.append(b); });
    const sel = el('select'); sel.id = 'histEx'; sel.setAttribute('aria-label','Exercice');
    ids.forEach(k => { const o = el('option', null, EBY[k].nom + ' · ' + (PBY[EBY[k].prog] || {}).label); o.value = k; sel.append(o); });
    if (!ids.includes(histEx)) histEx = ids[0]; sel.value = histEx; sel.onchange = () => { histEx = sel.value; renderHist(); };
    ctl.append(seg, sel); c4.append(ctl);
    const pts = series[histMetric][histEx].sort((a, b) => a.date < b.date ? -1 : 1).slice(-15).map(p => ({ l:fmtShort(p.date), s:fmtShort(p.date).slice(0,5), v:p.v }));
    lineChart(c4, pts, { unit:MET[histMetric][1] });
  } else noData(c4, 'Renseigne une charge, une tenue ou des répétitions sur au moins deux séances terminées pour voir leur progression.');
  ch.append(c4);

  const c7 = chartCard('Muscles travaillés · 7 jours', 'Séries renseignées par muscle : principal = 1, en soutien = ½. Plus la couleur est soutenue, plus le muscle a travaillé.');
  const W = {};
  last7.forEach(x => x.items.forEach(i => { const e = EBY[i.exId]; if (!e) return; const n = i.sets.filter(hasVal).length || (i.done ? 1 : 0); if (!n) return;
    const mu = musOf(e); mu.p.forEach(k => W[k] = (W[k] || 0) + n); mu.s.forEach(k => W[k] = (W[k] || 0) + n / 2); }));
  const wmax = Math.max(0, ...Object.values(W));
  if (wmax){ const nw = {}; for (const k in W) nw[k] = W[k] / wmax;
    const fig = el('div','mc-fig'); fig.style.maxWidth = '340px'; fig.innerHTML = bodyMap([], [], { weights:nw, aria:'Fréquence de travail par muscle sur 7 jours' }); c7.append(fig);
    const top = Object.entries(W).sort((a, b) => b[1] - a[1]).slice(0, 6); const l = el('div','lg-l'); l.style.marginTop = '10px';
    top.forEach(([k, v]) => l.append(el('span','chip', musLabel(k) + ' · ' + fmtN(Math.round(v * 10) / 10)))); c7.append(l);
  } else noData(c7, 'Termine une séance pour voir les muscles travaillés cette semaine.');
  ch.append(c7);
  const c5 = chartCard('Calendrier', 'Les 12 dernières semaines, une colonne par semaine.');
  const hw = el('div','heatw'); const lab = el('div','heat-l'); ['Lun','','Mer','','Ven','','Dim'].forEach(x => lab.append(el('span', null, x))); hw.append(lab);
  const heat = el('div','heat'); const doneD = new Set(done.map(s => s.date)), startD = new Set(sessions.filter(s => !s.done && s.items.some(i => i.done || i.sets.some(hasVal))).map(s => s.date));
  const h0 = weekStart(new Date()); h0.setDate(h0.getDate() - 77);
  for (let i = 0; i < 84; i++){ const d = new Date(h0); d.setDate(d.getDate()+i); const k = iso(d); const c = el('span', doneD.has(k) ? 'h2' : startD.has(k) ? 'h1' : '');
    if (k === iso(new Date())) c.classList.add('tdy'); c.title = fmtShort(k) + (doneD.has(k) ? ' · terminée' : startD.has(k) ? ' · commencée' : ''); if (d > new Date()) c.style.opacity = '.35'; heat.append(c); }
  hw.append(heat); c5.append(hw);
  const key = el('div','heat-k'); [['', 'Rien'], ['h1', 'Commencée'], ['h2', 'Terminée']].forEach(([c, l]) => { const s = el('span'); const i = el('i', c); if (c === 'h1') i.style.background = 'color-mix(in srgb,var(--accent) 45%,var(--surface-3))'; if (c === 'h2') i.style.background = 'var(--accent)'; s.append(i, l); key.append(s); }); c5.append(key);
  ch.append(c5);

  const c6 = chartCard('Répartition', 'Exercices faits par catégorie, sur toutes les séances terminées.');
  const byCat = {}; done.forEach(s => s.items.forEach(i => { const e = EBY[i.exId]; if (i.done && e && PBY[e.prog]){ const c = PBY[e.prog].cat; byCat[c] = (byCat[c] || 0) + 1; } }));
  const tot = Object.values(byCat).reduce((a, b) => a + b, 0);
  if (tot){ const g = el('div'); g.style.cssText = 'display:grid;gap:12px;margin-top:6px';
    allCats().filter(c => byCat[c]).forEach(c => { const row = el('div'); const top = el('div'); top.style.cssText = 'display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px';
      top.append(el('span', null, c)); const n = el('span','num', byCat[c] + ' · ' + Math.round(byCat[c] / tot * 100) + ' %'); n.style.color = 'var(--ink-2)'; top.append(n);
      const b = el('div','bar'); b.style.cssText = 'height:8px;margin:0'; const i = el('i'); i.style.width = (byCat[c] / tot * 100) + '%'; i.style.background = `var(${CAT_VAR[c] || '--accent'})`; b.append(i);
      row.append(top, b); g.append(row); });
    c6.append(g); } else noData(c6);
  ch.append(c6);
  r.append(ch);

  const sh = el('div','sh'); sh.append(el('h2', null, 'Séances')); sh.append(el('span','hint','Touche une séance pour la rouvrir')); r.append(sh);
  const list = el('div','card');
  if (!done.length){ const e = el('div','empty'); e.append(el('strong', null, 'Rien encore')); e.append(document.createTextNode('Termine une séance dans l’onglet Séance et elle apparaîtra ici.')); list.append(e); }
  else done.slice(0, 120).forEach(s => {
    const row = el('button','sess'); row.type = 'button';
    const dt = el('div','dt'); const dd = parseISO(s.date); dt.append(el('b', null, String(dd.getDate()).padStart(2,'0')), document.createTextNode(dd.toLocaleDateString('fr-FR',{ month:'short', year:'2-digit' }))); row.append(dt);
    const mid = el('div'); mid.style.minWidth = '0';
    mid.append(el('div','ti', s.slots.map(x => (PBY[x.prog] || {}).label).filter(Boolean).join(' · ') || 'Séance libre'));
    const mi = el('div','mi'); const items = s.items.filter(i => EBY[i.exId]);
    mi.append(el('span', null, cap1(dd.toLocaleDateString('fr-FR',{ weekday:'long' }))), el('span', null, items.filter(i => i.done).length + '/' + items.length + ' exercices'), el('span', null, nSeries(s) + ' séries'));
    if (s.rpe != null) mi.append(el('span', null, 'RPE ' + s.rpe));
    if (s.note) mi.append(el('span', null, '« ' + (s.note.length > 40 ? s.note.slice(0, 40) + '…' : s.note) + ' »'));
    mid.append(mi); row.append(mid);
    const right = el('div');
    if (s.douleur24 != null){ const c = el('span','chip line'); const d = el('span','dot'); d.style.background = painColor(s.douleur24); c.append(d, document.createTextNode(s.douleur24 + '/10')); right.append(c); }
    row.append(right);
    row.onclick = () => { viewDate = parseISO(s.date); loadSession(); go('sess'); };
    list.append(row);
  });
  r.append(list);
}

/* ================= RÈGLES ================= */
function renderRules(){
  const r = $('#p-rules'); r.innerHTML = '';
  const ph = el('div','ph'); const t = el('div'); t.append(el('span','eyebrow','Le cadre du plan'), el('h1', null, 'Règles')); ph.append(t); r.append(ph);
  const painIdx = REGLES.findIndex(x => /^Douleur/i.test(x.r));
  const base = painIdx < 0 ? REGLES : REGLES.slice(0, painIdx), signals = painIdx < 0 ? [] : REGLES.slice(painIdx);
  let sh = el('div','sh'); sh.append(el('h2', null, 'Non négociables'), el('span','hint', base.length + ' règles')); r.append(sh);
  const list = el('div','rules');
  base.forEach((x, i) => { const c = el('div','card rule'); c.append(el('span','n', String(i+1)), el('b', null, x.r), el('p', null, x.d)); list.append(c); });
  r.append(list);
  if (signals.length){
    sh = el('div','sh'); sh.append(el('h2', null, 'Lire les signaux du corps'), el('span','hint','Que faire selon ce que tu ressens')); r.append(sh);
    const tr = el('div','traffic');
    signals.forEach(x => {
      const lvl = /≤\s*3|normale/i.test(x.r) ? ['var(--ok)','Feu vert'] : /élevée|AUGMENTE|Perte/i.test(x.r) ? ['var(--crit)','Stop / adapter'] : ['var(--warn)','Attention'];
      const c = el('div','card tl'); const lv = el('div','lv'); const i = el('i'); i.style.background = lvl[0]; lv.style.color = lvl[0]; lv.append(i, document.createTextNode(lvl[1]));
      c.append(lv, el('b', null, x.r), el('p', null, x.d)); tr.append(c); });
    r.append(tr);
  }
  sh = el('div','sh'); sh.append(el('h2', null, 'Étapes de rééducation'), el('span','hint','Durée, fréquence, progression')); r.append(sh);
  const et = el('div','etapes');
  PROGS.filter(p => p.cat === 'Rééducation').forEach(p => {
    const c = el('div','card etape'); c.append(el('h3', null, p.label));
    (p.meta || []).forEach((txt, i) => { if (i === 0){ const m = el('div','num', txt); m.style.cssText = 'font-size:12.5px;color:var(--ink-2)'; c.append(m); } else { const pp = el('p', null, txt); pp.style.cssText = 'margin:0;font-size:13.5px;color:var(--ink-2)'; c.append(pp); } });
    if (p.blocs && p.blocs.length) c.append(blocList(p.blocs));
    const items = EXOS.filter(e => e.prog === p.id).sort((a, b) => a.ord - b.ord);
    const d = el('details'); const sm = el('summary', null, 'Les ' + items.length + ' items de la séance'); sm.style.cssText = 'cursor:pointer;font-size:13px;font-weight:600;color:var(--accent-deep)'; d.append(sm);
    const ol = el('ol'); ol.style.cssText = 'margin:10px 0 0;padding-left:20px;display:grid;gap:5px;font-size:13px;color:var(--ink-2)';
    items.forEach(e => { const li = el('li'); const b = el('span', null, e.nom); b.style.color = 'var(--ink)'; li.append(b, document.createTextNode(' · ' + prescOf(e) + (e.cible ? ' · ' + e.cible : ''))); ol.append(li); });
    d.append(ol); c.append(d); et.append(c);
  });
  r.append(et);
}

