#!/bin/sh
# Content-hash build: public/ (dev source) -> dist/ (deployed under
# www.clearevo.com/gnss/ by ../ykasidit.github.io/deploy.sh). Relative refs only.
# To refresh the wasm parser from source: see ../bt_gnss_wasm (branch: wasm) -
# cargo build --lib --release --target wasm32-unknown-unknown --no-default-features --features wasm
# wasm-bindgen --target web --out-dir pkg target/wasm32-unknown-unknown/release/rust_lib_bluetooth_gnss.wasm
# then copy pkg/rust_lib_bluetooth_gnss.js -> public/gnss_wasm.js, pkg/*_bg.wasm -> public/gnss_wasm_bg.wasm
set -e
cd "$(dirname "$0")"
node --check public/app.js
node --check public/logic.js
node --check public/demo.js

rm -rf dist
mkdir -p dist/assets
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cp public/* "$WORK"

h() { sha256sum "$1" | cut -c1-8; }

# stage 1: leaves
for f in ms_sans_serif.woff ms_sans_serif.woff2 ms_sans_serif_bold.woff ms_sans_serif_bold.woff2 PerfectDOSVGA437Win.woff2; do
  hash=$(h "$WORK/$f"); name="${f%.*}"; ext="${f##*.}"
  cp "$WORK/$f" "dist/assets/$name.$hash.$ext"
  sed -i "s|url($f)|url($name.$hash.$ext)|g" "$WORK/xp.css"
done
for f in gnss_wasm_bg.wasm; do
  hash=$(h "$WORK/$f")
  cp "$WORK/$f" "dist/assets/gnss_wasm_bg.$hash.wasm"
  sed -i "s|'./gnss_wasm_bg.wasm'|'./gnss_wasm_bg.$hash.wasm'|g" "$WORK/app.js"
done
for f in gnss_wasm.js logic.js demo.js; do
  hash=$(h "$WORK/$f"); name="${f%.js}"
  cp "$WORK/$f" "dist/assets/$name.$hash.js"
  sed -i "s|'./$f'|'./$name.$hash.js'|g" "$WORK/app.js"
done

# stage 2: css + app.js -> rewrite index.html
for f in xp.css gnss.css app.js; do
  hash=$(h "$WORK/$f"); name="${f%.*}"; ext="${f##*.}"
  cp "$WORK/$f" "dist/assets/$name.$hash.$ext"
  sed -i "s|\"$f\"|\"assets/$name.$hash.$ext\"|g" "$WORK/index.html"
done

VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo dev)
sed -i "s|window.GNSS_VERSION='dev'|window.GNSS_VERSION='$VERSION'|" "$WORK/index.html"
cp "$WORK/index.html" dist/
# ponytail: PWA files unhashed - they rarely change and manifest must keep a stable name
cp "$WORK/manifest.json" "$WORK"/icon-*.png dist/
grep -q '"manifest.json"' dist/index.html

# self-check
! grep -q "'./gnss_wasm.js'" dist/assets/app.*.js
! grep -q "'./gnss_wasm_bg.wasm'" dist/assets/app.*.js
! grep -q "'./logic\.js'" dist/assets/app.*.js
grep -q '"assets/app\.' dist/index.html
grep -q '"assets/xp\.' dist/index.html
grep -qE "gnss_wasm_bg\.[0-9a-f]{8}\.wasm" dist/assets/app.*.js

echo "build ok -> dist/ ($(ls dist/assets | wc -l) hashed assets)"
