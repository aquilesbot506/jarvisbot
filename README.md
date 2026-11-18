# CENA Render AI — pacote de instalação v0.1

Este é o **CENA Render AI**, publicado em uma branch isolada do repositório `jarvisbot`, sem alterar o código da branch `main`.

A conexão do GitHub usada para publicar não permite criar repositórios novos. Por isso, nesta publicação o código completo está distribuído nos 8 arquivos `archive/part-*.b64`, que formam um pacote TAR.XZ comprimido. O instalador reconstrói os 19 arquivos originais na pasta `cena-render-ai/`, valida o SHA-256 e preserva os serviços existentes.

## Instalação no Ubuntu

```bash
git clone --branch cena-render-ai --single-branch https://github.com/aquilesbot506/jarvisbot.git cena-render-ai-github
cd cena-render-ai-github
bash setup.sh --install
```

O instalador gera uma senha em `cena-render-ai/.env` e inicia o Docker Compose. **Guarde a senha**, não publique o arquivo `.env`. A interface será publicada somente em `127.0.0.1:13860` por padrão, sem exposição pública.

Para apenas extrair o projeto, rode `bash setup.sh`, sem `--install`. Após a extração você terá acesso a todo o código-fonte em `cena-render-ai/` e poderá executar `bash cena-render-ai/install.sh` quando desejar.

## Acesso pelo Mac com Tailscale

```bash
ssh -L 13860:127.0.0.1:13860 cena@IP_TAILSCALE_DO_SERVIDOR
```

Abra `http://127.0.0.1:13860` no Mac. Troque `IP_TAILSCALE_DO_SERVIDOR` pelo IP ou hostname real.

## Recursos da versão atual

Upload de arquivos GLB/FBX/OBJ, visualizador 3D em GLB, API com autenticação, histórico de trabalhos, renderização PNG e vídeo MP4 via Blender em CPU. **Não há geração com IA generativa nem importação SKP nativa nesta versão.** No SketchUp exporte GLB, FBX ou OBJ conforme as opções disponíveis.

## Integridade

SHA-256 do arquivo TAR.XZ antes da extração:

`046b860e6edcc498e143308ba79b9c56e857c3e7771ba8621a96b8a4c5ffdb39`

## Avisos

O Mac Pro Ubuntu sem GPU terá renderização Cycles lenta. O app está preparado para instalação e testes, mas o funcionamento do Blender no hardware específico ainda não foi validado. Consulte `cena-render-ai/README.md` após a extração.
