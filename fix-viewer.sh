#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$ROOT/cena-render-ai"
if [[ ! -f "$APP/Dockerfile" || ! -f "$APP/app/static/index.html" || ! -f "$APP/app/static/app.js" || ! -f "$APP/docker-compose.yml" ]]; then
  echo 'ERRO: execute este script dentro da pasta cena-render-ai-github, apos o git pull.' >&2
  exit 1
fi
python3 - "$APP" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
idx=p/'app/static/index.html'
s=idx.read_text(encoding='utf-8')
old='"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"'
new='"three":"/static/vendor/three/build/three.module.js","three/addons/":"/static/vendor/three/examples/jsm/"'
if old in s:
    s=s.replace(old,new)
elif new not in s:
    raise SystemExit('ERRO: mapa de importacao desconhecido, abortando sem alteracoes.')
s=s.replace('src="/static/app.js"','src="/static/app.js?v=0.1.1"')
idx.write_text(s, encoding='utf-8')

df=p/'Dockerfile'
s=df.read_text(encoding='utf-8')
if 'AS three-vendor' not in s:
    if not s.startswith('FROM python:3.11-slim-bookworm'):
        raise SystemExit('ERRO: Dockerfile inesperado. Nao e seguro alterar automaticamente.')
    s='FROM node:22-alpine AS three-vendor\nRUN npm install --prefix /vendor --no-audit --no-fund --ignore-scripts three@0.170.0\n\n'+s
    marker='COPY app ./app\n'
    if marker not in s:
        raise SystemExit('ERRO: Dockerfile sem instrucao COPY app ./app.')
    extra=('COPY --from=three-vendor /vendor/node_modules/three/build/three.module.js ./app/static/vendor/three/build/three.module.js\n'
           'COPY --from=three-vendor /vendor/node_modules/three/examples/jsm/controls/OrbitControls.js ./app/static/vendor/three/examples/jsm/controls/OrbitControls.js\n'
           'COPY --from=three-vendor /vendor/node_modules/three/examples/jsm/loaders/GLTFLoader.js ./app/static/vendor/three/examples/jsm/loaders/GLTFLoader.js\n'
           'COPY --from=three-vendor /vendor/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js ./app/static/vendor/three/examples/jsm/utils/BufferGeometryUtils.js\n'
           'COPY --from=three-vendor /vendor/node_modules/three/LICENSE ./app/static/vendor/three/LICENSE\n')
    s=s.replace(marker,marker+extra)
df.write_text(s,encoding='utf-8')

js=p/'app/static/app.js'
s=js.read_text(encoding='utf-8')
old="  $('viewerGuide').classList.add('hidden');$('viewerGuide').dataset.reason='';"
new="  $('viewerGuide').classList.add('hidden');$('viewerGuide').dataset.reason='';\n  $('viewerGuide').querySelector('.viewer-guide-text').textContent='SELECIONE UM PROJETO PARA VISUALIZAR';"
if old in s:
    s=s.replace(old,new)
old="toast('Visualização 3D indisponível: verifique internet e arquivo GLB.');console.warn(e);"
new="const detail=String(e?.message||e).slice(0,220);$('viewerGuide').querySelector('.viewer-guide-text').textContent='ERRO AO ABRIR MODELO: '+detail;toast('Falha ao abrir visualizador: '+detail);console.error('[CENA Render AI] Erro visualizador 3D:',e);"
if old in s:
    s=s.replace(old,new)
elif new not in s:
    raise SystemExit('ERRO: formato de tratamento de erros desconhecido.')
js.write_text(s,encoding='utf-8')
print('OK: Three.js local, mensagens de erro detalhadas e versao de cache atualizadas.')
PY
if [[ "${1:-}" == "--patch-only" ]]; then
  echo 'Aplicacao do patch concluida, sem reconstruir o Docker.'
  exit 0
fi
command -v docker >/dev/null || { echo 'ERRO: Docker nao encontrado.'; exit 1; }
cd "$APP"
echo 'Reconstruindo somente o CENA Render AI (o volume de dados e o .env serao preservados)...'
docker compose up -d --build --no-deps cena-render-ai
printf '\nVerificando bibliotecas locais...\n'
for f in \
  /static/vendor/three/build/three.module.js \
  /static/vendor/three/examples/jsm/controls/OrbitControls.js \
  /static/vendor/three/examples/jsm/loaders/GLTFLoader.js \
  /static/vendor/three/examples/jsm/utils/BufferGeometryUtils.js; do
  if curl --silent --show-error --fail --head "http://127.0.0.1:13860$f" >/dev/null; then
    echo "OK $f"
  else
    echo "AVISO: nao consegui confirmar $f (confira o container e a porta no .env)." >&2
  fi
done
echo 'Pronto. Recarregue o painel com Ctrl+Shift+R (ou Cmd+Shift+R no Mac).'
