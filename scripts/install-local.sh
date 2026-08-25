#!/bin/sh
set -eu

PROFILE="${1:-web}"
case "$PROFILE" in
  *[!a-zA-Z0-9_-]*|'') printf 'Invalid profile: %s\n' "$PROFILE" >&2; exit 1 ;;
esac

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd -P)
command -v dsh >/dev/null 2>&1 || { echo 'dsh not found' >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo 'pnpm not found' >&2; exit 1; }

cd "$ROOT"
pnpm install
pnpm run check
dsh plugin --profile "$PROFILE" add "link:$ROOT"

SKILL_DIR="${AGENTS_HOME:-$HOME/.agents}/skills/antv-ava"
mkdir -p "$SKILL_DIR"
cp "$ROOT/SKILL.md" "$SKILL_DIR/SKILL.md"

printf '\nInstalled into profile %s. Restart dsh web and hard-refresh the browser.\n' "$PROFILE"
