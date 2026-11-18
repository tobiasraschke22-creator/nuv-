// Erzeugt die iPhone-Startbilder (hell und dunkel) nach splash/ und trägt sie in index.html ein.
//   node werkzeug/startbilder.js      (benötigt Playwright mit Chromium)
// Neu ausführen, wenn sich Icon oder Hintergrundfarben ändern.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
// [CSS-Breite, CSS-Höhe, Pixeldichte] aller iPhones ab iPhone SE (1. Gen.)
const DEVICES = [
  [320, 568, 2], [375, 667, 2], [414, 736, 3], [375, 812, 3], [414, 896, 2], [414, 896, 3], [390, 844, 3],
  [428, 926, 3], [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3], [420, 912, 3]
];
const THEMES = [['light', '#f8f7f8', '#2d2a2c'], ['dark', '#121012', '#f3eef0']];
(async () => {
  const svg = fs.readFileSync(path.join(root, 'icon.svg'), 'utf8').replace('<svg ', '<svg width="100%" height="100%" ');
  fs.mkdirSync(path.join(root, 'splash'), { recursive: true });
  const b = await chromium.launch();
  const links = [];
  for (const [w, h, r] of DEVICES) {
    for (const [name, bg, fg] of THEMES) {
      const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: r });
      await p.setContent(`<body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:${bg};
        font:600 20px ui-rounded,-apple-system,'Segoe UI',sans-serif;color:${fg}">
        <div style="width:${Math.round(w * .3)}px;height:${Math.round(w * .3)}px;border-radius:${Math.round(w * .3 * .225)}px;overflow:hidden;box-shadow:0 12px 30px rgba(214,98,138,.25)">${svg}</div>
        <div>Ringtagebuch</div></body>`);
      const file = `splash/start-${w * r}x${h * r}-${name}.png`;
      await p.screenshot({ path: path.join(root, file) });
      await p.close();
      links.push(`<link rel="apple-touch-startup-image" media="screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait) and (prefers-color-scheme: ${name})" href="${file}">`);
    }
  }
  await b.close();
  const idx = path.join(root, 'index.html');
  const block = `<!--STARTBILDER-->\n${links.join('\n')}\n<!--/STARTBILDER-->`;
  let html = fs.readFileSync(idx, 'utf8');
  html = html.includes('<!--/STARTBILDER-->') ? html.replace(/<!--STARTBILDER-->[\s\S]*?<!--\/STARTBILDER-->/, block) : html.replace('<!--STARTBILDER-->', block);
  fs.writeFileSync(idx, html);
  // verkleinern (256 Farben reichen für Fläche + Icon)
  require('child_process').execFileSync('python3', ['-c', `
import glob
from PIL import Image
for f in glob.glob('${path.join(root, 'splash').replace(/\\/g, '/')}/*.png'):
    Image.open(f).convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(f, optimize=True)
`]);
  console.log(`${links.length} Startbilder erzeugt`);
})();
