import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState,updateChannel,saveScene,migrateState,isValidState,EQ_BANDS } from '../src/core/mixer.js';
import { FIRMWARE_PROFILE } from '../src/core/firmware-profile.js';
import { inspectPreset } from '../src/core/preset-inspector.js';

test('metadados firmware consistentes com imagem 3.0.7865',()=>{
  assert.equal(FIRMWARE_PROFILE.inspectedVersion,'3.0.7865');
  assert.equal(Object.values(FIRMWARE_PROFILE.presetsByFamily).reduce((a,b)=>a+b,0),161);
  assert.equal(FIRMWARE_PROFILE.eq.filter(k=>k.endsWith('.freq')||k.endsWith('.q')||k.endsWith('.gain')).length,13);
});
test('quatro bandas de EQ possuem frequência/Q/gain editáveis e limites',()=>{
  let s=createInitialState();
  s=updateChannel(s,1,{eq:{low:4},eqParams:{low:{freqHz:140,q:2.1}}});
  assert.equal(s.channels[0].eq.low,4);assert.equal(s.channels[0].eqParams.low.freqHz,140);
  assert.equal(s.channels[0].eqParams.low.q,2.1);
  s=updateChannel(s,1,{eqParams:{low:{freqHz:25000,q:300}}});
  assert.equal(s.channels[0].eqParams.low.freqHz,20000);
  assert.equal(s.channels[0].eqParams.low.q,12);
  assert.ok(isValidState(s));
  assert.equal(EQ_BANDS.length,4);
});
test('params de compressor e gate preservam alterações parciais',()=>{
  let s=createInitialState();
  s=updateChannel(s,2,{comp:{attackMs:47,releaseMs:800,makeupDb:5,softKnee:true},gate:{holdMs:400}});
  assert.equal(s.channels[1].comp.attackMs,47);
  assert.equal(s.channels[1].comp.ratio,3);
  assert.equal(s.channels[1].comp.softKnee,true);
  assert.equal(s.channels[1].gate.holdMs,400);
  assert.equal(s.channels[1].gate.threshold,-45);
  assert.ok(isValidState(s));
});
test('cenas legadas recuperam parâmetros novos sem perder faders e mutes',()=>{
  let s=createInitialState();s=updateChannel(s,5,{faderDb:-19,muted:true});s=saveScene(s,'Antiga');
  for(const c of s.channels){delete c.eqParams;delete c.comp.attackMs;delete c.comp.releaseMs;delete c.comp.makeupDb;delete c.comp.softKnee;delete c.gate.attackMs;delete c.gate.holdMs;delete c.gate.releaseMs;}
  for(const c of s.scenes[0].channels){delete c.eqParams;delete c.comp.attackMs;delete c.comp.releaseMs;delete c.comp.makeupDb;delete c.comp.softKnee;delete c.gate.attackMs;delete c.gate.holdMs;delete c.gate.releaseMs;}
  assert.equal(isValidState(s),false);
  const upgraded=migrateState(s);
  assert.ok(upgraded);assert.ok(isValidState(upgraded));
  assert.equal(upgraded.channels[4].faderDb,-19);
  assert.equal(upgraded.scenes[0].channels[4].muted,true);
  assert.equal(upgraded.scenes[0].channels[4].eqParams.low.freqHz,125);
});
test('inspector reconhece valores normalizados sem aplicar nenhum comando',()=>{
  const result=inspectPreset(JSON.stringify({'.eq.b1.freq':.25,'.eq.b1.q':.6,'.dyn.attack':.37}));
  assert.equal(result.entries.length,3);assert.equal(result.recognized,3);
  assert.deepEqual(result.families,['EQ','DYNAMICS']);
  assert.ok(!('actions' in result));
});
test('inspector rejeita injeções, nomes desconhecidos e valores não normalizados',()=>{
  assert.throws(()=>inspectPreset('{garbage'),/JSON/);
  assert.throws(()=>inspectPreset('{"constructor":1}'),/Chave/);
  assert.throws(()=>inspectPreset('{".eq.b1.freq":5}'),/intervalo/);
  assert.throws(()=>inspectPreset('[]'),/Estrutura/);
  assert.throws(()=>inspectPreset(JSON.stringify({'.dyn.attack':'code'})),/Valor/);
});
test('mapa de strings de protocolo não ativa comunicação real',()=>{
  const s=createInitialState();
  assert.equal(s.mode,'SIMULATOR');
  assert.ok(FIRMWARE_PROFILE.observedProtocolStrings.includes('SETD^'));
  assert.ok(FIRMWARE_PROFILE.limitations.some(x=>x.includes('não foram validadas')));
});

test('envios FX simulados são persistidos com limites',()=>{
  const s=createInitialState();const channels=[...s.channels[0].fx];channels[0]=-10;channels[1]=20;
  const next=updateChannel(s,1,{fx:channels});
  assert.deepEqual(next.channels[0].fx,[-10,10,-60,-60]);
  assert.ok(isValidState(next));
});
