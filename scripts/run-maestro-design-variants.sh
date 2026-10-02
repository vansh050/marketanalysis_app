#!/usr/bin/env bash
set -euo pipefail

app_id="${APP_ID:-com.arpint.alphaquark}"
variant="${DESIGN_VARIANT:-default}"
screenshot_dir="${SCREENSHOT_DIR:-artifacts/design-variants}"
test_email="${TEST_EMAIL:-testuser@alphaquark.in}"
test_password="${TEST_PASSWORD:-Test@12345}"

if ! command -v maestro >/dev/null 2>&1; then
  echo "ERROR: Maestro is not installed or not on PATH." >&2
  exit 1
fi
if ! adb get-state >/dev/null 2>&1; then
  echo "ERROR: no booted Android device/emulator is available." >&2
  exit 1
fi
mkdir -p "$screenshot_dir/$variant"
maestro_output_dir="$screenshot_dir/$variant/maestro-output"
actual_dir="$maestro_output_dir/customer-design-surfaces/takeScreenshot"
maestro test \
  --debug-output "$maestro_output_dir" \
  --flatten-debug-output \
  -e "APP_ID=$app_id" \
  -e "DESIGN_VARIANT=$variant" \
  -e "SCREENSHOT_DIR=$screenshot_dir" \
  -e "TEST_EMAIL=$test_email" \
  -e "TEST_PASSWORD=$test_password" \
  .maestro/design-variants/001_customer_design_surfaces.yaml

for surface in home news portfolio subscriptions model-portfolio; do
  screenshot="$actual_dir/$surface.png"
  if [[ ! -s "$screenshot" ]]; then
    echo "ERROR: expected non-empty screenshot was not produced: $screenshot" >&2
    exit 1
  fi
done

baseline_dir="${BASELINE_DIR:-.maestro/design-variants/baselines/$variant}"
diff_dir="${DIFF_DIR:-$screenshot_dir/diffs/$variant}"
node scripts/compare-maestro-screenshots.js \
  "$actual_dir" \
  "$baseline_dir" \
  "$diff_dir"

echo "Maestro design screenshots and baselines passed for $variant ($actual_dir)."
