// Store screenshots: drives the web build with a seeded journey, then frames
// each screen with a caption in the Grain style.
//
//   1. Start a local Supabase (see README) and build the web app against it:
//      EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=... npx expo export -p web
//   2. Serve the build (any static server) and run:
//      APP_URL=http://localhost:8099 SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=... node scripts/store-screenshots.mjs
//
// The duo partner and the witness are real accounts created on that local server.
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Playwright is not a project dependency: use the one installed on the machine.
const { chromium } = createRequire(import.meta.url)('playwright');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = process.env.APP_URL ?? 'http://localhost:8099';
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_ANON_KEY;
if (!SB_URL || !SB_KEY) throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY');
const OUT = join(root, 'docs/store/screenshots');

const DEVICES = [
  // Captured at the CSS size of the device, then framed at the store size.
  { dir: 'ios-6.9', width: 440, height: 956, scale: 3, caption: 34, top: 200, fit: 0.76 },
  { dir: 'ios-ipad-13', width: 1032, height: 1376, scale: 2, caption: 52, top: 230, fit: 0.8 },
  { dir: 'android-phone', width: 360, height: 720, scale: 3, caption: 28, top: 150, fit: 0.76 },
];

const LOCALES = {
  fr: {
    locale: 'fr-CH',
    me: 'Camille',
    companions: ['Pépin', 'Brindille'],
    partner: { name: 'Léa', companion: 'Noisette' },
    witness: 'Marc',
    goal: { label: 'Un week-end à Barcelone', price: 450 },
    currency: 'CHF',
    packPrice: 9.5,
    captions: {
      home: ['Quelqu’un', 'compte sur toi.'],
      lineage: ['Il grandit à chaque', 'jour sans fumer.'],
      savings: ['Vois ce que', 'tu gagnes.'],
      duo: ['À deux,', 'on tient.'],
      craving: ['Une envie ?', 'Respire deux minutes.'],
      companions: ['Tes compagnons,', 'tes noms.'],
    },
    accept: 'Accepter',
  },
  en: {
    locale: 'en-GB',
    me: 'Jamie',
    companions: ['Pip', 'Twig'],
    partner: { name: 'Sam', companion: 'Hazel' },
    witness: 'Alex',
    goal: { label: 'A weekend in Lisbon', price: 450 },
    currency: 'EUR',
    packPrice: 8.5,
    captions: {
      home: ['Someone', 'counts on you.'],
      lineage: ['It grows with every', 'smoke-free day.'],
      savings: ['See what', 'you gain.'],
      duo: ['Together,', 'you hold on.'],
      craving: ['A craving?', 'Breathe for two minutes.'],
      companions: ['Your companions,', 'your names.'],
    },
    accept: 'Accept',
  },
};

const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return key(d);
};

/** 41 smoke-free days, today still to check in. */
function seededState(l) {
  const journal = {};
  for (let i = 41; i >= 1; i--) journal[daysAgo(i)] = 'clean';
  return {
    version: 1,
    profile: { cigsPerDay: 15, packPrice: l.packPrice, cigsPerPack: 20, currency: l.currency, reminderHour: 21, startDay: daysAgo(41) },
    companions: [
      { id: 'c1', name: l.companions[0], speciesId: 'ember', bornDay: daysAgo(41), health: 92, cleanDays: 41, status: 'alive', reviveProgress: 0 },
      { id: 'c2', name: l.companions[1], speciesId: 'moss', bornDay: daysAgo(9), health: 80, cleanDays: 9, status: 'alive', reviveProgress: 0 },
    ],
    activeId: 'c1',
    journal,
    settledThrough: daysAgo(1),
    freezes: 2,
    goal: l.goal,
    witnesses: [],
    partner: null,
    inviteCode: 'NIXO42',
    ownedSpecies: ['ember', 'moss'],
    morningMessages: true,
    displayName: l.me,
    appliedReports: [],
    events: [],
    clockOffsetMs: 0,
  };
}

async function person(name, companion, streak) {
  const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  const { data: me, error: e2 } = await sb.rpc('ensure_profile');
  if (e2) throw e2;
  const { error: e3 } = await sb
    .from('profiles')
    .update({ display_name: name, companion_name: companion, companion_species: 'ochre', companion_stage: 2, companion_health: 85, companion_status: 'alive', streak })
    .eq('id', me.id);
  if (e3) throw e3;
  return { sb, id: me.id };
}

const fonts = {
  serif: readFileSync(join(root, 'node_modules/@expo-google-fonts/newsreader/400Regular/Newsreader_400Regular.ttf')).toString('base64'),
  italic: readFileSync(join(root, 'node_modules/@expo-google-fonts/newsreader/400Regular_Italic/Newsreader_400Regular_Italic.ttf')).toString('base64'),
};
const grain = readFileSync(join(root, 'assets/grain.png')).toString('base64');

function frame(d, [line1, line2], shot) {
  const w = Math.round(d.width * d.fit);
  return `<!doctype html><html><head><style>
  @font-face { font-family: S; src: url(data:font/ttf;base64,${fonts.serif}); }
  @font-face { font-family: SI; src: url(data:font/ttf;base64,${fonts.italic}); }
  html, body { margin: 0; width: ${d.width}px; height: ${d.height}px; overflow: hidden; background: #141210; }
  .bg { position: absolute; inset: 0;
    background: radial-gradient(60% 40% at 15% 10%, rgba(184,103,63,0.35), transparent 70%),
                radial-gradient(50% 35% at 90% 85%, rgba(70,110,105,0.30), transparent 70%); }
  .grain { position: absolute; inset: 0; background: url(data:image/png;base64,${grain}); opacity: 0.35; mix-blend-mode: overlay; }
  h1 { position: absolute; left: 0; right: 0; top: ${Math.round(d.top * 0.22)}px; margin: 0; text-align: center;
       color: #EDE6DA; font: ${d.caption}px/1.12 S; letter-spacing: -0.01em; }
  h1 em { font-family: SI; font-style: normal; color: #D9B99B; }
  img { position: absolute; top: ${d.top}px; left: ${Math.round((d.width - w) / 2)}px; width: ${w}px;
        border-radius: ${Math.round(w * 0.07)}px; border: 1px solid rgba(237,230,218,0.18);
        box-shadow: 0 30px 80px rgba(0,0,0,0.55); }
  </style></head><body><div class="bg"></div><div class="grain"></div>
  <h1>${line1}<br><em>${line2}</em></h1>
  <img src="data:image/png;base64,${shot.toString('base64')}"></body></html>`;
}

const browser = await chromium.launch();
for (const [lang, l] of Object.entries(LOCALES)) {
  for (const d of DEVICES) {
    const dir = join(OUT, d.dir, lang);
    mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.scale, locale: l.locale });
    const state = JSON.stringify(seededState(l));
    await ctx.addInitScript((s) => {
      if (!localStorage.getItem('nixo.state.v1')) localStorage.setItem('nixo.state.v1', s);
    }, state);
    const page = await ctx.newPage();
    const raw = {};
    const go = async (path, wait = 1500) => {
      await page.goto(APP + path);
      await page.waitForTimeout(wait);
    };

    // Sign in, then link a real duo partner and a witness on the server.
    await go('/duo', 3000);
    const code = (await page.getByText(/^[A-Z0-9]{6}$/).first().textContent()).trim();
    const partner = await person(l.partner.name, l.partner.companion, 23);
    await partner.sb.rpc('join_duo', { code });
    const witness = await person(l.witness, l.companions[0], 0);
    await witness.sb.rpc('request_witness', { code });
    await go('/duo', 2500);
    await page.getByText(l.accept, { exact: true }).first().click();
    await page.waitForTimeout(1500);
    await partner.sb.rpc('send_cheer', { day: key(new Date()) });

    await go('/home', 2500);
    raw.home = await page.screenshot();
    await go('/lineage');
    raw.lineage = await page.screenshot();
    await go('/savings');
    raw.savings = await page.screenshot();
    await go('/duo', 2500);
    if (d.width < 600) {
      await page.mouse.move(d.width / 2, d.height / 2);
      await page.mouse.wheel(0, d.height * 0.62);
      await page.waitForTimeout(800);
    }
    raw.duo = await page.screenshot();
    await go('/craving', 3500);
    raw.craving = await page.screenshot();
    await go('/companions');
    raw.companions = await page.screenshot();
    await ctx.close();

    const fctx = await browser.newContext({ viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.scale });
    const fpage = await fctx.newPage();
    let i = 1;
    for (const [name, shot] of Object.entries(raw)) {
      await fpage.setContent(frame(d, l.captions[name], shot));
      await fpage.waitForTimeout(300);
      await fpage.screenshot({ path: join(dir, `${pad(i++)}-${name}.jpg`), type: 'jpeg', quality: 86 });
    }
    await fctx.close();
    console.log('  ok -', d.dir, lang);
  }
}
await browser.close();
