// Renders the app icon, Android adaptive icon layers, splash and favicon
// in the "Grain" direction. Run: node scripts/make-icons.js (needs Playwright).
const path = require('path');
const { chromium } = require('playwright');

const out = (f) => path.join(__dirname, '..', 'assets', f);

// The companion (juvenile form, ember species), drawn like src/components/Companion.tsx.
function companion({ cx = 100, bottom = 176, w = 132, h = 140, eyes = 'open', mono = false } = {}) {
  const top = bottom - h, r = cx + w / 2, l = cx - w / 2;
  const body = `M ${cx} ${top} C ${cx + 0.34 * w} ${top} ${r} ${top + 0.28 * h} ${r} ${top + 0.55 * h} C ${r} ${top + 0.82 * h} ${cx + 0.3 * w} ${bottom} ${cx} ${bottom} C ${cx - 0.3 * w} ${bottom} ${l} ${top + 0.82 * h} ${l} ${top + 0.55 * h} C ${l} ${top + 0.28 * h} ${cx - 0.34 * w} ${top} ${cx} ${top} Z`;
  const hh = h * 0.17 * 0.84, y = top + h * 0.07, lx = cx - w * 0.17, rx = cx + w * 0.17, sw = w * 0.05;
  const ink = mono ? '#fff' : '#7A3B26';
  const horns = `<path d="M ${lx + 3} ${y + 4} C ${lx - hh * 0.5} ${y - hh} ${lx + hh * 0.1} ${y - hh * 1.6} ${lx + hh * 0.6} ${y - hh * 0.9}" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>
    <path d="M ${rx - 3} ${y + 4} C ${rx + hh * 0.5} ${y - hh} ${rx - hh * 0.1} ${y - hh * 1.6} ${rx - hh * 0.6} ${y - hh * 0.9}" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
  const feet = `<ellipse cx="${cx - w * 0.2}" cy="${bottom - 1}" rx="${w * 0.11}" ry="${h * 0.045}" fill="${mono ? '#fff' : '#4A2318'}"/>
    <ellipse cx="${cx + w * 0.2}" cy="${bottom - 1}" rx="${w * 0.11}" ry="${h * 0.045}" fill="${mono ? '#fff' : '#4A2318'}"/>`;
  const ey = top + h * 0.53, ed = w * 0.13, er = w * 0.034;
  const eyesSvg = mono
    ? ''
    : eyes === 'closed'
      ? [cx - ed, cx + ed].map((x) => `<path d="M ${x - er * 1.6} ${ey} Q ${x} ${ey + er * 1.4} ${x + er * 1.6} ${ey}" stroke="#2A1510" stroke-width="2.2" stroke-linecap="round" fill="none"/>`).join('')
      : [cx - ed, cx + ed].map((x) => `<ellipse cx="${x}" cy="${ey}" rx="${er}" ry="${er * 1.4}" fill="#1A0D0A"/><circle cx="${x + er * 0.3}" cy="${ey - er * 0.5}" r="${er * 0.32}" fill="#F7E9D3"/>`).join('');
  const shine = mono ? '' : `<path d="M ${cx - w * 0.3} ${top + h * 0.33} C ${cx - w * 0.24} ${top + h * 0.2} ${cx - w * 0.12} ${top + h * 0.16} ${cx - w * 0.02} ${top + h * 0.17}" stroke="#F7E9D3" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.45"/>`;
  return `${feet}${horns}<path d="${body}" fill="${mono ? '#fff' : 'url(#body)'}"/>${shine}${eyesSvg}`;
}

const defs = `<defs>
  <radialGradient id="body" cx="0.42" cy="0.32" r="0.75">
    <stop offset="0" stop-color="#F1D9B8"/><stop offset="0.35" stop-color="#B8673F"/><stop offset="0.8" stop-color="#4A2318"/><stop offset="1" stop-color="#1B0F0C"/>
  </radialGradient>
  <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#B8673F" stop-opacity="0.45"/><stop offset="1" stop-color="#B8673F" stop-opacity="0"/></radialGradient>
  <radialGradient id="b1" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#5A2A22" stop-opacity="0.95"/><stop offset="1" stop-color="#5A2A22" stop-opacity="0"/></radialGradient>
  <radialGradient id="b2" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#2E4A47" stop-opacity="0.9"/><stop offset="1" stop-color="#2E4A47" stop-opacity="0"/></radialGradient>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="3" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="table" tableValues="0 0.5"/></feComponentTransfer>
  </filter>
</defs>`;

const ground = `<rect width="200" height="200" fill="#141210"/>
  <circle cx="30" cy="40" r="110" fill="url(#b1)"/><circle cx="185" cy="170" r="100" fill="url(#b2)"/>`;
const grain = `<rect width="200" height="200" filter="url(#grain)" style="mix-blend-mode:overlay"/><rect width="200" height="200" filter="url(#grain)" opacity="0.25"/>`;

const art = {
  // iOS / store icon: opaque, full bleed.
  'icon.png': { size: 1024, svg: `${ground}<circle cx="100" cy="112" r="88" fill="url(#halo)"/>${companion({ bottom: 168, w: 116, h: 122 })}${grain}` },
  // Android adaptive layers: the system crops to a circle or squircle (safe zone ≈ 66 %).
  'android-icon-background.png': { size: 512, svg: `${ground}${grain}` },
  'android-icon-foreground.png': { size: 512, transparent: true, svg: `<circle cx="100" cy="104" r="60" fill="url(#halo)"/>${companion({ bottom: 142, w: 80, h: 84 })}` },
  'android-icon-monochrome.png': { size: 432, transparent: true, svg: companion({ bottom: 142, w: 80, h: 84, mono: true }) },
  // Splash: the seed asleep, on the app background colour.
  'splash-icon.png': { size: 1024, transparent: true, svg: `<circle cx="100" cy="112" r="60" fill="url(#halo)"/>${companion({ bottom: 140, w: 60, h: 70, eyes: 'closed' }).replace(/<path d="M [^"]*" stroke="#7A3B26"[^>]*\/>/g, '').replace(/<ellipse[^>]*fill="#4A2318"\/>/g, '')}` },
  'favicon.png': { size: 48, svg: `${ground}${companion({ bottom: 172, w: 140, h: 150 })}` },
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [file, { size, svg, transparent }] of Object.entries(art)) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200">${defs}${svg}</svg></body></html>`);
    await page.screenshot({ path: out(file), omitBackground: !!transparent });
    console.log('assets/' + file);
  }
  await browser.close();
})();
