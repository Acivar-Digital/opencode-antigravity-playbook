#!/usr/bin/env bash
# Antigravity Watchdog
# Monitors antigravity-accounts.json for silent account state changes.
# Prints an alert (and rings the terminal bell) whenever:
#   - An account gets disabled
#   - An account gets verificationRequired=true
#   - A previously disabled/flagged account recovers
#
# Usage:
#   bash scripts/watchdog.sh              # run in foreground (Ctrl+C to stop)
#   bash scripts/watchdog.sh --interval 15  # check every 15 seconds (default: 20)
#   bash scripts/watchdog.sh --bell off    # suppress terminal bell

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────

INTERVAL=20
BELL=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interval|-i) INTERVAL="$2"; shift 2 ;;
    --bell) [[ "$2" == "off" || "$2" == "false" ]] && BELL=false; shift 2 ;;
    *) shift ;;
  esac
done

if [[ "${XDG_CONFIG_HOME:-}" != "" ]]; then
  CONFIG_DIR="${XDG_CONFIG_HOME}/opencode"
else
  CONFIG_DIR="${HOME}/.config/opencode"
fi
ACCOUNTS_FILE="${CONFIG_DIR}/antigravity-accounts.json"

# ── ANSI colors ───────────────────────────────────────────────────────────────

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ── State tracking (associative arrays) ───────────────────────────────────────

declare -A PREV_ENABLED=()
declare -A PREV_VERREQUIRED=()

# ── Helpers ───────────────────────────────────────────────────────────────────

alert() {
  local level="$1"
  local msg="$2"
  local ts
  ts="$(date '+%H:%M:%S')"

  if [[ "$level" == "ERROR" ]]; then
    echo -e "${RED}${BOLD}[${ts}] ⚠ ALERT: ${msg}${RESET}"
  elif [[ "$level" == "WARN" ]]; then
    echo -e "${YELLOW}${BOLD}[${ts}] ⚠ WARN:  ${msg}${RESET}"
  else
    echo -e "${GREEN}[${ts}] ✓ OK:    ${msg}${RESET}"
  fi

  if [[ "$BELL" == "true" && "$level" != "OK" ]]; then
    printf '\a'  # terminal bell
  fi
}

# ── Check accounts file ───────────────────────────────────────────────────────

check_accounts() {
  if [[ ! -f "$ACCOUNTS_FILE" ]]; then
    echo -e "${DIM}[$(date '+%H:%M:%S')] accounts file not found: ${ACCOUNTS_FILE}${RESET}"
    return
  fi

  local raw
  raw="$(cat "$ACCOUNTS_FILE" 2>/dev/null)" || return

  # Extract per-account fields using jq
  local snapshot
  snapshot="$(echo "$raw" | jq -c '.accounts[] | {email: (.email // "unknown"), enabled: (.enabled // true), verReq: (.verificationRequired // false)}' 2>/dev/null)" || return

  while IFS= read -r line; do
    local email enabled ver_req
    email="$(echo "$line" | jq -r '.email')"
    enabled="$(echo "$line" | jq -r '.enabled')"
    ver_req="$(echo "$line" | jq -r '.verReq')"

    # ── Check enabled state ───────────────────────────────────────────────
    local prev_enabled="${PREV_ENABLED[$email]:-}"
    if [[ -z "$prev_enabled" ]]; then
      # First time seeing this account — just record state
      PREV_ENABLED[$email]="$enabled"
    elif [[ "$prev_enabled" == "true" && "$enabled" == "false" ]]; then
      alert "ERROR" "${email} was DISABLED (background loop killed it)"
      PREV_ENABLED[$email]="$enabled"
    elif [[ "$prev_enabled" == "false" && "$enabled" == "true" ]]; then
      alert "OK" "${email} was re-enabled"
      PREV_ENABLED[$email]="$enabled"
    fi

    # ── Check verificationRequired ────────────────────────────────────────
    local prev_ver="${PREV_VERREQUIRED[$email]:-}"
    if [[ -z "$prev_ver" ]]; then
      PREV_VERREQUIRED[$email]="$ver_req"
    elif [[ "$prev_ver" == "false" && "$ver_req" == "true" ]]; then
      alert "WARN" "${email} flagged verificationRequired=true"
      PREV_VERREQUIRED[$email]="$ver_req"
    elif [[ "$prev_ver" == "true" && "$ver_req" == "false" ]]; then
      alert "OK" "${email} verification cleared"
      PREV_VERREQUIRED[$email]="$ver_req"
    fi

  done <<< "$snapshot"
}

# ── Initial summary ───────────────────────────────────────────────────────────

print_summary() {
  if [[ ! -f "$ACCOUNTS_FILE" ]]; then return; fi
  echo ""
  echo -e "${CYAN}${BOLD}Antigravity Watchdog started${RESET}  (interval: ${INTERVAL}s)"
  echo -e "${DIM}Watching: ${ACCOUNTS_FILE}${RESET}"
  echo ""

  local raw
  raw="$(cat "$ACCOUNTS_FILE" 2>/dev/null)" || return

  echo "$raw" | jq -r '.accounts[] | [
    (.enabled // true | if . then "✓" else "✗" end),
    (.verificationRequired // false | if . then "VERIFY!" else "      " end),
    (.email // "unknown")
  ] | join(" ")' 2>/dev/null | while IFS= read -r line; do
    local dot="${DIM}"
    if [[ "$line" == ✗* ]]; then dot="${RED}"; fi
    if [[ "$line" == *VERIFY!* ]]; then dot="${YELLOW}"; fi
    echo -e "  ${dot}${line}${RESET}"
  done
  echo ""
}

# ── Main loop ─────────────────────────────────────────────────────────────────

print_summary

# Warm up state (no alerts on first pass)
check_accounts

echo -e "${DIM}Monitoring... Ctrl+C to stop.${RESET}"
echo ""

while true; do
  sleep "$INTERVAL"
  check_accounts
done
