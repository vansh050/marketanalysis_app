#!/usr/bin/env bash
# Fails when a react-native-config env file holds a credential. Every value in
# that file is baked into the APK/AAB/IPA as plain text, so a token there ships
# to every customer (2026-10-22: a GitHub token was inside AlphaPro 3.9.194).
# Prints key names only, never values.

set -euo pipefail

env_file="${1:-.env}"
[[ -f "$env_file" ]] || exit 0

pattern='github_pat_|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}'
bad_keys="$(awk -F= -v pat="$pattern" '
  /^[[:space:]]*#/ || index($0, "=") == 0 { next }
  { key = $1; sub(/^[^=]*=/, ""); if ($0 ~ pat) print key }
' "$env_file")"

if [[ -n "$bad_keys" ]]; then
  echo "ERROR: $env_file holds credential-like values. Remove them; the app must not ship them:"
  printf '  - %s\n' $bad_keys
  exit 1
fi
