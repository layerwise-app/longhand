// Draws all of the site's artwork from code: story covers, figures, avatars, the
// share image, and favicons. Everything here is original, and the results are
// committed to `public/art`, so this only needs to run when the art changes.
//
//   pnpm art [--only name] [--exe /path/to/chrome]
//
// It renders SVG in a headless Chromium through playwright-core. Set CHROME_PATH
// or pass --exe to point at a browser. It is not part of the app or the Worker.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const argValue = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
};
const only = argValue('only');

const fontFile = (pkg, file) =>
  readFileSync(
    join(root, 'node_modules/@fontsource-variable', pkg, 'files', file)
  ).toString('base64');
const fontCss = `
@font-face{font-family:Serif;src:url(data:font/woff2;base64,${fontFile('newsreader', 'newsreader-latin-opsz-normal.woff2')});font-weight:200 800;font-style:normal}
@font-face{font-family:Serif;src:url(data:font/woff2;base64,${fontFile('newsreader', 'newsreader-latin-opsz-italic.woff2')});font-weight:200 800;font-style:italic}
@font-face{font-family:Sans;src:url(data:font/woff2;base64,${fontFile('instrument-sans', 'instrument-sans-latin-wght-normal.woff2')});font-weight:400 700}
`;

// Small, repeatable random numbers so the art is stable between runs.
function rng(seed) {
  let s = [...String(seed)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const range = (n) => Array.from({ length: n }, (_, i) => i);
const f = (n) => Number(n.toFixed(1));

/** A closed area under a wobbling line, for hills and water. */
function wave(W, H, y, amp, freq, phase, wob = 0) {
  const pts = [];
  for (let x = -20; x <= W + 20; x += 20) {
    const v =
      y +
      Math.sin(x * freq + phase) * amp +
      Math.sin(x * freq * 2.3 + phase * 1.7) * amp * wob;
    pts.push(`${x},${f(v)}`);
  }
  return `M-20,${H + 20} L${pts.join(' ')} L${W + 20},${H + 20} Z`;
}
function waveLine(W, y, amp, freq, phase, wob = 0) {
  const pts = [];
  for (let x = -20; x <= W + 20; x += 16) {
    const v =
      y +
      Math.sin(x * freq + phase) * amp +
      Math.sin(x * freq * 2.3 + phase * 1.7) * amp * wob;
    pts.push(`${x},${f(v)}`);
  }
  return `M${pts.join(' L')}`;
}

/** Wraps art in an SVG with a printed-paper grain over the top. */
function page(W, H, bg, body, { grain = 0.16 } = {}) {
  return `<!doctype html><html><head><style>${fontCss}html,body{margin:0;background:${bg}}svg{display:block}.m{mix-blend-mode:multiply}.s{mix-blend-mode:screen}text{font-family:Sans}.serif{font-family:Serif}</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1.4 -0.55"/></filter>
<filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="9"/><feDisplacementMap in="SourceGraphic" scale="9"/></filter>
<radialGradient id="glow"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".25" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="${bg}"/>
${body}
${grain ? `<rect width="${W}" height="${H}" filter="url(#grain)" opacity="${grain}" style="mix-blend-mode:overlay"/>` : ''}
</svg></body></html>`;
}

const W = 1600;
const H = 900;

const covers = {
  'the-tide-table-on-my-kitchen-wall': () => {
    const ink = ['#7fa89a', '#4f7f83', '#2f5a68', '#1f3f4d'];
    const bands = ink
      .map(
        (c, i) =>
          `<path class="m" fill="${c}" opacity=".9" d="${wave(W, H, 380 + i * 110, 70 - i * 8, 0.0052 + i * 0.0011, i * 1.4, 0.25)}"/>`
      )
      .join('');
    const marks = range(9)
      .map(
        (i) =>
          `<line x1="110" x2="${i % 3 ? 140 : 170}" y1="${130 + i * 76}" y2="${130 + i * 76}" stroke="#2f3f42" stroke-width="3"/>`
      )
      .join('');
    return page(
      W,
      H,
      '#efe9da',
      `<circle cx="1210" cy="230" r="118" fill="#d9794e" class="m"/>${bands}<line x1="110" x2="110" y1="90" y2="800" stroke="#2f3f42" stroke-width="3"/>${marks}`
    );
  },
  'every-boat-is-an-argument-with-water': () => {
    let lines = '';
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      lines += `<path fill="none" stroke="#e6efe9" stroke-width="${i % 4 ? 1.6 : 2.6}" opacity=".85" d="M140,${450} C${500},${450 - 300 * t} ${1100},${450 - 320 * t} 1470,${450 - 40 * t}"/>`;
      lines += `<path fill="none" stroke="#e6efe9" stroke-width="${i % 4 ? 1.6 : 2.6}" opacity=".85" d="M140,${450} C${500},${450 + 300 * t} ${1100},${450 + 320 * t} 1470,${450 + 40 * t}"/>`;
    }
    for (let i = 1; i < 12; i++) {
      const x = 140 + (1330 / 12) * i;
      lines += `<line x1="${x}" x2="${x}" y1="110" y2="790" stroke="#e6efe9" stroke-width="1" opacity=".35"/>`;
    }
    return page(
      W,
      H,
      '#17404a',
      `${lines}<line x1="90" x2="1520" y1="450" y2="450" stroke="#f0a36f" stroke-width="3"/>`
    );
  },
  'what-an-apprentice-learns-from-one-board': () => {
    const r = rng('board');
    let grain = '';
    for (let i = 0; i < 46; i++) {
      const y = 262 + i * 8.4 + r() * 3;
      grain += `<path fill="none" stroke="#8a5a2c" stroke-width="${0.8 + r() * 1.6}" opacity="${0.35 + r() * 0.5}" d="${waveLine(W, y, 4 + r() * 10, 0.003 + r() * 0.004, r() * 6, 0.3)}"/>`;
    }
    let curls = '';
    for (let i = 0; i < 16; i++) {
      const x = 180 + r() * 1200;
      const y = 700 + r() * 130;
      const s = 18 + r() * 34;
      curls += `<path fill="none" stroke="#c98f4f" stroke-width="${5 + r() * 5}" stroke-linecap="round" d="M${x},${y} c${s},${-s} ${s * 2},${s * 0.4} ${s * 0.6},${s * 0.8} c${-s},${s * 0.2} ${-s},${-s} ${s * 0.1},${-s * 0.7}"/>`;
    }
    return page(
      W,
      H,
      '#efe3cc',
      `<clipPath id="b"><rect x="0" y="250" width="${W}" height="400"/></clipPath><rect x="0" y="250" width="${W}" height="400" fill="#dcb27b"/><g clip-path="url(#b)">${grain}</g><rect x="0" y="650" width="${W}" height="14" fill="#a1723f"/>${curls}`
    );
  },
  'the-index-you-forgot-is-why-your-app-is-slow': () => {
    const r = rng('index');
    let cells = '';
    const cols = 40;
    const rows = 22;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const hit = y === 13;
        const scanned = y < 13;
        cells += `<rect x="${60 + x * 37}" y="${60 + y * 36}" width="${30}" height="${28}" rx="3" fill="${hit && x === 27 ? '#ff9a4a' : scanned ? '#3a4f86' : '#233056'}" opacity="${hit && x === 27 ? 1 : scanned ? 0.55 + r() * 0.45 : 0.75}"/>`;
      }
    }
    return page(W, H, '#141c36', cells);
  },
  'boring-technology-is-a-gift-to-your-future-self': () => {
    const r = rng('boring');
    let bricks = '';
    const tones = ['#c9c4b4', '#bdb8a7', '#d4cfc0', '#b1ac9c'];
    for (let y = 0; y < 12; y++) {
      const off = y % 2 ? -110 : 0;
      for (let x = 0; x < 8; x++) {
        bricks += `<rect x="${off + x * 222}" y="${16 + y * 74}" width="214" height="66" rx="2" fill="${tones[Math.floor(r() * 4)]}"/>`;
      }
    }
    return page(
      W,
      H,
      '#8f8a7b',
      `${bricks}<circle cx="1220" cy="212" r="27" fill="#2f8f63"/>`
    );
  },
  'i-read-every-postmortem-we-ever-wrote': () => {
    const r = rng('pm');
    let ticks = '';
    for (let i = 0; i < 214; i++) {
      const col = i % 27;
      const row = Math.floor(i / 27);
      const hot = (col > 9 && col < 15 && r() > 0.3) || r() > 0.92;
      ticks += `<rect x="${130 + col * 50}" y="${120 + row * 84}" width="${hot ? 34 : 12}" height="58" rx="2" fill="${hot ? '#c8402c' : '#2b2b2e'}" opacity="${hot ? 0.95 : 0.8}" transform="rotate(${f((r() - 0.5) * 7)} ${130 + col * 50} ${120 + row * 84})"/>`;
    }
    return page(W, H, '#efeadf', ticks);
  },
  'a-sourdough-starter-is-a-small-pet-with-opinions': () => {
    const r = rng('sour');
    let bubbles = '';
    for (let i = 0; i < 90; i++) {
      const y = 330 + r() * 430;
      const x = 560 + r() * 480;
      const s = 6 + r() * r() * 42;
      bubbles += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}" fill="#f8efd8" stroke="#a97c44" stroke-width="2.4"/>`;
    }
    return page(
      W,
      H,
      '#b9502f',
      `<clipPath id="j"><rect x="530" y="150" width="540" height="650" rx="60"/></clipPath>
      <rect x="530" y="150" width="540" height="650" rx="60" fill="#f4e3c1"/>
      <g clip-path="url(#j)"><path fill="#e7c88f" d="${wave(W, H, 330, 26, 0.012, 1, 0.4)}"/>${bubbles}</g>
      <rect x="530" y="150" width="540" height="650" rx="60" fill="none" stroke="#3a2415" stroke-width="7"/>
      <rect x="585" y="92" width="430" height="74" rx="14" fill="#3a2415"/>
      <rect x="610" y="470" width="80" height="6" fill="#3a2415" opacity=".55"/>`
    );
  },
  'the-case-for-pulling-your-cookies-two-minutes-early': () => {
    const r = rng('cookie');
    const spots = [
      [260, 230, 170],
      [650, 180, 150],
      [1040, 270, 180],
      [1400, 170, 130],
      [150, 650, 130],
      [510, 620, 190],
      [920, 690, 160],
      [1300, 610, 185]
    ];
    const cookies = spots
      .map(([x, y, s], i) => {
        const under = i === 5;
        let chips = '';
        for (let j = 0; j < 9; j++) {
          const a = r() * 6.28;
          const d = r() * s * 0.78;
          chips += `<ellipse cx="${f(x + Math.cos(a) * d)}" cy="${f(y + Math.sin(a) * d)}" rx="${f(12 + r() * 12)}" ry="${f(9 + r() * 8)}" fill="#3d2315" transform="rotate(${f(r() * 180)} ${f(x + Math.cos(a) * d)} ${f(y + Math.sin(a) * d)})"/>`;
        }
        return `<circle cx="${x}" cy="${y}" r="${s}" fill="${under ? '#edc77f' : '#d39a55'}" filter="url(#rough)"/><circle cx="${x}" cy="${y}" r="${s * 0.62}" fill="${under ? '#f6dfa8' : '#e0b06e'}" opacity=".85" filter="url(#rough)"/>${chips}`;
      })
      .join('');
    return page(W, H, '#b7d6cf', cookies);
  },
  'my-grandmother-never-wrote-anything-down': () => {
    const r = rng('flour');
    let dust = '';
    for (let i = 0; i < 1100; i++) {
      const a = r() * 6.28;
      const d = Math.pow(r(), 1.8) * 620;
      dust += `<circle cx="${f(800 + Math.cos(a) * d * 1.25)}" cy="${f(450 + Math.sin(a) * d * 0.72)}" r="${f(0.8 + r() * 3.4)}" fill="#f6f0e2" opacity="${f(0.35 + r() * 0.6)}"/>`;
    }
    return page(
      W,
      H,
      '#5b3a2c',
      `${dust}<ellipse cx="800" cy="450" rx="280" ry="210" fill="#f6f0e2" opacity=".96" filter="url(#rough)"/>
      <path d="M672,460 c30,-90 120,-120 190,-80 c44,26 58,88 18,128 c-34,34 -92,30 -122,6" fill="none" stroke="#b08a6b" stroke-width="5" stroke-linecap="round"/>`
    );
  },
  'how-to-see-the-andromeda-galaxy-from-a-parking-lot': () => {
    const r = rng('m31');
    let stars = '';
    for (let i = 0; i < 520; i++) {
      stars += `<circle cx="${f(r() * W)}" cy="${f(r() * 690)}" r="${f(0.6 + r() * r() * 2.6)}" fill="#fff" opacity="${f(0.3 + r() * 0.7)}"/>`;
    }
    return page(
      W,
      H,
      '#0d1230',
      `${stars}<g transform="rotate(-32 1040 300)"><ellipse cx="1040" cy="300" rx="350" ry="86" fill="url(#glow)" opacity=".85"/><ellipse cx="1040" cy="300" rx="120" ry="36" fill="url(#glow)"/></g>
      <rect y="730" width="${W}" height="170" fill="#05070f"/><rect x="330" y="400" width="10" height="340" fill="#05070f"/><rect x="285" y="392" width="100" height="12" rx="4" fill="#05070f"/><path d="M285,404 l-90,330 h290 l-100,-330 z" fill="#f4c56b" opacity=".09"/>
      <path d="M820,735 q6,-50 60,-54 l110,-2 q40,0 70,50 l60,8 q16,4 16,20 v10 h-340 z" fill="#05070f"/>
      ${range(7).map((i) => `<rect x="${120 + i * 210}" y="820" width="110" height="7" fill="#f3efe0" opacity=".28"/>`).join('')}`,
      { grain: 0.1 }
    );
  },
  'the-classroom-demo-that-failed-in-front-of-everyone': () => {
    const r = rng('demo');
    let arcs = '';
    for (let i = 0; i < 8; i++) {
      const a = 0.9 - i * 0.03;
      const len = 560;
      arcs += `<path fill="none" stroke="#e8efe6" stroke-width="2.5" opacity="${0.75 - i * 0.07}" stroke-dasharray="${8 + r() * 14} ${5 + r() * 10}" d="M${800 - Math.sin(a) * len},${110 + Math.cos(a) * len} A${len},${len} 0 0 0 ${800 + Math.sin(a - 0.3) * len},${110 + Math.cos(a - 0.3) * len}"/>`;
    }
    return page(
      W,
      H,
      '#2c4a3e',
      `<rect x="70" y="60" width="1460" height="780" fill="none" stroke="#c9a877" stroke-width="16"/>${arcs}
      <line x1="800" y1="110" x2="${800 + Math.sin(0.62) * 560}" y2="${110 + Math.cos(0.62) * 560}" stroke="#f1eee1" stroke-width="5"/>
      <circle cx="${800 + Math.sin(0.62) * 560}" cy="${110 + Math.cos(0.62) * 560}" r="62" fill="#e5674a"/>
      <rect x="640" y="94" width="320" height="16" fill="#f1eee1"/>`
    );
  },
  'the-dark-between-the-stars-is-evidence': () => {
    const r = rng('olbers');
    let rays = '';
    for (let i = 0; i < 54; i++) {
      const a = r() * 6.28;
      const d = 120 + r() * 920;
      rays += `<line x1="800" y1="450" x2="${f(800 + Math.cos(a) * d)}" y2="${f(450 + Math.sin(a) * d)}" stroke="#d9d3ff" stroke-width="1" opacity=".26"/><circle cx="${f(800 + Math.cos(a) * d)}" cy="${f(450 + Math.sin(a) * d)}" r="${f(1.6 + r() * 3.2)}" fill="#fff4d6"/>`;
    }
    return page(
      W,
      H,
      '#0b0917',
      `${rays}<circle cx="800" cy="450" r="9" fill="#e9b872"/><circle cx="800" cy="450" r="150" fill="none" stroke="#6e62c7" opacity=".4"/><circle cx="800" cy="450" r="320" fill="none" stroke="#6e62c7" opacity=".28"/><circle cx="800" cy="450" r="540" fill="none" stroke="#6e62c7" opacity=".18"/>`,
      { grain: 0.1 }
    );
  },
  'why-your-paragraphs-feel-cramped': () => {
    const r = rng('para');
    const col = (x, width, lh, n, c) =>
      range(n)
        .map(
          (i) =>
            `<rect x="${x}" y="${120 + i * lh}" width="${f(width * (i === n - 1 ? 0.5 : 0.86 + r() * 0.14))}" height="${Math.min(14, lh * 0.55)}" fill="${c}"/>`
        )
        .join('');
    return page(
      W,
      H,
      '#f3efe6',
      `${col(100, 830, 22, 30, '#2a2a2a')}<rect x="1020" y="90" width="490" height="720" fill="#2438a6"/>${col(1075, 380, 48, 14, '#f3efe6')}`
    );
  },
  'the-quiet-politics-of-the-default-font': () => {
    let cells = '';
    const faces = [
      "font-family:Sans;font-weight:500",
      "font-family:Serif;font-weight:500",
      "font-family:Georgia;font-style:italic",
      "font-family:'Courier New'",
      "font-family:Serif;font-style:italic;font-weight:300",
      "font-family:Helvetica;font-weight:700"
    ];
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 7; x++) {
        const lit = x === 4 && y === 1;
        cells += `<text x="${130 + x * 228}" y="${210 + y * 208}" font-size="150" text-anchor="middle" style="${lit ? faces[4] : faces[0]}" fill="${lit ? '#f7d348' : '#47506a'}">Aa</text>`;
      }
    }
    return page(W, H, '#191d2c', cells);
  },
  'a-love-letter-to-the-ampersand': () =>
    page(
      W,
      H,
      '#f4ddd2',
      `<text class="serif m" x="810" y="790" font-size="940" text-anchor="middle" font-style="italic" font-weight="400" fill="#d6422b">&amp;</text>
      <text class="serif m" x="780" y="760" font-size="940" text-anchor="middle" font-style="italic" font-weight="400" fill="#2d58a8" opacity=".82">&amp;</text>`
    ),
  'desire-paths-are-the-most-honest-urban-plan': () => {
    const paved = (x1, y1, x2, y2) =>
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e7e2d3" stroke-width="30"/>`;
    return page(
      W,
      H,
      '#7ea065',
      `<rect x="0" y="0" width="${W}" height="900" fill="#7ea065"/>
      ${paved(200, -20, 200, 920)}${paved(1400, -20, 1400, 920)}${paved(-20, 150, 1620, 150)}${paved(-20, 750, 1620, 750)}
      <path d="M200,750 C520,640 680,470 900,400 S1250,250 1400,150" fill="none" stroke="#b08a5a" stroke-width="30" stroke-linecap="round" filter="url(#rough)"/>
      ${[[420, 340, 58], [560, 250, 42], [1120, 600, 66], [980, 680, 46], [1250, 480, 38], [340, 520, 34]].map(([x, y, s]) => `<circle cx="${x}" cy="${y}" r="${s}" fill="#4f7450"/>`).join('')}`
    );
  },
  'the-bus-stop-bench-problem': () =>
    page(
      W,
      H,
      '#f0b65f',
      `<circle cx="1230" cy="340" r="165" fill="#e9713f"/>
      <rect y="640" width="${W}" height="260" fill="#39424f"/>
      <path d="M340,740 L1300,740 L1600,860 L560,860 Z" fill="#242b35" opacity=".65"/>
      <rect x="310" y="536" width="620" height="30" fill="#1d2430"/><rect x="310" y="580" width="620" height="24" fill="#1d2430"/>
      <rect x="350" y="600" width="24" height="140" fill="#1d2430"/><rect x="866" y="600" width="24" height="140" fill="#1d2430"/>
      <rect x="1130" y="170" width="16" height="572" fill="#1d2430"/><rect x="1060" y="120" width="156" height="116" rx="12" fill="#f5efe2"/>
      <rect x="1088" y="150" width="100" height="56" rx="6" fill="#2438a6"/>`
    ),
  'what-twelve-minutes-does-to-a-city': () => {
    const c = [800, 450];
    let ticks = '';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * 6.283 - 1.5708;
      const big = i % 5 === 0;
      ticks += `<line x1="${f(c[0] + Math.cos(a) * 340)}" y1="${f(c[1] + Math.sin(a) * 340)}" x2="${f(c[0] + Math.cos(a) * (big ? 305 : 322))}" y2="${f(c[1] + Math.sin(a) * (big ? 305 : 322))}" stroke="#f6efdd" stroke-width="${big ? 7 : 3}"/>`;
    }
    const a12 = (12 / 60) * 6.283;
    return page(
      W,
      H,
      '#c63f35',
      `<path d="M800,450 L800,110 A340,340 0 0 1 ${f(800 + Math.sin(a12) * 340)},${f(450 - Math.cos(a12) * 340)} Z" fill="#f4c54d"/>
      <circle cx="800" cy="450" r="350" fill="none" stroke="#f6efdd" stroke-width="10"/>${ticks}
      <line x1="800" y1="450" x2="800" y2="170" stroke="#f6efdd" stroke-width="12" stroke-linecap="round"/><line x1="800" y1="450" x2="${f(800 + Math.sin(a12) * 240)}" y2="${f(450 - Math.cos(a12) * 240)}" stroke="#f6efdd" stroke-width="16" stroke-linecap="round"/><circle cx="800" cy="450" r="20" fill="#f6efdd"/>
      <path d="M-20,830 H1620" stroke="#7d1f1b" stroke-width="26"/>
      ${[170, 430, 1130, 1420].map((x) => `<rect x="${x}" y="792" width="150" height="62" rx="14" fill="#f6efdd"/>`).join('')}`
    );
  },
  'the-lighthouse-keepers-invoice': () => {
    const r = rng('light');
    let stars = '';
    for (let i = 0; i < 160; i++) {
      stars += `<circle cx="${f(r() * W)}" cy="${f(r() * 560)}" r="${f(0.8 + r() * 1.6)}" fill="#f1eedd" opacity="${f(0.3 + r() * 0.6)}"/>`;
    }
    let stripes = '';
    for (let i = 0; i < 4; i++) {
      stripes += `<path d="M${540 - i * 7},${300 + i * 100} L${660 + i * 7},${300 + i * 100} L${665 + i * 7},${350 + i * 100} L${535 - i * 7},${350 + i * 100} Z" fill="#c8402c"/>`;
    }
    return page(
      W,
      H,
      '#10233c',
      `${stars}<path d="M600,250 L1620,60 L1620,430 Z" fill="#f4d06f" opacity=".85"/>
      <path d="M520,700 L560,250 L640,250 L680,700 Z" fill="#f1eedd"/>${stripes}
      <rect x="545" y="200" width="110" height="60" fill="#f4d06f"/><path d="M530,200 L600,140 L670,200 Z" fill="#c8402c"/><rect x="522" y="256" width="156" height="12" fill="#0a1626"/>
      <path d="${wave(W, H, 700, 12, 0.012, 1, 0.4)}" fill="#1d3f5e"/><path d="${wave(W, H, 780, 14, 0.009, 3, 0.4)}" fill="#0b1a2e"/>`
    );
  },
  'visiting-hours': () => {
    const left = range(5)
      .map((i) => {
        const s = 1 - i * 0.17;
        const x = 800 - 640 * s;
        const nx = 800 - 640 * (s - 0.1);
        const lit = i === 2;
        return `<path d="M${f(x)},${f(450 - 340 * s)} L${f(nx)},${f(450 - 340 * (s - 0.1))} L${f(nx)},${f(450 + 400 * (s - 0.1))} L${f(x)},${f(450 + 400 * s)} Z" fill="${lit ? '#f7d794' : '#27505a'}" stroke="#0e2b33" stroke-width="3"/>`;
      })
      .join('');
    const right = range(5)
      .map((i) => {
        const s = 1 - i * 0.17;
        const x = 800 + 640 * s;
        const nx = 800 + 640 * (s - 0.1);
        return `<path d="M${f(x)},${f(450 - 340 * s)} L${f(nx)},${f(450 - 340 * (s - 0.1))} L${f(nx)},${f(450 + 400 * (s - 0.1))} L${f(x)},${f(450 + 400 * s)} Z" fill="#27505a" stroke="#0e2b33" stroke-width="3"/>`;
      })
      .join('');
    return page(
      W,
      H,
      '#123841',
      `<path d="M0,900 L800,470 L1600,900 Z" fill="#1c4a54"/><path d="M0,0 L800,420 L1600,0 Z" fill="#0d2b33"/>${left}${right}
      <rect x="760" y="400" width="80" height="94" fill="#0a2127"/>
      <path d="M${800 - 640 * 0.56},${450 + 400 * 0.56} L${800 - 640 * 0.46},${450 + 400 * 0.46} L${800 - 180},${900} L${800 - 500},${900} Z" fill="#f7d794" opacity=".18"/>
      ${range(4).map((i) => `<rect x="${760 - i * 60}" y="${64 + i * 62 - i * i * 4}" width="${80 + i * 120}" height="${8 + i * 2}" rx="3" fill="#cfeadf" opacity=".55" transform="translate(${i * 0} 0)"/>`).join('')}`
    );
  },
  'four-in-the-morning-is-its-own-country': () => {
    const r = rng('windows');
    let windows = '';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 15; x++) {
        const lit = r() > 0.92 || (x === 9 && y === 3);
        windows += `<rect x="${110 + x * 94}" y="${60 + y * 100}" width="66" height="76" fill="${lit ? '#f4c86a' : '#1a2750'}"/>`;
      }
    }
    return page(W, H, '#0f1838', windows);
  },
  'cut-the-first-paragraph': () => {
    const r = rng('cut');
    const line = (y, w, c = '#2b2a28') =>
      `<rect x="330" y="${y}" width="${w}" height="16" fill="${c}"/>`;
    let first = '';
    for (let i = 0; i < 5; i++) first += line(170 + i * 42, 880 + r() * 60, '#9a968c');
    let rest = '';
    for (let i = 0; i < 10; i++) rest += line(430 + i * 42, i === 9 ? 500 : 880 + r() * 60);
    return page(
      W,
      H,
      '#3f5c78',
      `<rect x="240" y="80" width="1120" height="880" fill="#fbf8f0"/>${first}${rest}
      <path d="M300,262 C520,150 900,330 1310,190" fill="none" stroke="#d7392a" stroke-width="14" stroke-linecap="round" filter="url(#rough)"/>
      <path d="M300,330 L1290,144" fill="none" stroke="#d7392a" stroke-width="9" stroke-linecap="round" filter="url(#rough)"/>`
    );
  },
  'on-rereading-the-same-book-every-winter': () => {
    const r = rng('snow');
    let snow = '';
    for (let i = 0; i < 240; i++) {
      snow += `<circle cx="${f(r() * W)}" cy="${f(r() * H)}" r="${f(1.4 + r() * 4.6)}" fill="#fff" opacity="${f(0.55 + r() * 0.45)}"/>`;
    }
    const tones = ['#21344f', '#7a2e2e', '#31564a', '#c49a3e', '#21344f', '#5d4a70', '#7a2e2e'];
    const spines = tones
      .map((c, i) => {
        const width = 66 + (i * 37) % 44;
        return { c, width };
      })
      .reduce(
        (acc, { c, width }) => {
          const x = acc.x;
          acc.svg += `<rect x="${x}" y="${250 + ((x * 3) % 40)}" width="${width}" height="${540 - ((x * 3) % 40)}" fill="${c}"/><rect x="${x + 12}" y="${300 + ((x * 3) % 40)}" width="${width - 24}" height="8" fill="#f2e6c9"/>`;
          acc.x += width + 4;
          return acc;
        },
        { x: 470, svg: '' }
      ).svg;
    return page(
      W,
      H,
      '#a9c5d6',
      `<rect y="790" width="${W}" height="110" fill="#f3f1ea"/>${spines}${snow}`
    );
  },
  'how-to-give-feedback-a-writer-can-use': () => {
    const r = rng('fb');
    let lines = '';
    for (let i = 0; i < 16; i++) {
      lines += `<rect x="130" y="${90 + i * 46}" width="${780 + r() * 150}" height="14" fill="#34373d"/>`;
    }
    const scribble = (x, y, s) =>
      `<path d="M${x},${y} c${s},${-s} ${s * 2},${s} ${s * 3},0 s${s * 2},${-s} ${s * 3},0 s${s * 2},${s} ${s * 3},0" fill="none" stroke="#d7392a" stroke-width="6" stroke-linecap="round"/>`;
    return page(
      W,
      H,
      '#f6efe0',
      `${lines}<rect x="1080" y="70" width="400" height="760" fill="#fbd96a"/>
      ${scribble(1130, 170, 28)}${scribble(1130, 240, 22)}${scribble(1130, 400, 26)}${scribble(1130, 620, 28)}${scribble(1130, 690, 18)}
      <ellipse cx="520" cy="334" rx="240" ry="38" fill="none" stroke="#d7392a" stroke-width="7" filter="url(#rough)"/>
      <path d="M760,330 C900,310 1000,240 1110,172" fill="none" stroke="#d7392a" stroke-width="5"/>
      <path d="M130,570 H730" stroke="#d7392a" stroke-width="7" filter="url(#rough)"/>`
    );
  }
};

const FW = 1400;
const FH = 800;
const figText = (x, y, s, opts = '') =>
  `<text x="${x}" y="${y}" font-size="26" fill="#55524b" ${opts}>${s}</text>`;

const figures = {
  'tide-curve': () => {
    // Two unequal highs and two lows, matching the tide times in the story.
    const events = [
      [3.68, 1.1],
      [9.87, 12.6],
      [16.07, 0.8],
      [22.28, 11.1]
    ];
    const height = (hour) => {
      const all = [[-2.5, 11.4], ...events, [28.4, 1.2]];
      let i = 0;
      while (all[i + 1][0] < hour) i++;
      const [t1, h1] = all[i];
      const [t2, h2] = all[i + 1];
      const p = (hour - t1) / (t2 - t1);
      return h1 + ((h2 - h1) * (1 - Math.cos(Math.PI * p))) / 2;
    };
    const X = (h) => 120 + (h / 24) * 1200;
    const Y = (v) => 690 - (v / 14) * 580;
    const pts = range(241).map((i) => `${f(X(i / 10))},${f(Y(height(i / 10)))}`);
    let grid = '';
    for (const v of [0, 4, 8, 12]) {
      grid += `<line x1="120" x2="1320" y1="${Y(v)}" y2="${Y(v)}" stroke="#d9d4c7" stroke-width="2"/>${figText(70, Y(v) + 9, `${v} ft`, 'text-anchor="middle"')}`;
    }
    for (const h of [0, 6, 12, 18, 24]) {
      grid += figText(X(h), 740, h === 0 || h === 24 ? 'midnight' : h === 12 ? 'noon' : h === 6 ? '6 am' : '6 pm', 'text-anchor="middle"');
    }
    const labels = [
      ['low 3:41', 3.68, 1.1, 40],
      ['high 9:52', 9.87, 12.6, -24],
      ['low 4:04', 16.07, 0.8, 40],
      ['high 10:17', 22.28, 11.1, -24]
    ]
      .map(
        ([t, h, v, dy]) =>
          `<circle cx="${X(h)}" cy="${Y(v)}" r="9" fill="#1f4f63"/>${figText(X(h), Y(v) + dy, t, 'text-anchor="middle" font-weight="600" style="fill:#1f4f63"')}`
      )
      .join('');
    return page(
      FW,
      FH,
      '#faf7f0',
      `${grid}<path d="M120,690 L${pts.join(' L')} L1320,690 Z" fill="#a9c8cd" opacity=".55"/><path d="M${pts.join(' L')}" fill="none" stroke="#1f4f63" stroke-width="5"/>${labels}`,
      { grain: 0 }
    );
  },
  'hull-lines': () => {
    let lines = '';
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      lines += `<path fill="none" stroke="#2c3a40" stroke-width="2.4" d="M120,410 C450,${410 - 300 * t} 980,${410 - 320 * t} 1280,${410 - 56 * t}"/>`;
    }
    for (let i = 1; i < 11; i++) {
      const x = 120 + i * 116;
      lines += `<line x1="${x}" x2="${x}" y1="80" y2="720" stroke="#9fb1b4" stroke-width="1.4" stroke-dasharray="6 7"/>${figText(x, 760, i, 'text-anchor="middle"')}`;
    }
    // Sheer and rocker below the centerline.
    lines += `<path fill="none" stroke="#b5482a" stroke-width="4" d="M120,520 C520,580 980,570 1280,500"/><path fill="none" stroke="#b5482a" stroke-width="4" d="M120,540 C420,700 980,700 1280,540"/>`;
    return page(
      FW,
      FH,
      '#f6f3ea',
      `<line x1="90" x2="1310" y1="410" y2="410" stroke="#2c3a40" stroke-width="2"/>${lines}${figText(1190, 450, 'half-breadth', 'text-anchor="middle" font-style="italic"')}${figText(1190, 492, 'sheer', 'text-anchor="middle" style="fill:#b5482a"')}${figText(700, 700, 'rocker', 'text-anchor="middle" style="fill:#b5482a"')}`,
      { grain: 0 }
    );
  },
  'incident-chart': () => {
    const counts = [2, 1, 1, 0, 2, 1, 3, 4, 6, 9, 21, 28, 17, 9, 12, 26, 31, 18, 8, 5, 3, 3, 2, 2];
    const X = (h) => 110 + h * 50;
    const Y = (v) => 690 - v * 18;
    const bars = counts
      .map(
        (v, h) =>
          `<rect x="${X(h)}" y="${Y(v)}" width="40" height="${v * 18}" fill="${[10, 11, 15, 16].includes(h) ? '#c8402c' : '#3b3f46'}"/>`
      )
      .join('');
    return page(
      FW,
      FH,
      '#faf7f0',
      `${bars}<line x1="100" x2="1320" y1="690" y2="690" stroke="#3b3f46" stroke-width="2"/>
      ${[0, 6, 12, 18, 23].map((h) => figText(X(h) + 20, 734, h === 0 ? '12a' : h === 12 ? '12p' : h === 6 ? '6a' : h === 18 ? '6p' : '11p', 'text-anchor="middle"')).join('')}
      ${figText(X(10) + 44, Y(28) - 22, 'after the 10 a.m. deploy', 'text-anchor="middle" style="fill:#c8402c" font-weight="600"')}
      ${figText(X(15) + 150, Y(31) - 22, 'after the 3 p.m. deploy', 'text-anchor="middle" style="fill:#c8402c" font-weight="600"')}`,
      { grain: 0 }
    );
  },
  crumb: () => {
    const r = rng('crumb');
    let holes = '';
    const placed = [];
    for (let i = 0; i < 1600 && placed.length < 190; i++) {
      const a = r() * 6.283;
      const d = Math.sqrt(r());
      const x = 700 + Math.cos(a) * d * 540;
      const y = 400 + Math.sin(a) * d * (Math.sin(a) < 0 ? 240 : 190);
      const s = 5 + r() * r() * r() * 66;
      if (placed.some(([px, py, ps]) => Math.hypot(px - x, py - y) < ps + s + 3)) continue;
      placed.push([x, y, s]);
      holes += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s)}" ry="${f(s * (0.68 + r() * 0.3))}" fill="#a9743a" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})"/>`;
    }
    return page(
      FW,
      FH,
      '#faf6ec',
      `<path d="M90,520 C60,250 300,90 700,90 C1100,90 1340,250 1310,520 C1300,640 1180,690 1040,690 L360,690 C220,690 100,640 90,520 Z" fill="#6f3f1c" filter="url(#rough)"/><path d="M122,515 C96,270 320,122 700,122 C1080,122 1304,270 1278,515 C1268,620 1160,660 1040,660 L360,660 C240,660 132,620 122,515 Z" fill="#f1dcae" filter="url(#rough)"/>${holes}`,
      { grain: 0.12 }
    );
  },
  'star-hop': () => {
    const r = rng('chart');
    let field = '';
    for (let i = 0; i < 130; i++) {
      field += `<circle cx="${f(r() * FW)}" cy="${f(r() * FH)}" r="${f(0.8 + r() * 1.4)}" fill="#cfd6ff" opacity="${f(0.25 + r() * 0.45)}"/>`;
    }
    const star = (x, y, s, name, dx = 16, dy = 8) =>
      `<circle cx="${x}" cy="${y}" r="${s}" fill="#fff"/>${name ? `<text x="${x + dx}" y="${y + dy}" font-size="26" fill="#dfe3ff">${name}</text>` : ''}`;
    const square = [
      [190, 560],
      [470, 610],
      [520, 340],
      [240, 300]
    ];
    return page(
      FW,
      FH,
      '#10142e',
      `${field}<path d="M${square.map((p) => p.join(',')).join(' L')} Z" fill="none" stroke="#7d88d8" stroke-width="2"/>
      <path d="M520,340 L690,300 L850,270 M850,270 L905,220 L940,160" fill="none" stroke="#f4c56b" stroke-width="3" stroke-dasharray="10 9"/>
      ${star(190, 560, 6)}${star(470, 610, 6)}${star(240, 300, 6)}${star(520, 340, 8, 'Alpheratz', -30, -18)}${star(690, 300, 6, 'Delta And', -20, 40)}${star(850, 270, 8, 'Mirach', 10, 40)}${star(905, 220, 5, 'Mu', 16, 18)}${star(940, 160, 5, 'Nu', 18, 8)}
      <text x="355" y="470" font-size="26" fill="#a9b2ee" text-anchor="middle">Great Square</text><text x="355" y="504" font-size="26" fill="#a9b2ee" text-anchor="middle">of Pegasus</text>
      <g transform="rotate(-38 1010 110)"><ellipse cx="1010" cy="110" rx="120" ry="30" fill="url(#glow)" opacity=".9"/></g>
      <text x="1090" y="170" font-size="28" font-weight="600" fill="#f4c56b">Andromeda</text>`,
      { grain: 0 }
    );
  },
  ampersands: () => {
    const faces = [
      ['Serif', 'normal', 400],
      ['Serif', 'italic', 400],
      ['Georgia', 'italic', 400],
      ['Baskerville', 'italic', 400],
      ['Didot', 'normal', 400],
      ['Helvetica', 'normal', 700],
      ['Courier New', 'normal', 400],
      ['Zapfino', 'normal', 400]
    ];
    const cells = faces
      .map(([face, style, weight], i) => {
        const x = 200 + (i % 4) * 335;
        const y = i < 4 ? 320 : 690;
        const size = face === 'Zapfino' ? 170 : 300;
        return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="${i % 3 === 0 ? '#c8402c' : '#22242b'}" style="font-family:'${face}';font-style:${style};font-weight:${weight}">&amp;</text>`;
      })
      .join('');
    return page(FW, FH, '#faf7f0', cells, { grain: 0 });
  },
  'desire-path': () => {
    const paved = (x1, y1, x2, y2) =>
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e9e5d8" stroke-width="26"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#c0bba9" stroke-width="30" opacity=".5"/>`;
    return page(
      FW,
      FH,
      '#faf7f0',
      `<rect x="80" y="60" width="1240" height="660" rx="6" fill="#a3bd8a"/>
      ${paved(180, 60, 180, 720)}${paved(1220, 60, 1220, 720)}${paved(80, 160, 1320, 160)}${paved(80, 620, 1320, 620)}
      <path d="M180,620 C460,520 620,420 790,350 S1090,230 1220,160" fill="none" stroke="#a5784a" stroke-width="20" stroke-dasharray="26 10" stroke-linecap="round" filter="url(#rough)"/>
      ${[[420, 280, 44], [560, 220, 32], [960, 500, 50], [820, 560, 36], [1080, 410, 28]].map(([x, y, s]) => `<circle cx="${x}" cy="${y}" r="${s}" fill="#5d8359"/>`).join('')}
      <text x="700" y="770" font-size="26" fill="#55524b" text-anchor="middle">Pavement as drawn, and the route people chose</text>
      <text x="880" y="250" font-size="26" fill="#5c3f1f" font-weight="600" text-anchor="end">the worn diagonal</text>
      <text x="640" y="670" font-size="24" fill="#3f4a35">paved path</text>`,
      { grain: 0 }
    );
  }
};

// Paper-cut portraits for the fictional authors.
const avatarSpecs = {
  wren: { bg: '#b9d0c9', skin: '#e6b48d', hair: '#7a5a3a', top: '#2f5a68', style: 'short', extra: 'beard' },
  tomasz: { bg: '#dcd4c1', skin: '#f0c9a4', hair: '#c8c5be', top: '#3a4f86', style: 'bald', extra: 'glasses' },
  imani: { bg: '#f0b65f', skin: '#7a4a2e', hair: '#23150d', top: '#c8402c', style: 'afro' },
  dov: { bg: '#232a55', skin: '#eac2a0', hair: '#3a2a20', top: '#e5674a', style: 'curly', extra: 'glasses' },
  saffron: { bg: '#f4ddd2', skin: '#f2cfb1', hair: '#b4432a', top: '#22242b', style: 'bob' },
  juniper: { bg: '#a9c98f', skin: '#5e3a24', hair: '#17100b', top: '#f4c54d', style: 'bun' },
  hollis: { bg: '#123841', skin: '#d9a884', hair: '#141414', top: '#8dc7bb', style: 'short' },
  ottoline: { bg: '#e8e2f2', skin: '#efd2bb', hair: '#ece9e2', top: '#5d4a70', style: 'long', extra: 'glasses' }
};

function avatar({ bg, skin, hair, top, style, extra }) {
  const hairShapes = {
    short: `<path d="M146,226 C128,84 384,84 366,226 C352,176 304,158 256,158 C208,158 160,176 146,226 Z" fill="${hair}"/>`,
    bald: `<path d="M150,214 C148,190 156,176 164,170 L168,226 Z M362,214 C364,190 356,176 348,170 L344,226 Z" fill="${hair}"/>`,
    afro: `<circle cx="256" cy="176" r="136" fill="${hair}"/>`,
    curly: `${range(11)
      .map((i) => {
        const a = Math.PI + (i / 10) * Math.PI;
        return `<circle cx="${f(256 + Math.cos(a) * 108)}" cy="${f(196 + Math.sin(a) * 92)}" r="40" fill="${hair}"/>`;
      })
      .join('')}`,
    bob: `<path d="M136,330 C110,120 180,70 256,70 C332,70 402,120 376,330 L330,330 L330,190 L182,190 L182,330 Z" fill="${hair}"/>`,
    bun: `<circle cx="256" cy="64" r="48" fill="${hair}"/><path d="M152,200 C150,100 362,100 360,200 C330,150 182,150 152,200 Z" fill="${hair}"/>`,
    long: `<path d="M130,430 C100,130 180,70 256,70 C332,70 412,130 382,430 L330,430 L330,190 L182,190 L182,430 Z" fill="${hair}"/>`
  };
  const back = ['afro', 'bob', 'long'].includes(style) ? hairShapes[style] : '';
  const front = ['afro', 'bob', 'long'].includes(style) ? '' : hairShapes[style];
  const extras = {
    beard: `<path d="M152,246 C150,384 362,384 360,246 C342,292 300,282 256,282 C212,282 170,292 152,246 Z" fill="${hair}"/>`,
    glasses: `<circle cx="212" cy="232" r="30" fill="none" stroke="#1d1c1a" stroke-width="8"/><circle cx="300" cy="232" r="30" fill="none" stroke="#1d1c1a" stroke-width="8"/><line x1="242" x2="270" y1="232" y2="232" stroke="#1d1c1a" stroke-width="8"/>`
  };
  return page(
    512,
    512,
    bg,
    `${back}<rect x="214" y="310" width="84" height="90" fill="${skin}"/><path d="M60,540 C70,410 160,372 256,372 C352,372 442,410 452,540 Z" fill="${top}"/><ellipse cx="256" cy="226" rx="104" ry="124" fill="${skin}"/>${front}${extra ? extras[extra] : ''}`,
    { grain: 0.1 }
  );
}

const LOGO_STROKE =
  'M15 66 C30 66 44 53 49 37 C53 24 51 12 42 12 C33 12 28 27 28 44 C28 59 30 76 34 88 C37 76 44 63 53 63 C59 63 59 71 58 78 C57 85 62 87 69 83 C75 79 81 73 86 66';

function logoIcon(size, bg, ink) {
  return `<!doctype html><html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${bg}"/><path d="${LOGO_STROKE}" fill="none" stroke="${ink}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/></svg></body></html>`;
}

function shareImage() {
  return page(
    1200,
    630,
    '#fbfaf7',
    `<path d="M-40,520 C180,500 330,420 400,310 C450,220 440,120 370,120 C300,120 262,240 262,360 C262,470 280,600 310,690 C330,600 390,500 460,500 C510,500 510,560 500,620 C490,670 560,690 620,650 C760,560 980,500 1260,520" fill="none" stroke="#2438a6" stroke-width="30" stroke-linecap="round" opacity=".14"/>
    <text class="serif" x="90" y="280" font-size="124" font-weight="500" fill="#1d1c1a">Longhand</text>
    <text class="serif" x="94" y="360" font-size="48" font-style="italic" fill="#68655e">Good writing takes its time.</text>`,
    { grain: 0 }
  );
}

async function run() {
  const defaultExe = join(
    homedir(),
    'Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell'
  );
  const exe =
    argValue('exe') ||
    process.env.CHROME_PATH ||
    (existsSync(defaultExe) ? defaultExe : undefined);
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const tab = await context.newPage();

  const shot = async (html, width, height, options = {}) => {
    await tab.setViewportSize({ width, height });
    await tab.setContent(html, { waitUntil: 'load' });
    await tab.evaluate(() => document.fonts.ready);
    return tab.screenshot({ clip: { x: 0, y: 0, width, height }, ...options });
  };

  // Re-encodes through a canvas so the site can serve smaller WebP files.
  const toWebp = async (png, width, height, quality) => {
    const url = await tab.evaluate(
      async ({ data, width, height, quality }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL('image/webp', quality);
      },
      { data: Buffer.from(png).toString('base64'), width, height, quality }
    );
    return Buffer.from(url.split(',')[1], 'base64');
  };

  const out = (...parts) => {
    const file = join(root, 'public', ...parts);
    mkdirSync(dirname(file), { recursive: true });
    return file;
  };
  const wanted = (name) => !only || only === name;

  for (const [name, draw] of Object.entries(covers)) {
    if (!wanted(name)) continue;
    const html = draw();
    writeFileSync(
      out('art/covers', `${name}.jpg`),
      await shot(html, W, H, { type: 'jpeg', quality: 82 })
    );
    const png = await shot(html, W, H, { type: 'png' });
    writeFileSync(
      out('art/covers', `${name}-sm.webp`),
      await toWebp(png, 640, 360, 0.78)
    );
    console.log('cover', name);
  }
  for (const [name, draw] of Object.entries(figures)) {
    if (!wanted(name)) continue;
    const png = await shot(draw(), FW, FH, { type: 'png' });
    writeFileSync(
      out('art/figures', `${name}.webp`),
      await toWebp(png, FW, FH, 0.86)
    );
    console.log('figure', name);
  }
  for (const [name, spec] of Object.entries(avatarSpecs)) {
    if (!wanted(name)) continue;
    const png = await shot(avatar(spec), 512, 512, { type: 'png' });
    writeFileSync(out('art/avatars', `${name}.webp`), await toWebp(png, 240, 240, 0.86));
    console.log('avatar', name);
  }
  if (wanted('brand')) {
    writeFileSync(
      out('og-image.jpg'),
      await shot(shareImage(), 1200, 630, { type: 'jpeg', quality: 88 })
    );
    const icons = {
      'favicon-16x16.png': 16,
      'favicon-32x32.png': 32,
      'favicon.png': 96,
      'apple-touch-icon.png': 180,
      'android-chrome-192x192.png': 192,
      'android-chrome-512x512.png': 512
    };
    for (const [file, size] of Object.entries(icons)) {
      writeFileSync(
        out(file),
        await shot(logoIcon(size, '#2438a6', '#fbfaf7'), size, size, {
          type: 'png',
          omitBackground: true
        })
      );
    }
    // A .ico is a small header wrapped around PNG data.
    const png32 = await shot(logoIcon(32, '#2438a6', '#fbfaf7'), 32, 32, {
      type: 'png',
      omitBackground: true
    });
    const header = Buffer.alloc(22);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    header.writeUInt8(32, 6);
    header.writeUInt8(32, 7);
    header.writeUInt16LE(1, 10);
    header.writeUInt16LE(32, 12);
    header.writeUInt32LE(png32.length, 14);
    header.writeUInt32LE(22, 18);
    writeFileSync(out('favicon.ico'), Buffer.concat([header, png32]));
    console.log('brand assets');
  }
  await browser.close();
}

await run();
