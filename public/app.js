import init, { GnssParser } from './gnss_wasm.js';
import {
  skyplotXY, gnssColor, GNSS_COLORS, snrPercent, sortSats,
  displayFields, makeConsole, consoleLine,
} from './logic.js';
import { DemoPort } from './demo.js';

const $ = (id) => document.getElementById(id);
const supported = 'serial' in navigator;
if (!supported) $('unsupported').hidden = false;

await init({ module_or_path: new URL('./gnss_wasm_bg.wasm', import.meta.url) });
const parser = new GnssParser();

const VER = window.GNSS_VERSION || 'dev';
$('titleText').textContent = `🛰 ClearEvo.com GNSS Monitor [${VER}]`;
document.title = `GNSS Monitor online ${VER} - live GPS / NMEA / u-blox UBX viewer in your browser`;

// ---------- connection ----------
let port = null, reader = null, connected = false;
const con = makeConsole(400);

async function connectPort(p) {
  port = p;
  connected = true;
  $('btnDisconnect').disabled = false;
  $('sbConn').textContent = port.isDemo ? `Connected (DEMO SIMULATED - ${port.label})` : 'Connected';
  $('sbConn').classList.toggle('demo', !!port.isDemo);
  readLoop();
}

async function readLoop() {
  try {
    reader = port.readable.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const objs = JSON.parse(parser.feed(value));
      for (const o of objs) con.push(consoleLine(o));
      if (objs.length) render();
    }
  } catch (e) {
    if (connected) { con.push(`[read error: ${e.message}]`); renderConsole(); }
  } finally {
    try { reader && reader.releaseLock(); } catch {}
    reader = null;
    if (connected) disconnect();
  }
}

async function disconnect() {
  if (!connected) return;
  connected = false;
  try { reader && await reader.cancel(); } catch {}
  try { port && await port.close(); } catch {}
  port = null;
  $('btnDisconnect').disabled = true;
  $('sbConn').textContent = 'Disconnected';
  $('sbConn').classList.remove('demo');
}

// serialize connect flows: overlapping disconnect/open (e.g. double-tap on
// Demo) orphans a port whose read loop keeps filling the console forever
let busy = false;
async function guarded(fn) {
  if (busy) return;
  busy = true;
  try { await fn(); } finally { busy = false; }
}

$('btnConnect').onclick = () => guarded(async () => {
  if (!supported) { alert('Web Serial is not available in this browser - use Chrome or Edge on desktop, or try the DEMO.'); return; }
  await disconnect();
  try {
    const p = await navigator.serial.requestPort();
    await p.open({ baudRate: +$('selBaud').value });
    parser.reset();
    connectPort(p);
  } catch (e) { if (e.name !== 'NotFoundError') { con.push(`[${e.message}]`); renderConsole(); } }
});

$('btnDisconnect').onclick = disconnect;

$('btnDemo').onclick = () => guarded(async () => {
  await disconnect();
  const p = new DemoPort($('selDemo').value);
  await p.open();
  parser.reset();
  con.push(`[DEMO MODE - ${p.label} - simulated device, NOT real hardware; fixed position: McCormick Hospital, Chiang Mai]`);
  connectPort(p);
});

$('btnOpenLog').onclick = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = () => guarded(async () => {
    const f = input.files[0];
    if (!f) return;
    if (f.size > 256 * 1048576) { con.push(`[log is ${(f.size / 1048576).toFixed(0)} MB - replay is limited to 256 MB]`); renderConsole(); return; }
    await disconnect();
    parser.reset();
    const bytes = new Uint8Array(await f.arrayBuffer());
    // feed in chunks so streaming parse paths behave like live input
    for (let i = 0; i < bytes.length; i += 4096) {
      const objs = JSON.parse(parser.feed(bytes.subarray(i, i + 4096)));
      for (const o of objs) con.push(consoleLine(o));
    }
    con.push(`[log replayed: ${f.name}, ${bytes.length} bytes]`);
    render();
  });
  input.click();
};

$('btnClear').onclick = () => { parser.reset(); con.clear(); render(); };

let osmUrl = '';
$('mapLink').onclick = (e) => { e.preventDefault(); if (osmUrl) window.open(osmUrl, '_blank', 'noopener'); };

// ---------- rendering ----------
const SKY_R = 100;

function renderSky(sats) {
  const svg = $('sky');
  const parts = [];
  for (const elev of [0, 30, 60]) {
    parts.push(`<circle cx="0" cy="0" r="${SKY_R * (90 - elev) / 90}" fill="${elev === 0 ? '#fdfdfd' : 'none'}" stroke="#bbb"/>`);
  }
  parts.push(`<line x1="-${SKY_R}" y1="0" x2="${SKY_R}" y2="0" stroke="#ddd"/>`);
  parts.push(`<line x1="0" y1="-${SKY_R}" x2="0" y2="${SKY_R}" stroke="#ddd"/>`);
  for (const [t, x, y] of [['N', 0, -SKY_R - 4], ['S', 0, SKY_R + 9], ['E', SKY_R + 6, 3], ['W', -SKY_R - 6, 3]]) {
    parts.push(`<text x="${x}" y="${y}" text-anchor="middle" font-size="9" fill="#666">${t}</text>`);
  }
  for (const s of sats) {
    if (s.az == null || s.elev == null) continue;
    const { x, y } = skyplotXY(s.az, s.elev, SKY_R);
    const c = gnssColor(s.gnss);
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${s.used ? c : 'none'}" stroke="${c}" stroke-width="1.5"/>`);
    parts.push(`<text x="${x.toFixed(1)}" y="${(y + 2.5).toFixed(1)}" text-anchor="middle" font-size="6.5" fill="${s.used ? '#fff' : c}">${s.prn}</text>`);
  }
  svg.innerHTML = parts.join('');
}

function renderBars(sats) {
  $('bars').innerHTML = sats.map((s) => {
    const c = gnssColor(s.gnss);
    return `<div class="bar" title="${s.gnss} ${s.prn} snr=${s.snr ?? '-'} ${s.used ? '(used in fix)' : ''}">
      <span class="snr">${s.snr ?? ''}</span>
      <div class="fill ${s.used ? '' : 'unused'}" style="height:${snrPercent(s.snr)}%;background:${c}"></div>
      <span class="lbl">${s.prn}</span></div>`;
  }).join('');
}

function renderConsole() {
  const el = $('console');
  el.textContent = con.text();
  el.scrollTop = el.scrollHeight;
}

function render() {
  const p = JSON.parse(parser.params());
  const f = displayFields(p);
  for (const [id, v] of [['fLat', f.lat], ['fLon', f.lon], ['fAlt', f.alt], ['fEll', f.ell],
    ['fGeoid', f.geoid], ['fFix', f.fix], ['fQuality', f.quality], ['fUsed', f.used],
    ['fHdop', f.hdop], ['fVdop', f.vdop], ['fPdop', f.pdop], ['fSpeed', f.speed],
    ['fCourse', f.course], ['fTime', f.time]]) {
    $(id).textContent = v;
  }
  const hasFix = f.lat !== '-' && f.lon !== '-';
  $('mapLink').hidden = !hasFix;
  // coords never go in the href: GA4 enhanced measurement records outbound
  // link_url on click, which would leak the position to analytics
  if (hasFix) osmUrl = `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=16/${p.lat}/${p.lon}`;

  const sats = sortSats(p.sats || []);
  renderSky(sats);
  renderBars(sats);
  renderConsole();
  $('sbSats').textContent = `${sats.length} sats in view, ${p.n_sats_used ?? 0} used`;
  $('sbFix').textContent = String(f.fix);
}

// legend
$('skyLegend').innerHTML = Object.entries(GNSS_COLORS)
  .map(([g, c]) => `<span><i style="background:${c}"></i>${g}</span>`).join('');
render();
