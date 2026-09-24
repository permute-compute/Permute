#!/usr/bin/env bash
# Sync worker package into your permute-compute Git clone and build (no monorepo history).
#
# Usage:
#   export PERMUTE_GIT_NAME="permute-compute"
#   export PERMUTE_GIT_EMAIL="you@example.com"
#   ./scripts/push-github.sh
#   ./scripts/push-github.sh ~/Documents/permute
#
# Push with PAT (HTTPS) — see script output. SSH optional.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$HOME/Documents/permute}"

if [[ ! -d "$DEST" ]]; then
  echo "Destination missing: $DEST"
  echo "Clone first: git clone https://github.com/permute-compute/Permute.git \"$DEST\""
  exit 1
fi

echo "Syncing worker package → $DEST (keeps existing .git)"
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude '.env' \
  --exclude '.git' \
  "$ROOT/" "$DEST/"

cd "$DEST"
echo "Installing dependencies…"
npm install
echo "Building…"
npm run build

if [[ ! -d .git ]]; then
  git init -b main
  git remote add origin https://github.com/permute-compute/Permute.git 2>/dev/null || true
fi

git config user.name "${PERMUTE_GIT_NAME:-permute-compute}"
git config user.email "${PERMUTE_GIT_EMAIL:?Set PERMUTE_GIT_EMAIL (permute-compute GitHub email or noreply)}"

git add -A
if git diff --staged --quiet; then
  echo "No changes to commit."
else
  git commit -m "Add @permute_compute/worker provider agent"
fi

echo ""
echo "Author on this commit:"
git log -1 --format='  %an <%ae>'
echo ""
echo "Push with your PAT (no SSH required):"
echo "  cd \"$DEST\""
echo "  git remote set-url origin https://github.com/permute-compute/Permute.git"
echo "  git push origin main"
echo ""
echo "When prompted: Username = permute-compute (or the org bot user), Password = your PAT (not GitHub password)."
echo ""
echo "Optional SSH: only if you add an SSH key to the permute-compute GitHub account and use git@github.com:permute-compute/Permute.git"
