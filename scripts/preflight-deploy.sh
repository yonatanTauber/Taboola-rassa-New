#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

pass() {
  echo "[OK] $1"
}

if [ ! -f .env ]; then
  fail ".env not found"
fi

# shellcheck disable=SC1091
source .env

if [ -z "${AUTH_SECRET:-}" ]; then
  fail "AUTH_SECRET is missing"
fi

if [ "${#AUTH_SECRET}" -lt 32 ]; then
  fail "AUTH_SECRET is too short (minimum 32 chars recommended)"
fi
pass "AUTH_SECRET present"

if [ -z "${DATABASE_URL:-}" ]; then
  fail "DATABASE_URL is missing"
fi

if [[ "${NODE_ENV:-development}" == "production" ]]; then
  if [[ "$DATABASE_URL" == file:* ]]; then
    fail "Production cannot run with SQLite DATABASE_URL (file:...)"
  fi
fi
pass "DATABASE_URL sanity check passed"

if [ "${NODE_ENV:-development}" == "production" ]; then
  schema_path="${PRISMA_SCHEMA_PATH:-}"
  if [ "$schema_path" != "prisma/schema.postgres.prisma" ]; then
    fail "Production requires PRISMA_SCHEMA_PATH=prisma/schema.postgres.prisma"
  fi
  pass "PRISMA_SCHEMA_PATH is postgres schema"

  if [ -z "${APP_BASE_URL:-}" ]; then
    fail "APP_BASE_URL is missing in production"
  fi
  pass "APP_BASE_URL present"

  mode="${REGISTRATION_MODE:-invite}"
  if [ "$mode" == "open" ]; then
    echo "[WARN] REGISTRATION_MODE=open in production"
  else
    pass "REGISTRATION_MODE=$mode"
  fi
fi

if [ -d node_modules ]; then
  pass "node_modules exists"
else
  echo "[WARN] node_modules missing; run npm install"
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "[WARN] Working tree is not clean"
  else
    pass "Git working tree clean"
  fi
fi

echo "Preflight complete"
