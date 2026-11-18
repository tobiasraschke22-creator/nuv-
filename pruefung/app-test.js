const { chromium, devices } = require('playwright');
const fs = require('fs');
// Aufruf über pruefung/test.sh. Läuft am zuverlässigsten ab dem 5. eines Monats (Testdaten liegen relativ zu heute).
const SP = process.argv[2];
const BASE = process.env.BASE;
const VERSION = require('fs').readFileSync(__dirname + '/../VERSION', 'utf8').trim();
const now = new Date();
const monthOf = d => d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
const MONTH = monthOf(now), PREV = monthOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
const FIRST = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 14'], acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE);
  await p.waitForSelector('.intro.show');
  ok(await p.isVisible('.intro'), 'Erster Start: Einführung erscheint');
  const nSlides = await p.$$eval('.intro-slide', s => s.length);
  ok(nSlides === 12, `Einführung hat ${nSlides} Folien`);
  for (let k = 0; k < nSlides; k++) {
    if (k === 3 || k === 9) await p.screenshot({ path: `${SP}/intro_${k}.png` });
    ok(await p.$eval('.intro-slide.active h2', h => h.textContent.length > 3), `Folie ${k + 1}: ${await p.textContent('.intro-slide.active h2')}`);
    if (k < nSlides - 1) { await p.click('.intro-next'); await p.waitForTimeout(250); }
  }
  ok((await p.textContent('.intro-next')) === "Los geht's", 'Letzte Folie: „Los geht\'s“');
  await p.click('.intro-next'); await p.waitForTimeout(600);
  ok(!(await p.$('.intro')), 'Einführung geschlossen');
  ok(await p.evaluate(() => localStorage.getItem('nuv.intro')) === '1', 'Einführung gemerkt');
  await p.reload(); await p.waitForTimeout(400);
  ok(!(await p.$('.intro')), 'Einführung kommt nicht nochmal');
  ok(await p.isHidden('#tabs'), 'Tableiste beim Onboarding versteckt');
  await p.evaluate(() => localStorage.setItem('fremde-app', 'bleibt'));
  await p.click('[data-action=start]');
  const set = (w, pz, ago) => p.evaluate(([w, pz, ago]) => {
    const t = new Date(); const D = i => new Date(t - i * 864e5 - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    localStorage.setItem('nuv.settings', JSON.stringify({ inserts: [D(ago)], wearDays: w, pauseDays: pz }));
  }, [w, pz, ago]);
  const banner = async () => (await p.$$eval('.insight', n => n.map(x => x.textContent).join(' | ')));
  // durchgehend 28 Tage
  await set(28, 0, 27); await p.reload(); ok(!(await banner()).includes('wechseln'), 'Durchgehend Tag 28: noch kein Wechselhinweis');
  await set(28, 0, 28); await p.reload(); let t = await banner(); ok(t.includes('Heute Ring wechseln'), 'Durchgehend Tag 29: "Heute Ring wechseln"');
  ok((await p.textContent('.status')).includes('Wechseltag'), 'Status zeigt Wechseltag, nicht überfällig');
  await set(28, 0, 30); await p.reload(); ok((await banner()).includes('seit 2 Tag'), 'Überfällig korrekt gezählt');
  // mit Pause 21/7
  await set(21, 7, 21); await p.reload(); ok((await banner()).includes('Heute Ring entfernen'), '21/7 Tag 22: Ring entfernen');
  await set(21, 7, 27); await p.reload(); ok(!(await banner()).includes('einsetzen'), '21/7 letzter Pausentag: noch kein Einsetzhinweis');
  await set(21, 7, 28); await p.reload(); ok((await banner()).includes('Heute neuen Ring einsetzen'), '21/7 Tag 29: neuen Ring einsetzen');
  await p.click('[data-action=newring]'); ok((await p.textContent('.status')).includes('Ring-Tag 1 von 21'), 'Nach Wechsel: Ring-Tag 1');
  ok((await p.textContent('.status')).includes('Tagebuch-Tag 29'), 'Tagebuch-Tag läuft über Ringe hinweg weiter');
  // Eingaben
  const grab2 = async sel => { await p.$eval(sel, b => b.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300); const [d] = await Promise.all([p.waitForEvent('download'), p.$eval(sel, b => b.click())]); const f = `${SP}/${d.suggestedFilename()}`; await d.saveAs(f); return fs.readFileSync(f, 'utf8'); };
  const sec = async v => { await p.click(`[data-action=section][data-v=${v}]`); await p.waitForTimeout(50); };
  ok(await p.isVisible('[data-k=pain]') && !(await p.isVisible('[data-k=mood]')), 'Reiter: nur Symptome sichtbar');
  await p.click('[data-k=pain][data-v="6"]'); await p.click('[data-k=painAreas][data-v=Rücken]'); await p.fill('[data-f=symNote]', 'stechend nach dem Joggen');
  ok(await p.$eval('[data-k=pain][data-v="6"]', b => b.classList.contains('on') && b.classList.contains('pop')), 'Auswahl ohne Neuzeichnen, mit Animation');
  ok(await p.$eval('[data-action=section][data-v=sym] .seg-dot', d => d.classList.contains('done')), 'Punkt am Reiter zeigt „ausgefüllt“');
  await p.click('[data-action=step][data-d="1"]');
  ok(await p.isVisible('[data-action=addmeal]'), '„Weiter“ führt zu Essen');
  await p.click('[data-action=addmeal]');
  ok(await p.evaluate(() => document.activeElement.dataset.f) === 'meal-text', 'Neue Mahlzeit: Textfeld hat den Fokus');
  await p.fill('[data-f=meal-text]', 'Pizza'); await p.fill('[data-f=foodNote]', 'Bauchweh danach');
  await sec('body'); await p.click('[data-k=meds][data-v=Ibuprofen]'); await p.click('[data-k=sleep][data-v="2"]'); await p.fill('[data-f=medsNote]', '400 mg');
  await p.click('[data-action=finish]'); await p.waitForTimeout(100);
  ok((await p.textContent('#toast')).includes('noch offen: Gefühle'), 'Fertig-Knopf nennt offene Bereiche');
  await sec('sym'); ok(await p.$eval('[data-k=pain][data-v="6"]', b => b.classList.contains('on')), 'Zurück zu Symptomen: Wert noch da');
  await p.reload();
  const e = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('nuv.entries')))[0]);
  ok(e.pain === 6 && e.painAreas[0] === 'Rücken' && e.meds[0] === 'Ibuprofen' && e.sleep === 2 && e.meals[0].text === 'Pizza' && e.foodNote && e.medsNote === '400 mg' && e.symNote === 'stechend nach dem Joggen', 'Alle Felder gespeichert');
  await sec('food'); ok(await p.inputValue('[data-f=meal-text]') === 'Pizza', 'Mahlzeit nach Neuladen sichtbar');
  await p.click('[data-action=addmeal]'); await p.click('.meal:last-child [data-action=delmeal]'); await p.waitForTimeout(400);
  ok(await p.$$eval('.meal', m => m.length) === 1, 'Mahlzeit löschen');
  await sec('emo');
  await p.click('[data-k=mood][data-v="-3"]');
  ok((await p.textContent('[data-k=mood].on')).trim() === '−3', 'Laune-Skala zeigt −3');
  ok((await p.textContent('[data-k=mood][data-v="5"]')).trim() === '+5', 'Laune-Skala zeigt +5');
  ok(await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('nuv.entries')))[0].mood) === -3, 'Laune gespeichert');
  const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? r.scope : null; });
  ok(sw && sw.endsWith('/ringtagebuch/'), 'Offline-Speicher unter /ringtagebuch/ aktiv: ' + sw);
  ok(await p.evaluate(async () => (await fetch('manifest.json')).ok), 'manifest.json erreichbar');
  // Testdaten mit Mustern: Milch + spätes Essen -> Beschwerden, schlechter Schlaf -> Schmerz
  await p.evaluate(() => {
    const t = new Date(); const D = i => new Date(t - i * 864e5 - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    const e = {};
    for (let i = 40; i >= 0; i--) {
      const milk = i % 4 === 0, bad = i % 5 === 0;
      e[D(i)] = { pain: milk || bad ? 7 : (i * 3) % 5, cramps: milk ? 6 : (i * 2) % 4, diarrhea: milk ? 2 : 0, bleeding: i % 9 === 0 ? 'light' : i % 6 === 0 ? 'spotting' : 'none',
        stress: milk ? 4 : i % 3, mood: milk ? -4 : 2, anxiety: i % 3, anger: i % 2, sleep: bad ? 1 : 4, energy: bad ? 2 : 4, painAreas: milk ? ['Unterleib', 'Darm'] : ['Rücken'],
        meds: milk ? ['Ibuprofen'] : [], meals: [{ time: milk ? '21:00' : '12:30', text: milk ? 'Latte Macchiato mit Milch' : 'Haferbrei Banane', amount: milk ? 'viel' : 'normal' }],
        foodNote: '', symNote: milk ? 'stechend, krampfartig' : i % 3 === 0 ? 'ziehend' : '', note: milk ? 'Stressiger Tag' : 'ruhig' };
    }
    localStorage.setItem('nuv.settings', JSON.stringify({ inserts: [D(40), D(12)], wearDays: 28, pauseDays: 0 }));
    localStorage.setItem('nuv.entries', JSON.stringify(e));
  });
  await p.reload(); await p.click('[data-tab=analysis]');
  ok(await p.$eval('#tabs', n => getComputedStyle(n).getPropertyValue('--i').trim()) === '2', 'Tableisten-Kapsel steht auf Auswertung');
  ok(await p.$eval('.seg.static button.on', b => b.dataset.v) === 'month' && (await p.textContent('.month-nav')).includes(MONTH), 'Standard-Zeitraum: aktueller Monat');
  await p.click('[data-action=pmonth][data-d="-1"]');
  ok((await p.textContent('.month-nav')).includes(PREV), 'Monat zurückblättern');
  ok(await p.$eval('[data-action=pmonth][data-d="1"]', b => !b.disabled), 'Vorblättern möglich');
  await p.click('[data-action=pmonth][data-d="1"]');
  ok(await p.$eval('[data-action=pmonth][data-d="1"]', b => b.disabled), 'Nicht in die Zukunft blättern');
  // KI-Auftrag für den Monat
  await p.click('[data-action=section][data-v=tables]'); await p.waitForTimeout(700);
  await p.$eval('[data-action=aicopy]', b => b.click()); await p.waitForTimeout(200);
  const ki = await p.evaluate(() => navigator.clipboard.readText());
  fs.writeFileSync(SP + '/ki-text.txt', ki);
  ok(ki.startsWith('Du bist ein interdisziplinäres Team') && ki.includes('den Monat ' + MONTH) && ki.includes('durchgehend ohne Pause, Ringwechsel alle 28 Tage'), 'KI-Text: Prompt mit Monat und Rhythmus');
  ok(ki.includes('TAGESDATEN') && ki.includes('Sonntag') === false && ki.includes(FIRST) && ki.includes('Laune −4') && ki.includes('Latte Macchiato mit Milch'), 'KI-Text: Tagesdaten mit Werten');
  ok(!ki.includes(PREV + ' ('), 'KI-Text: nur der gewählte Monat');
  ok(/Blutung: \w+, Notiz: stechend, krampfartig/.test(ki) && ki.includes('Beschreibung im Freitext'), 'KI-Text: Symptom-Notiz übernommen');
  ok(ki.includes('MUSTER, DIE DIE APP GEFUNDEN HAT') && !ki.includes('<b>'), 'KI-Text: gefundene Muster ohne HTML');
  ok((await p.textContent('#toast')).includes('Kopiert'), 'Kopieren bestätigt');
  const kiFile = await grab2('[data-action=aishare]'); ok(kiFile === ki, 'KI-Datei = kopierter Text');
  await p.click('[data-action=period][data-v=all]'); await p.click('[data-action=section][data-v=overview]');
  let an = await p.textContent('#view');
  ok(an.includes('Ø Schmerz') && !an.includes('Symptome im Verlauf'), 'Auswertung: Reiter Überblick');
  for (const v of ['links', 'charts', 'tables']) { await p.click(`[data-action=section][data-v=${v}]`); an += await p.textContent('#pane'); }
  ok(await p.$eval('.seg:not(.static) button.on', b => b.dataset.v) === 'tables' && await p.$eval('.seg.static button.on', b => b.dataset.v) === 'all', 'Auswertung: richtiger Schalter bewegt sich');
  await p.click('[data-action=section][data-v=charts]'); await p.screenshot({ path: `${SP}/an_charts.png`, fullPage: true });
  await p.click('[data-action=section][data-v=overview]');
  ok(an.includes('spätes Essen') && an.includes('große Portion'), 'Uhrzeit/Menge fließen in Zusammenhänge ein');
  ok(an.includes('schlechtem Schlaf'), 'Schlaf fließt in Zusammenhänge ein');
  ok(an.includes('schlechter Laune') && an.includes('Laune im Verlauf') && an.includes('Ø Laune'), 'Laune in Auswertung, Diagramm und Tabelle');
  ok(an.includes('Häufigste Beschreibungen in den Symptom-Notizen: „stechend“') && an.includes('Häufigste Schmerzorte') && an.includes('Schmerzmittel an'), 'Schmerzorte & Schmerzmittel ausgewertet');
  ok(an.includes('Ring Woche 1') && an.includes('Nach Wechseltermin') === false, 'Phasen korrekt gruppiert');
  await p.screenshot({ path: `${SP}/an_all.png`, fullPage: true });
  await p.click('[data-action=period][data-v=ring]');
  ok((await p.textContent('#view')).includes('13 von 13 Tagen'), 'Zeitraum "Aktueller Ring" filtert');
  ok(await p.isVisible('.seg-pill'), 'Reiter bleiben nach Zeitraumwechsel');
  await p.click('[data-action=period][data-v=all]');
  // Downloads
  const grab = async sel => { await p.waitForTimeout(600); await p.$eval(sel, b => b.scrollIntoView({ block: 'center' })); const [d] = await Promise.all([p.waitForEvent('download'), p.$eval(sel, b => b.click())]); const f = `${SP}/${d.suggestedFilename()}`; await d.saveAs(f); return fs.readFileSync(f, 'utf8'); };
  const rep = await grab('[data-action=report]');
  ok(rep.includes('Auswertung') && rep.includes('Symptome im Verlauf') && rep.includes('Nach Ring-Phase') && rep.includes('Zusammenhänge') && !rep.includes('Bericht teilen') && !rep.includes('class="seg'), 'Bericht: alle Reiter, ohne Bedienelemente');
  ok(rep.indexOf('Auftrag an die KI') < rep.indexOf('Symptome im Verlauf') && rep.includes('Tagesdaten') && rep.indexOf('Tagesdaten') > rep.indexOf('Nach Ring-Phase'), 'Bericht: beginnt mit KI-Auftrag, endet mit Tagesdaten');
  await p.click('[data-tab=settings]');
  await p.evaluate(() => { window.__cal = []; window.openCalendar = (n, t) => window.__cal.push(t); });
  const calOf = async sel => { await p.click(sel); return p.evaluate(() => window.__cal.pop()); };
  const ics = await calOf('[data-action=ics]');
  ok(ics.includes('SUMMARY:Ring wechseln') && (ics.match(/BEGIN:VEVENT/g) || []).length === 24 && ics.includes('T080000') && ics.includes('T200000'), 'ICS: 12 Wechsel × 2 Erinnerungen');
  const diary = await calOf('[data-action=icsdiary]'); ok(diary.includes('RRULE:FREQ=DAILY'), 'ICS: tägliche Tagebuch-Erinnerung');
  const csv = await grab('[data-action=csv]'); ok(csv.split('\r\n').length === 42 && csv.includes('Laune') && csv.includes('Symptome-Notiz') && csv.includes('krampfartig'), 'CSV: 41 Tage + Kopfzeile');
  await p.screenshot({ path: `${SP}/settings.png`, fullPage: true });
  await p.$eval('[data-action=intro]', b => b.click()); await p.waitForSelector('.intro.show');
  ok(await p.isVisible('.intro'), 'Einführung über „Mehr“ erneut aufrufbar');
  await p.click('.intro-skip'); await p.waitForTimeout(600);
  ok(!(await p.$('.intro')), 'Überspringen schließt die Einführung');
  await p.click('[data-tab=today]'); await p.click('[data-tab=settings]'); ok((await p.textContent('#view')).includes('Ringtagebuch ' + VERSION), 'Versionsnummer sichtbar'); await p.click('[data-tab=today]'); await p.waitForTimeout(700); await p.screenshot({ path: `${SP}/today.png` });
  await p.evaluate(() => window.scrollTo(0, 400)); await p.waitForTimeout(100);
  ok(await p.$eval('.seg', s => s.getBoundingClientRect().top < 80), 'Reiter-Schalter klebt beim Scrollen oben');
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.click('[data-tab=history]'); await p.screenshot({ path: `${SP}/history.png` });
  await p.click('[data-tab=settings]');
  p.once('dialog', d => d.accept()); await p.click('[data-action=reset]');
  ok(await p.evaluate(() => localStorage.getItem('fremde-app')) === 'bleibt' && await p.evaluate(() => localStorage.getItem('nuv.entries')) === null, 'Löschen entfernt nur eigene Daten');
  ok(errs.length === 0, 'Keine JS-Fehler ' + JSON.stringify(errs));
  console.log(fails ? `${fails} FEHLER` : 'ALLES OK');
  await b.close();
})();
