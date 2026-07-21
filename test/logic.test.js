import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  skyplotXY, snrPercent, sortSats, displayFields, makeConsole, consoleLine, gnssColor,
} from '../public/logic.js';
import { nmeaChecksum, nmeaBurst, degToNmea, MCCORMICK, DemoPort } from '../public/demo.js';

test('skyplotXY: zenith center, horizon edge, compass directions', () => {
  const z = skyplotXY(123, 90, 100);
  assert.ok(Math.abs(z.x) < 1e-9 && Math.abs(z.y) < 1e-9);
  const n = skyplotXY(0, 0, 100);
  assert.ok(Math.abs(n.x) < 1e-9 && Math.abs(n.y + 100) < 1e-9); // N = up
  const e = skyplotXY(90, 0, 100);
  assert.ok(Math.abs(e.x - 100) < 1e-9 && Math.abs(e.y) < 1e-9); // E = right
  const half = skyplotXY(180, 45, 100);
  assert.ok(Math.abs(half.y - 50) < 1e-9); // 45 elev = half radius, S = down
});

test('snrPercent clamps and scales', () => {
  assert.equal(snrPercent(null), 0);
  assert.equal(snrPercent(55), 100);
  assert.equal(snrPercent(99), 100);
  assert.ok(snrPercent(27.5) === 50);
});

test('sortSats: by constellation then prn', () => {
  const sorted = sortSats([
    { gnss: 'Glonass', prn: 70 }, { gnss: 'Gps', prn: 9 }, { gnss: 'Gps', prn: 2 },
  ]);
  assert.deepEqual(sorted.map((s) => s.prn), [70, 2, 9]);
});

test('displayFields formats and falls back to ANY_ keys', () => {
  const f = displayFields({
    lat: 18.7961, lon: 99.008, alt: 310, hdop: 0.9,
    ANY_fix_type: 'Gps', ANY_rmc_ts: 1784606400000, n_sats_used: 8,
  });
  assert.equal(f.lat, '18.796100');
  assert.equal(f.alt, '310.0');
  assert.equal(f.fix, 'Gps');
  assert.equal(f.used, 8);
  assert.match(f.time, /UTC$/);
  assert.equal(f.vdop, '-');
});

test('consoleLine picks nmea, ubx, name, fallback', () => {
  assert.equal(consoleLine({ nmea: '$GPGGA,x\r\n' }), '$GPGGA,x');
  assert.equal(consoleLine({ ubx: true, ubx_type: 'NAV-PVT' }), '[UBX NAV-PVT]');
  assert.equal(consoleLine({ name: 'QSTARZ' }), '[QSTARZ]');
});

test('makeConsole caps lines', () => {
  const c = makeConsole(3);
  for (let i = 0; i < 10; i++) c.push('l' + i);
  assert.equal(c.text(), 'l7\nl8\nl9');
});

test('gnssColor known and fallback', () => {
  assert.notEqual(gnssColor('Gps'), gnssColor('Glonass'));
  assert.equal(gnssColor('Whatever'), '#616161');
});

test('demo burst: checksums valid, McCormick position', () => {
  const burst = nmeaBurst('GN', new Date('2026-07-21T03:00:00Z'));
  for (const line of burst.trimEnd().split('\r\n')) {
    const [body, cs] = line.slice(1).split('*');
    assert.equal(nmeaChecksum(body), cs, `bad checksum: ${line}`);
  }
  assert.match(burst, /1847\.7660,N,09900\.4800,E/);
  assert.deepEqual(degToNmea(MCCORMICK.lon, true), { dm: '09900.4800', hemi: 'E' });
});

test('DemoPort streams a burst', async () => {
  const p = new DemoPort('demo-ublox', 999999);
  await p.open();
  const reader = p.readable.getReader();
  const dec = new TextDecoder();
  let acc = '';
  while (!acc.includes('$GNRMC')) acc += dec.decode((await reader.read()).value);
  await p.close();
});
