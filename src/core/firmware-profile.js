/**
 * Interoperability research notes derived from the user's Ui24R v3.0.7865 update
 * package. No Soundcraft firmware executable, factory preset values, graphical
 * assets, or other proprietary code are included in this application.
 * This is a parameter-name catalogue, NOT a validated wire-protocol mapping.
 */
export const FIRMWARE_PROFILE = Object.freeze({
  hardware: 'Soundcraft Ui24R',
  inspectedVersion: '3.0.7865',
  packageType: 'signed firmware update / four ext4 images and ARM kernel',
  components: Object.freeze(['system', 'mixer', 'xorg', 'chrome']),
  presetCount: 161,
  presetsByFamily: Object.freeze({ch:25,digi:48,dynch:22,dynm:1,eqch:28,fxcho:6,fxdel:8,fxrev:14,fxroom:9}),
  eq: Object.freeze(['.eq.hpf.freq',...Array.from({length:4},(_,i)=>[`.eq.b${i+1}.freq`,`.eq.b${i+1}.q`,`.eq.b${i+1}.gain`]).flat()]),
  dynamics: Object.freeze(['.dyn.attack','.dyn.release','.dyn.ratio','.dyn.threshold','.dyn.outgain','.dyn.softknee','.dyn.gate','.dyn.gain']),
  digitech: Object.freeze(['.digitech.amp','.digitech.cab','.digitech.gain','.digitech.bass','.digitech.mid','.digitech.treble','.digitech.level']),
  effects: Object.freeze(['.par1','.par2','.par3','.par4','.par5','.par6']),
  observedProtocolStrings: Object.freeze(['websocket','SETD^','SETS^','UPDATE_SHOWS','UPDATE_PLAYLIST']),
  limitations: Object.freeze([
    'Caminhos em presets são NORMALIZADOS: conversões para Hz, Q e dB não foram validadas no hardware.',
    'As strings de protocolo foram identificadas estaticamente, mas não comprovam mensagens completas, autenticação ou semântica de escrita.',
    'Firmware 3.0.7865 não representa necessariamente firmware 3.3 ou 3.5 instalado na mesa.',
    'Nenhum comando é enviado à console. Dados de nível continuam estritamente sintéticos.'
  ])
});
