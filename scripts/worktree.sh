#!/usr/bin/env bash
# Create (or open) a git worktree for a parallel line of work, so several agents or
# people can edit the site at once without touching each other's files.
#
#   scripts/worktree.sh <name>            create ../mk-skitka-site.worktrees/<name> on branch wt/<name>
#   scripts/worktree.sh <name> --remove   remove that worktree (branch is kept)
#   scripts/worktree.sh --list
#
# Each worktree is a full checkout with its own node_modules and its own dev server
# port, printed at the end. Merge finished work back into main from the main checkout:
#   git merge wt/<name>
set -euo pipefail
ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
WT_DIR="$(dirname "$ROOT")/$(basename "$ROOT").worktrees"

if [[ "${1:-}" == "--list" || -z "${1:-}" ]]; then git -C "$ROOT" worktree list; exit 0; fi
NAME="$1"; BRANCH="wt/$NAME"; DIR="$WT_DIR/$NAME"

if [[ "${2:-}" == "--remove" ]]; then
  git -C "$ROOT" worktree remove "$DIR" && echo "removed $DIR (branch $BRANCH kept)"; exit 0
fi

mkdir -p "$WT_DIR"
if [[ -d "$DIR" ]]; then echo "exists: $DIR"; else
  if git -C "$ROOT" show-ref --quiet "refs/heads/$BRANCH"; then
    git -C "$ROOT" worktree add "$DIR" "$BRANCH"
  else
    git -C "$ROOT" worktree add -b "$BRANCH" "$DIR" main
  fi
  (cd "$DIR" && npm install --no-fund --no-audit >/dev/null 2>&1 && echo "installed dependencies")
fi
# a port per worktree so several dev servers can run at once
PORT=$(( 5180 + $(ls "$WT_DIR" | sort | grep -nx "$NAME" | cut -d: -f1) ))
echo
echo "worktree: $DIR"
echo "branch:   $BRANCH"
echo "dev:      cd $DIR && npm run dev -- --port $PORT"
echo "agent:    cd $DIR && claude"
