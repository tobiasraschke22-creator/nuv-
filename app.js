'use strict';
/* Ringtagebuch – NuvaRing & Endometriose. Alle Daten bleiben im localStorage des Geräts. */
const APP_VERSION = '2.0.0'; // wird von werkzeug/paket.sh aus VERSION gesetzt

// ---------- Speicher ----------
const KEYS = { settings: 'nuv.settings', entries: 'nuv.entries', backup: 'nuv.lastBackup', seen: 'nuv.seenVersion', intro: 'nuv.intro', doctor: 'nuv.doctor' };
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { alert('Speichern fehlgeschlagen. Ist der Speicher voll oder der private Modus aktiv?'); } }
};
let settings = store.get(KEYS.settings, null); // {inserts:[YYYY-MM-DD], wearDays, pauseDays}
let entries = store.get(KEYS.entries, {});     // {YYYY-MM-DD: Eintrag}
const saveSettings = () => store.set(KEYS.settings, settings);
const saveEntries = () => store.set(KEYS.entries, entries);
let doctor = store.get(KEYS.doctor, { date: '', questions: [], notes: '' }); // Arzttermin: Datum, Fragen, Notizen
const saveDoctor = () => store.set(KEYS.doctor, doctor);

// ---------- Datum ----------
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const dayNum = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const fromNum = n => new Date(n * 864e5).toISOString().slice(0, 10);
const addDays = (s, n) => fromNum(dayNum(s) + n);
const todayStr = () => iso(new Date());
const fmtDate = s => new Date(s + 'T00:00:00Z').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtShort = s => new Date(s + 'T00:00:00Z').toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Ring-Phasen ----------
// Tag 1 = Einsetztag. Mit Pause: Tag w+1 Entfernen, Tag w+p+1 neuer Ring.
// Durchgehend (p = 0): Tag w+1 ist der Wechseltag.
const sortedInserts = () => [...settings.inserts].sort();
function phaseOf(date) {
  if (!settings) return null;
  const ins = sortedInserts();
  const start = ins.filter(d => d <= date).pop();
  if (!start) return null;
  const n = dayNum(date) - dayNum(start) + 1;
  const cycle = ins.indexOf(start) + 1;
  const { wearDays: w, pauseDays: p } = settings;
  const changeDate = addDays(start, w + p);
  if (n <= w) return { kind: 'ring', day: n, week: Math.ceil(n / 7), cycle, start, changeDate };
  if (n <= w + p) return { kind: 'pause', day: n - w, cycle, start, changeDate };
  return { kind: 'over', day: n - w - p, cycle, start, changeDate };
}
function phaseLabel(ph) {
  if (!ph) return 'Vor Beginn';
  if (ph.kind === 'ring') return `Ring Woche ${ph.week}`;
  if (ph.kind === 'pause') return 'Ringpause';
  if (ph.day === 1) return settings.pauseDays ? 'Einsetztag' : 'Wechseltag';
  return 'Wechsel überfällig';
}
// stabile Gruppen für die Auswertung
const groupLabel = ph => !ph ? 'Vor Beginn' : ph.kind === 'ring' ? `Ring Woche ${ph.week}` : ph.kind === 'pause' ? 'Ringpause' : 'Nach Wechseltermin';
const groupRank = g => g.startsWith('Ring Woche') ? +g.slice(11) : g === 'Ringpause' ? 50 : g === 'Nach Wechseltermin' ? 60 : 0;
const diaryDay = date => settings && settings.inserts.length ? dayNum(date) - dayNum(sortedInserts()[0]) + 1 : null;

// ---------- Erfassung ----------
const BLEEDING = [['none', 'Keine'], ['spotting', 'Schmierblutung'], ['light', 'Leicht'], ['medium', 'Mittel'], ['heavy', 'Stark']];
const DIARRHEA = ['Keiner', '1×', '2–3×', '4× oder mehr'];
const AMOUNTS = ['wenig', 'normal', 'viel'];
const PAIN_AREAS = ['Unterleib', 'Rücken', 'Darm', 'Blase', 'Beine', 'Beim Sex', 'Kopf'];
const MEDS = ['Ibuprofen', 'Paracetamol', 'Metamizol', 'Buscopan', 'Wärmflasche', 'Sonstiges'];
const EXTRA_SYM = ['Blähbauch', 'Übelkeit', 'Verstopfung', 'Schmerz beim Stuhlgang', 'Schmerz beim Wasserlassen', 'Ausstrahlung ins Bein', 'Erschöpfung'];
const FOOD_TAGS = ['Gluten', 'Milchprodukte', 'Zucker', 'Alkohol', 'Koffein', 'Rotes Fleisch', 'Scharf', 'Fettig'];
const MOVEMENT = ['Keine', 'Spaziergang', 'Yoga / Dehnen', 'Sport leicht', 'Sport intensiv'];
const MED_EFFECT = ['gar nicht', 'etwas', 'gut', 'sehr gut'];
const DAYTIMES = [['m', 'Morgens', 'morgens'], ['n', 'Mittags', 'mittags'], ['a', 'Abends', 'abends']];
// Zusatzbereiche: unter „Mehr“ ein- und ausschaltbar (Schlüssel, Titel, Erklärung, Standard)
const MODULES = [
  ['extraSym', 'Weitere Beschwerden', 'Blähbauch, Übelkeit, Verstopfung … bei den Symptomen', true],
  ['daytime', 'Schmerzen nach Tageszeit', 'Morgens, mittags und abends getrennt bewerten', false],
  ['foodTags', 'Ernährungs-Merkmale', 'Gluten, Milchprodukte, Zucker … zum Antippen', true],
  ['drinkMove', 'Trinken & Bewegung', 'Gläser Wasser und Bewegung im Bereich Körper', true],
  ['medEffect', 'Wirkung der Schmerzmittel', 'Wann genommen und wie gut es geholfen hat', true]
];
const mod = k => { const v = settings && settings.modules ? settings.modules[k] : undefined; return v ?? MODULES.find(m => m[0] === k)[3]; };
const hasPainkiller = e => (e.meds || []).some(m => m !== 'Wärmflasche');
const isBleed = e => ['light', 'medium', 'heavy'].includes(e.bleeding);
const isSpot = e => e.bleeding === 'spotting';
const filled = s => !!(s || '').trim();
const hasMeals = e => (e.meals || []).some(m => filled(m.text));
const hasData = e => !!e && (['pain', 'cramps', 'diarrhea', 'mood', 'anxiety', 'anger', 'stress', 'sleep', 'energy', 'water', 'movement', 'medEffect'].some(k => e[k] != null) ||
  !!e.bleeding || filled(e.note) || filled(e.symNote) || filled(e.foodNote) || filled(e.medsNote) || hasMeals(e) ||
  ['painAreas', 'meds', 'symptoms', 'foodTags'].some(k => (e[k] || []).length > 0) ||
  (!!e.painDay && Object.values(e.painDay).some(v => v != null)));

let tab = 'today';
let curDate = todayStr();
let calMonth = todayStr().slice(0, 7);
let period = 'month';
let pMonth = todayStr().slice(0, 7);
let flash = '';

const getE = () => entries[curDate] || {};
function patch(p) {
  entries[curDate] = { ...getE(), ...p };
  saveEntries();
}

// ---------- Render ----------
const view = document.getElementById('view');
const TABS = ['today', 'history', 'analysis', 'settings'];
function render(anim) {
  const nav = document.getElementById('tabs');
  nav.querySelectorAll('button').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  nav.style.setProperty('--i', TABS.indexOf(tab));
  nav.hidden = !settings;
  view.innerHTML = !settings ? onboardingHTML() : { today: todayHTML, history: historyHTML, analysis: analysisHTML, settings: settingsHTML }[tab]();
  if (anim) replay(view, 'view-in');
  flash = '';
  setupTopbar();
}
// Große Überschrift wandert beim Scrollen in die obere Leiste (wie in iOS)
const topbar = document.getElementById('topbar');
function setupTopbar() {
  const h = view.querySelector('h1.large');
  topbar.hidden = !h;
  document.getElementById('topbar-title').textContent = h ? (h.dataset.short || h.textContent) : '';
  onScroll();
}
function onScroll() {
  const h = view.querySelector('h1.large');
  topbar.classList.toggle('show', !!h && h.getBoundingClientRect().bottom < (topbar.offsetHeight || 50));
}
window.addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive: true });
// Kleine Erfolgsanimation, wenn alle vier Bereiche eines Tages ausgefüllt sind
const celebrated = {};
function celebrate() {
  const el = document.createElement('div');
  el.className = 'celebrate'; el.setAttribute('role', 'status');
  el.innerHTML = `<div><svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="celg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f797ad"/><stop offset=".5" stop-color="#f7c3a4"/><stop offset="1" stop-color="#bfe96a"/></linearGradient></defs>
    <circle cx="50" cy="50" r="40" stroke="url(#celg)" pathLength="100"/><path d="M33 51l11 11 23-24" pathLength="60"/></svg><b>Alles erfasst für heute</b></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}
// Animation neu starten (Klasse kurz entfernen, Layout erzwingen, wieder setzen)
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; replay(t, 'show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2000);
}

// ---------- Reiter (Segment-Schalter wie bei iOS) ----------
const SECTIONS = [
  { id: 'sym', label: 'Symptome', keys: ['pain', 'painDay', 'painAreas', 'cramps', 'diarrhea', 'bleeding', 'symptoms', 'symNote'] },
  { id: 'food', label: 'Essen', keys: ['meals', 'foodTags', 'foodNote'] },
  { id: 'emo', label: 'Gefühle', keys: ['mood', 'anxiety', 'anger', 'stress', 'note'] },
  { id: 'body', label: 'Körper', keys: ['sleep', 'energy', 'water', 'movement', 'meds', 'medsNote', 'medEffect'] }
];
const ASECTIONS = [
  { id: 'overview', label: 'Überblick' }, { id: 'links', label: 'Zusammen­hänge' },
  { id: 'charts', label: 'Verläufe' }, { id: 'tables', label: 'Tabellen' }
];
let section = 'sym', aSection = 'overview';
function secDone(sec, e) {
  return sec.keys.some(k => {
    const v = e[k];
    if (k === 'meals') return hasMeals(e);
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return filled(v);
    if (v && typeof v === 'object') return Object.values(v).some(x => x != null);
    return v != null;
  });
}
function segHTML(items, active, action, e, cls = '') {
  const i = items.findIndex(x => x.id === active);
  return `<div class="seg noprint ${cls}" role="tablist" style="--n:${items.length};--i:${i}"><span class="seg-pill" aria-hidden="true"></span>${items.map(x =>
    `<button role="tab" aria-selected="${x.id === active}" class="${x.id === active ? 'on' : ''}" data-action="${action}" data-v="${x.id}">${ICONS[x.id] ? icon(x.id) : ''}${x.label}${e ? `<i class="seg-dot ${secDone(x, e) ? 'done' : ''}" aria-hidden="true"></i>` : ''}</button>`).join('')}</div>`;
}
function updateDots() {
  const e = getE();
  view.querySelectorAll('.seg [data-action=section]').forEach(b => {
    const dot = b.querySelector('.seg-dot'), done = secDone(SECTIONS.find(x => x.id === b.dataset.v), e);
    if (dot && dot.classList.contains('done') !== done) { dot.classList.toggle('done', done); if (done) replay(dot, 'pop'); }
  });
  const n = SECTIONS.filter(x => secDone(x, e)).length;
  const sum = document.getElementById('sum-count');
  if (sum) sum.textContent = `${n} von 4 Bereichen erfasst`;
  if (n === 4 && !celebrated[curDate] && tab === 'today') { celebrated[curDate] = true; celebrate(); }
}
// Reiter wechseln: Kapsel gleitet, Inhalt schiebt sich aus der passenden Richtung herein
function switchTo(id) {
  const today = tab === 'today', list = today ? SECTIONS : ASECTIONS, cur = today ? section : aSection;
  if (id === cur || !list.some(x => x.id === id)) return;
  const idx = x => list.findIndex(y => y.id === x);
  const dir = idx(id) > idx(cur) ? 'from-right' : 'from-left';
  if (today) section = id; else aSection = id;
  const seg = view.querySelector('.seg:not(.static)'), pane = document.getElementById('pane');
  seg.style.setProperty('--i', idx(id));
  seg.querySelectorAll('button').forEach(b => { const on = b.dataset.v === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  pane.innerHTML = today ? paneHTML() : analysisPane();
  pane.classList.remove('from-left', 'from-right'); void pane.offsetWidth; pane.classList.add(dir);
  const y = pane.getBoundingClientRect().top + window.scrollY - seg.offsetHeight - 24;
  if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
}
function step(n) {
  const list = tab === 'today' ? SECTIONS : ASECTIONS, cur = tab === 'today' ? section : aSection;
  const i = list.findIndex(x => x.id === cur) + n;
  if (i >= 0 && i < list.length) switchTo(list[i].id);
}

function onboardingHTML() {
  return `<h1>Willkommen im Ringtagebuch</h1>
  <div class="card">
    <p>Ab dem Tag, an dem der neue Ring eingesetzt wird, hält die App jeden Tag Symptome, Essen und Emotionen fest und wertet alles zusammen aus. So wird sichtbar, wie der Ring den Körper und die Endometriose beeinflusst.</p>
    <label for="ob-date">Ring eingesetzt am</label>
    <input type="date" id="ob-date" value="${todayStr()}" max="${todayStr()}">
    <label for="ob-wear">Ring wird gewechselt nach</label>
    <select id="ob-wear"><option value="21">21 Tagen (3 Wochen)</option><option value="28" selected>28 Tagen (4 Wochen)</option><option value="31">31 Tagen</option></select>
    <label for="ob-pause">Ringpause</label>
    <select id="ob-pause"><option value="0" selected>Keine – durchgehende Anwendung</option><option value="7">7 Tage</option></select>
    <p class="muted">Lässt sich später unter „Mehr“ jederzeit ändern.</p>
    <p><button class="btn" data-action="start">Los geht's</button></p>
  </div>
  <p class="notice">Alle Daten bleiben auf diesem Gerät und werden nirgends hochgeladen.</p>`;
}

const signed = i => i > 0 ? '+' + i : String(i).replace('-', '−');
// Wert lesen/schreiben, auch verschachtelt (z. B. „painDay.m“ = Schmerz morgens)
const getVal = (e, key) => { const [a, b] = key.split('.'); return b ? (e[a] || {})[b] : e[a]; };
function setVal(key, v) {
  const [a, b] = key.split('.');
  if (!b) { patch({ [a]: v }); return; }
  const obj = { ...(getE()[a] || {}), [b]: v };
  const vals = Object.values(obj).filter(x => x != null);
  patch({ [a]: obj, pain: vals.length ? Math.max(...vals) : null }); // Tageswert = höchster Wert des Tages
  const mx = document.getElementById('daymax');
  if (mx) mx.textContent = dayMaxText();
}
const dayMaxText = () => `Tageswert (höchster): ${getE().pain ?? '–'}`;
// Schieberegler: ziehen, auf eine Zahl tippen oder mit den Pfeiltasten; nochmal auf dieselbe Zahl tippen = leeren
function scaleHTML(key, min, max, val, labels, title, tone = '') {
  const n = max - min + 1, lbl = i => (min < 0 ? signed(i) : String(i));
  return `<div class="sl ${tone} ${val == null ? 'empty' : ''}" data-k="${key}" data-min="${min}" data-max="${max}" role="slider" tabindex="0"
    aria-label="${esc(title)}" aria-valuemin="${min}" aria-valuemax="${max}" ${val != null ? `aria-valuenow="${val}" aria-valuetext="${lbl(val)}"` : 'aria-valuetext="nicht bewertet"'}
    style="--p:${val == null ? 0 : (val - min) / (max - min) * 100}">
    <span class="sl-hint">Antippen oder ziehen</span>
    <div class="sl-track"><i class="sl-fill"></i><b class="sl-thumb"><span>${val == null ? '' : lbl(val)}</span></b></div>
    <div class="sl-ticks" style="--n:${n}">${Array.from({ length: n }, (_, k) => min + k).map(i =>
      `<button type="button" tabindex="-1" data-action="scale" data-k="${key}" data-v="${i}" style="--x:${(i - min) / (max - min) * 100}" class="${val === i ? 'on' : ''}" aria-label="${esc(title)}: ${lbl(i)}">${lbl(i)}</button>`).join('')}</div>
  </div>${labels ? `<div class="scale-lbl"><span>${labels[0]}</span><span>${labels[1]}</span></div>` : ''}`;
}
function updateSlider(sl, val) {
  const min = +sl.dataset.min, max = +sl.dataset.max, lbl = i => (min < 0 ? signed(i) : String(i));
  sl.classList.toggle('empty', val == null);
  sl.style.setProperty('--p', val == null ? 0 : (val - min) / (max - min) * 100);
  sl.querySelector('.sl-thumb span').textContent = val == null ? '' : lbl(val);
  if (val == null) { sl.removeAttribute('aria-valuenow'); sl.setAttribute('aria-valuetext', 'nicht bewertet'); }
  else { sl.setAttribute('aria-valuenow', val); sl.setAttribute('aria-valuetext', lbl(val)); }
  sl.querySelectorAll('.sl-ticks button').forEach(b => b.classList.toggle('on', +b.dataset.v === val));
}
const chipsOne = (key, labels, val) => `<div class="chips">${labels.map((l, i) => `<button class="chip ${val === i ? 'on' : ''}" aria-pressed="${val === i}" data-action="scale" data-k="${key}" data-v="${i}">${esc(l)}</button>`).join('')}</div>`;
const litres = n => String(n * 0.25).replace('.', ',');
const waterHTML = n => {
  n = n ?? 0;
  return `<div class="water"><div class="stepper"><button type="button" data-action="water" data-d="-1" aria-label="Ein Glas weniger">−</button>
    <output aria-live="polite">${n} ${n === 1 ? 'Glas' : 'Gläser'}<small>≈ ${litres(n)} l</small></output>
    <button type="button" data-action="water" data-d="1" aria-label="Ein Glas mehr">+</button></div>
    <div class="glasses" aria-hidden="true">${Array.from({ length: Math.max(8, n) }, (_, i) => `<i class="${i < n ? 'full' : ''}"></i>`).join('')}</div></div>`;
};
function frequentMeals() {
  const c = new Map();
  Object.values(entries).forEach(e => (e.meals || []).forEach(m => {
    const t = (m.text || '').trim();
    if (t.length < 2) return;
    const o = c.get(t.toLowerCase()) || { t, n: 0 };
    o.n++; c.set(t.toLowerCase(), o);
  }));
  return [...c.values()].sort((a, b) => b.n - a.n).slice(0, 40).map(o => o.t);
}
const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : h < 22 ? 'Guten Abend' : 'Gute Nacht'; };
const fmtHead = s => new Date(s + 'T00:00:00Z').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const multiChips = (key, opts, sel = []) => `<div class="chips">${opts.map(o => `<button class="chip ${sel.includes(o) ? 'on' : ''}" aria-pressed="${sel.includes(o)}" data-action="toggle" data-k="${key}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;

function bannersHTML() {
  const out = [];
  if (flash) out.push(`<div class="insight">${flash}</div>`);
  const ph = phaseOf(todayStr());
  if (ph && ph.kind === 'pause' && ph.day === 1)
    out.push(`<div class="insight"><b>Heute Ring entfernen.</b> Die Ringpause beginnt (${settings.pauseDays} Tage). Neuer Ring am ${fmtDate(ph.changeDate)}.</div>`);
  if (ph && ph.kind === 'over')
    out.push(`<div class="insight"><b>${ph.day === 1 ? (settings.pauseDays ? 'Heute neuen Ring einsetzen.' : 'Heute Ring wechseln.') : `Ringwechsel seit ${ph.day - 1} Tag(en) überfällig.`}</b><br>
      <button class="btn small" data-action="newring" data-due="1">Neuen Ring eingesetzt</button></div>`);
  if (doctor.date && doctor.date >= todayStr() && dayNum(doctor.date) - dayNum(todayStr()) <= 1) {
    const open = doctor.questions.filter(q => !q.done).length;
    out.push(`<div class="insight"><b>${doctor.date === todayStr() ? 'Heute' : 'Morgen'} ist dein Arzttermin.</b> ${open ? `${open} offene ${open === 1 ? 'Frage' : 'Fragen'}.` : ''} Den Bericht findest du unter „Auswertung“.
      <br><button class="btn ghost small" data-action="gotab" data-v="settings">Fragen ansehen</button></div>`);
  }
  const logged = Object.values(entries).filter(hasData).length;
  const last = store.get(KEYS.backup, null);
  if (logged >= 14 && (!last || dayNum(todayStr()) - dayNum(last) > 30))
    out.push(`<div class="insight">Tipp: Zeit für ein Backup, damit keine Daten verloren gehen. <button class="btn ghost small" data-action="backup">Backup erstellen</button></div>`);
  return out.join('');
}

function todayHTML() {
  const e = getE();
  const ph = phaseOf(curDate);
  const isToday = curDate === todayStr();
  const { wearDays: w, pauseDays: p } = settings;
  let status = '<p class="muted">Dieser Tag liegt vor dem ersten Ring.</p>';
  if (ph) {
    const sub = ph.kind === 'ring' ? `Ring-Tag ${ph.day} von ${w} · ${p ? 'Ring raus' : 'Wechsel'} am ${fmtShort(addDays(ph.start, w))}`
      : ph.kind === 'pause' ? `Pausentag ${ph.day} von ${p} · neuer Ring am ${fmtShort(ph.changeDate)}`
        : ph.day === 1 ? (p ? 'Heute kommt der neue Ring' : 'Heute ist Wechseltag') : `${ph.day - 1} Tag(e) über dem Wechseltermin`;
    const pct = ph.kind === 'ring' ? ph.day / w * 100 : ph.kind === 'pause' ? ph.day / p * 100 : 100;
    const badge = ph.kind === 'over' ? (ph.day === 1 ? '↻' : '!') : ph.day;
    const cls = ph.kind === 'over' && ph.day === 1 ? 'pause' : ph.kind;
    status = `<div class="status"><div class="ringprog ${cls}"><svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="rpg" x1="1" y1=".5" x2="0" y2=".5"><stop offset="0" stop-color="#f797ad"/><stop offset=".5" stop-color="#f7c3a4"/><stop offset="1" stop-color="#bfe96a"/></linearGradient></defs>
        <circle class="rp-bg" cx="32" cy="32" r="27"/><circle class="rp-fg" cx="32" cy="32" r="27" pathLength="100" stroke="url(#rpg)" style="--to:${100 - Math.min(100, pct)}"/></svg><b>${badge}</b></div>
      <div class="info"><b>${phaseLabel(ph)}</b><div class="muted">${sub}</div><div class="muted">Tagebuch-Tag ${diaryDay(curDate)} · Ring ${ph.cycle}</div></div></div>
      ${isToday && ph.kind !== 'over' && !settings.inserts.includes(todayStr()) ? '<p style="margin:10px 0 0"><button class="btn ghost small" data-action="newring">Ring heute gewechselt</button></p>' : ''}`;
  }
  const done = SECTIONS.filter(x => secDone(x, e)).length;
  if (done === 4) celebrated[curDate] = true;
  const where = !ph ? '' : ph.kind === 'ring' ? `Ring-Tag ${ph.day} · ` : `${phaseLabel(ph)} · `;
  return `
  <div class="today-head"><div>
      <p class="greet">${isToday ? greeting() : 'Nachtrag'}</p>
      <h1 class="large" data-short="${isToday ? 'Heute' : esc(fmtDate(curDate))}">${fmtHead(curDate)}</h1>
      <p class="muted summary">${where}<span id="sum-count">${done} von 4 Bereichen erfasst</span></p></div>
    <div class="day-nav"><button class="btn ghost small round" data-action="day" data-d="-1" aria-label="Vortag">‹</button>
      <button class="btn ghost small round" data-action="day" data-d="1" aria-label="Folgetag" ${isToday ? 'disabled' : ''}>›</button></div></div>
  ${!isToday ? '<p class="muted">Nachtrag für einen vergangenen Tag · <a href="#" data-action="gotoday">zu heute</a></p>' : ''}
  ${isToday ? `<div>${bannersHTML()}</div>` : ''}
  <div class="card status-card">${status}</div>
  ${segHTML(SECTIONS, section, 'section', e)}
  <div id="pane" class="pane">${paneHTML()}</div>`;
}

function paneHTML() {
  const e = getE();
  const i = SECTIONS.findIndex(x => x.id === section);
  const prev = SECTIONS[i - 1], next = SECTIONS[i + 1];
  const meals = e.meals || [];
  const yMeals = (entries[addDays(curDate, -1)]?.meals || []).filter(m => filled(m.text));
  const body = {
    sym: () => `<h2 class="sec-title">Endometriose-Symptome</h2>
    ${mod('daytime') ? `<h3>Schmerzen nach Tageszeit</h3>${DAYTIMES.map(([k, l, lo]) => `<p class="daytime-lbl">${l}</p>${scaleHTML('painDay.' + k, 0, 10, (e.painDay || {})[k], null, `Schmerzen ${lo}`)}`).join('')}
      <div class="scale-lbl"><span>keine</span><span>unerträglich</span></div><p class="daymax" id="daymax">${dayMaxText()}</p>`
    : `<h3>Schmerzen</h3>${scaleHTML('pain', 0, 10, e.pain, ['keine', 'unerträglich'], 'Schmerzen')}`}
    <h3>Wo?</h3>${multiChips('painAreas', PAIN_AREAS, e.painAreas)}
    <h3>Krämpfe</h3>${scaleHTML('cramps', 0, 10, e.cramps, ['keine', 'sehr stark'], 'Krämpfe')}
    <h3>Durchfall</h3><div class="chips">${DIARRHEA.map((l, i) => `<button class="chip ${e.diarrhea === i ? 'on' : ''}" aria-pressed="${e.diarrhea === i}" data-action="scale" data-k="diarrhea" data-v="${i}">${l}</button>`).join('')}</div>
    <h3>Blutung</h3><div class="chips">${BLEEDING.map(([k, l]) => `<button class="chip ${e.bleeding === k ? 'on' : ''}" aria-pressed="${e.bleeding === k}" data-action="bleed" data-k="bleeding" data-v="${k}">${l}</button>`).join('')}</div>
    ${mod('extraSym') ? `<h3>Weitere Beschwerden</h3>${multiChips('symptoms', EXTRA_SYM, e.symptoms)}` : ''}
    <h3>Freitext</h3><textarea data-f="symNote" placeholder="Wie fühlte es sich an? Stechend, ziehend, brennend … Wann und wobei? Was war anders als sonst?">${esc(e.symNote || '')}</textarea>`,
    food: () => `<h2 class="sec-title">Essenstagebuch</h2>
    <p class="muted">Was gab es, wie viel und wann?</p>
    <div id="meals">${meals.map((m, i) => mealHTML(m, i)).join('')}</div>
    <div class="btn-row"><button class="btn ghost small" data-action="addmeal">+ Mahlzeit</button>
    ${yMeals.length ? `<button class="btn ghost small" data-action="copyyesterday">Wie gestern (${yMeals.length})</button>` : ''}</div>
    <datalist id="meal-suggest">${frequentMeals().map(t => `<option value="${esc(t)}">`).join('')}</datalist>
    ${mod('foodTags') ? `<h3>Merkmale</h3><p class="muted" style="margin-top:-2px">Was war heute im Essen?</p>${multiChips('foodTags', FOOD_TAGS, e.foodTags)}` : ''}
    <h3>Freitext zum Essen</h3><textarea data-f="foodNote" placeholder="Getränke, Zutaten, Beschwerden nach dem Essen …">${esc(e.foodNote || '')}</textarea>`,
    emo: () => `<h2 class="sec-title">Gefühle</h2>
    <h3>Laune</h3>${scaleHTML('mood', -5, 5, e.mood, ['sehr schlecht', 'sehr gut'], 'Laune von −5 bis +5', 'mood')}
    <h3>Angst</h3>${scaleHTML('anxiety', 0, 5, e.anxiety, ['keine', 'sehr stark'], 'Angst')}
    <h3>Wut</h3>${scaleHTML('anger', 0, 5, e.anger, ['keine', 'sehr stark'], 'Wut')}
    <h3>Stress</h3>${scaleHTML('stress', 0, 5, e.stress, ['keiner', 'sehr stark'], 'Stress')}
    <h3>Freitext</h3><textarea data-f="note" placeholder="Wie geht es dir heute? Was ist passiert?">${esc(e.note || '')}</textarea>`,
    body: () => `<h2 class="sec-title">Körper &amp; Medikamente</h2>
    <h3>Schlaf letzte Nacht</h3>${scaleHTML('sleep', 1, 5, e.sleep, ['sehr schlecht', 'sehr gut'], 'Schlaf', 'good')}
    <h3>Energie</h3>${scaleHTML('energy', 1, 5, e.energy, ['erschöpft', 'voller Energie'], 'Energie', 'good')}
    ${mod('drinkMove') ? `<h3>Getrunken (Gläser à 250 ml)</h3>${waterHTML(e.water)}<h3>Bewegung</h3>${chipsOne('movement', MOVEMENT, e.movement)}` : ''}
    <h3>Schmerzmittel &amp; Hilfen</h3>${multiChips('meds', MEDS, e.meds)}
    <input type="text" data-f="medsNote" value="${esc(e.medsNote || '')}" placeholder="Dosis, weitere Medikamente …" style="margin-top:8px" aria-label="Medikamente Notiz">
    ${mod('medEffect') ? `<div id="med-extra" class="med-extra" ${hasPainkiller(e) ? '' : 'hidden'}>
      <h3>Eingenommen um</h3><input type="time" data-f="medTime" value="${esc(e.medTime || '')}" aria-label="Uhrzeit der Einnahme">
      <h3>Hat es geholfen?</h3>${chipsOne('medEffect', MED_EFFECT, e.medEffect)}</div>` : ''}`
  }[section]();
  return `<div class="card">${body}</div>
  <div class="pane-nav">
    ${prev ? `<button class="btn ghost" data-action="step" data-d="-1">‹ ${prev.label}</button>` : '<span></span>'}
    ${next ? `<button class="btn" data-action="step" data-d="1">Weiter: ${next.label} ›</button>` : '<button class="btn" data-action="finish">Fertig ✓</button>'}
  </div>
  <p class="muted" style="text-align:center">Wird automatisch gespeichert · zum Wechseln seitlich wischen</p>`;
}
const mealHTML = (m, i) => `<div class="meal" data-meal="${i}">
      <input type="time" data-f="meal-time" value="${esc(m.time)}" aria-label="Uhrzeit">
      <select data-f="meal-amount" aria-label="Menge">${AMOUNTS.map(a => `<option ${m.amount === a ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <button class="btn danger small" data-action="delmeal" data-i="${i}" aria-label="Mahlzeit löschen">✕</button>
      <input type="text" data-f="meal-text" value="${esc(m.text)}" placeholder="z. B. Haferbrei mit Banane" aria-label="Was gab es?" list="meal-suggest" autocomplete="off">
    </div>`;

function historyHTML() {
  const [y, m] = calMonth.split('-').map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let cells = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < lead; i++) cells += '<button class="blank" tabindex="-1" aria-hidden="true"></button>';
  for (let d = 1; d <= dim; d++) {
    const ds = `${calMonth}-${String(d).padStart(2, '0')}`;
    const e = entries[ds];
    const ph = phaseOf(ds);
    const future = ds > todayStr();
    const dot = e && isBleed(e) ? '<span class="dot"></span>' : e && isSpot(e) ? '<span class="dot spot"></span>' : '';
    const ins = settings.inserts.includes(ds) ? '<span class="ins">↻</span>' : '';
    const heat = e && e.pain != null ? e.pain : 0;
    cells += `<button style="--d:${d};--heat:${heat}" data-action="open" data-d="${ds}" ${future ? 'disabled' : ''} aria-label="${fmtDate(ds)}${e && e.pain != null ? `, Schmerzen ${e.pain}` : ''}"
      class="${ds === todayStr() ? 'today' : ''} ${ph && ph.kind === 'pause' ? 'pausebg' : ''} ${hasData(e) ? 'logged' : ''} ${heat >= 6 ? 'hot' : ''}">${d}${ins}${dot}</button>`;
  }
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `<h1 class="large">Verlauf</h1>
  <div class="card">
  <div class="row between" style="margin-bottom:10px"><button class="btn ghost small" data-action="month" data-d="-1" aria-label="Voriger Monat">‹</button><b>${label}</b><button class="btn ghost small" data-action="month" data-d="1" aria-label="Nächster Monat">›</button></div>
  <div class="cal">${cells}</div>
  <div class="legend"><span style="color:var(--blood)">● Blutung</span><span style="color:var(--blood)">○ Schmierblutung</span><span style="color:var(--accent)">↻ Ringwechsel</span>${settings.pauseDays ? '<span style="color:var(--ok)">▮ Ringpause</span>' : ''}<span>Schmerz 0<i class="heat-scale"></i>10</span><span><b>Fett</b> = erfasst</span></div>
  </div>
  <p class="muted">Tippe auf einen Tag, um ihn anzusehen oder nachzutragen.</p>`;
}

// ---------- Auswertung ----------
const avg = a => { const v = a.filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const f1 = x => x == null ? '–' : x.toFixed(1).replace('.', ',').replace('-', '−');
const fs = x => x == null ? '–' : (x > 0.05 ? '+' : '') + f1(x);
const pct = (n, d) => d ? Math.round(n / d * 100) + ' %' : '–';

function loggedDays() {
  let rows = Object.keys(entries).filter(d => hasData(entries[d])).sort().map(d => ({ d, e: entries[d], ph: phaseOf(d) }));
  if (period === 'month') rows = rows.filter(r => r.d.startsWith(pMonth));
  if (period === '31') rows = rows.filter(r => r.d >= addDays(todayStr(), -30));
  if (period === 'ring') { const cur = phaseOf(todayStr()); rows = cur ? rows.filter(r => r.ph && r.ph.start === cur.start) : []; }
  return rows;
}

function groupStats(rows) {
  return {
    n: rows.length,
    pain: avg(rows.map(r => r.e.pain)),
    cramps: avg(rows.map(r => r.e.cramps)),
    diar: rows.filter(r => r.e.diarrhea > 0).length,
    bleed: rows.filter(r => isBleed(r.e)).length,
    spot: rows.filter(r => isSpot(r.e)).length,
    stress: avg(rows.map(r => r.e.stress)),
    mood: avg(rows.map(r => r.e.mood)),
    meds: rows.filter(r => (r.e.meds || []).some(m => m !== 'Wärmflasche')).length
  };
}

const CHARTS = new Map();
let chartSeq = 0;
// weiche Kurve durch die Punkte (Catmull-Rom), ohne über den Rand hinauszuschießen
function smoothPath(pts, top, bottom) {
  const cl = v => Math.min(bottom, Math.max(top, v));
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, cl(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, cl(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
function chartSVG(rows, series, minV, maxV, showBleed) {
  if (rows.length < 2) return '<p class="muted">Für das Diagramm werden mindestens 2 erfasste Tage benötigt.</p>';
  if (!rows.some(r => series.some(sr => r.e[sr.key] != null))) return '<p class="muted">Noch keine Werte erfasst.</p>';
  const W = 600, H = 200, L = 28, R = 8, T = 10, B = 24;
  const d0 = dayNum(rows[0].d), d1 = dayNum(rows[rows.length - 1].d);
  const span = Math.max(1, d1 - d0);
  const x = d => L + (dayNum(d) - d0) / span * (W - L - R);
  const y = v => T + (1 - (v - minV) / (maxV - minV)) * (H - T - B);
  const bw = (W - L - R) / (span + 1);
  const id = ++chartSeq;
  CHARTS.set(id, { W, H, L, R, T, B, d0, span, rows: rows.map(r => ({ d: r.d, e: r.e })), series });
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Verlauf: ${series.map(sr => sr.label).join(', ')}. Antippen zeigt die Werte eines Tages.">`;
  for (let i = d0; i <= d1; i++) {
    const ds = fromNum(i), ph = phaseOf(ds);
    if (ph && ph.kind === 'pause') s += `<rect x="${x(ds) - bw / 2}" y="${T}" width="${bw}" height="${H - T - B}" fill="var(--ok)" opacity=".18"/>`;
    if (settings.inserts.includes(ds)) s += `<line x1="${x(ds)}" x2="${x(ds)}" y1="${T}" y2="${H - B}" stroke="var(--accent)" stroke-dasharray="2 3" opacity=".6"/>`;
  }
  [minV, (minV + maxV) / 2, maxV].forEach(v => s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="4" y="${y(v) + 3}">${v}</text>`);
  series.forEach(sr => {
    const pts = rows.filter(r => r.e[sr.key] != null).map(r => [x(r.d), y(r.e[sr.key])]);
    if (!pts.length) return;
    if (pts.length > 1) s += `<path fill="none" stroke="${sr.color}" stroke-width="2.4" stroke-linecap="round" ${sr.dash ? 'stroke-dasharray="5 4"' : 'pathLength="1" class="draw"'} d="${smoothPath(pts, T, H - B)}"/>`;
    s += pts.map(([cx, cy]) => `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.2" fill="${sr.color}"/>`).join('');
  });
  if (showBleed) rows.forEach(r => { if (isBleed(r.e) || isSpot(r.e)) s += `<circle cx="${x(r.d).toFixed(1)}" cy="${H - 10}" r="3.5" fill="${isBleed(r.e) ? 'var(--blood)' : 'none'}" stroke="var(--blood)" stroke-width="1.5"/>`; });
  [...new Set([rows[0].d, rows[Math.floor(rows.length / 2)].d, rows[rows.length - 1].d])].forEach(d => s += `<text x="${x(d)}" y="${H - 1}" text-anchor="middle">${fmtShort(d)}</text>`);
  return `<div class="chart" data-cid="${id}">${s}</svg><div class="tip" hidden></div></div><div class="legend">` + series.map(sr => `<span style="color:${sr.color}">${sr.dash ? '╌' : '━'} ${sr.label}</span>`).join('') +
    (showBleed ? '<span style="color:var(--blood)">● Blutung ○ Schmier</span>' : '') +
    '<span style="color:var(--accent)">┆ Ringwechsel</span>' + (settings.pauseDays ? '<span style="color:var(--ok)">▮ Ringpause</span>' : '') + '</div>';
}
function chartAt(ev) {
  const ch = ev.target.closest && ev.target.closest('.chart');
  if (!ch) return false;
  const c = CHARTS.get(+ch.dataset.cid);
  if (!c) return false;
  const svg = ch.querySelector('svg'), r = svg.getBoundingClientRect();
  const day = Math.round(((ev.clientX - r.left) / r.width * c.W - c.L) / (c.W - c.L - c.R) * c.span) + c.d0;
  let best = null;
  c.rows.forEach(row => { const dd = Math.abs(dayNum(row.d) - day); if (!best || dd < best.dd) best = { row, dd }; });
  if (!best) return false;
  const xr = c.L + (dayNum(best.row.d) - c.d0) / c.span * (c.W - c.L - c.R);
  let g = svg.querySelector('.guide');
  if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'line'); g.setAttribute('class', 'guide'); svg.appendChild(g); }
  g.setAttribute('x1', xr); g.setAttribute('x2', xr); g.setAttribute('y1', c.T); g.setAttribute('y2', c.H - c.B);
  const tip = ch.querySelector('.tip');
  tip.hidden = false;
  tip.innerHTML = `<b>${fmtDate(best.row.d)}</b>` + c.series.map(sr => {
    const v = best.row.e[sr.key];
    return `<span style="color:${sr.color}">${sr.label}: ${v == null ? '–' : sr.key === 'mood' ? signed(v) : v}</span>`;
  }).join('<br>');
  const px = xr / c.W * r.width;
  tip.style.left = `${Math.min(r.width - 70, Math.max(70, px))}px`;
  return true;
}
function hideTips(except) {
  view.querySelectorAll('.chart').forEach(ch => {
    if (ch === except) return;
    const t = ch.querySelector('.tip'); if (t) t.hidden = true;
    const g = ch.querySelector('.guide'); if (g) g.remove();
  });
}

const STOP = new Set(['mit', 'und', 'oder', 'etwas', 'wenig', 'viel', 'ohne', 'dazu', 'eine', 'einen', 'einer', 'eines', 'dem', 'den', 'der', 'die', 'das', 'sowie', 'noch', 'auch', 'kleine', 'kleiner', 'groß', 'heute', 'gestern', 'habe', 'hatte', 'waren', 'wurde', 'sehr', 'dann', 'aber', 'nach', 'nicht', 'ganz', 'dass', 'weil', 'mehr', 'mich', 'mein', 'meine', 'sich', 'war', 'wieder', 'schon', 'immer', 'bisschen', 'einem', 'beim', 'vom', 'zum', 'zur']);
const words = t => (String(t || '').toLowerCase().match(/[a-zäöüß]{4,}/g) || []).filter(w => !STOP.has(w));
function foodFeatures(r) {
  const meals = (r.e.meals || []).filter(m => filled(m.text));
  const f = new Set(words(meals.map(m => m.text).join(' ') + ' ' + (r.e.foodNote || '')));
  if (meals.some(m => m.time && m.time >= '20:00')) f.add('spätes Essen (ab 20 Uhr)');
  if (meals.some(m => m.amount === 'viel')) f.add('große Portion');
  (r.e.foodTags || []).forEach(t => f.add('Merkmal ' + t));
  return f;
}

// Zusammenhänge zwischen Essen, Emotionen, Schlaf und Symptomen (selber oder nächster Tag)
function correlationNotes(rows) {
  const byDate = Object.fromEntries(rows.map(r => [r.d, r]));
  const strong = r => Math.max(r.e.pain ?? 0, r.e.cramps ?? 0) >= 6;
  const diar = r => (r.e.diarrhea ?? 0) >= 1;
  const outcomes = [['starke Schmerzen oder Krämpfe', strong], ['Durchfall', diar]];
  const near = (r, f) => { const nx = byDate[addDays(r.d, 1)]; return f(r) || (!!nx && f(nx)); };
  const out = [];
  const sources = [
    ['Essen', foodFeatures, r => hasMeals(r.e) || filled(r.e.foodNote) || (r.e.foodTags || []).length > 0],
    ['Tagebuchtext', r => new Set(words(r.e.note)), r => filled(r.e.note)]
  ];
  for (const [name, feats, has] of sources) {
    const withText = rows.filter(has);
    if (withText.length < 7) continue;
    const map = {};
    withText.forEach(r => feats(r).forEach(w => (map[w] ||= []).push(r)));
    for (const [label, f] of outcomes) {
      const base = withText.filter(r => near(r, f)).length / withText.length;
      const groups = {};
      Object.entries(map).filter(([, v]) => v.length >= 3)
        .map(([w, v]) => ({ w, n: v.length, key: v.map(r => r.d).join(), rate: v.filter(r => near(r, f)).length / v.length }))
        .filter(x => x.rate >= 0.5 && x.rate - base >= 0.25)
        .forEach(x => (groups[x.key] ||= { ...x, words: [] }).words.push(x.w));
      Object.values(groups).sort((a, b) => b.rate - a.rate).slice(0, 3).forEach(x =>
        out.push(`${name}: ${x.words.sort((u, v) => v.includes(' ') - u.includes(' ')).slice(0, 5).map(w => `„<b>${esc(w)}</b>“`).join(', ')} kam${x.words.length > 1 ? 'en' : ''} an ${x.n} Tagen vor. Am selben oder nächsten Tag gab es dann in ${Math.round(x.rate * 100)} % der Fälle ${label} (sonst ${Math.round(base * 100)} %).`));
    }
  }
  // [Bezeichnung, Wort, Feld, Auffällig?, Rückrichtung prüfen: +1 höher / −1 niedriger an Beschwerdetagen / 0 nicht]
  const factors = [
    ['schlechter Laune (−2 oder darunter)', 'Laune', 'mood', v => v <= -2, -1],
    ['hohem Stress', 'Stress', 'stress', v => v >= 3, 1],
    ['starker Angst', 'Angst', 'anxiety', v => v >= 3, 1],
    ['starker Wut', 'Wut', 'anger', v => v >= 3, 1],
    ['schlechtem Schlaf', 'Schlaf', 'sleep', v => v <= 2, 0],
    ['wenig Energie', 'Energie', 'energy', v => v <= 2, 0],
    ['wenig Getrunkenem (unter 5 Gläsern)', 'Trinken', 'water', v => v < 5, 0],
    ['keiner Bewegung', 'Bewegung', 'movement', v => v === 0, 0]
  ];
  for (const [label, noun, k, isHigh, dir] of factors) {
    const have = rows.filter(r => r.e[k] != null);
    const hi = have.filter(r => isHigh(r.e[k])), lo = have.filter(r => !isHigh(r.e[k]));
    if (have.length < 7 || hi.length < 3 || lo.length < 3) continue;
    for (const [oLabel, f] of outcomes) {
      const a = hi.filter(r => near(r, f)).length / hi.length, b = lo.filter(r => near(r, f)).length / lo.length;
      if (a - b >= 0.2) out.push(`Nach Tagen mit ${label} gab es am selben oder nächsten Tag in ${Math.round(a * 100)} % der Fälle ${oLabel}, sonst in ${Math.round(b * 100)} %.`);
    }
    if (dir) {
      const sR = have.filter(strong), oR = have.filter(r => !strong(r));
      if (sR.length >= 3 && oR.length >= 3) {
        const a = avg(sR.map(r => r.e[k])), b = avg(oR.map(r => r.e[k]));
        const fmt = k === 'mood' ? fs : f1;
        if ((a - b) * dir >= 0.7) out.push(`An Tagen mit starken Beschwerden war ${k === 'mood' ? 'die Laune schlechter' : `die ${noun === 'Stress' ? 'Stress-Belastung' : noun} höher`} (Ø ${fmt(a)} statt ${fmt(b)}). Körper und Gefühle beeinflussen sich vermutlich gegenseitig.`);
      }
    }
  }
  return out;
}

function topCounts(rows, key, exclude = []) {
  const c = {};
  rows.forEach(r => (r.e[key] || []).filter(x => !exclude.includes(x)).forEach(x => c[x] = (c[x] || 0) + 1));
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}

function analysisHTML() {
  return analysisParts().head + (analysisParts.cache.enough ? segHTML(ASECTIONS, aSection, 'section') + `<div id="pane" class="pane">${analysisPane()}</div>` : analysisParts.cache.body);
}
function analysisPane() { const p = analysisParts.cache; return p.parts[aSection] + p.footer; }
// alles auf einmal (Bericht, Drucken)
function analysisFull() {
  const p = analysisParts();
  const promptCard = `<div class="card"><h2 style="margin-top:0">Auftrag an die KI</h2><pre class="ai">${esc(aiPrompt())}</pre></div>`;
  const daysCard = `<div class="card"><h2 style="margin-top:0">Tagesdaten</h2><pre class="ai">${esc(aiDays())}</pre></div>`;
  const open = doctor.questions.filter(q => !q.done);
  const qCard = open.length ? `<div class="card"><h2 style="margin-top:0">Fragen für den Arzttermin</h2><ul>${open.map(q => `<li>${esc(q.t)}</li>`).join('')}</ul></div>` : '';
  return p.head + promptCard + qCard + (p.enough ? ASECTIONS.map(x => p.parts[x.id]).join('') : p.body) + daysCard + (p.enough ? p.footer : '');
}

// ---------- KI-Auftrag ----------
const plain = html => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent.replace(/\s+/g, ' ').trim(); };
function aiPrompt() {
  const { wearDays: w, pauseDays: p } = settings;
  const rhythm = p ? `${w} Tage mit Ring, danach ${p} Tage Pause` : `durchgehend ohne Pause, Ringwechsel alle ${w} Tage`;
  return `Du bist ein interdisziplinäres Team aus
1. einer Gynäkologin mit Schwerpunkt Endometriose und hormonelle Verhütung,
2. einer Ernährungsfachkraft mit Erfahrung bei Endometriose,
3. einer Psychologin mit Schwerpunkt chronische Schmerzen.

HINTERGRUND
Ich habe Endometriose und verwende den Vaginalring NuvaRing (Etonogestrel 0,120 mg und Ethinylestradiol 0,015 mg pro 24 Stunden), ${rhythm}. Ich führe dazu täglich ein Tagebuch in vier Bereichen: Endometriose-Symptome, Essen, Gefühle/Psyche und Körper. Unten findest du alle Daten für ${periodLabel()}.

SO SIND DIE WERTE ZU LESEN
- Schmerzen und Krämpfe: 0 bis 10 (0 = keine, 10 = unerträglich)
- Durchfall: keiner, 1×, 2–3×, 4× oder mehr pro Tag
- Blutung: keine, Schmierblutung, leicht, mittel, stark
- Laune: −5 (sehr schlecht) bis +5 (sehr gut)
- Angst, Wut, Stress: 0 bis 5 (0 = gar nicht, 5 = sehr stark)
- Schlaf (letzte Nacht) und Energie: 1 bis 5 (1 = sehr schlecht, 5 = sehr gut)
- Schmerzen nach Tageszeit (falls erfasst): morgens, mittags, abends; der Tageswert ist der höchste davon
- Getrunken: Anzahl Gläser à 250 ml
- Wirkung der Schmerzmittel: gar nicht, etwas, gut, sehr gut
- „Weitere“ und „Merkmale“: nur was zutraf ist genannt
- Ring-Tag 1 ist der Tag, an dem ein neuer Ring eingesetzt wurde.
- „Notiz“ ist ein Freitext, den ich in diesem Bereich selbst geschrieben habe.
- Fehlt ein Wert, wurde er nicht erfasst. Das bedeutet nicht „0“.

DEINE AUFGABE
1. Datenlage: Wie vollständig sind die Daten, und wie belastbar sind Aussagen daraus?
2. Einfluss des NuvaRings: Wie verändern sich die vier Bereiche im Verlauf eines Rings (erste Woche bis zum Wechsel) und rund um den Ringwechsel${p ? ' bzw. die Ringpause' : ''}? Gibt es Durchbruch- oder Schmierblutungen, und wann treten sie auf? Steht unten ein Vergleich mit dem Vormonat, bewerte auch die Entwicklung.
3. Die vier Bereiche einzeln:
   - Endometriose-Symptome (Schmerzen, Schmerzorte, Krämpfe, Durchfall, Blutung, Beschreibung im Freitext)
   - Essen (was, wann, wie viel, Merkmale wie Gluten oder Milchprodukte)
   - Gefühle/Psyche (Laune, Angst, Wut, Stress, Freitext)
   - Körper (Schlaf, Energie, Trinken, Bewegung, Schmerzmittel und ihre Wirkung)
4. Wechselwirkungen: Wie beeinflussen sich die Bereiche gegenseitig, in beide Richtungen und auch zeitversetzt? Zum Beispiel Essen → Beschwerden am selben oder nächsten Tag, Schmerz → Laune, Stress → Schmerz, Schlaf → Schmerz und Laune.
5. Auffällige Tage oder Muster, die du besonders hervorheben würdest.
6. Zusammenfassung und Fazit: zuerst je ein kurzes Fazit aus Sicht der Gynäkologin, der Ernährungsfachkraft und der Psychologin, dann ein gemeinsames Fazit.
7. Nächste Schritte: was ich weiter beobachten sollte, welche Ernährungsideen einen Versuch wert sind, was mir psychisch helfen kann, und 3 bis 5 Fragen für meinen nächsten Termin bei der Frauenärztin. Stehen unten schon eigene Fragen, beziehe sie ein und ergänze nur, was fehlt.

WICHTIG
- Trenne klar zwischen dem, was die Daten zeigen, und Vermutungen. Ein zeitlicher Zusammenhang ist kein Beweis für eine Ursache. Sag, wenn die Datenmenge für eine Aussage nicht reicht.
- Stelle keine Diagnosen und empfiehl keine eigenmächtige Änderung der Verhütung oder der Medikamente. Sag stattdessen, was ich mit meiner Ärztin besprechen sollte.
- Falls in den Daten Warnzeichen auftauchen, bei denen ich nicht bis zum nächsten Termin warten sollte, nenne sie deutlich.
- Fehlen dir für eine gute Einschätzung wichtige Angaben, frag mich zuerst danach.
- Antworte auf Deutsch, verständlich und mit Überschriften gegliedert.`;
}
function dayText(d, e, ph) {
  const parts = [];
  const ring = ph ? `${phaseLabel(ph)}, Ring ${ph.cycle}, Ring-Tag ${ph.kind === 'ring' ? ph.day : ph.kind === 'pause' ? settings.wearDays + ph.day : settings.wearDays + settings.pauseDays + ph.day}${settings.inserts.includes(d) ? ', NEUER RING EINGESETZT' : ''}` : 'vor dem ersten Ring';
  if (!hasData(e)) return `${fmtLong(d)} (${ring}): nicht erfasst`;
  const n = (v, max) => v == null ? null : `${v}/${max}`;
  const join = a => a.filter(Boolean).join(', ');
  const pd = e.painDay ? DAYTIMES.filter(([k]) => e.painDay[k] != null).map(([k, , lo]) => `${lo} ${e.painDay[k]}`).join(', ') : '';
  const sym = join([e.pain != null && `Schmerzen ${n(e.pain, 10)}${pd ? ` (${pd})` : ''}${(e.painAreas || []).length ? `, Ort: ${e.painAreas.join(', ')}` : ''}`,
    e.cramps != null && `Krämpfe ${n(e.cramps, 10)}`, e.diarrhea != null && `Durchfall: ${DIARRHEA[e.diarrhea]}`,
    e.bleeding && `Blutung: ${Object.fromEntries(BLEEDING)[e.bleeding]}`, (e.symptoms || []).length && `Weitere: ${e.symptoms.join(', ')}`,
    filled(e.symNote) && `Notiz: ${e.symNote.trim()}`]);
  const meals = (e.meals || []).filter(m => filled(m.text)).map(m => `${m.time || '?'} ${m.text.trim()} (${m.amount})`).join('; ');
  const food = join([meals, (e.foodTags || []).length && `Merkmale: ${e.foodTags.join(', ')}`, filled(e.foodNote) && `Notiz: ${e.foodNote.trim()}`]);
  const emo = join([e.mood != null && `Laune ${signed(e.mood)}`, e.anxiety != null && `Angst ${n(e.anxiety, 5)}`, e.anger != null && `Wut ${n(e.anger, 5)}`,
    e.stress != null && `Stress ${n(e.stress, 5)}`, filled(e.note) && `Notiz: ${e.note.trim()}`]);
  const body = join([e.sleep != null && `Schlaf ${n(e.sleep, 5)}`, e.energy != null && `Energie ${n(e.energy, 5)}`,
    e.water != null && `Getrunken: ${e.water} Gläser (etwa ${litres(e.water)} l)`, e.movement != null && `Bewegung: ${MOVEMENT[e.movement]}`,
    ((e.meds || []).length || filled(e.medsNote)) && `Schmerzmittel/Hilfen: ${join([(e.meds || []).join(', '), filled(e.medsNote) && e.medsNote.trim(),
      e.medTime && `eingenommen ${e.medTime}`, e.medEffect != null && `geholfen: ${MED_EFFECT[e.medEffect]}`])}`]);
  parts.push(`${fmtLong(d)} (${ring})`);
  parts.push(`  Symptome: ${sym || 'nicht erfasst'}`);
  parts.push(`  Essen: ${food || 'nicht erfasst'}`);
  parts.push(`  Gefühle: ${emo || 'nicht erfasst'}`);
  parts.push(`  Körper: ${body || 'nicht erfasst'}`);
  return parts.join('\n');
}
function aiDays() {
  const rows = loggedDays();
  if (!rows.length) return 'Für diesen Zeitraum wurden keine Daten erfasst.';
  let from = rows[0].d, to = rows[rows.length - 1].d;
  if (period === 'month') {
    from = pMonth + '-01';
    const end = fromNum(dayNum(addDays(from, 32).slice(0, 7) + '-01') - 1);
    to = end < todayStr() ? end : todayStr();
  }
  const first = sortedInserts()[0];
  if (from < first) from = first;
  const out = [];
  for (let i = dayNum(from); i <= dayNum(to); i++) { const d = fromNum(i); out.push(dayText(d, entries[d] || {}, phaseOf(d))); }
  return out.join('\n\n');
}
function aiText() {
  const p = analysisParts();
  const ins = sortedInserts().map((d, i) => `Ring ${i + 1}: eingesetzt am ${fmtLong(d)}`).join('\n');
  let txt = aiPrompt() + '\n\n---\n\nRINGWECHSEL\n' + ins;
  if (p.enough) {
    const t = p.tot;
    txt += `\n\nÜBERBLICK (von der App berechnet)
- Erfasste Tage: ${t.n}
- Durchschnitt Schmerzen: ${f1(t.pain)} von 10, Krämpfe: ${f1(t.cramps)} von 10
- Tage mit Blutung: ${pct(t.bleed, t.n)}, mit Schmierblutung: ${pct(t.spot, t.n)}, mit Durchfall: ${pct(t.diar, t.n)}
- Durchschnitt Laune: ${fs(t.mood)}, Stress: ${f1(t.stress)} von 5
- Tage mit Schmerzmitteln: ${pct(t.meds, t.n)}`;
    const found = [...p.notes, ...p.links].map(plain);
    if (found.length) txt += '\n\nMUSTER, DIE DIE APP GEFUNDEN HAT (bitte kritisch prüfen)\n' + found.map(x => '- ' + x).join('\n');
    if (p.cmp) txt += '\n\n' + p.cmp.text;
  }
  const open = doctor.questions.filter(q => !q.done);
  if (open.length) txt += '\n\nMEINE OFFENEN FRAGEN AN DIE ÄRZTIN\n' + open.map(q => '- ' + q.t).join('\n');
  return txt + '\n\nTAGESDATEN\n\n' + aiDays();
}
async function aiCopy() {
  const txt = aiText();
  try { await navigator.clipboard.writeText(txt); toast('Kopiert ✓ Jetzt in der KI-App einfügen'); return; } catch (e) { /* weiter mit Ausweichweg */ }
  const ta = document.createElement('textarea');
  ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, txt.length);
  const ok = document.execCommand && document.execCommand('copy');
  ta.remove();
  toast(ok ? 'Kopiert ✓ Jetzt in der KI-App einfügen' : 'Kopieren ging nicht – bitte „Als Datei teilen“ nutzen');
}
function analysisParts() {
  const res = analysisData();
  analysisParts.cache = res;
  return res;
}
const monthName = ym => new Date(ym + '-01T00:00:00Z').toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtLong = s => new Date(s + 'T00:00:00Z').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
function periodLabel() {
  if (period === 'month') return `den Monat ${monthName(pMonth)}`;
  if (period === 'ring') { const cur = phaseOf(todayStr()); return cur ? `den aktuellen Ring (Ring ${cur.cycle}, eingesetzt am ${fmtLong(cur.start)})` : 'den aktuellen Ring'; }
  if (period === '31') return `die letzten 31 Tage (${fmtLong(addDays(todayStr(), -30))} bis ${fmtLong(todayStr())})`;
  return 'den gesamten Aufzeichnungszeitraum';
}
// Vergleich des gewählten Monats mit dem Vormonat (für Überblick und KI-Auftrag)
function monthCompare() {
  if (period !== 'month') return null;
  const [y, m] = pMonth.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const rowsOf = ym => Object.keys(entries).filter(d => d.startsWith(ym) && hasData(entries[d])).map(d => ({ d, e: entries[d] }));
  const a = rowsOf(prev), b = rowsOf(pMonth);
  if (a.length < 3 || b.length < 3) return null;
  const A = groupStats(a), B = groupStats(b);
  const sh = (n, t) => t ? n / t : null;
  const pc = v => v == null ? '–' : Math.round(v * 100) + ' %';
  // [Bezeichnung, Vormonat, dieser Monat, besser wenn: −1 kleiner / +1 größer, Format, Schwelle]
  const rows = [
    ['Ø Schmerzen', A.pain, B.pain, -1, f1, .5],
    ['Ø Krämpfe', A.cramps, B.cramps, -1, f1, .5],
    ['Tage mit Blutung/Schmierblutung', sh(A.bleed + A.spot, A.n), sh(B.bleed + B.spot, B.n), -1, pc, .1],
    ['Tage mit Durchfall', sh(A.diar, A.n), sh(B.diar, B.n), -1, pc, .1],
    ['Ø Laune', A.mood, B.mood, 1, fs, .5],
    ['Ø Stress', A.stress, B.stress, -1, f1, .5],
    ['Tage mit Schmerzmitteln', sh(A.meds, A.n), sh(B.meds, B.n), -1, pc, .1],
    ['Erfasste Tage', A.n, B.n, 0, v => String(v), 0]
  ];
  const trend = ([, va, vb, dir, , th]) => {
    if (!dir || va == null || vb == null || Math.abs(vb - va) < th) return ['≈', ''];
    return (vb - va) * dir > 0 ? ['besser', 'trend-better'] : ['schlechter', 'trend-worse'];
  };
  const prevName = monthName(prev), curName = monthName(pMonth);
  const html = `<div class="card"><h2 style="margin-top:0">Vergleich mit ${esc(prevName)}</h2><div class="table-wrap"><table>
    <tr><th>&nbsp;</th><th class="num">${esc(prevName.split(' ')[0])}</th><th class="num">${esc(curName.split(' ')[0])}</th><th class="num">Trend</th></tr>
    ${rows.map(r => { const [t, c] = trend(r); return `<tr><td>${r[0]}</td><td class="num">${r[4](r[1])}</td><td class="num">${r[4](r[2])}</td><td class="num ${c}">${t}</td></tr>`; }).join('')}
    </table></div></div>`;
  const text = `VERGLEICH MIT DEM VORMONAT (${prevName} → ${curName})\n` + rows.map(r => `- ${r[0]}: ${r[4](r[1])} → ${r[4](r[2])} (${trend(r)[0]})`).join('\n');
  return { html, text };
}
function analysisData() {
  const rows = loggedDays();
  const periods = [{ id: 'month', label: 'Monat' }, { id: 'ring', label: 'Ring' }, { id: '31', label: '31 Tage' }, { id: 'all', label: 'Gesamt' }];
  const monthNav = period === 'month' ? `<div class="month-nav noprint"><button class="btn ghost small round" data-action="pmonth" data-d="-1" aria-label="Voriger Monat">‹</button><b>${monthName(pMonth)}</b><button class="btn ghost small round" data-action="pmonth" data-d="1" aria-label="Nächster Monat" ${pMonth >= todayStr().slice(0, 7) ? 'disabled' : ''}>›</button></div>` : '';
  const head1 = `<h1 class="large">Auswertung</h1>${segHTML(periods, period, 'period', null, 'static')}${monthNav}`;
  if (rows.length < 3) return { head: head1, enough: false, body: `<div class="card"><p>Noch zu wenig Daten für diesen Zeitraum. Sobald ein paar Tage erfasst sind, erscheint hier die Auswertung.</p><p class="muted">Erfasste Tage: ${rows.length}</p></div>` };
  const tot = groupStats(rows);
  const first = rows[0].d, last = rows[rows.length - 1].d;
  const span = dayNum(last) - dayNum(first) + 1;
  const groups = {};
  rows.forEach(r => (groups[groupLabel(r.ph)] ||= []).push(r));
  const order = Object.keys(groups).sort((a, b) => groupRank(a) - groupRank(b));
  const cycles = {};
  rows.forEach(r => r.ph && (cycles[r.ph.cycle] ||= []).push(r));

  // Auffälligkeiten
  const notes = [];
  if (rows.length >= 14) {
    const h = Math.floor(rows.length / 2);
    const a = avg(rows.slice(0, h).map(r => r.e.pain)), b = avg(rows.slice(h).map(r => r.e.pain));
    if (a != null && b != null) {
      const dlt = b - a;
      notes.push(Math.abs(dlt) < 0.5 ? `Die Schmerzen sind über den Zeitraum etwa gleich geblieben (Ø ${f1(a)} → ${f1(b)}).`
        : dlt < 0 ? `Die Schmerzen sind im Verlauf gesunken: Ø ${f1(a)} in der ersten Hälfte, Ø ${f1(b)} in der zweiten.`
          : `Die Schmerzen sind im Verlauf gestiegen: Ø ${f1(a)} in der ersten Hälfte, Ø ${f1(b)} in der zweiten.`);
    }
  }
  const weeks = order.filter(g => g.startsWith('Ring Woche') && groups[g].length >= 3);
  if (weeks.length >= 2) {
    const w1 = weeks[0], wl = weeks[weeks.length - 1];
    const a = avg(groups[w1].map(r => r.e.pain)), b = avg(groups[wl].map(r => r.e.pain));
    if (a != null && b != null) notes.push(`Schmerzen in ${w1}: Ø ${f1(a)}, in ${wl} (vor dem Wechsel): Ø ${f1(b)}.${Math.abs(b - a) >= 1 ? ' Das kann auf einen Zusammenhang mit dem Hormonspiegel des Rings hindeuten, sprich es bei der Ärztin an.' : ''}`);
  }
  const ringRows = rows.filter(r => r.ph?.kind === 'ring'), pauseRows = rows.filter(r => r.ph?.kind === 'pause');
  if (ringRows.length >= 3 && pauseRows.length >= 3) {
    const a = avg(ringRows.map(r => r.e.pain)), b = avg(pauseRows.map(r => r.e.pain));
    if (a != null && b != null) notes.push(`Schmerzen mit Ring: Ø ${f1(a)}, in der Ringpause: Ø ${f1(b)}.`);
  }
  const spotRing = ringRows.filter(r => isSpot(r.e) || isBleed(r.e)).length;
  if (ringRows.length) notes.push(`An ${spotRing} von ${ringRows.length} Tagen mit Ring gab es Blutungen oder Schmierblutungen (${pct(spotRing, ringRows.length)}).`);
  const areas = topCounts(rows, 'painAreas');
  if (areas.length) notes.push(`Häufigste Schmerzorte: ${areas.slice(0, 3).map(([k, n]) => `${esc(k)} (${n} Tage)`).join(', ')}.`);
  const symWords = {};
  rows.forEach(r => new Set(words(r.e.symNote)).forEach(w => symWords[w] = (symWords[w] || 0) + 1));
  const symTop = Object.entries(symWords).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (symTop.length) notes.push(`Häufigste Beschreibungen in den Symptom-Notizen: ${symTop.map(([w, n]) => `„${esc(w)}“ (${n} Tage)`).join(', ')}.`);
  const extra = topCounts(rows, 'symptoms');
  if (extra.length) notes.push(`Häufigste weitere Beschwerden: ${extra.slice(0, 4).map(([k, n]) => `${esc(k)} (${n} Tage)`).join(', ')}.`);
  const eff = {};
  rows.forEach(r => { if (r.e.medEffect != null) (r.e.meds || []).filter(m => m !== 'Wärmflasche').forEach(m => (eff[m] ||= []).push(r.e.medEffect)); });
  const effTxt = Object.entries(eff).filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length)
    .map(([m, v]) => `${esc(m)} half im Schnitt „${MED_EFFECT[Math.round(avg(v))]}“ (${v.length}×)`);
  if (effTxt.length) notes.push(`Wirkung der Schmerzmittel: ${effTxt.join(', ')}.`);
  const water = avg(rows.map(r => r.e.water));
  if (water != null) notes.push(`Im Schnitt ${f1(water)} Gläser Wasser am Tag (etwa ${f1(water / 4)} Liter).`);
  const mv = rows.filter(r => r.e.movement != null);
  if (mv.length >= 3) notes.push(`Bewegung an ${mv.filter(r => r.e.movement > 0).length} von ${mv.length} Tagen, an denen du sie eingetragen hast.`);
  const meds = topCounts(rows, 'meds', ['Wärmflasche']);
  if (tot.meds) notes.push(`Schmerzmittel an ${tot.meds} von ${tot.n} Tagen (${pct(tot.meds, tot.n)})${meds.length ? `, am häufigsten ${esc(meds[0][0])}` : ''}.`);
  const links = correlationNotes(rows);
  const cmp = monthCompare();

  const row = (name, g) => `<tr><td>${esc(name)}</td><td class="num">${g.n}</td><td class="num">${f1(g.pain)}</td><td class="num">${f1(g.cramps)}</td><td class="num">${pct(g.diar, g.n)}</td><td class="num">${pct(g.bleed, g.n)}</td><td class="num">${pct(g.spot, g.n)}</td><td class="num">${fs(g.mood)}</td><td class="num">${f1(g.stress)}</td><td class="num">${pct(g.meds, g.n)}</td></tr>`;
  const head = '<tr><th>&nbsp;</th><th class="num">Tage</th><th class="num">Ø Schm.</th><th class="num">Ø Kr.</th><th class="num">Durchf.</th><th class="num">Blut.</th><th class="num">Schmier</th><th class="num">Ø Laune</th><th class="num">Ø Stress</th><th class="num">Schmerzm.</th></tr>';

  const card = (title, inner) => `<div class="card"><h2 style="margin-top:0">${title}</h2>${inner}</div>`;
  const parts = {};
  parts.overview = `<div class="card"><div class="stats">
    <div class="stat"><b>${f1(tot.pain)}</b>Ø Schmerz (0–10)</div>
    <div class="stat"><b>${f1(tot.cramps)}</b>Ø Krämpfe (0–10)</div>
    <div class="stat"><b>${pct(tot.bleed + tot.spot, tot.n)}</b>Tage mit Blutung oder Schmierblutung</div>
    <div class="stat"><b>${pct(tot.diar, tot.n)}</b>Tage mit Durchfall</div>
    <div class="stat"><b>${fs(tot.mood)}</b>Ø Laune (−5 bis +5)</div>
    <div class="stat"><b>${f1(tot.stress)}</b>Ø Stress (0–5)</div>
    <div class="stat"><b>${pct(tot.meds, tot.n)}</b>Tage mit Schmerzmitteln</div>
    <div class="stat"><b>${tot.n}</b>erfasste Tage</div>
  </div></div>
  ${cmp ? cmp.html : ''}
  ${notes.length ? card('Auffälligkeiten', notes.map(n => `<div class="insight">${n}</div>`).join('')) : ''}`;
  parts.links = `<div class="card"><h2 style="margin-top:0">Zusammenhänge: Essen, Gefühle &amp; Symptome</h2>
    ${links.length ? links.map(n => `<div class="insight">${n}</div>`).join('') : `<p class="muted">${rows.length < 10 ? 'Für Zusammenhänge braucht es etwa 10 erfasste Tage mit Essen und Emotionen.' : 'Bisher sind keine deutlichen Zusammenhänge erkennbar.'}</p>`}
    <p class="muted">Berücksichtigt werden Essensbeschreibungen, Uhrzeit, Menge und Merkmale der Mahlzeiten, die Freitexte zu Essen und Gefühlen, Emotionen, Schlaf, Energie, Trinken und Bewegung, jeweils am selben und am Folgetag. Das sind Muster, keine Beweise.</p></div>`;
  parts.charts = `<div class="card"><h2 style="margin-top:0">Symptome im Verlauf</h2>${chartSVG(rows, [{ key: 'pain', label: 'Schmerzen', color: 'var(--accent)' }, { key: 'cramps', label: 'Krämpfe', color: 'var(--warn)', dash: true }], 0, 10, true)}</div>
  <div class="card"><h2 style="margin-top:0">Laune im Verlauf</h2>${chartSVG(rows, [{ key: 'mood', label: 'Laune', color: 'var(--accent)' }], -5, 5, false)}</div>
  <div class="card"><h2 style="margin-top:0">Emotionen im Verlauf</h2>${chartSVG(rows, [{ key: 'stress', label: 'Stress', color: 'var(--accent)' }, { key: 'anxiety', label: 'Angst', color: 'var(--lilac)', dash: true }, { key: 'anger', label: 'Wut', color: 'var(--warn)' }], 0, 5, false)}</div>
  <div class="card"><h2 style="margin-top:0">Schlaf &amp; Energie</h2>${chartSVG(rows, [{ key: 'sleep', label: 'Schlaf', color: 'var(--lilac)' }, { key: 'energy', label: 'Energie', color: 'var(--ok)', dash: true }], 1, 5, false)}</div>`;
  parts.tables = `<div class="card"><h2 style="margin-top:0">Nach Ring-Phase</h2><div class="table-wrap"><table>${head}${order.map(k => row(k, groupStats(groups[k]))).join('')}</table></div></div>
  <div class="card"><h2 style="margin-top:0">Nach Ring</h2><div class="table-wrap"><table>${head}${Object.keys(cycles).map(c => row(`Ring ${c} (ab ${fmtShort(cycles[c][0].ph.start)})`, groupStats(cycles[c]))).join('')}</table></div></div>`;
  const footer = `<div class="card noprint"><h2 style="margin-top:0">Mit KI auswerten</h2>
    <p class="muted">Erstellt einen fertigen Auftrag mit allen Tagesdaten für ${esc(periodLabel())}. Einfach in ChatGPT, Claude oder eine andere KI einfügen.</p>
    <div class="row wrap" style="margin-top:10px"><button class="btn" data-action="aicopy">Für KI kopieren</button><button class="btn ghost" data-action="aishare">Als Datei teilen</button></div>
    <details class="ai-preview"><summary>Auftrag ansehen</summary><pre class="ai">${esc(aiPrompt())}</pre></details></div>
  <div class="card noprint"><h2 style="margin-top:0">Für die Ärztin</h2>
    <div class="row wrap"><button class="btn" data-action="report">Bericht teilen</button><button class="btn ghost" data-action="print">Drucken / PDF</button><button class="btn ghost" data-action="csv">CSV</button></div>
    <p class="muted">Bericht und PDF beginnen mit dem KI-Auftrag und enthalten am Ende alle Tagesdaten. So kannst du die Datei auch direkt in eine KI hochladen.</p></div>
  <p class="notice">Diese Auswertung zeigt Muster in den eigenen Aufzeichnungen und ersetzt keine ärztliche Beratung. Für das Gespräch mit der Frauenärztin oder dem Frauenarzt ist sie eine gute Grundlage.</p>`;
  return { head: `${head1}<p class="muted">${fmtDate(first)} – ${fmtDate(last)} · ${tot.n} von ${span} Tagen erfasst</p>`, enough: true, parts, footer, notes, links, tot, cmp };
}

// ---------- Einstellungen ----------
function settingsHTML() {
  const ins = sortedInserts();
  const ios = /iPhone|iPad/.test(navigator.userAgent) && !navigator.standalone;
  const last = store.get(KEYS.backup, null);
  return `<h1 class="large">Mehr</h1>
  ${ios ? '<div class="card"><h2 style="margin-top:0">Auf dem iPhone installieren</h2><p class="muted">In Safari auf <b>Teilen</b> tippen, dann auf <b>Zum Home-Bildschirm</b>. Nur so bleiben die Daten dauerhaft gespeichert und die App öffnet sich im Vollbild.</p></div>' : ''}
  <div class="card"><h2 style="margin-top:0">Einführung</h2>
    <p class="muted">Alle Funktionen der App, kurz erklärt und animiert.</p>
    <p><button class="btn ghost" data-action="intro">Einführung ansehen</button></p></div>
  ${doctorHTML()}
  <div class="card"><h2 style="margin-top:0">Was möchtest du erfassen?</h2>
    <p class="muted">Alles ist freiwillig. Schalte aus, was du nicht brauchst – bereits Eingetragenes bleibt erhalten.</p>
    ${MODULES.map(([k, t, desc]) => `<div class="mod"><div><b>${t}</b><span>${desc}</span></div><button type="button" class="switch" role="switch" aria-checked="${mod(k)}" aria-label="${t}" data-action="module" data-v="${k}"></button></div>`).join('')}</div>
  <div class="card"><h2 style="margin-top:0">Erinnerungen</h2>
    <p class="muted">Kalendertermine mit Hinweis landen im iPhone-Kalender und erinnern auch, wenn die App geschlossen ist. Nach dem Tippen erscheint die Kalender-Vorschau: „Alle hinzufügen“ wählen.</p>
    <p><button class="btn" data-action="ics">Ringwechsel: 2× am Tag erinnern</button></p>
    <p class="muted">Erinnert am Wechseltag um 8:00 und 20:00 Uhr, für die nächsten 12 Ringe. Wenn der Wechsel einmal an einem anderen Tag war, hier neu laden.</p>
    <p><button class="btn ghost" data-action="icsdiary">Täglich um 20:30 ans Tagebuch erinnern</button></p>
  </div>
  <div class="card"><h2 style="margin-top:0">Ring-Rhythmus</h2>
    <label for="s-wear">Ring wird gewechselt nach (Tagen)</label><input type="number" inputmode="numeric" id="s-wear" min="1" max="60" value="${settings.wearDays}">
    <label for="s-pause">Ringpause (Tage, 0 = durchgehend)</label><input type="number" inputmode="numeric" id="s-pause" min="0" max="14" value="${settings.pauseDays}">
    <p><button class="btn small" data-action="saverhythm">Speichern</button></p>
    <h3>Ringwechsel</h3>
    ${ins.map((d, i) => `<div class="row between" style="margin-bottom:6px"><span>Ring ${i + 1}: ${fmtDate(d)}</span>${ins.length > 1 ? `<button class="btn danger small" data-action="delinsert" data-d="${d}" aria-label="Eintrag löschen">Löschen</button>` : ''}</div>`).join('')}
    <div class="row"><input type="date" id="s-newins" value="${todayStr()}" max="${todayStr()}" aria-label="Datum Ringwechsel"><button class="btn ghost small" data-action="addinsert">Hinzufügen</button></div>
  </div>
  <div class="card"><h2 style="margin-top:0">Daten</h2>
    <div class="row wrap"><button class="btn ghost small" data-action="backup">Backup erstellen</button>
    <button class="btn ghost small" data-action="csv">CSV</button>
    <label class="btn ghost small" style="margin:0;display:inline-flex;align-items:center">Backup laden<input type="file" id="s-import" accept="application/json,.json" hidden></label></div>
    <p class="muted">Die Daten liegen nur auf diesem Gerät. ${last ? `Letztes Backup: ${fmtDate(last)}.` : 'Noch kein Backup erstellt.'} Sichere das Backup z. B. in „Dateien“ oder iCloud.</p>
    <button class="btn danger small" data-action="reset">Alle Tagebuchdaten löschen</button></div>
  <p class="notice" style="text-align:center">Ringtagebuch ${APP_VERSION}</p>`;
}

function doctorHTML() {
  return `<div class="card" id="doctor"><h2 style="margin-top:0">Arzttermin</h2>
    <label for="doc-date">Nächster Termin</label><input type="date" id="doc-date" data-f="docDate" value="${esc(doctor.date)}">
    <h3>Fragen an die Ärztin</h3>
    <div id="doc-qs">${qListHTML()}</div>
    <div class="row" style="margin-top:8px"><input type="text" id="doc-new" placeholder="Neue Frage …" aria-label="Neue Frage" enterkeyhint="done"><button class="btn small" data-action="docadd">Hinzufügen</button></div>
    <h3>Notizen vom Termin</h3><textarea data-f="docNotes" placeholder="Was hat die Ärztin gesagt?">${esc(doctor.notes)}</textarea>
    <p class="muted">Offene Fragen stehen auch im KI-Auftrag und im Bericht. Am Tag vorher erinnert dich die App.</p></div>`;
}
const qListHTML = () => (doctor.questions.length ? doctor.questions.map(q => `<div class="q ${q.done ? 'done' : ''}" data-q="${q.id}">
    <input type="checkbox" data-f="docDone" ${q.done ? 'checked' : ''} aria-label="Beantwortet"><span>${esc(q.t)}</span>
    <button class="btn danger small" data-action="docdel" aria-label="Frage löschen">✕</button>
    ${q.done ? `<input type="text" class="answer" data-f="docAnswer" value="${esc(q.answer || '')}" placeholder="Antwort der Ärztin …" aria-label="Antwort">` : ''}</div>`).join('')
  : '<p class="muted">Noch keine Fragen. Sammle hier alles, was dir einfällt.</p>')
  + (doctor.questions.some(q => q.done) ? '<p><button class="btn ghost small" data-action="docclean">Beantwortete Fragen entfernen</button></p>' : '');
function addQuestion() {
  const inp = document.getElementById('doc-new'), t = inp.value.trim();
  if (!t) return;
  doctor.questions.push({ id: Date.now().toString(36), t, done: false });
  saveDoctor(); inp.value = '';
  const box = document.getElementById('doc-qs');
  box.innerHTML = qListHTML();
  const last = box.querySelectorAll('.q'); if (last.length) last[last.length - 1].classList.add('pop');
  toast('Frage gespeichert ✓');
}

// ---------- Export ----------
let CSS_TEXT = '';
fetch('style.css').then(r => r.text()).then(t => { CSS_TEXT = t; }).catch(() => {});

async function share(name, text, type) {
  const file = new File([text], name, { type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function csv() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const hdr = ['Datum', 'Tagebuch-Tag', 'Phase', 'Ringtag', 'Schmerzen', 'Schmerz morgens', 'Schmerz mittags', 'Schmerz abends', 'Schmerzorte', 'Kraempfe', 'Durchfall', 'Blutung', 'Weitere Beschwerden', 'Symptome-Notiz',
    'Laune', 'Angst', 'Wut', 'Stress', 'Schlaf', 'Energie', 'Glaeser Wasser', 'Bewegung', 'Schmerzmittel', 'Medikamente-Notiz', 'Einnahme Uhrzeit', 'Wirkung', 'Essen', 'Ernaehrungs-Merkmale', 'Essen-Freitext', 'Notiz'];
  const pd = e => e.painDay || {};
  const lines = loggedDays().map(({ d, e, ph }) => [d, diaryDay(d), phaseLabel(ph), ph?.day, e.pain, pd(e).m, pd(e).n, pd(e).a, (e.painAreas || []).join('; '), e.cramps, e.diarrhea != null ? DIARRHEA[e.diarrhea] : '',
    e.bleeding ? Object.fromEntries(BLEEDING)[e.bleeding] : '', (e.symptoms || []).join('; '), e.symNote, e.mood, e.anxiety, e.anger, e.stress, e.sleep, e.energy,
    e.water, e.movement != null ? MOVEMENT[e.movement] : '', (e.meds || []).join('; '), e.medsNote, e.medTime, e.medEffect != null ? MED_EFFECT[e.medEffect] : '',
    (e.meals || []).filter(m => filled(m.text)).map(m => `${m.time} ${m.text} (${m.amount})`).join('; '), (e.foodTags || []).join('; '), e.foodNote, e.note].map(q).join(';'));
  share(`ringtagebuch-${todayStr()}.csv`, '﻿' + [hdr.map(q).join(';'), ...lines].join('\r\n'), 'text/csv');
}
function report() {
  const clone = document.createElement('div');
  clone.innerHTML = analysisFull();
  clone.querySelectorAll('.noprint').forEach(n => n.remove());
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ringtagebuch – Bericht ${todayStr()}</title><style>${CSS_TEXT}body{padding-bottom:24px}</style></head>
<body><main><p class="muted">Ringtagebuch · Bericht für ${esc(periodLabel())} · erstellt am ${fmtDate(todayStr())} · Ring-Rhythmus: ${settings.wearDays} Tage${settings.pauseDays ? `, ${settings.pauseDays} Tage Pause` : ', durchgehend'}</p>${clone.innerHTML}</main></body></html>`;
  share(`ringtagebuch-bericht-${period === 'month' ? pMonth : todayStr()}.html`, html, 'text/html');
}
// Kalendertermine: auf dem iPhone direkt öffnen, dann zeigt iOS die Kalender-Vorschau mit „Alle hinzufügen“
function openCalendar(name, text) {
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) { location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(text); return; }
  share(name, text, 'text/calendar');
}
const icsStamp = () => new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
const icsWrap = ev => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ringtagebuch//DE', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR'].join('\r\n');
const icsAlarm = t => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${t}`, 'TRIGGER:PT0M', 'END:VALARM'];
function ics() {
  const { wearDays: w, pauseDays: p } = settings;
  const last = sortedInserts().pop();
  const events = [];
  const add = (date, title) => ['0800', '2000'].forEach(t => events.push({ date, t, title }));
  for (let c = 0; c < 12; c++) {
    const s = addDays(last, c * (w + p));
    if (p > 0) add(addDays(s, w), 'Ring entfernen');
    add(addDays(s, w + p), p > 0 ? 'Neuen Ring einsetzen' : 'Ring wechseln');
  }
  const stamp = icsStamp();
  openCalendar('ringwechsel.ics', icsWrap(events.filter(e => e.date >= todayStr()).flatMap(e => [
    'BEGIN:VEVENT', `UID:ring-${e.date}-${e.t}@ringtagebuch`, `DTSTAMP:${stamp}`,
    `DTSTART:${e.date.replace(/-/g, '')}T${e.t}00`, 'DURATION:PT15M', `SUMMARY:${e.title}`, ...icsAlarm(e.title), 'END:VEVENT'])));
}
function icsDiary() {
  openCalendar('tagebuch-erinnerung.ics', icsWrap(['BEGIN:VEVENT', 'UID:diary-daily@ringtagebuch', `DTSTAMP:${icsStamp()}`,
    `DTSTART:${todayStr().replace(/-/g, '')}T203000`, 'DURATION:PT10M', 'RRULE:FREQ=DAILY', 'SUMMARY:Ringtagebuch ausfüllen',
    ...icsAlarm('Ringtagebuch ausfüllen'), 'END:VEVENT']));
}

// ---------- Events ----------
view.addEventListener('click', ev => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  ev.preventDefault();
  const a = el.dataset.action, d = el.dataset;
  const $ = id => document.getElementById(id);
  switch (a) {
    case 'start': {
      const date = $('ob-date').value || todayStr();
      settings = { inserts: [date > todayStr() ? todayStr() : date], wearDays: +$('ob-wear').value, pauseDays: +$('ob-pause').value };
      saveSettings(); curDate = todayStr(); tab = 'today'; render(true); return;
    }
    case 'scale': {
      const nv = getVal(getE(), d.k) === +d.v ? null : +d.v;
      setVal(d.k, nv);
      const sl = el.closest('.sl');
      if (sl) { updateSlider(sl, nv); updateDots(); } else refreshGroup(el);
      return;
    }
    case 'water': {
      const n = Math.max(0, Math.min(20, (getE().water ?? 0) + +d.d));
      patch({ water: n });
      const w = el.closest('.water'); w.outerHTML = waterHTML(n);
      if (+d.d > 0) { const g = view.querySelectorAll('.water .glasses i')[n - 1]; if (g) g.classList.add('new'); }
      updateDots(); return;
    }
    case 'copyyesterday': {
      const y = (entries[addDays(curDate, -1)]?.meals || []).filter(m => filled(m.text)).map(m => ({ ...m }));
      const meals = [...(getE().meals || []).filter(m => filled(m.text)), ...y];
      patch({ meals });
      const box = document.getElementById('meals');
      box.innerHTML = meals.map((m, i) => mealHTML(m, i)).join('');
      [...box.children].slice(-y.length).forEach(r => r.classList.add('appear'));
      toast(`${y.length} ${y.length === 1 ? 'Mahlzeit' : 'Mahlzeiten'} von gestern übernommen`); updateDots(); return;
    }
    case 'module': {
      settings.modules = { ...(settings.modules || {}), [d.v]: !mod(d.v) };
      saveSettings(); el.setAttribute('aria-checked', mod(d.v)); return;
    }
    case 'gotab': {
      tab = d.v; render(true);
      if (tab === 'settings') setTimeout(() => document.getElementById('doctor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      return;
    }
    case 'docadd': addQuestion(); return;
    case 'docdel': {
      const id = el.closest('.q').dataset.q;
      doctor.questions = doctor.questions.filter(q => q.id !== id); saveDoctor();
      document.getElementById('doc-qs').innerHTML = qListHTML(); return;
    }
    case 'docclean': doctor.questions = doctor.questions.filter(q => !q.done); saveDoctor(); document.getElementById('doc-qs').innerHTML = qListHTML(); return;
    case 'bleed': patch({ bleeding: getE().bleeding === d.v ? null : d.v }); refreshGroup(el); return;
    case 'toggle': {
      const cur = getE()[d.k] || [];
      patch({ [d.k]: cur.includes(d.v) ? cur.filter(x => x !== d.v) : [...cur, d.v] }); refreshGroup(el); return;
    }
    case 'section': switchTo(d.v); return;
    case 'step': step(+d.d); return;
    case 'finish': {
      const open = SECTIONS.filter(x => !secDone(x, getE())).map(x => x.label);
      toast(open.length ? `Gespeichert · noch offen: ${open.join(', ')}` : 'Für heute alles erfasst ✓');
      return;
    }
    case 'day': { const n = addDays(curDate, +d.d); if (n <= todayStr()) curDate = n; render(true); return; }
    case 'gotoday': curDate = todayStr(); render(true); return;
    case 'open': curDate = d.d; tab = 'today'; window.scrollTo(0, 0); render(true); return;
    case 'month': { const [y, m] = calMonth.split('-').map(Number); calMonth = new Date(Date.UTC(y, m - 1 + +d.d, 1)).toISOString().slice(0, 7); break; }
    case 'period': period = d.v; break;
    case 'pmonth': { const [y, m] = pMonth.split('-').map(Number); const n = new Date(Date.UTC(y, m - 1 + +d.d, 1)).toISOString().slice(0, 7); if (n <= todayStr().slice(0, 7)) pMonth = n; break; }
    case 'aicopy': aiCopy(); return;
    case 'intro': showIntro(); return;
    case 'aishare': share(`ringtagebuch-ki-${period === 'month' ? pMonth : todayStr()}.txt`, aiText(), 'text/plain'); return;
    case 'addmeal': {
      const now = new Date();
      const time = curDate === todayStr() ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` : '12:00';
      const meals = [...(getE().meals || []), { time, text: '', amount: 'normal' }];
      patch({ meals });
      const box = document.getElementById('meals');
      box.insertAdjacentHTML('beforeend', mealHTML(meals[meals.length - 1], meals.length - 1));
      box.lastElementChild.classList.add('appear');
      box.lastElementChild.querySelector('[data-f=meal-text]').focus();
      return;
    }
    case 'delmeal': {
      const m = [...(getE().meals || [])]; m.splice(+d.i, 1); patch({ meals: m }); updateDots();
      const row = el.closest('.meal'); row.classList.add('leave');
      setTimeout(() => { document.getElementById('meals').innerHTML = m.map((x, i) => mealHTML(x, i)).join(''); }, 260);
      return;
    }
    case 'newring': {
      const t = todayStr();
      if (settings.inserts.includes(t)) break;
      if (!d.due && !confirm('Heute einen neuen Ring eingesetzt? Der Ring-Zähler beginnt dann wieder bei Tag 1.')) return;
      settings.inserts.push(t); saveSettings();
      flash = 'Neuer Ring eingetragen. Tag 1 beginnt heute.' + (d.due ? '' : ' Lade unter „Mehr“ die Kalender-Erinnerungen neu, damit sie zum neuen Termin passen.');
      render(true); toast('Neuer Ring ✓'); return;
    }
    case 'saverhythm': {
      const w = Math.min(60, Math.max(1, Math.round(+$('s-wear').value) || 28));
      const p = Math.min(14, Math.max(0, Math.round(+$('s-pause').value) || 0));
      settings.wearDays = w; settings.pauseDays = p; saveSettings(); toast('Gespeichert ✓'); break;
    }
    case 'addinsert': { const v = $('s-newins').value; if (v && v <= todayStr() && !settings.inserts.includes(v)) { settings.inserts.push(v); saveSettings(); } break; }
    case 'delinsert': if (!confirm(`Ringwechsel vom ${fmtDate(d.d)} löschen?`)) return; settings.inserts = settings.inserts.filter(x => x !== d.d); saveSettings(); break;
    case 'print':
      view.innerHTML = analysisFull();
      window.addEventListener('afterprint', () => render(), { once: true });
      setTimeout(() => window.print(), 50); return;
    case 'report': report(); return;
    case 'csv': csv(); return;
    case 'ics': ics(); return;
    case 'icsdiary': icsDiary(); return;
    case 'backup':
      share(`ringtagebuch-backup-${todayStr()}.json`, JSON.stringify({ app: 'ringtagebuch', version: 2, settings, entries }), 'application/json');
      store.set(KEYS.backup, todayStr()); break;
    case 'reset':
      if (!confirm('Wirklich ALLE Tagebuchdaten löschen? Das kann nicht rückgängig gemacht werden. Tipp: vorher ein Backup erstellen.')) return;
      Object.values(KEYS).forEach(k => localStorage.removeItem(k));
      settings = null; entries = {}; doctor = { date: '', questions: [], notes: '' }; render(true); return;
  }
  render();
});

// Nur die angetippte Gruppe aktualisieren – kein Flackern, die Auswahl „ploppt“
function refreshGroup(el) {
  const e = getE(), k = el.dataset.k;
  el.parentElement.querySelectorAll('[data-action]').forEach(b => {
    const v = b.dataset.v;
    const on = b.dataset.action === 'toggle' ? (e[k] || []).includes(v) : b.dataset.action === 'bleed' ? e.bleeding === v : e[k] === +v;
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
  });
  if (el.classList.contains('on')) replay(el, 'pop');
  if (k === 'meds') { const mx = document.getElementById('med-extra'); if (mx) mx.hidden = !hasPainkiller(e); }
  updateDots();
}

// Wischen zwischen den Reitern
let touch = null;
view.addEventListener('touchstart', ev => {
  touch = ev.target.closest('#pane') && !ev.target.closest('input, textarea, select, .table-wrap, svg') ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY } : null;
}, { passive: true });
view.addEventListener('touchend', ev => {
  if (!touch) return;
  const dx = ev.changedTouches[0].clientX - touch.x, dy = ev.changedTouches[0].clientY - touch.y;
  touch = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
}, { passive: true });
// Schieberegler ziehen; Diagramm antippen zeigt die Werte des Tages
let drag = null;
const sliderValue = (sl, tr, x) => {
  const r = tr.getBoundingClientRect(), min = +sl.dataset.min, max = +sl.dataset.max;
  return Math.round(min + Math.min(1, Math.max(0, (x - r.left) / r.width)) * (max - min));
};
view.addEventListener('pointerdown', ev => {
  const tr = ev.target.closest('.sl-track');
  if (tr) {
    ev.preventDefault();
    const sl = tr.closest('.sl');
    drag = { sl, tr, id: ev.pointerId, v: undefined };
    try { tr.setPointerCapture(ev.pointerId); } catch (e) { /* ohne Erfassung weiter */ }
    sl.classList.add('dragging');
    moveDrag(ev);
    return;
  }
  const ch = ev.target.closest('.chart');
  hideTips(ch);
  if (ch) chartAt(ev);
});
function moveDrag(ev) {
  const v = sliderValue(drag.sl, drag.tr, ev.clientX);
  if (v !== drag.v) { drag.v = v; updateSlider(drag.sl, v); }
}
view.addEventListener('pointermove', ev => {
  if (drag && ev.pointerId === drag.id) { moveDrag(ev); return; }
  if (ev.pointerType === 'mouse' || ev.buttons) chartAt(ev);
});
const endDrag = ev => {
  if (!drag || ev.pointerId !== drag.id) return;
  const { sl, v } = drag;
  drag = null; sl.classList.remove('dragging');
  if (v !== undefined) { setVal(sl.dataset.k, v); updateDots(); }
};
view.addEventListener('pointerup', endDrag);
view.addEventListener('pointercancel', endDrag);
view.addEventListener('keydown', ev => {
  if (ev.target.id === 'doc-new' && ev.key === 'Enter') { ev.preventDefault(); addQuestion(); return; }
  const sl = ev.target.classList && ev.target.classList.contains('sl') ? ev.target : null;
  if (!sl) return;
  const min = +sl.dataset.min, max = +sl.dataset.max;
  let v = getVal(getE(), sl.dataset.k);
  if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') v = v == null ? min : Math.min(max, v + 1);
  else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') v = v == null ? min : Math.max(min, v - 1);
  else if (ev.key === 'Delete' || ev.key === 'Backspace') v = null;
  else return;
  ev.preventDefault(); setVal(sl.dataset.k, v); updateSlider(sl, v); updateDots();
});
// iOS zeigt :active (Knopf gibt nach) nur mit einem touchstart-Empfänger
document.addEventListener('touchstart', () => {}, { passive: true });

view.addEventListener('input', ev => {
  const el = ev.target, f = el.dataset.f;
  if (!f) return;
  if (['note', 'foodNote', 'medsNote', 'symNote', 'medTime'].includes(f)) { patch({ [f]: el.value }); updateDots(); return; }
  if (f === 'docNotes') { doctor.notes = el.value; saveDoctor(); return; }
  if (f === 'docAnswer') { const q = doctor.questions.find(x => x.id === el.closest('.q').dataset.q); if (q) { q.answer = el.value; saveDoctor(); } return; }
  const row = el.closest('[data-meal]');
  if (!row) return;
  const i = +row.dataset.meal;
  const meals = [...(getE().meals || [])];
  meals[i] = { ...meals[i], [f.replace('meal-', '')]: el.value };
  patch({ meals }); updateDots();
});

view.addEventListener('change', ev => {
  const f = ev.target.dataset.f;
  if (f === 'docDate') { doctor.date = ev.target.value; saveDoctor(); toast(ev.target.value ? 'Termin gespeichert ✓' : 'Termin entfernt'); return; }
  if (f === 'docDone') {
    const q = doctor.questions.find(x => x.id === ev.target.closest('.q').dataset.q);
    if (q) { q.done = ev.target.checked; saveDoctor(); document.getElementById('doc-qs').innerHTML = qListHTML(); }
    return;
  }
  if (ev.target.id !== 's-import') return;
  const file = ev.target.files[0];
  if (!file) return;
  file.text().then(t => {
    let data;
    try { data = JSON.parse(t); } catch { data = null; }
    const ok = data && data.settings && Array.isArray(data.settings.inserts) && data.settings.inserts.length &&
      typeof data.entries === 'object' && !Array.isArray(data.entries);
    if (!ok) { alert('Die Datei ist kein gültiges Ringtagebuch-Backup.'); return; }
    if (!confirm('Vorhandene Daten werden durch das Backup ersetzt. Fortfahren?')) return;
    settings = data.settings; entries = data.entries; saveSettings(); saveEntries(); render();
  });
  ev.target.value = '';
});

document.getElementById('tabs').addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (!b) return;
  tab = b.dataset.tab;
  if (tab === 'today') curDate = todayStr();
  window.scrollTo(0, 0); render(true);
});

// Tageswechsel, während die App offen bleibt (z. B. über Nacht im Hintergrund)
let lastSeen = todayStr();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  checkUpdate();
  if (todayStr() !== lastSeen) {
    if (curDate === lastSeen) curDate = todayStr();
    lastSeen = todayStr(); render(true);
  }
});

// ---------- Updates von der DiskStation ----------
// Kommt die App aus dem Hintergrund zurück, fragt sie die DiskStation nach der aktuellen Version.
// Gibt es eine neuere, lädt sie sich neu (alle Eingaben sind da schon gespeichert).
async function serverVersion() {
  const r = await fetch('version.json', { cache: 'no-store' });
  if (!r.ok) throw new Error('keine Versionsdatei');
  return r.json();
}
async function checkUpdate() {
  if (location.protocol === 'file:') return;
  try {
    const v = await serverVersion();
    if (!v.version || v.version === APP_VERSION) return;
    // Schutz vor Endlosschleife, falls nach dem Neuladen noch die alte Datei ankommt
    let tried = null;
    try { tried = sessionStorage.getItem('nuv.reloadFor'); sessionStorage.setItem('nuv.reloadFor', v.version); } catch (e) { /* ohne Schutz weiter */ }
    if (tried === v.version) return;
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update().catch(() => {});
    location.reload();
  } catch (e) { /* offline: einfach mit der gespeicherten Version weiter */ }
}
// Nach einem Update einmal zeigen, was neu ist
async function whatsNew() {
  const seen = store.get(KEYS.seen, null);
  if (seen === APP_VERSION) return;
  store.set(KEYS.seen, APP_VERSION);
  if (!seen || !settings) return; // Erstinstallation: nichts zeigen
  try {
    const v = await serverVersion();
    if (v.version !== APP_VERSION || !(v.notes || []).length) return;
    const el = document.createElement('div');
    el.className = 'sheet-wrap';
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="news-title">
      <h2 id="news-title">Neu in Version ${esc(APP_VERSION)}</h2>
      <ul>${v.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
      <button class="btn" data-close>Alles klar</button>
      <button class="btn ghost" data-intro style="width:100%;margin-top:8px">Einführung ansehen</button></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); };
    el.addEventListener('click', ev => {
      if (ev.target.closest('[data-intro]')) { close(); showIntro(); return; }
      if (ev.target === el || ev.target.closest('[data-close]')) close();
    });
    el.querySelector('[data-close]').focus();
  } catch (e) { /* offline: beim nächsten Mal nicht erneut zeigen, ist nicht schlimm */ }
}

render(true);
setTimeout(checkUpdate, 1500); // auch beim Start: gibt es auf der DiskStation schon eine neuere Version?
if (!introSeen()) showIntro(() => whatsNew()); else whatsNew();
// Offline-Speicher anmelden; eine fertig geladene neue Version gleich übernehmen lassen
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const nudge = () => { if (reg.waiting) reg.waiting.postMessage('skipWaiting'); };
    nudge();
    // Falls eine neue Version wartet (z. B. weil sie fertig wurde, während die Seite lud): mehrfach anstoßen
    let tries = 0;
    const timer = setInterval(() => { nudge(); if (++tries > 20 || (!reg.waiting && !reg.installing)) clearInterval(timer); }, 1000);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') nudge(); });
    });
  }).catch(() => {});
}
navigator.storage?.persist?.();
