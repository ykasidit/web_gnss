import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { GnssParser } from '../public/gnss_wasm.js';
import { nmeaBurst } from '../public/demo.js';

test('wasm parser end-to-end: demo burst -> position + sats', async () => {
  await init({ module_or_path: await readFile(new URL('../public/gnss_wasm_bg.wasm', import.meta.url)) });
  const p = new GnssParser();
  const objs = JSON.parse(p.feed(new TextEncoder().encode(nmeaBurst('GN', new Date('2026-07-21T03:00:00Z')))));
  assert.equal(objs.length, 5);
  assert.deepEqual(objs.map((o) => o.name), ['GGA', 'GSA', 'GSV', 'GSV', 'RMC']);

  const params = JSON.parse(p.params());
  assert.ok(Math.abs(params.lat - 18.7961) < 1e-6);
  assert.ok(Math.abs(params.lon - 99.008) < 1e-6);
  assert.equal(params.alt, 310);
  assert.equal(params.sats.length, 8);
  const s = params.sats.find((x) => x.prn === 1 && x.gnss === 'Gps');
  assert.ok(s && s.elev === 68 && s.az === 42 && s.snr === 45 && s.used === true);

  p.reset();
  assert.equal(p.params(), '{}');
});
