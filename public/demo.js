// DEMO simulated GNSS receivers - NOT real devices. Fixed position: McCormick
// Hospital, Chiang Mai. Same SerialPort-shaped fake as the hyperterminal tool.

export const MCCORMICK = { lat: 18.7961, lon: 99.0080, altM: 310.0 };

export function nmeaChecksum(body) {
  let x = 0;
  for (const ch of body) x ^= ch.charCodeAt(0);
  return x.toString(16).toUpperCase().padStart(2, '0');
}
export function nmeaWrap(body) { return `$${body}*${nmeaChecksum(body)}\r\n`; }

export function degToNmea(deg, isLon) {
  const hemi = isLon ? (deg < 0 ? 'W' : 'E') : (deg < 0 ? 'S' : 'N');
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  return { dm: `${String(d).padStart(isLon ? 3 : 2, '0')}${((abs - d) * 60).toFixed(4).padStart(7, '0')}`, hemi };
}

function t2(n) { return String(n).padStart(2, '0'); }

export function nmeaBurst(talker, now, pos = MCCORMICK) {
  const lat = degToNmea(pos.lat, false);
  const lon = degToNmea(pos.lon, true);
  const t = `${t2(now.getUTCHours())}${t2(now.getUTCMinutes())}${t2(now.getUTCSeconds())}.00`;
  const d = `${t2(now.getUTCDate())}${t2(now.getUTCMonth() + 1)}${t2(now.getUTCFullYear() % 100)}`;
  const out = [
    nmeaWrap(`${talker}GGA,${t},${lat.dm},${lat.hemi},${lon.dm},${lon.hemi},1,10,0.9,${pos.altM.toFixed(1)},M,-28.0,M,,`),
    nmeaWrap(`${talker}GSA,A,3,01,03,06,09,17,19,22,28,,,,,1.5,0.9,1.2`),
  ];
  if (talker === 'GN') {
    out.push(nmeaWrap('GPGSV,1,1,04,01,68,042,45,03,44,104,42,06,31,201,38,09,22,318,35'));
    out.push(nmeaWrap('GLGSV,1,1,04,65,55,088,41,66,40,175,39,72,28,254,36,73,15,332,30'));
  } else {
    out.push(nmeaWrap(`${talker}GSV,1,1,04,01,68,042,45,03,44,104,42,06,31,201,38,09,22,318,35`));
  }
  out.push(nmeaWrap(`${talker}RMC,${t},A,${lat.dm},${lat.hemi},${lon.dm},${lon.hemi},0.00,0.00,${d},,,A`));
  return out.join('');
}

export const DEMO_DEVICES = {
  'demo-ublox': { label: 'DEMO: simulated u-blox-like GNSS', talker: 'GN' },
  'demo-mtk': { label: 'DEMO: simulated MTK-like GNSS', talker: 'GP' },
};

export class DemoPort {
  constructor(kind, tickMsOverride) {
    const dev = DEMO_DEVICES[kind];
    if (!dev) throw new Error(`unknown demo device: ${kind}`);
    this.isDemo = true;
    this.label = dev.label;
    const enc = new TextEncoder();
    let ctrl = null, timer = 0;
    const enqueue = (text) => { try { ctrl.enqueue(enc.encode(text)); } catch {} };
    this.readable = new ReadableStream({
      start(c) { ctrl = c; },
      cancel() { clearInterval(timer); },
    });
    this.writable = new WritableStream({ write() {} });
    this.open = async () => {
      const tick = () => enqueue(nmeaBurst(dev.talker, new Date()));
      tick();
      timer = setInterval(tick, tickMsOverride ?? 1000);
    };
    this.close = async () => { clearInterval(timer); try { ctrl.close(); } catch {} };
  }
}
