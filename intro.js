'use strict';
/* Einführung: Startbildschirm, der alle Funktionen mit kleinen Animationen erklärt.
   WICHTIG: Bei jeder neuen Funktion und jeder Optikänderung hier anpassen (siehe CLAUDE.md).
   Jede Folie: Titel, kurzer Text, „art“ = animierte Mini-Darstellung (nur HTML/CSS, Klassen ia-*). */
const INTRO_VERSION = 1;

const nums = (from, to, on) => Array.from({ length: to - from + 1 }, (_, k) => from + k)
  .map(n => `<span class="${n === on ? 'ia-pick' : ''}">${n > 0 && from < 0 ? '+' + n : String(n).replace('-', '−')}</span>`).join('');

const INTRO_SLIDES = [
  {
    title: 'Willkommen im Ringtagebuch',
    text: 'Halte jeden Tag fest, wie es dir geht. So wird sichtbar, wie der NuvaRing deinen Körper und die Endometriose beeinflusst.',
    art: `<img class="ia-icon" src="icon.svg" alt=""><div class="ia-glow"></div>`
  },
  {
    title: 'Vier Bereiche, ein Tag',
    text: 'Unter „Heute“ wechselst du zwischen Symptome, Essen, Gefühle und Körper – antippen oder seitlich wischen. Ein Punkt zeigt, was schon ausgefüllt ist.',
    art: `<div class="ia-seg"><i class="ia-seg-pill"></i><span>Symptome</span><span>Essen</span><span>Gefühle</span><span>Körper</span></div>
      <div class="ia-segdots"><b style="--d:0"></b><b style="--d:1"></b><b style="--d:2"></b><b style="--d:3"></b></div>`
  },
  {
    title: 'Symptome',
    text: 'Schmerzen und Krämpfe von 0 bis 10, wo es wehtut, Durchfall, Blutung – und ein Freitext für alles, was anders war.',
    art: `<div class="ia-scale">${nums(0, 10, 7)}</div>
      <div class="ia-chips"><span>Unterleib</span><span class="ia-pick" style="--d:1">Rücken</span><span>Darm</span></div>
      <div class="ia-type"><span>stechend nach dem Joggen</span></div>`
  },
  {
    title: 'Essen',
    text: 'Was gab es, wie viel und wann? Dazu ein Freitext. Die App erkennt später, nach welchem Essen es dir schlechter ging.',
    art: `<div class="ia-meal" style="--d:0"><b>08:00</b><span>Haferbrei mit Banane</span><em>normal</em></div>
      <div class="ia-meal" style="--d:1"><b>13:00</b><span>Pasta mit Tomaten</span><em>viel</em></div>
      <div class="ia-meal" style="--d:2"><b>19:30</b><span>Tee und Brot</span><em>wenig</em></div>`
  },
  {
    title: 'Gefühle',
    text: 'Deine Laune von −5 bis +5, dazu Angst, Wut und Stress – und Platz für deine Gedanken.',
    art: `<div class="ia-mood"><div class="ia-mood-track"><i></i></div><div class="ia-mood-lbl"><span>−5</span><span>0</span><span>+5</span></div></div>
      <div class="ia-bars"><div><span>Angst</span><i style="--w:30%;--d:0"></i></div><div><span>Wut</span><i style="--w:15%;--d:1"></i></div><div><span>Stress</span><i style="--w:70%;--d:2"></i></div></div>`
  },
  {
    title: 'Körper',
    text: 'Wie hast du geschlafen, wie viel Energie hast du? Und welche Schmerzmittel oder Hilfen hast du genommen?',
    art: `<div class="ia-bars"><div><span>Schlaf</span><i style="--w:80%;--d:0"></i></div><div><span>Energie</span><i style="--w:50%;--d:1"></i></div></div>
      <div class="ia-chips"><span class="ia-pick" style="--d:2">Ibuprofen</span><span>Wärmflasche</span></div>`
  },
  {
    title: 'Ring & Erinnerungen',
    text: 'Die App zählt die Ring-Tage und sagt dir, wann gewechselt wird. Auf Wunsch erinnert dein Kalender am Wechseltag um 8 und um 20 Uhr.',
    art: `<svg class="ia-ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" class="ia-ring-bg"/><circle cx="60" cy="60" r="48" class="ia-ring-fg" pathLength="1"/><text x="60" y="58" text-anchor="middle" class="ia-ring-n">13</text><text x="60" y="76" text-anchor="middle" class="ia-ring-s">von 28</text></svg>
      <div class="ia-bells"><span style="--d:0">8:00 Ring wechseln</span><span style="--d:1">20:00 Ring wechseln</span></div>`
  },
  {
    title: 'Verlauf',
    text: 'Im Kalender siehst du jeden Tag auf einen Blick, mit Blutungen und Ringwechseln. Antippen, um etwas nachzutragen.',
    art: `<div class="ia-cal">${Array.from({ length: 28 }, (_, k) => `<span style="--d:${k}" class="${[3, 4, 11].includes(k) ? 'ia-dot' : k === 16 ? 'ia-ring-day' : ''}"></span>`).join('')}</div>`
  },
  {
    title: 'Auswertung',
    text: 'Für Monat, Ring oder alles: Verläufe, Vergleiche und Zusammenhänge zwischen Essen, Gefühlen, Schlaf und Beschwerden.',
    art: `<svg class="ia-chart" viewBox="0 0 220 90" aria-hidden="true"><polyline pathLength="1" points="5,70 30,40 55,55 80,25 105,45 130,30 155,60 180,35 215,50"/></svg>
      <div class="ia-insight">Nach Tagen mit hohem Stress gab es öfter starke Schmerzen.</div>`
  },
  {
    title: 'Mit KI auswerten',
    text: 'Ein Tipp kopiert einen fertigen Auftrag mit allen Daten des Monats. Einfach in ChatGPT, Claude oder eine andere KI einfügen.',
    art: `<div class="ia-doc"><div class="ia-lines"><i style="--w:90%;--d:0"></i><i style="--w:75%;--d:1"></i><i style="--w:85%;--d:2"></i><i style="--w:60%;--d:3"></i></div></div>
      <div class="ia-toast">Kopiert ✓</div>`
  },
  {
    title: 'Für die Ärztin & Backup',
    text: 'Teile einen Bericht oder drucke ihn als PDF. Mach ab und zu ein Backup – die App erinnert dich daran.',
    art: `<div class="ia-doc ia-doc-share"><div class="ia-lines"><i style="--w:70%;--d:0"></i><i style="--w:90%;--d:1"></i><i style="--w:50%;--d:2"></i></div><svg class="ia-share" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg></div>`
  },
  {
    title: 'Privat und immer aktuell',
    text: 'Deine Daten bleiben nur auf diesem Handy. Neue Versionen kommen von selbst, wenn du die App öffnest.',
    art: `<svg class="ia-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
      <svg class="ia-sync" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4"/></svg>`
  }
];

function showIntro(onDone) {
  if (document.querySelector('.intro')) return;
  const el = document.createElement('div');
  el.className = 'intro';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Einführung');
  el.innerHTML = `<button class="intro-skip" type="button">Überspringen</button>
    <div class="intro-viewport"><div class="intro-track">${INTRO_SLIDES.map((s, i) => `<section class="intro-slide" aria-hidden="${i !== 0}">
      <div class="intro-art">${s.art}</div><h2>${s.title}</h2><p>${s.text}</p></section>`).join('')}</div></div>
    <div class="intro-foot">
      <div class="intro-dots">${INTRO_SLIDES.map((s, i) => `<button type="button" aria-label="Folie ${i + 1}: ${s.title}" data-i="${i}"></button>`).join('')}</div>
      <div class="intro-nav"><button class="btn ghost intro-back" type="button">Zurück</button><button class="btn intro-next" type="button">Weiter</button></div>
    </div>`;
  document.body.appendChild(el);
  const track = el.querySelector('.intro-track'), slides = [...el.querySelectorAll('.intro-slide')];
  const dots = [...el.querySelectorAll('.intro-dots button')], next = el.querySelector('.intro-next'), back = el.querySelector('.intro-back');
  let i = 0;
  function go(n) {
    i = Math.max(0, Math.min(slides.length - 1, n));
    track.style.transform = `translateX(${-i * 100}%)`;
    slides.forEach((s, k) => { s.classList.toggle('active', k === i); s.setAttribute('aria-hidden', k !== i); });
    dots.forEach((d, k) => { d.classList.toggle('on', k === i); d.setAttribute('aria-current', k === i ? 'step' : 'false'); });
    next.textContent = i === slides.length - 1 ? "Los geht's" : 'Weiter';
    back.style.visibility = i === 0 ? 'hidden' : 'visible';
  }
  function finish() {
    try { localStorage.setItem('nuv.intro', String(INTRO_VERSION)); } catch (e) { /* ohne Speicher einfach schließen */ }
    document.removeEventListener('keydown', onKey);
    el.classList.add('leave');
    setTimeout(() => { el.remove(); if (onDone) onDone(); }, 450);
  }
  function onKey(ev) {
    if (ev.key === 'ArrowRight') go(i + 1);
    else if (ev.key === 'ArrowLeft') go(i - 1);
    else if (ev.key === 'Escape') finish();
  }
  next.addEventListener('click', () => (i === slides.length - 1 ? finish() : go(i + 1)));
  back.addEventListener('click', () => go(i - 1));
  el.querySelector('.intro-skip').addEventListener('click', finish);
  dots.forEach(d => d.addEventListener('click', () => go(+d.dataset.i)));
  document.addEventListener('keydown', onKey);
  let t = null;
  el.addEventListener('touchstart', ev => { t = { x: ev.touches[0].clientX, y: ev.touches[0].clientY }; }, { passive: true });
  el.addEventListener('touchend', ev => {
    if (!t) return;
    const dx = ev.changedTouches[0].clientX - t.x, dy = ev.changedTouches[0].clientY - t.y;
    t = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) go(i + (dx < 0 ? 1 : -1));
  }, { passive: true });
  requestAnimationFrame(() => { el.classList.add('show'); go(0); next.focus({ focusVisible: false }); });
}
function introSeen() {
  try { return +(localStorage.getItem('nuv.intro') || 0) >= INTRO_VERSION; } catch (e) { return true; }
}
