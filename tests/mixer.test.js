import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, updateChannel, setMaster, saveScene, recallScene, deleteScene,
  executeActions, isValidState, simulatedMeter, dbToMeterPercent
} from '../src/core/mixer.js';
import { planCommand, resolveChannel } from '../src/core/commands.js';

test('simulador começa com 24 canais e sem conexão real',()=>{
  const state=createInitialState();
  assert.equal(state.channels.length,24);
  assert.equal(state.mode,'SIMULATOR');
  assert.equal(state.channels[14].name,'Voz Principal');
  assert.equal(state.scenes.length,0);
  assert.ok(isValidState(state));
});
test('fader e EQ aplicam limites válidos',()=>{
  const first=createInitialState();
  const state=updateChannel(first,4,{faderDb:500,eq:{low:50}});
  assert.equal(state.channels[3].faderDb,10);
  assert.equal(state.channels[3].eq.low,15);
  assert.equal(first.channels[3].faderDb,-12);
  assert.equal(first.channels[3].eq.low,0);
});
test('IDs de canal inválidos são rejeitados',()=>{
  assert.throws(()=>updateChannel(createInitialState(),25,{muted:true}),/inválido/);
  assert.throws(()=>updateChannel(createInitialState(),0,{muted:true}),/inválido/);
  assert.throws(()=>updateChannel(createInitialState(),1,{phantom:true}),/não permitido/);
});
test('estado de mute e solo independente de master',()=>{
  const a=updateChannel(createInitialState(),7,{muted:true,solo:true});
  assert.equal(a.channels[6].muted,true);
  assert.equal(a.channels[6].solo,true);
  assert.equal(a.master.muted,false);
  const b=setMaster(a,{faderDb:-8});
  assert.equal(b.master.faderDb,-8);
});
test('cenas restauram níveis e mutes',()=>{
  let state=updateChannel(createInitialState(),15,{faderDb:-3,muted:true});
  state=saveScene(state,'Passagem de Som');
  const sceneId=state.scenes[0].id;
  state=updateChannel(state,15,{faderDb:-31,muted:false});
  state=recallScene(state,sceneId);
  assert.equal(state.channels[14].faderDb,-3);
  assert.equal(state.channels[14].muted,true);
  state=deleteScene(state,sceneId);
  assert.equal(state.scenes.length,0);
});
test('resolução reconhece canais e nomes principais',()=>{
  const s=createInitialState();
  assert.equal(resolveChannel('canal 4',s),4);
  assert.equal(resolveChannel('voz principal',s),15);
  assert.equal(resolveChannel('vocal principal',s),15);
  assert.equal(resolveChannel('canal 99',s),null);
});
test('Aquiles planeja aumento em dB sem aplicar antes da aprovação',()=>{
  const before=createInitialState();
  const plan=planCommand('Aquiles, aumenta o canal 15 em 2 dB.',before);
  assert.equal(plan.actions.length,1);
  assert.deepEqual(plan.actions[0],{type:'SET_FADER',channelId:15,value:-10});
  assert.equal(before.channels[14].faderDb,-12);
  const after=executeActions(before,plan.actions);
  assert.equal(after.channels[14].faderDb,-10);
});
test('Aquiles reduz e muta canal específico',()=>{
  const state=createInitialState();
  assert.deepEqual(planCommand('Abaixa o canal 4 em 3 dB',state).actions[0],{type:'SET_FADER',channelId:4,value:-15});
  assert.deepEqual(planCommand('muta o canal 10',state).actions[0],{type:'SET_MUTE',channelId:10,value:true});
  assert.deepEqual(planCommand('desmuta o canal 10',state).actions[0],{type:'SET_MUTE',channelId:10,value:false});
});
test('muta todos exceto voz e bloqueia comando sem unidade',()=>{
  const state=createInitialState();
  const p=planCommand('muta todos menos o canal 15',state);
  assert.equal(p.actions.length,23);
  assert.ok(p.actions.every(a=>a.channelId!==15));
  assert.equal(planCommand('aumenta o canal 5',state).actions.length,0);
});
test('comando de cena salva no simulador',()=>{
  const initial=createInitialState();
  const plan=planCommand('salva cena Minha Passagem',initial);
  assert.equal(plan.actions[0].type,'SAVE_SCENE');
  assert.equal(executeActions(initial,plan.actions).scenes[0].name,'minha passagem');
});
test('Aquiles bloqueia master, phantom, ações arbitrárias e planos grandes',()=>{
  const state=createInitialState();
  assert.throws(()=>executeActions(state,[{type:'SET_MASTER',value:10}]),/não autorizada/);
  assert.throws(()=>executeActions(state,[{type:'PHANTOM',value:true}]),/não autorizada/);
  assert.throws(()=>executeActions(state,Array(25).fill({type:'SET_MUTE',channelId:1,value:true})),/limite/);
});
test('VU é sintético e responde a mute; porcentagem limitada',()=>{
  const state=createInitialState();
  const c=state.channels[0];
  assert.equal(simulatedMeter({...c,muted:true}),-60);
  assert.ok(simulatedMeter(c,1700000000000)<=3);
  assert.equal(dbToMeterPercent(-100),0);
  assert.equal(dbToMeterPercent(100),100);
});
