#!/usr/bin/env bash
# Fails the build when the react-native-config .env is missing or incomplete.
# An iOS build without it ships an app whose every server call fails
# (AlphaPro iOS 2.7 (24), 2026-10: login said "Something went wrong").

set -euo pipefail

env_file="${1:-.env}"
expected_variant="${2:?usage: verify_mobile_env.sh <env> <APP_VARIANT> [REACT_APP_HEADER_NAME]}"
expected_tenant="${3:-$expected_variant}"

if [[ ! -s "$env_file" ]]; then
  echo "ERROR: $env_file is missing or empty."
  exit 1
fi

read_value() {
  local key="$1"
  awk -F= -v key="$key" '
    $1 == key {
      sub(/^[^=]*=/, "")
      sub(/\r$/, "")
      print
      exit
    }
  ' "$env_file"
}

required_keys=(
  APP_VARIANT
  REACT_APP_HEADER_NAME
  REACT_APP_NODE_SERVER_API_URL
  REACT_APP_CCXT_SERVER_WEBSOCKET_URL
  REACT_APP_AQ_KEYS
  REACT_APP_AQ_SECRET
  REACT_APP_FIREBASE_API_KEY
  REACT_APP_FIREBASE_AUTH_DOMAIN
  REACT_APP_FIREBASE_PROJECT_ID
  REACT_APP_FIREBASE_APP_ID
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID
)

missing_keys=()
for key in "${required_keys[@]}"; do
  value="$(read_value "$key")"
  if [[ -z "$value" || "$value" == '""' || "$value" == "''" ]]; then
    missing_keys+=("$key")
  fi
done

if (( ${#missing_keys[@]} > 0 )); then
  echo "ERROR: $env_file is missing required mobile runtime configuration:"
  printf '  - %s\n' "${missing_keys[@]}"
  exit 1
fi

if [[ "$(read_value APP_VARIANT)" != "$expected_variant" ]]; then
  echo "ERROR: APP_VARIANT must be $expected_variant for this build."
  exit 1
fi

# The tenant header is NOT always the variant: AlphaPro is variant
# "alphaquark", tenant "prod" (see CLAUDE.md "mobile tenant header").
if [[ "$(read_value REACT_APP_HEADER_NAME)" != "$expected_tenant" ]]; then
  echo "ERROR: REACT_APP_HEADER_NAME must be $expected_tenant for this build."
  exit 1
fi

bash "$(dirname "$0")/check_env_secrets.sh" "$env_file"

echo "Mobile runtime configuration is present for $expected_variant."
