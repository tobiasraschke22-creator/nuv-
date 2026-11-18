'use strict';
/* Ringtagebuch – NuvaRing & Endometriose. Alle Daten bleiben im localStorage des Geräts. */

// ---------- Speicher ----------
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
};
let settings = store.get('nuv.settings', null); // {inserts:[YYYY-MM-DD], wearDays, pauseDays}
let entries = store.get('nuv.entries', {});     // {YYYY-MM-DD: {...}}
const saveSettings = () => store.set('nuv.settings', settings);
const saveEntries = () => store.set('nuv.entries', entries);

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
function phaseOf(date) {
  if (!settings) return null;
  const ins = [...settings.inserts].sort();
  const start = ins.filter(d => d <= date).pop();
  if (!start) return null;
  const n = dayNum(date) - dayNum(start) + 1;
  const cycle = ins.indexOf(start) + 1;
  const { wearDays: w, pauseDays: p } = settings;
  if (n <= w) return { kind: 'ring', day: n, week: Math.ceil(n / 7), cycle, start };
  if (n <= w + p) return { kind: 'pause', day: n - w, cycle, start };
  return { kind: 'over', day: n - w - p, cycle, start };
}
const phaseLabel = ph => !ph ? 'Vor Beginn' : ph.kind === 'ring' ? `Ring Woche ${ph.week}` : ph.kind === 'pause' ? 'Ringpause' : (ph.day === 1 && settings.pauseDays === 0 ? 'Ringwechsel heute' : 'Wechsel überfällig');

// ---------- Erfassung ----------
const BLEEDING = [['none', 'Keine'], ['spotting', 'Schmierblutung'], ['light', 'Leicht'], ['medium', 'Mittel'], ['heavy', 'Stark']];
const DIARRHEA = ['Keiner', '1×', '2–3×', '4× oder mehr'];
const AMOUNTS = ['wenig', 'normal', 'viel'];
const isBleed = e => ['light', 'medium', 'heavy'].includes(e.bleeding);
const isSpot = e => e.bleeding === 'spotting';
const hasData = e => e && (e.pain != null || e.cramps != null || e.diarrhea != null || e.bleeding || e.anxiety != null ||
  e.anger != null || e.stress != null || (e.note || '').trim() || (e.foodNote || '').trim() || (e.meals || []).some(m => m.text.trim()));

let tab = 'today';
let curDate = todayStr();
let calMonth = todayStr().slice(0, 7);

const getE = () => entries[curDate] || {};
function patch(p) {
  entries[curDate] = { ...getE(), ...p };
  saveEntries();
}

// ---------- Render ----------
const view = document.getElementById('view');
function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  if (!settings) { view.innerHTML = onboardingHTML(); return; }
  view.innerHTML = { today: todayHTML, history: historyHTML, analysis: analysisHTML, settings: settingsHTML }[tab]();
}

function onboardingHTML() {
  return `<h1>Willkommen im Ringtagebuch</h1>
  <div class="card">
    <p>Ab dem Tag, an dem der neue Ring eingesetzt wird, erfasst die App jeden Tag Symptome, Essen und Emotionen und wertet alles am Ende zusammen aus.</p>
    <label>Ring eingesetzt am</label>
    <input type="date" id="ob-date" value="${todayStr()}" max="${todayStr()}">
    <label>Tage mit Ring</label>
    <select id="ob-wear"><option value="21">21 Tage (3 Wochen)</option><option value="28" selected>28 Tage (4 Wochen)</option><option value="31">31 Tage</option></select>
    <label>Ringpause</label>
    <select id="ob-pause"><option value="0" selected>Keine (durchgehend)</option><option value="7">7 Tage</option></select>
    <p><button class="btn" data-action="start">Los geht's</button></p>
  </div>
  <p class="notice">Alle Daten bleiben auf diesem Gerät und werden nirgends hochgeladen.</p>`;
}

function scaleHTML(key, min, max, val, labels) {
  const n = max - min + 1;
  let h = `<div class="scale" style="grid-template-columns:repeat(${n},1fr)">`;
  for (let i = min; i <= max; i++) h += `<button data-action="scale" data-k="${key}" data-v="${i}" class="${val === i ? 'on' : ''}">${i}</button>`;
  h += '</div>';
  if (labels) h += `<div class="scale-lbl"><span>${labels[0]}</span><span>${labels[1]}</span></div>`;
  return h;
}

function reminderBanner() {
  const ph = phaseOf(todayStr());
  if (!ph) return '';
  const { wearDays: w, pauseDays: p } = settings;
  if (ph.kind === 'pause' && ph.day === 1 && p > 0)
    return `<div class="insight"><b>Heute Ring entfernen.</b> Die Ringpause beginnt (${p} Tage).</div>`;
  if (ph.kind === 'over')
    return `<div class="insight"><b>Heute neuen Ring einsetzen.</b> <button class="btn small" data-action="newring">Neuen Ring eingesetzt</button></div>`;
  if (ph.kind === 'pause' && ph.day === p)
    return `<div class="insight"><b>Heute neuen Ring einsetzen.</b> <button class="btn small" data-action="newring">Neuen Ring eingesetzt</button></div>`;
  return '';
}

function todayHTML() {
  const e = getE();
  const ph = phaseOf(curDate);
  const isToday = curDate === todayStr();
  const { wearDays: w, pauseDays: p } = settings;
  let status = '<p class="muted">Dieser Tag liegt vor dem Ring-Start.</p>';
  if (ph) {
    const total = ph.kind === 'ring' ? w : ph.kind === 'pause' ? p : 0;
    const pct = ph.kind === 'ring' ? ph.day / w * 100 : ph.kind === 'pause' ? ph.day / p * 100 : 100;
    status = `<div class="status"><div class="badge ${ph.kind}">${ph.kind === 'over' ? '!' : ph.day}</div>
      <div><b>${phaseLabel(ph)}</b><div class="muted">${ph.kind === 'ring' ? `Tag ${ph.day} von ${w}` : ph.kind === 'pause' ? `Pausentag ${ph.day} von ${p}` : `${ph.day} Tag(e) über Plan`} · Zyklus ${ph.cycle}</div></div></div>
      <div class="progress"><i style="width:${Math.min(100, pct)}%"></i></div>`;
  }
  const meals = e.meals || [];
  return `
  <div class="row between"><button class="btn ghost small" data-action="day" data-d="-1" aria-label="Vortag">‹</button>
    <h1 style="margin:0;font-size:1.2rem;text-align:center">${isToday ? 'Heute · ' : ''}${fmtDate(curDate)}</h1>
    <button class="btn ghost small" data-action="day" data-d="1" aria-label="Folgetag" ${isToday ? 'disabled' : ''}>›</button></div>
  ${isToday ? reminderBanner() : ''}
  <div class="card" style="margin-top:12px">${status}</div>

  <div class="card"><h2 style="margin-top:0">Endometriose-Symptome</h2>
    <h3>Schmerzen</h3>${scaleHTML('pain', 0, 10, e.pain, ['keine', 'unerträglich'])}
    <h3>Krämpfe</h3>${scaleHTML('cramps', 0, 10, e.cramps, ['keine', 'sehr stark'])}
    <h3>Durchfall</h3><div class="chips">${DIARRHEA.map((l, i) => `<button class="chip ${e.diarrhea === i ? 'on' : ''}" data-action="scale" data-k="diarrhea" data-v="${i}">${l}</button>`).join('')}</div>
    <h3>Blutung</h3><div class="chips">${BLEEDING.map(([k, l]) => `<button class="chip ${e.bleeding === k ? 'on' : ''}" data-action="bleed" data-v="${k}">${l}</button>`).join('')}</div>
  </div>

  <div class="card"><h2 style="margin-top:0">Essenstagebuch</h2>
    <p class="muted">Was gab es, wie viel und wann?</p>
    ${meals.map((m, i) => `<div class="row wrap" style="margin-bottom:10px" data-meal="${i}">
      <input type="time" data-f="meal-time" value="${esc(m.time)}" style="width:96px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px">
      <input type="text" data-f="meal-text" value="${esc(m.text)}" placeholder="z. B. Haferbrei mit Banane" style="order:3;flex:1 1 100%;min-width:0;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px">
      <select data-f="meal-amount" style="width:auto">${AMOUNTS.map(a => `<option ${m.amount === a ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <button class="btn danger small" data-action="delmeal" data-i="${i}" aria-label="Mahlzeit löschen">✕</button></div>`).join('')}
    <button class="btn ghost small" data-action="addmeal">+ Mahlzeit</button>
    <h3>Freitext zum Essen</h3><textarea data-f="foodNote" placeholder="Getränke, Zutaten, Beschwerden nach dem Essen …">${esc(e.foodNote || '')}</textarea>
  </div>

  <div class="card"><h2 style="margin-top:0">Emotionen</h2>
    <h3>Angst</h3>${scaleHTML('anxiety', 0, 5, e.anxiety, ['keine', 'sehr stark'])}
    <h3>Wut</h3>${scaleHTML('anger', 0, 5, e.anger, ['keine', 'sehr stark'])}
    <h3>Stress</h3>${scaleHTML('stress', 0, 5, e.stress, ['keiner', 'sehr stark'])}
    <h3>Freitext</h3><textarea data-f="note" placeholder="Was sonst noch auffällt …">${esc(e.note || '')}</textarea>
  </div>
  <p class="muted">Änderungen werden automatisch gespeichert.</p>`;
}

function historyHTML() {
  const [y, m] = calMonth.split('-').map(Number);
  const first = `${calMonth}-01`;
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let cells = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < lead; i++) cells += '<button class="blank" tabindex="-1"></button>';
  for (let d = 1; d <= dim; d++) {
    const ds = `${calMonth}-${String(d).padStart(2, '0')}`;
    const e = entries[ds];
    const ph = phaseOf(ds);
    const dot = e && isBleed(e) ? '<span class="dot"></span>' : e && isSpot(e) ? '<span class="dot spot"></span>' : '';
    cells += `<button data-action="open" data-d="${ds}" class="${ds === todayStr() ? 'today' : ''} ${ph && ph.kind === 'pause' ? 'pausebg' : ''}" style="${hasData(e) ? 'font-weight:700' : 'opacity:.7'}">${d}${dot}</button>`;
  }
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `<h1>Verlauf</h1>
  <div class="row between" style="margin-bottom:10px"><button class="btn ghost small" data-action="month" data-d="-1">‹</button><b>${label}</b><button class="btn ghost small" data-action="month" data-d="1">›</button></div>
  <div class="cal">${cells}</div>
  <div class="legend"><span>● Blutung</span><span>○ Schmierblutung</span><span style="color:var(--ok)">▮ Ringpause</span><span><b>Fett</b> = erfasst</span></div>`;
}

// ---------- Auswertung ----------
const avg = a => { const v = a.filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const f1 = x => x == null ? '–' : x.toFixed(1).replace('.', ',');
const pct = (n, d) => d ? Math.round(n / d * 100) + ' %' : '–';

function loggedDays() {
  return Object.keys(entries).filter(d => hasData(entries[d])).sort().map(d => ({ d, e: entries[d], ph: phaseOf(d) }));
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
    anx: avg(rows.map(r => r.e.anxiety)),
    anger: avg(rows.map(r => r.e.anger)),
    maxPain: Math.max(-1, ...rows.map(r => r.e.pain ?? -1))
  };
}

function chartSVG(rows, series, maxV, showBleed) {
  if (rows.length < 2) return '<p class="muted">Für das Diagramm werden mindestens 2 erfasste Tage benötigt.</p>';
  const W = 600, H = 200, L = 28, R = 8, T = 10, B = 24;
  const d0 = dayNum(rows[0].d), d1 = dayNum(rows[rows.length - 1].d);
  const span = Math.max(1, d1 - d0);
  const x = d => L + (dayNum(d) - d0) / span * (W - L - R);
  const y = v => T + (1 - v / maxV) * (H - T - B);
  const bw = (W - L - R) / (span + 1);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Verlauf">`;
  for (let i = d0; i <= d1; i++) {
    const ph = phaseOf(fromNum(i));
    if (ph && ph.kind === 'pause') s += `<rect x="${x(fromNum(i)) - bw / 2}" y="${T}" width="${bw}" height="${H - T - B}" fill="var(--ok)" opacity=".18"/>`;
  }
  [0, maxV / 2, maxV].forEach(v => s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="4" y="${y(v) + 3}">${v}</text>`);
  series.forEach(sr => {
    const pts = rows.filter(r => r.e[sr.key] != null);
    if (!pts.length) return;
    s += `<polyline fill="none" stroke="${sr.color}" stroke-width="2" stroke-linejoin="round" ${sr.dash ? 'stroke-dasharray="5 3"' : ''} points="${pts.map(r => `${x(r.d).toFixed(1)},${y(r.e[sr.key]).toFixed(1)}`).join(' ')}"/>` +
      pts.map(r => `<circle cx="${x(r.d).toFixed(1)}" cy="${y(r.e[sr.key]).toFixed(1)}" r="2.5" fill="${sr.color}"/>`).join('');
  });
  if (showBleed) rows.forEach(r => { if (isBleed(r.e) || isSpot(r.e)) s += `<circle cx="${x(r.d).toFixed(1)}" cy="${H - 10}" r="3.5" fill="${isBleed(r.e) ? 'var(--blood)' : 'none'}" stroke="var(--blood)" stroke-width="1.5"/>`; });
  [rows[0].d, rows[Math.floor(rows.length / 2)].d, rows[rows.length - 1].d].forEach(d => s += `<text x="${x(d)}" y="${H - 1}" text-anchor="middle">${fmtShort(d)}</text>`);
  return s + '</svg><div class="legend">' + series.map(sr => `<span style="color:${sr.color}">${sr.dash ? '╌' : '━'} ${sr.label}</span>`).join('') +
    (showBleed ? '<span style="color:var(--blood)">● Blutung ○ Schmier</span>' : '') + '<span style="color:var(--ok)">▮ Ringpause</span></div>';
}

const STOP = new Set(['mit', 'und', 'oder', 'etwas', 'wenig', 'viel', 'ohne', 'dazu', 'eine', 'einen', 'einer', 'dem', 'den', 'der', 'die', 'das', 'sowie', 'noch', 'auch', 'kleine', 'kleiner', 'groß', 'heute', 'gestern', 'habe', 'hatte', 'waren', 'wurde', 'sehr', 'dann', 'aber', 'nach', 'nicht', 'ganz', 'dass', 'weil', 'mehr']);

// Zusammenhänge zwischen Essen, Emotionen und Symptomen (selber oder nächster Tag)
function correlationNotes(rows) {
  const byDate = Object.fromEntries(rows.map(r => [r.d, r]));
  const strong = r => Math.max(r.e.pain ?? 0, r.e.cramps ?? 0) >= 6;
  const diar = r => (r.e.diarrhea ?? 0) >= 1;
  const outcomes = [['starke Schmerzen oder Krämpfe', strong], ['Durchfall', diar]];
  const near = (r, f) => { const nx = byDate[addDays(r.d, 1)]; return f(r) || (!!nx && f(nx)); };
  const out = [];
  const sources = [
    ['Essen', r => [...(r.e.meals || []).map(m => m.text), r.e.foodNote].join(' ')],
    ['Tagebuchtext', r => r.e.note || '']
  ];
  for (const [name, getText] of sources) {
    const withText = rows.filter(r => getText(r).trim());
    if (withText.length < 7) continue;
    const map = {};
    withText.forEach(r => new Set((getText(r).toLowerCase().match(/[a-zäöüß]{4,}/g) || []).filter(w => !STOP.has(w))).forEach(w => (map[w] ||= []).push(r)));
    for (const [label, f] of outcomes) {
      const base = withText.filter(r => near(r, f)).length / withText.length;
      const groups = {};
      Object.entries(map).filter(([, v]) => v.length >= 3)
        .map(([w, v]) => ({ w, n: v.length, key: v.map(r => r.d).join(), rate: v.filter(r => near(r, f)).length / v.length }))
        .filter(x => x.rate >= 0.5 && x.rate - base >= 0.25)
        .forEach(x => (groups[x.key] ||= { ...x, words: [] }).words.push(x.w));
      Object.values(groups).sort((a, b) => b.rate - a.rate).slice(0, 3).forEach(x =>
        out.push(`${name}: ${x.words.slice(0, 4).map(w => `„<b>${esc(w)}</b>“`).join(', ')} kam${x.words.length > 1 ? 'en' : ''} an ${x.n} Tagen vor. Am selben oder nächsten Tag gab es dann in ${Math.round(x.rate * 100)} % der Fälle ${label} (sonst ${Math.round(base * 100)} %).`));
    }
  }
  for (const [name, k] of [['Stress', 'stress'], ['Angst', 'anxiety'], ['Wut', 'anger']]) {
    const have = rows.filter(r => r.e[k] != null);
    const hi = have.filter(r => r.e[k] >= 3), lo = have.filter(r => r.e[k] < 3);
    if (have.length < 7 || hi.length < 3 || lo.length < 3) continue;
    for (const [label, f] of outcomes) {
      const a = hi.filter(r => near(r, f)).length / hi.length, b = lo.filter(r => near(r, f)).length / lo.length;
      if (a - b >= 0.2) out.push(`Nach Tagen mit hohem ${name} (≥ 3) gab es in ${Math.round(a * 100)} % der Fälle ${label}, sonst in ${Math.round(b * 100)} %.`);
    }
    const sR = have.filter(strong), oR = have.filter(r => !strong(r));
    if (sR.length >= 3 && oR.length >= 3) {
      const a = avg(sR.map(r => r.e[k])), b = avg(oR.map(r => r.e[k]));
      if (a - b >= 0.7) out.push(`An Tagen mit starken Beschwerden war ${name} höher (Ø ${f1(a)} statt ${f1(b)}). Körper und Gefühle beeinflussen sich vermutlich gegenseitig.`);
    }
  }
  return out;
}

function analysisHTML() {
  const rows = loggedDays();
  if (rows.length < 3) return `<h1>Auswertung</h1><div class="card"><p>Noch zu wenig Daten. Sobald ein paar Tage erfasst sind, erscheint hier die Auswertung.</p><p class="muted">Erfasste Tage: ${rows.length}</p></div>`;
  const tot = groupStats(rows);
  const groups = {};
  rows.forEach(r => (groups[phaseLabel(r.ph)] ||= []).push(r));
  const order = Object.keys(groups).sort();
  const cycles = {};
  rows.forEach(r => r.ph && (cycles[r.ph.cycle] ||= []).push(r));

  // Hinweise
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
  const ringRows = rows.filter(r => r.ph?.kind === 'ring'), pauseRows = rows.filter(r => r.ph?.kind === 'pause');
  if (ringRows.length >= 3 && pauseRows.length >= 3) {
    const a = avg(ringRows.map(r => r.e.pain)), b = avg(pauseRows.map(r => r.e.pain));
    if (a != null && b != null) notes.push(`Schmerzen mit Ring: Ø ${f1(a)}, in der Ringpause: Ø ${f1(b)}.`);
  }
  const spotRing = ringRows.filter(r => isSpot(r.e) || isBleed(r.e)).length;
  if (ringRows.length) notes.push(`An ${spotRing} von ${ringRows.length} Tagen mit Ring gab es Blutungen oder Schmierblutungen (${pct(spotRing, ringRows.length)}).`);
  const links = correlationNotes(rows);

  const row = (name, g) => `<tr><td>${esc(name)}</td><td class="num">${g.n}</td><td class="num">${f1(g.pain)}</td><td class="num">${f1(g.cramps)}</td><td class="num">${pct(g.diar, g.n)}</td><td class="num">${pct(g.bleed, g.n)}</td><td class="num">${pct(g.spot, g.n)}</td><td class="num">${f1(g.stress)}</td></tr>`;
  const head = '<tr><th>&nbsp;</th><th class="num">Tage</th><th class="num">Ø Schm.</th><th class="num">Ø Kr.</th><th class="num">Durchf.</th><th class="num">Blut.</th><th class="num">Schmier</th><th class="num">Ø Stress</th></tr>';

  return `<h1>Auswertung</h1>
  <div class="card"><div class="stats">
    <div class="stat"><b>${tot.n}</b>erfasste Tage</div>
    <div class="stat"><b>${f1(tot.pain)}</b>Ø Schmerz (0–10)</div>
    <div class="stat"><b>${pct(tot.bleed, tot.n)}</b>Tage mit Blutung</div>
    <div class="stat"><b>${pct(tot.diar, tot.n)}</b>Tage mit Durchfall</div>
  </div></div>
  ${notes.length ? `<div class="card"><h2 style="margin-top:0">Auffälligkeiten</h2>${notes.map(n => `<div class="insight">${n}</div>`).join('')}</div>` : ''}
  <div class="card"><h2 style="margin-top:0">Zusammenhänge: Essen, Emotionen &amp; Symptome</h2>
    ${links.length ? links.map(n => `<div class="insight">${n}</div>`).join('') : `<p class="muted">${rows.length < 10 ? 'Für Zusammenhänge braucht es etwa 10 erfasste Tage, mit Essen und Emotionen.' : 'Bisher sind keine deutlichen Zusammenhänge erkennbar.'}</p>`}
    <p class="muted">Berücksichtigt werden Essensbeschreibungen, Freitexte und Emotionswerte, jeweils am selben und am Folgetag. Das sind Muster, keine Beweise.</p></div>
  <div class="card"><h2 style="margin-top:0">Symptome im Verlauf</h2>${chartSVG(rows, [{ key: 'pain', label: 'Schmerzen', color: 'var(--accent)' }, { key: 'cramps', label: 'Krämpfe', color: 'var(--warn)', dash: true }], 10, true)}</div>
  <div class="card"><h2 style="margin-top:0">Emotionen im Verlauf</h2>${chartSVG(rows, [{ key: 'stress', label: 'Stress', color: 'var(--accent)' }, { key: 'anxiety', label: 'Angst', color: 'var(--lilac)', dash: true }, { key: 'anger', label: 'Wut', color: 'var(--warn)' }], 5, false)}</div>
  <div class="card"><h2 style="margin-top:0">Nach Ring-Phase</h2><div class="table-wrap"><table>${head}${order.map(k => row(k, groupStats(groups[k]))).join('')}</table></div></div>
  <div class="card"><h2 style="margin-top:0">Nach Ring-Zyklus</h2><div class="table-wrap"><table>${head}${Object.keys(cycles).map(c => row(`Zyklus ${c} (ab ${fmtShort(cycles[c][0].ph.start)})`, groupStats(cycles[c]))).join('')}</table></div></div>
  <div class="card noprint"><button class="btn" data-action="print">Als PDF drucken / speichern</button> <button class="btn ghost" data-action="csv">CSV exportieren</button></div>
  <p class="notice">Diese Auswertung zeigt Muster in den eigenen Aufzeichnungen und ersetzt keine ärztliche Beratung. Zum Gespräch mit dem Frauenarzt kann sie eine gute Grundlage sein.</p>`;
}

// ---------- Einstellungen ----------
function settingsHTML() {
  const ins = [...settings.inserts].sort();
  const ios = /iPhone|iPad/.test(navigator.userAgent) && !navigator.standalone;
  return `<h1>Einstellungen</h1>
  ${ios ? '<div class="card"><h2 style="margin-top:0">Auf dem iPhone installieren</h2><p class="muted">In Safari auf <b>Teilen</b> tippen, dann <b>Zum Home-Bildschirm</b>. Nur so bleiben die Daten dauerhaft gespeichert und die App öffnet sich im Vollbild.</p></div>' : ''}
  <div class="card"><h2 style="margin-top:0">Ring-Rhythmus</h2>
    <label>Tage mit Ring</label><input type="number" id="s-wear" min="1" max="60" value="${settings.wearDays}">
    <label>Ringpause (Tage, 0 = durchgehend)</label><input type="number" id="s-pause" min="0" max="14" value="${settings.pauseDays}">
    <p><button class="btn small" data-action="saverhythm">Speichern</button></p>
    <h3>Ring-Einsetzdaten</h3>
    ${ins.map(d => `<div class="row between" style="margin-bottom:6px"><span>${fmtDate(d)}</span>${ins.length > 1 ? `<button class="btn danger small" data-action="delinsert" data-d="${d}">Löschen</button>` : ''}</div>`).join('')}
    <div class="row"><input type="date" id="s-newins" value="${todayStr()}"><button class="btn ghost small" data-action="addinsert">Hinzufügen</button></div>
  </div>
  <div class="card"><h2 style="margin-top:0">Erinnerung zum Ringwechsel</h2>
    <p class="muted">Am Entfern- und Einsetztag erscheint ein Hinweis in der App. Für echte Benachrichtigungen, 2× täglich (8:00 und 20:00 Uhr), erzeugst du einen Kalendertermin-Export und fügst ihn über „Teilen“ → „Kalender“ hinzu.</p>
    <button class="btn" data-action="ics">Kalender-Erinnerungen laden (.ics)</button></div>
  <div class="card"><h2 style="margin-top:0">Daten</h2>
    <div class="row wrap"><button class="btn ghost small" data-action="backup">Backup (JSON)</button>
    <button class="btn ghost small" data-action="csv">CSV</button>
    <label class="btn ghost small" style="margin:0;display:inline-block">Backup laden<input type="file" id="s-import" accept="application/json" hidden></label></div>
    <p class="muted">Die Daten liegen nur auf diesem Gerät. Mach regelmäßig ein Backup, besonders vor dem Löschen von Browserdaten.</p>
    <button class="btn danger small" data-action="reset">Alles löschen</button></div>`;
}

// ---------- Export ----------
async function download(name, text, type) {
  const file = new File([text], name, { type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function csv() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const hdr = ['Datum', 'Phase', 'Ringtag', 'Schmerzen', 'Kraempfe', 'Durchfall', 'Blutung', 'Angst', 'Wut', 'Stress', 'Essen', 'Essen-Freitext', 'Notiz'];
  const lines = loggedDays().map(({ d, e, ph }) => [d, phaseLabel(ph), ph?.day, e.pain, e.cramps, e.diarrhea, e.bleeding, e.anxiety, e.anger, e.stress,
    (e.meals || []).filter(m => m.text.trim()).map(m => `${m.time} ${m.text} (${m.amount})`).join('; '), e.foodNote, e.note].map(q).join(','));
  download('ringtagebuch.csv', '﻿' + [hdr.join(','), ...lines].join('\n'), 'text/csv');
}
function ics() {
  const { wearDays: w, pauseDays: p } = settings;
  const ins = [...settings.inserts].sort();
  const last = ins[ins.length - 1];
  const events = [];
  const add = (date, title) => ['08:00', '20:00'].forEach(t => events.push({ date, t, title }));
  for (let c = 0; c < 12; c++) {
    const s = addDays(last, c * (w + p));
    if (p > 0) add(addDays(s, w), 'Ring entfernen');
    add(addDays(s, w + p), 'Neuen Ring einsetzen');
  }
  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ringtagebuch//DE', ...events.filter(e => e.date >= todayStr()).flatMap((e, i) => [
    'BEGIN:VEVENT', `UID:nuv-${e.date}-${e.t.replace(':', '')}-${i}@ringtagebuch`, `DTSTAMP:${now}`,
    `DTSTART:${e.date.replace(/-/g, '')}T${e.t.replace(':', '')}00`, 'DURATION:PT15M', `SUMMARY:${e.title}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${e.title}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT']), 'END:VCALENDAR'];
  download('ringwechsel.ics', out.join('\r\n'), 'text/calendar');
}

// ---------- Events ----------
view.addEventListener('click', ev => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action, d = el.dataset;
  const $ = id => document.getElementById(id);
  switch (a) {
    case 'start': {
      const w = +$('ob-wear').value, p = +$('ob-pause').value, date = $('ob-date').value || todayStr();
      settings = { inserts: [date], wearDays: w, pauseDays: p }; saveSettings(); curDate = todayStr(); break;
    }
    case 'scale': { const cur = getE()[d.k]; patch({ [d.k]: cur === +d.v ? null : +d.v }); break; }
    case 'bleed': patch({ bleeding: getE().bleeding === d.v ? null : d.v }); break;
    case 'day': { const n = addDays(curDate, +d.d); if (n <= todayStr()) curDate = n; break; }
    case 'open': curDate = d.d; tab = 'today'; break;
    case 'month': { const [y, m] = calMonth.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1 + +d.d, 1)); calMonth = dt.toISOString().slice(0, 7); break; }
    case 'addmeal': { const now = new Date(); patch({ meals: [...(getE().meals || []), { time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, text: '', amount: 'normal' }] }); break; }
    case 'delmeal': { const m = [...(getE().meals || [])]; m.splice(+d.i, 1); patch({ meals: m }); break; }
    case 'newring': { if (!settings.inserts.includes(todayStr())) { settings.inserts.push(todayStr()); saveSettings(); } break; }
    case 'saverhythm': {
      const w = Math.max(1, +$('s-wear').value || 21), p = Math.max(0, +$('s-pause').value || 0);
      settings.wearDays = w; settings.pauseDays = p; saveSettings(); break;
    }
    case 'addinsert': { const v = $('s-newins').value; if (v && !settings.inserts.includes(v)) { settings.inserts.push(v); saveSettings(); } break; }
    case 'delinsert': settings.inserts = settings.inserts.filter(x => x !== d.d); saveSettings(); break;
    case 'print': window.print(); return;
    case 'csv': csv(); return;
    case 'ics': ics(); return;
    case 'backup': download('ringtagebuch-backup.json', JSON.stringify({ settings, entries }), 'application/json'); return;
    case 'reset':
      if (confirm('Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.')) { localStorage.clear(); settings = null; entries = {}; }
      else return;
      break;
  }
  render();
});

view.addEventListener('input', ev => {
  const el = ev.target, f = el.dataset.f;
  if (!f) return;
  if (f === 'note' || f === 'foodNote') return patch({ [f]: el.value });
  const i = +el.closest('[data-meal]').dataset.meal;
  const meals = [...(getE().meals || [])];
  meals[i] = { ...meals[i], [f.replace('meal-', '')]: el.value };
  patch({ meals });
});

view.addEventListener('change', ev => {
  if (ev.target.id !== 's-import') return;
  const file = ev.target.files[0];
  if (!file) return;
  file.text().then(t => {
    try {
      const data = JSON.parse(t);
      if (!data.settings || !data.entries) throw new Error();
      if (!confirm('Vorhandene Daten werden durch das Backup ersetzt. Fortfahren?')) return;
      settings = data.settings; entries = data.entries; saveSettings(); saveEntries(); render();
    } catch { alert('Die Datei ist kein gültiges Backup.'); }
  });
});

document.getElementById('tabs').addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (b) { tab = b.dataset.tab; render(); window.scrollTo(0, 0); }
});

render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

navigator.storage?.persist?.();
