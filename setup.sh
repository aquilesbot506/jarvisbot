#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v base64 >/dev/null 2>&1 || ! command -v xz >/dev/null 2>&1 || ! command -v tar >/dev/null 2>&1 || ! command -v sha256sum >/dev/null 2>&1; then
  echo "Instale os pacotes xz-utils, coreutils e tar antes de continuar." >&2
  exit 1
fi
if [[ -d cena-render-ai ]]; then
  echo "A pasta cena-render-ai ja existe. Para evitar sobrescrever dados, abortando." >&2
  exit 1
fi
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cat archive/part-*.b64 | base64 -d > "$tmp/cena-render-ai.tar.xz"
printf '%s  %s\n' '046b860e6edcc498e143308ba79b9c56e857c3e7771ba8621a96b8a4c5ffdb39' "$tmp/cena-render-ai.tar.xz" | sha256sum -c -
tar -xJf "$tmp/cena-render-ai.tar.xz"
echo "Projeto extraido em: $(pwd)/cena-render-ai"
if [[ "${1:-}" == '--install' ]]; then
  cd cena-render-ai
  bash install.sh
else
  echo "Para instalar: cd cena-render-ai && bash install.sh"
fi
