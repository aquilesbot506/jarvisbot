# Aquiles AI — relatório de interoperabilidade Ui24R

**Fonte examinada:** pacote de atualização fornecido pelo usuário `uiupdate-k-3.0.7865-ui24v2-paidsearch.zip` (169 MiB).  
**SHA-256:** `21a229d53b80d6227fcb136fbe096ccae283a16aadc0001ac31e4031b354a24f`.  
**Escopo:** engenharia reversa estática para interoperabilidade. Nenhum componente foi executado, modificado ou gravado em hardware.

## O que o arquivo contém (evidência direta)

- Identificador `target.id`: `soundcraft-ui24`.
- `100-system.img`: imagem de sistema Linux ext4; `200-mixer.img`: imagem do software de mixagem; `300-xorg.img`: componentes gráficos; `400-chrome.img`: ambiente Chromium; `kernel.img`: imagem de inicialização.
- Arquivos de assinatura `.sig` e scripts `preupdate.sh`, `update.sh` de atualização da console. A instalação na mesa **não faz parte do Aquiles**.
- Em `200-mixer.img`, `/etc/mixer.version` = `3.0.7865`; `/etc/mixer.svnrev` = `7865`.
- `/mixer/umixsrv`: binário ARM 32-bit, ELF compilado, **19.542.660 bytes**, referenciado no serviço `umixsrv.service` com `-port=80`.
- Strings estáticas observadas no binário: `websocket`, `SETD^`, `SETS^`, `UPDATE_SHOWS`, `UPDATE_PLAYLIST`, `/mixer`, `/socket.io/`. **Apenas evidência de strings, não protocolo interoperável implementado.**

## Presets internos (quantidade por família)

| Família interna | Quantidade | Campos verificados |
|---|---:|---|
| `factory/ch` | 25 | EQ e dinâmica de entrada |
| `factory/digi` | 48 | DigiTech, dinâmica, HPF |
| `factory/dynch` | 22 | dinâmica de entrada |
| `factory/dynm` | 1 | dinâmica L/R e linked |
| `factory/eqch` | 28 | EQ de quatro bandas e HPF |
| `factory/fxcho` | 6 | seis parâmetros genéricos FX |
| `factory/fxdel` | 8 | seis parâmetros genéricos FX |
| `factory/fxrev` | 14 | seis parâmetros genéricos FX |
| `factory/fxroom` | 9 | seis parâmetros genéricos FX |
| **Total** | **161** | |

### Chaves de parâmetros observadas

**EQ**: `.eq.hpf.freq`, `.eq.b1.freq`, `.eq.b1.q`, `.eq.b1.gain` e correspondentes para `b2`, `b3` e `b4`; também `.eq.easy`, `.eq.bass`, `.eq.mid`, `.eq.treble`.

**Dinâmica**: `.dyn.attack`, `.dyn.release`, `.dyn.ratio`, `.dyn.threshold`, `.dyn.outgain`, `.dyn.softknee`, `.dyn.gate`, `.dyn.gain`.

**DigiTech**: `.digitech.amp`, `.digitech.cab`, `.digitech.gain`, `.digitech.bass`, `.digitech.mid`, `.digitech.treble`, `.digitech.level`.

**FX**: `.par1` até `.par6`, observados em chorus, delay, reverb e room.

Os valores dos presets observados estão no intervalo **normalizado entre 0 e 1**. Esses valores não devem ser interpretados diretamente como Hz, dB, ms ou Q. Para o simulador foram escolhidas faixas intuitivas próprias, **não equivalentes comprovadas ao DSP da mesa**.

## O que foi implementado no Aquiles v0.3

1. Simulador de 24 entradas com controle local de fader, mute, solo, pan e master.
2. EQ de quatro bandas com frequência, Q e ganho independentes + curva ilustrativa e HPF.
3. Compressor: threshold, ratio, attack, release, makeup, soft knee.
4. Gate: threshold, attack, hold, release.
5. Envio para oito AUX e quatro FX.
6. Cenas locais com migração de parâmetros ao abrir versões anteriores.
7. Painel de diagnóstico exibindo chaves identificadas e limitando afirmações ao que foi observado.
8. Inspetor **somente leitura** de presets `.uipreset` JSON locais: identifica chaves, valida valores normalizados e não grava na mesa nem converte para unidades reais.
9. Assistente Aquiles por regras locais para faders/mutes/cenas, com aprovação obrigatória e sem controle do master.
10. `SIMULATOR` permanece o único modo ativo; sem rede de controle ou captura de áudio.

## O que NÃO foi demonstrado ou implementado

- Protocolo completo de mensagens WebSocket, sua codificação, autorização e semântica da sincronização bidirecional.
- Compatibilidade binária/funcional com os firmwares 3.3 e 3.5.
- Áudio real: DSP, RTA, AFS2, recursos de gravação USB, roteamento físico, patching, cue real, cascata, phantom e pré-amplificadores.
- Controle remoto de uma Ui24R física, latência de rede, reconexões, alterações por múltiplos clientes ou recuperação de estados após queda.
- Modelo de IA generativa capaz de ouvir áudio e recomendar ajustes baseados em sinais capturados.
- Build macOS testado em MacBook de usuário, assinatura Apple ou notarização.

**Critério de segurança:** `REAL_READ_ONLY` só poderá ser ativado depois de validar o protocolo em um equipamento de teste, com testes instrumentados que garantam ausência de comandos de alteração. `REAL_CONTROL` deve ser implementado e habilitado separadamente, com autorização por parâmetro, rollback quando possível e opção de desligar o módulo de IA.

## Confidencialidade e direitos

Este repositório contém **apenas código original do Aquiles e uma descrição de metadados**. Não redistribui firmware, arquivos `.uipreset`, binários `umixsrv`, imagens, ícones nem código proprietário da Soundcraft. Os controles foram desenhados para fins de simulação e interoperabilidade futura.
