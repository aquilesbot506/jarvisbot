/** Static, read-only inspector for Ui24R .uipreset JSON data. No DSP or network. */
import { FIRMWARE_PROFILE } from './firmware-profile.js';
const knownKeys=new Set([...FIRMWARE_PROFILE.eq,...FIRMWARE_PROFILE.dynamics,...FIRMWARE_PROFILE.digitech,...FIRMWARE_PROFILE.effects,'.eq.easy','.eq.bass','.eq.mid','.eq.treble','.gate.thresh',...Array.from({length:2},(_,i)=>['attack','outgain','ratio','release','softknee','threshold'].map(k=>`.dyn.${i?'r':'l'}.${k}`)).flat(),'.dyn.linked']);
export function inspectPreset(text) {
  if(typeof text!=='string' || text.length>65536) throw new Error('Preset excede o limite de 64 KB');
  let obj;
  try{obj=JSON.parse(text);}catch{throw new Error('Arquivo não contém JSON válido');}
  if(!obj || Array.isArray(obj) || typeof obj!=='object' || Object.keys(obj).length===0 || Object.keys(obj).length>100)throw new Error('Estrutura de preset inválida');
  const entries=[];
  for(const [key,value] of Object.entries(obj)){
    if(!/^\.[a-z0-9]+(?:\.[a-z0-9]+){0,3}$/.test(key))throw new Error('Chave inválida no preset');
    if(typeof value!=='number' || !Number.isFinite(value) || value<0 || value>1)throw new Error('Valor de preset fora do intervalo normalizado 0–1');
    const family=key.startsWith('.eq.')?'EQ':key.startsWith('.dyn.')||key.startsWith('.gate.')?'DYNAMICS':key.startsWith('.digitech.')?'DIGITECH':key.startsWith('.par')?'FX':'OTHER';
    entries.push({key,value,family,recognized:knownKeys.has(key)});
  }
  const families=[...new Set(entries.map(x=>x.family))];
  return {entries,families,recognized:entries.filter(x=>x.recognized).length,unrecognized:entries.filter(x=>!x.recognized).length,explanation:'Leitura apenas: valores internos normalizados, sem conversão validada para Hz/dB nem aplicação no mixer.'};
}
