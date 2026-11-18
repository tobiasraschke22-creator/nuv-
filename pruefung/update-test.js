const { chromium, devices } = require('playwright');
const { execSync } = require('child_process');
const SP = process.argv[2];
const OLD = process.env.OLD, NEW = process.env.NEW;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// Aufruf über pruefung/test.sh: SP enthält alt/, neu/ und www/ringtagebuch/ (wird vom Server ausgeliefert)
const serve = v => execSync(`cp -r ${SP}/${v}/. ${SP}/www/ringtagebuch/`);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 14'] }); await ctx.addInitScript(() => { try { if (!localStorage.getItem('nuv.intro')) localStorage.setItem('nuv.intro', '99'); } catch (e) {} }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let loads = 0; p.on('load', () => loads++);
  const ver = () => p.evaluate(() => APP_VERSION);
  const resume = () => p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await p.goto(process.env.BASE);
  await p.click('[data-action=start]');
  await p.click('[data-k=pain][data-v="5"]');
  await p.evaluate(() => navigator.serviceWorker.ready);
  ok(await ver() === OLD, 'Handy läuft mit der alten Version');
  await p.waitForTimeout(300);
  ok(!(await p.$('.sheet')), 'Erstinstallation: kein „Was ist neu“');
  await resume(); await p.waitForTimeout(800);
  ok(await ver() === OLD && loads === 1, 'Ohne neue Version: kein Neuladen');

  serve('neu');                               // Update auf der DiskStation eingespielt
  await resume();                              // App kommt aus dem Hintergrund zurück
  await p.waitForLoadState('load'); await p.waitForTimeout(1500);
  ok(await ver() === NEW, 'Nach Rückkehr: App lädt sich selbst neu auf die neue Version');
  ok(await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('nuv.entries')))[0].pain) === 5, 'Daten nach dem Update erhalten');
  ok(await p.isVisible('.sheet') && (await p.textContent('.sheet')).includes('Neu in Version ' + NEW) && (await p.textContent('.sheet')).includes('Testneuerung'), '„Was ist neu“ erscheint einmal');
  await p.click('.sheet [data-close]'); await p.waitForTimeout(600);
  ok(!(await p.$('.sheet')), 'Fenster schließt');
  const swNow = () => p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return [r?.active?.state, r?.installing?.state, r?.waiting?.state].map(x => x || '-').join('/'); }).catch(() => '?');
  const swBefore = await swNow();
  let hung = false;
  await p.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { hung = true; });
  ok(!hung, `Neuladen nach dem Update hängt nicht (Offline-Speicher vorher: ${swBefore})`);
  if (hung) await p.goto(process.env.BASE);
  await p.waitForTimeout(800);
  ok(!(await p.$('.sheet')), '„Was ist neu“ kommt nicht nochmal');

  // Schutz gegen Endlosschleife: Server meldet neuere Version, liefert aber alte Dateien
  execSync(`printf '{"version":"9.9.9","notes":[]}' > ${SP}/www/ringtagebuch/version.json`);
  const before = loads;
  await resume(); await p.waitForLoadState('load'); await p.waitForTimeout(1200);
  await resume(); await p.waitForTimeout(1200);
  ok(loads - before <= 1, `Kein Endlos-Neuladen (${loads - before}× neu geladen)`);

  // Offline: App startet trotzdem
  await ctx.setOffline(true);
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800);
  ok((await p.textContent('#view')).includes('Symptome'), 'Offline: App startet aus dem Speicher');
  await ctx.setOffline(false);
  ok(errs.length === 0, 'Keine JS-Fehler ' + JSON.stringify(errs));
  console.log(fails ? `${fails} FEHLER` : 'ALLES OK');
  await b.close();
})();
