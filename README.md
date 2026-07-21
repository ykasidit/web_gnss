# GNSS Monitor online

Live GPS/GNSS viewer in the browser - u-center-style panels: data fields, satellite sky
plot, per-satellite SNR bars and raw message console.

Live at **https://www.clearevo.com/gnss/**

- Connect a USB/serial GNSS receiver via the Web Serial API (Chrome/Edge desktop)
- Decodes **NMEA 0183 and u-blox UBX binary** via the Rust parser from the
  [Bluetooth GNSS](https://github.com/ykasidit/bluetooth_gnss) Android app, compiled to
  WebAssembly (branch `wasm`, crate `rust/`)
- Replay NMEA/UBX log files; DEMO simulated receivers (clearly marked, fixed at McCormick
  Hospital, Chiang Mai) for trying without hardware - these work in any browser
- 100% client-side: position data never leaves the machine

## Dev

No framework, no bundler. `public/` is the site; `public/gnss_wasm*.{js,wasm}` are built
artifacts from `bluetooth_gnss` branch `wasm` (build commands in `build.sh` header).

```
./test.sh            # node --test: UI logic, demo NMEA generator, wasm end-to-end
./build.sh           # content-hash build -> dist/
./push.sh            # build + deploy whole site via ../ykasidit.github.io/deploy.sh
```

## License

GPL v2, like the [Bluetooth GNSS](https://github.com/ykasidit/bluetooth_gnss) app - see [LICENSE](LICENSE).
