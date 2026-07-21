// Pure UI logic - no DOM, unit-tested in test/logic.test.js

// az/elev (degrees) -> x,y on a sky plot of given radius. 0=N up, clockwise, horizon=edge.
export function skyplotXY(azDeg, elevDeg, radius) {
  const r = radius * (90 - Math.max(0, Math.min(90, elevDeg))) / 90;
  const az = (azDeg * Math.PI) / 180;
  return { x: r * Math.sin(az), y: -r * Math.cos(az) };
}

export const GNSS_COLORS = {
  Gps: '#1565c0', Glonass: '#c62828', Galileo: '#2e7d32', Beidou: '#e65100',
  Qzss: '#6a1b9a', Sbas: '#00838f',
};
export function gnssColor(gnss) { return GNSS_COLORS[gnss] || '#616161'; }

// SNR dB-Hz -> 0..100% bar height (55+ treated as full)
export function snrPercent(snr) {
  if (snr == null || isNaN(snr)) return 0;
  return Math.max(0, Math.min(100, Math.round((snr / 55) * 100)));
}

export function sortSats(sats) {
  return [...sats].sort((a, b) =>
    (a.gnss || '').localeCompare(b.gnss || '') || (a.prn || 0) - (b.prn || 0));
}

export function fmtNum(v, digits) {
  if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) return '-';
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toFixed(digits);
}

export function fmtLatLon(v) { return fmtNum(v, 6); }

export function fmtTs(ms) {
  if (!ms || ms < 0) return '-';
  return new Date(Number(ms)).toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');
}

// pull display fields out of the parser params map (TALKER_NONE keys are plain,
// talker-specific ones fall back to the ANY_ variant)
export function displayFields(p) {
  const any = (k) => p[k] ?? p['ANY_' + k];
  return {
    lat: fmtLatLon(p.lat), lon: fmtLatLon(p.lon),
    alt: fmtNum(p.alt, 1), ell: fmtNum(p.ellipsoidal_height, 1),
    geoid: fmtNum(p.geoidal_height, 1),
    fix: any('fix_type') ?? '-', quality: any('fix_quality') ?? '-',
    used: p.n_sats_used ?? '-',
    hdop: fmtNum(p.hdop, 2), vdop: fmtNum(p.vdop, 2), pdop: fmtNum(p.pdop, 2),
    speed: fmtNum(p.speed_over_ground, 2), course: fmtNum(p.true_course, 1),
    time: fmtTs(any('rmc_ts')),
  };
}

// bounded console line buffer
export function makeConsole(max = 500) {
  const lines = [];
  return {
    push(line) { lines.push(line); if (lines.length > max) lines.splice(0, lines.length - max); },
    text() { return lines.join('\n'); },
    clear() { lines.length = 0; },
  };
}

// summarize one parsed object from GnssParser.feed() for the console
export function consoleLine(obj) {
  if (obj.nmea) return obj.nmea.trim();
  if (obj.ubx_type || obj.ubx) return `[UBX ${obj.ubx_type ?? ''}]`.replace(' ]', ']');
  if (obj.name) return `[${obj.name}]`;
  return JSON.stringify(obj);
}
