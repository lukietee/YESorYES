#!/usr/bin/env bash
# Bootstrap all four runtimes' deps.
#
# Usage:
#   ./setup.sh          # install everything
#   ./setup.sh web      # only one runtime
#   ./setup.sh --check  # verify required tools are installed
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

bold() { printf "\n\033[1;36m▶ %s\033[0m\n" "$1"; }
warn() { printf "\033[1;33m! %s\033[0m\n" "$1"; }
ok()   { printf "\033[1;32m✔ %s\033[0m\n" "$1"; }

check_tools() {
  bold "checking tools"
  local missing=()
  for cmd in node npm python3 pip; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      missing+=("$cmd")
    else
      ok "$cmd: $($cmd --version 2>&1 | head -1)"
    fi
  done
  if [ ${#missing[@]} -gt 0 ]; then
    warn "missing: ${missing[*]}"
    return 1
  fi
  ok "all required tools present"

  # macOS-specific: cliclick for the remote-agent
  if [[ "$(uname)" == "Darwin" ]]; then
    if command -v cliclick >/dev/null 2>&1; then
      ok "cliclick: $(cliclick -V 2>&1 | head -1)"
    else
      warn "cliclick missing — required by remote-agent. install with: brew install cliclick"
    fi
  fi
}

install_web() {
  bold "web/ — Next.js"
  (cd web && npm install --no-audit --no-fund)
  ok "web installed"
}

install_bridge() {
  bold "bridge/ — Fastify + Twilio + Deepgram + Claude + ElevenLabs"
  (cd bridge && npm install --no-audit --no-fund)
  ok "bridge installed"
}

install_remote_agent() {
  bold "remote-agent/ — Anthropic Computer Use"
  (cd remote-agent && npm install --no-audit --no-fund)
  ok "remote-agent installed"
}

install_vision() {
  bold "vision/ — OpenCV + Pusher"
  (
    cd vision
    if [ ! -d .venv ]; then python3 -m venv .venv; fi
    # shellcheck disable=SC1091
    source .venv/bin/activate
    pip install --quiet --upgrade pip
    pip install --quiet -r requirements.txt
  )
  ok "vision installed (venv at vision/.venv)"
}

install_scripts() {
  bold "scripts/ — mock event publisher"
  (cd scripts && npm install --no-audit --no-fund)
  ok "scripts installed"
}

case "${1:-all}" in
  --check) check_tools ;;
  web) install_web ;;
  bridge) install_bridge ;;
  remote-agent) install_remote_agent ;;
  vision) install_vision ;;
  scripts) install_scripts ;;
  all|"")
    check_tools || true
    install_web
    install_bridge
    install_remote_agent
    install_vision
    install_scripts
    bold "all done"
    cat <<EOF

next steps:
  1. cp web/.env.example web/.env.local            # fill in Pusher + KV + INTERNAL_TOKEN
  2. cp bridge/.env.example bridge/.env            # fill in Twilio/Deepgram/Anthropic/ElevenLabs
  3. cp vision/.env.example vision/.env            # fill in Pusher
  4. cp remote-agent/.env.example remote-agent/.env
  5. cp scripts/.env.example scripts/.env

quick smoke test:
  cd web && npm run dev
  open http://localhost:3000/display/dev
EOF
    ;;
  *)
    echo "usage: $0 [--check|all|web|bridge|remote-agent|vision|scripts]" >&2
    exit 2
    ;;
esac
