# AQUILES AI — CENA Produções

**Versão 0.2.0: simulador offline para macOS com interface inspirada no fluxo operacional Yamaha DM7.** Aplicativo Electron com 24 canais, faders, medidores sintéticos, controles de EQ/dinâmica/AUX (modelo de parâmetros), master, cenas locais e assistente de comandos em português com aprovação antes de executar.

> ⚠️ **Nenhuma conexão real.** Esta versão não descobre, conecta ou envia comandos à Soundcraft Ui24R. Não há captura nem processamento de áudio. Os medidores são gerados matematicamente e não têm relação com o sinal real. O assistente offline é um interpretador de regras, não um LLM. Recursos de áudio real, OmniRouter e conexão física ainda não foram implementados.

## Rodar no Mac

Requisitos: macOS suportado pelo Electron, Node.js 22+, npm, conectividade à internet **apenas na instalação inicial**.

```sh
npm install
npm test
npm start
```

A partir daí, o simulador funciona sem internet, inclusive com o MacBook conectado exclusivamente ao hotspot da mesa. O app não tenta se comunicar com a mesa.

## Criar o aplicativo

No macOS:

```sh
npm run dist:mac
```

O build produz `.app` dentro do pacote e instaladores `.dmg` em `release/`. Os builds do GitHub Actions são **não assinados e não notarizados**, portanto o Gatekeeper pode alertar. Para distribuir amplamente, configurar assinatura e notarização Apple; não desativar mecanismos de segurança do macOS para instalar aplicativos desconhecidos.

## Desenvolvimento e testes

```sh
npm run check
npm test
```

Os testes usam o `node:test` nativo e não requerem dependências instaladas. O workflow `.github/workflows/mac-build.yml` testa no Linux e compila no runner macOS (Apple Silicon e Intel); os instaladores ficam disponíveis nos artefatos da execução após sucesso. Para GitHub Releases, é necessário configurar posteriormente um fluxo separado de publicação e assinatura.

## Segurança

- `contextIsolation`, `sandbox`, sem `nodeIntegration` no renderer; CSP bloqueia conexões externas.
- `preload` expõe apenas leitura/gravação de dados no diretório local Application Support do aplicativo.
- No Electron, alterações são salvas em arquivo JSON com gravação atômica.
- Cenas podem ser importadas/exportadas em JSON e devem passar por validação básica.
- A IA **não** recebe permissão para alterar master, phantom ou ganho.
- Toda proposta de automação exige aprovação explícita, e vale apenas para o simulador.
- Nenhum token/API key deve ser salvo no projeto.

## Comandos locais suportados

- “Aquiles, aumenta o canal 15 em 2 dB.”
- “Abaixa a guitarra L em 3 dB.”
- “Muta o canal 10.”
- “Desmuta o canal 10.”
- “Muta todos menos o canal 15.”
- “Salva cena Passagem de Som.”
- “Analisa os níveis.” (somente dados simulados)

## Próximas etapas

1. Testar o .app no MacBook da CENA (Intel/Apple Silicon, versão macOS).
2. Melhorar ergonomia (tela cheia e atalhos), completar modelos de cenas e testes.
3. Adicionar driver isolado de leitura para `soundcraft-ui-connection` (https://github.com/fmalcher/soundcraft-ui), com consentimento explícito e testes em mesa fora de operação.
4. Validar sincronização de estados em `REAL_READ_ONLY` com uma Ui24R física.
5. Habilitar alterações reais **somente** após botão de autorização e testes seguros; nada de controle automático do master.
6. Opcional: integrar um LLM local ou OmniRouter quando houver conectividade; o mixer continuará independente da IA.

Projeto não afiliado à Soundcraft. Soundcraft e Ui24R são marcas de seus titulares.


## Interface 0.2 — Selected Channel e Overview

O console foi redesenhado com fluxo inspirado na organização do Yamaha DM7 Editor (referência estrutural, sem redistribuir ativos ou código Yamaha). Inclui:

- Meter bridge sintética dos 12 canais visíveis no topo.
- Navegação por bancos 01–12 e 13–24, barra compacta e faders verticais.
- Visualização **Selected Channel** com EQ paramétrico, DYN 1 Gate, DYN 2 Compressor, HPF, pan e fader.
- Tela **Overview** com 12 cards de processamento e estado de mute.
- Controles ON, SOLO e SEL, com indicação visual de seleção.
- Todos os parâmetros permanecem em **simulação**, sem conexão à mesa real e sem processamento de áudio.

Referência de layout: https://br.yamaha.com/pt/business/audio/products/software-apps/dm7-editor/

O software Aquiles é independente e não é afiliado à Yamaha ou à Soundcraft.
