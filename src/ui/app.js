import {
  createInitialState, isValidState, updateChannel, setMaster, saveScene, recallScene,
  deleteScene, executeActions, simulatedMeter, dbToMeterPercent, clamp
} from '../core/mixer.js';
import { planCommand } from '../core/commands.js';

const root = document.getElementById('app');
const storage = window.aquilesStorage || {
  async load() { try { return JSON.parse(localStorage.getItem('aquiles-demo')); } catch { return null; } },
  async save(data) { localStorage.setItem('aquiles-demo', JSON.stringify(data)); }
};
let state = createInitialState();
let tab = 'mixer', bank = 0, selected = 15, chat = [], pending = null;
let undoStack = [], redoStack = [], saveQueue = Promise.resolve(), toastHandle;
const h = x => String(x ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dt = iso => new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const db = v => (v > 0 ? '+' : '') + (+v).toFixed(1) + ' dB';
const icon = (name) => {
  const paths = {
    mixer:'<path d="M4 4v16M12 4v16M20 4v16"/><rect x="1" y="7" width="6" height="5" rx="1"/><rect x="9" y="12" width="6" height="5" rx="1"/><rect x="17" y="6" width="6" height="5" rx="1"/>',
    channel:'<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5 5l14 14"/>',
    scenes:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 3v18M3 10h18"/>',
    ai:'<path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M19 5l-3 3M8 16l-3 3"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.mixer}</svg>`;
};
const navItems = [['mixer','Mixer'],['channel','Channel Edit'],['scenes','Scenes'],['ai','Aquiles IA'],['settings','Configurações']];
function pushHistory() { undoStack.push(structuredClone(state)); if (undoStack.length>40) undoStack.shift(); redoStack = []; }
function persist() {
  const snapshot = structuredClone(state);
  saveQueue = saveQueue.catch(()=>{}).then(()=>storage.save(snapshot)).catch(err=>notify('Falha ao salvar: '+err.message,true));
}
function commit(next, opts={}) {
  if (!isValidState(next)) throw new Error('Estado inválido detectado');
  if (!opts.skipHistory) pushHistory();
  state = next; persist(); if (opts.render !== false) render();
}
function notify(text,error=false) {
  document.querySelector('.toast')?.remove();
  const el=document.createElement('div'); el.className=`toast ${error?'error':''}`;el.textContent=text;
  document.body.appendChild(el); clearTimeout(toastHandle); toastHandle=setTimeout(()=>el.remove(),3500);
}
function header() {
  const titles={mixer:'Mixer de 24 canais',channel:'Processamento de canal',scenes:'Cenas e presets',ai:'Assistente Aquiles',settings:'Configurações'};
  return `<header class="topbar"><div><div class="head-kicker">CENA PRODUÇÕES · DIGITAL AUDIO</div><h1>${titles[tab]}</h1></div>
    <div class="top-actions"><span class="pill sim"><span class="led"></span> SIMULADOR OFFLINE</span><span class="pill warn">MESA REAL DESCONECTADA</span></div></header>`;
}
function sidebar() {
  return `<aside class="sidebar"><div class="brand"><div class="brandmark">A<span>Q</span></div><div><div class="brandtitle">AQUILES</div><div class="brandsub">INTELLIGENT MIX</div></div></div>
  <div class="sidecaption">CONSOLE</div>${navItems.map(([key,label])=>`<button class="nav ${key===tab?'active':''}" data-action="tab" data-tab="${key}" title="${label}" aria-current="${key===tab?'page':'false'}">${icon(key)}<span>${label}</span></button>`).join('')}
  <div class="side-spacer"></div><div class="side-card"><b><span class="led"></span> Ambiente seguro</b><small>Modo de simulação. Nenhum comando é enviado à Soundcraft física.</small></div>
  <div class="sidebar-footer">AQUILES AI v0.1.0<br/>© CENA PRODUÇÕES</div></aside>`;
}
function shell(body) {
  root.innerHTML = `<div class="shell">${sidebar()}<div class="workspace">${header()}<main class="content">${body}<div class="footer-note">AQUILES AI v0.1.0 · SIMULAÇÃO · Software independente, não afiliado à Soundcraft. Dados VU sintéticos.</div></main></div></div>`;
}
function stats() {
  const muted=state.channels.filter(c=>c.muted).length;
  return `<div class="stat-grid">
    <div class="stat"><div class="stat-label">Canais disponíveis</div><div class="stat-value">24 <span style="font-size:12px;color:#6e7a89">CH</span></div><div class="stat-desc">Inputs virtuais</div></div>
    <div class="stat"><div class="stat-label">Canais mutados</div><div class="stat-value">${muted} <span style="font-size:12px;color:#6e7a89">/ 24</span></div><div class="stat-desc">Mutes do simulador</div></div>
    <div class="stat"><div class="stat-label">Cenas armazenadas</div><div class="stat-value">${state.scenes.length.toString().padStart(2,'0')}</div><div class="stat-desc">Salvas localmente</div></div>
    <div class="stat"><div class="stat-label">Motor Aquiles</div><div class="stat-value" style="font-size:20px;color:#54d6ab;margin-top:12px">OFFLINE</div><div class="stat-desc">Comandos determinísticos</div></div>
  </div>`;
}
function strip(c,master=false) {
  const value = c.faderDb;
  return `<div class="strip ${master?'master':''} ${selected===c.id && !master?'selected':''}" data-ch="${c.id}">
    <div class="ch-number">${master?'STEREO MASTER':`INPUT ${String(c.id).padStart(2,'0')}`}</div>
    ${master?`<div class="strip-name" style="padding:12px 0 4px">${h(c.name)}</div>`:`<button class="strip-name btn ghost small" style="background:transparent;border:none;max-width:100%;padding:12px 0 4px" data-action="select" data-id="${c.id}" title="Editar ${h(c.name)}">${h(c.name)}</button>`}
    <div class="strip-color" style="background:${master?'#fa6371':h(c.color)}"></div>
    <div class="db-val" data-db-for="${c.id}">${db(value)}</div>
    <div class="fader-area"><div class="vu-track"><div class="vu-fill" data-meter-id="${c.id}"></div></div>
    <input class="fader" type="range" min="-60" max="10" step="0.5" value="${value}" data-slider="fader" data-id="${c.id}" aria-label="Fader ${h(c.name)}"/></div>
    <div class="strip-buttons"><button class="mini-btn ${c.muted?'muted':''}" data-action="mute" data-id="${c.id}" aria-pressed="${c.muted}">M</button>
    ${master?'':`<button class="mini-btn ${c.solo?'solo':''}" data-action="solo" data-id="${c.id}" aria-pressed="${c.solo}">S</button>`}</div>
  </div>`;
}
function renderMixer() {
  const list = state.channels.slice(bank*12,bank*12+12);
  return `<div class="hero-line"><div><h2 class="section-title">CONSOLE VIRTUAL</h2><div class="section-sub">Simulador Ui24R · 24 entradas · 8 AUX · 4 FX modelados</div></div>
  <div class="row-actions"><button class="btn ghost" data-action="undo" ${!undoStack.length?'disabled':''}>↶ Desfazer</button><button class="btn ghost" data-action="redo" ${!redoStack.length?'disabled':''}>↷ Refazer</button>
  <button class="btn primary" data-action="quick-scene">+ Salvar cena</button></div></div>
  ${stats()}<section class="mix-panel"><div class="panel-heading"><b>CHANNEL STRIPS <span style="color:#758190;font-weight:500">/ BANCO ${bank+1}</span></b><div class="bank-tabs"><button class="bank-tab ${bank===0?'active':''}" data-action="bank" data-bank="0">CH 01–12</button><button class="bank-tab ${bank===1?'active':''}" data-action="bank" data-bank="1">CH 13–24</button></div></div>
  <div class="mixer-scroll"><div class="mixer-bay">${list.map(c=>strip(c)).join('')}${strip({id:'master',name:'MASTER L/R',color:'#f35d65',...state.master},true)}</div></div></section>
  <div class="channel-bottom"><span>● Controles virtuais · Clique no nome de um canal para editar</span><span>MASTER ${db(state.master.faderDb)}</span></div>
  <div class="warning-card" style="margin-top:18px"><strong>SIMULAÇÃO ATIVA</strong> — Os medidores VU são sintéticos. Este aplicativo ainda não se conecta à mesa, não captura áudio e não altera o som real.</div>`;
}
function eqSVG(c) {
  const bands=[c.eq.low,c.eq.lowMid,c.eq.highMid,c.eq.high];
  const centers=[.13,.40,.65,.88];
  const points=Array.from({length:91},(_,i)=>{const x=i/90, gain=bands.reduce((sum,gain,j)=>sum+gain*Math.exp(-Math.pow((x-centers[j])/.13,2)),0);return `${(x*560).toFixed(1)},${(75-gain*3).toFixed(1)}`;}).join(' ');
  return `<svg class="eq-display" viewBox="0 0 560 150" preserveAspectRatio="none" role="img" aria-label="Curva simulada de equalização do canal">
    <g stroke="#2b3c4b" stroke-width="1">${[0,1,2,3,4].map(i=>`<line x1="0" y1="${i*37.5}" x2="560" y2="${i*37.5}"/>`).join('')}${[0,1,2,3,4,5,6,7].map(i=>`<line x1="${i*80}" y1="0" x2="${i*80}" y2="150"/>`).join('')}</g>
    <line x1="0" y1="75" x2="560" y2="75" stroke="#7a8895" stroke-dasharray="5 5"/><polyline points="${points}" fill="none" stroke="#f1575c" stroke-width="3" stroke-linejoin="round"/>${centers.map((x,j)=>`<circle cx="${x*560}" cy="${75-bands[j]*3}" r="5" fill="#e9d3d5" stroke="#f1575c" stroke-width="2"/>`).join('')}
  </svg>`;
}
function parameter(id,label,value,min,max,step=1,unit='') {
  return `<div class="parameter"><label for="${id}">${label}</label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-slider="parameter" data-param="${id}" aria-label="${label}"/><output data-output="${id}">${value}${unit}</output></div>`;
}
function renderChannel() {
  const c=state.channels[selected-1];
  return `<div class="section-body"><div class="hero-line"><div><h2 class="section-title">PROCESSAMENTO / CH ${String(c.id).padStart(2,'0')}</h2><div class="section-sub">Parâmetros locais, ainda sem processamento DSP ou comunicação com a mesa</div></div>
  <select class="field" style="width:225px" data-select="channel">${state.channels.map(x=>`<option value="${x.id}" ${x.id===selected?'selected':''}>${String(x.id).padStart(2,'0')} · ${h(x.name)}</option>`).join('')}</select></div>
  <div class="channel-head"><div class="param-card"><label class="form-label" for="channel-name">NOME DO CANAL</label><input class="field" id="channel-name" maxlength="36" value="${h(c.name)}" data-text="channel-name"/></div>
  <div class="param-card"><label class="form-label">FADER</label><div class="stat-value" style="font-size:22px">${db(c.faderDb)}</div><div class="parameter"><input type="range" min="-60" max="10" step="0.5" value="${c.faderDb}" data-slider="fader" data-id="${c.id}" style="width:100%;accent-color:#ee565e"/></div></div>
  <div class="param-card"><label class="form-label">STATUS</label><div class="row-actions" style="margin-top:13px"><button class="btn ${c.muted?'danger':''}" data-action="mute" data-id="${c.id}">${c.muted?'MUTADO':'MUTE OFF'}</button><button class="btn ${c.solo?'primary':''}" data-action="solo" data-id="${c.id}">${c.solo?'SOLO ON':'SOLO OFF'}</button></div></div></div>
  <div class="two-col"><div class="param-card"><h3 class="param-title">EQUALIZADOR PARAMÉTRICO · SIMULADO</h3>${eqSVG(c)}
    ${parameter('low','LOW',c.eq.low,-15,15,.5,' dB')}${parameter('lowMid','LOW MID',c.eq.lowMid,-15,15,.5,' dB')}${parameter('highMid','HIGH MID',c.eq.highMid,-15,15,.5,' dB')}${parameter('high','HIGH',c.eq.high,-15,15,.5,' dB')}
  </div><div style="display:grid;gap:15px"><div class="param-card"><h3 class="param-title">FILTRO E POSICIONAMENTO</h3>${parameter('hpf','HPF',c.hpf,20,400,5,' Hz')}${parameter('pan','PAN',c.pan,-100,100,1,'')}</div>
  <div class="param-card"><h3 class="param-title">DINÂMICA · PARÂMETROS VIRTUAIS</h3><div class="row-actions"><button class="btn small ${c.comp.enabled?'primary':''}" data-action="comp-toggle">COMP ${c.comp.enabled?'ON':'OFF'}</button><button class="btn small ${c.gate.enabled?'primary':''}" data-action="gate-toggle">GATE ${c.gate.enabled?'ON':'OFF'}</button></div>
  ${parameter('threshold','COMP THR',c.comp.threshold,-60,0,1,' dB')}${parameter('ratio','RATIO',c.comp.ratio,1,20,.5,':1')}${parameter('gateThreshold','GATE THR',c.gate.threshold,-80,0,1,' dB')}</div></div></div>
  <div class="param-card" style="margin-top:15px"><h3 class="param-title">AUX SENDS · SIMULAÇÃO</h3><div class="two-col">${c.aux.map((value,i)=>parameter(`aux${i+1}`,`AUX ${i+1}`,value,-60,10,.5,' dB')).join('')}</div></div></div>`;
}
function renderScenes() {
  return `<div class="section-body"><div class="hero-line"><div><h2 class="section-title">BIBLIOTECA DE CENAS</h2><div class="section-sub">Snapshots locais dos 24 canais e do master simulado</div></div><div class="row-actions"><button class="btn" data-action="export">⇩ Exportar JSON</button><button class="btn" data-action="import">⇧ Importar JSON</button><input type="file" accept="application/json,.json" id="scene-file" hidden/></div></div>
  <div class="surface card-pad" style="margin-bottom:19px"><label class="form-label" for="scene-name">CRIAR CENA</label><div class="row-actions"><input id="scene-name" class="field" style="flex:1;min-width:200px" placeholder="Ex.: Passagem de Som — Sexta" maxlength="60"/><button class="btn primary" data-action="save-scene">+ Salvar estado atual</button></div></div>
  ${state.scenes.length ? `<div class="scene-list">${state.scenes.map(s=>`<div class="scene"><h3>${h(s.name)}</h3><div class="scene-meta">${dt(s.createdAt)} · ${s.channels.length} canais · local</div><div class="scene-actions"><button class="btn primary small" data-action="recall" data-scene="${h(s.id)}">Restaurar</button><button class="btn danger small" data-action="delete-scene" data-scene="${h(s.id)}">Excluir</button></div></div>`).join('')}</div>`:'<div class="surface empty">Nenhuma cena salva ainda. Crie sua primeira cena acima.</div>'}
  <div class="warning-card" style="margin-top:18px"><strong>ATENÇÃO:</strong> restaurar cenas altera apenas o simulador. Não há integração com os arquivos de show internos da Soundcraft.</div></div>`;
}
function renderChat() {
  const msgs=chat.map(m=>`<div class="message ${m.role==='user'?'user':''}">${m.role==='assistant'?'<small>AQUILES · OFFLINE</small>':''}${h(m.text)}${m.pending?`<div class="action-preview"><p>${h(m.pending.description)}</p><div class="row-actions"><button class="btn small primary" data-action="approve">Aprovar no simulador</button><button class="btn small" data-action="reject">Cancelar</button></div></div>`:''}</div>`).join('');
  return `<div class="chat-layout"><section class="surface chat"><div class="panel-heading"><b>✦ AQUILES IA</b><span class="pill sim">MODO DETERMINÍSTICO</span></div><div class="chat-messages" id="chat-messages">${msgs}</div>
  <div class="suggestions"><button class="btn ghost" data-action="example" data-example="Aumenta o canal 15 em 2 dB">+2 dB vocal</button><button class="btn ghost" data-action="example" data-example="Muta o canal 10">Mute guitarra</button><button class="btn ghost" data-action="example" data-example="Salva cena Passagem de Som">Salvar cena</button><button class="btn ghost" data-action="example" data-example="Analisa os níveis">Analisar níveis</button></div>
  <form id="chat-form" class="chat-entry"><input class="field" id="chat-input" placeholder="Peça um ajuste ao Aquiles..." autocomplete="off" maxlength="300" aria-label="Comando para o Aquiles"/><button class="btn primary" type="submit">Enviar ➜</button></form></section>
  <section class="surface card-pad"><h3 class="param-title">ESTADO DA INTELIGÊNCIA</h3><div class="status-box"><span class="led"></span> Módulo offline ativo<br/>Interpretador local de comandos em português.<br/>Nenhuma conexão com IA na nuvem.</div>
  <h3 class="param-title" style="margin-top:25px">LIMITES DE SEGURANÇA</h3><div class="settings-list"><div class="setting-row"><div><b>Confirmação obrigatória</b><span>Antes de qualquer ação de IA</span></div><span class="pill sim">ATIVA</span></div><div class="setting-row"><div><b>Controle do master</b><span>Bloqueado para o Aquiles</span></div><span class="pill">OFF</span></div><div class="setting-row"><div><b>Acesso à mesa física</b><span>Sem biblioteca ou conexão ativa</span></div><span class="pill">OFF</span></div></div>
  <p class="footer-note">Esta versão usa regras locais, não um modelo de linguagem generativo. Medições de áudio real e OmniRouter serão módulos futuros.</p></section></div>`;
}
function renderSettings() {
  return `<div class="section-body"><div class="hero-line"><div><h2 class="section-title">CENTRAL DE CONFIGURAÇÕES</h2><div class="section-sub">Arquitetura offline-first · macOS · segurança para eventos</div></div></div>
  <div class="surface card-pad"><h3 class="param-title">MODO DE OPERAÇÃO</h3><div class="settings-list">
    <div class="setting-row"><div><b><span class="led"></span> SIMULATOR</b><span>Habilitado. Cenas e comandos somente locais.</span></div><span class="pill sim">EM USO</span></div>
    <div class="setting-row"><div><b>REAL READ ONLY</b><span>Futuro: observar o estado da Ui24R pelo Wi-Fi, sem enviar comandos de escrita.</span></div><button class="btn small" disabled>Indisponível</button></div>
    <div class="setting-row"><div><b>REAL CONTROL</b><span>Futuro: operar a mesa com aprovação e limites.</span></div><button class="btn small" disabled>Bloqueado</button></div>
  </div></div>
  <div class="surface card-pad" style="margin-top:17px"><h3 class="param-title">CONEXÃO FUTURA</h3><div class="two-col"><div><label class="form-label">ENDEREÇO PADRÃO DO HOTSPOT</label><input class="field" value="10.10.1.1" readonly/></div><div><label class="form-label">ADAPTADOR</label><input class="field" value="Soundcraft Ui24R · a implementar" readonly/></div></div><p class="footer-note">O app não acessa, descobre ou verifica a rede da mesa nesta versão. O IP indicado é informativo.</p></div>
  <div class="surface card-pad" style="margin-top:17px"><h3 class="param-title">DADOS E SEGURANÇA</h3><div class="settings-list"><div class="setting-row"><div><b>Armazenamento de cenas</b><span>Application Support do macOS (Electron) / localStorage (prévia web)</span></div><span class="pill sim">LOCAL</span></div>
  <div class="setting-row"><div><b>OmniRouter</b><span>Integração não habilitada na versão 0.1</span></div><span class="pill">OFFLINE</span></div>
  <div class="setting-row"><div><b>Limpar dados do simulador</b><span>Apaga cenas e restaura os 24 canais para valores iniciais</span></div><button class="btn danger small" data-action="reset">Restaurar padrão</button></div></div></div>
  <div class="surface card-pad" style="margin-top:17px"><h3 class="param-title">ÚLTIMAS ALTERAÇÕES</h3><div class="activity">${state.audit.length?state.audit.slice(-9).reverse().map(a=>`<div class="activity-item"><time>${new Date(a.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time><span>${h(a.actor)} · ${h(a.description)}</span></div>`).join(''):'<div class="section-sub">Nenhuma alteração registrada nesta sessão.</div>'}</div></div></div>`;
}
function render() {
  const body={mixer:renderMixer,channel:renderChannel,scenes:renderScenes,ai:renderChat,settings:renderSettings}[tab]();
  shell(body);
  if (tab==='ai') { const list=document.getElementById('chat-messages'); if(list)list.scrollTop=list.scrollHeight; }
  animateMeters();
}
function animateMeters() {
  const now=Date.now();
  document.querySelectorAll('[data-meter-id]').forEach(el=>{
    const id=el.dataset.meterId;
    const c=id==='master'?{id:99,...state.master}:state.channels[Number(id)-1];
    if (c) el.style.height=`${dbToMeterPercent(simulatedMeter(c,now))}%`;
  });
}
function doUndo() { if (!undoStack.length) return; redoStack.push(structuredClone(state));state=undoStack.pop();persist();render(); }
function doRedo() { if (!redoStack.length) return; undoStack.push(structuredClone(state));state=redoStack.pop();persist();render(); }
function sendCommand(value) {
  const message=String(value||'').trim(); if (!message) return;
  chat.push({role:'user',text:message});
  const proposal=planCommand(message,state);
  pending=proposal.actions.length?proposal:null;
  chat.push({role:'assistant',text:proposal.reply,pending});
  if(chat.length>36) chat=chat.slice(-36);
  render();
}
async function importScenes(file) {
  if (!file) return;
  try {
    if (file.size>2_000_000) throw new Error('Arquivo muito grande (limite de 2 MB)');
    const content=JSON.parse(await file.text());
    if(content.version!==1 || !Array.isArray(content.scenes) || content.scenes.length>200) throw new Error('Formato de cenas incompatível');
    const valid=content.scenes.every(s=>s && typeof s.id==='string' && typeof s.name==='string' && s.name.length<=60 &&
      isValidState({...state,channels:s.channels,master:s.master}));
    if(!valid) throw new Error('Arquivo contém cenas inválidas');
    const ids=new Set(); const scenes=content.scenes.map(s=>{let id=s.id;if(ids.has(id))id=crypto.randomUUID();ids.add(id);return {id,name:s.name,createdAt:s.createdAt||new Date().toISOString(),channels:s.channels,master:s.master};});
    commit({...state,scenes}); notify('Cenas importadas com sucesso');
  } catch(e) { notify('Falha ao importar: '+e.message,true); }
}
function exportScenes() {
  const data={version:1,scenes:state.scenes};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='aquiles-cenas.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);
  notify('Exportação de cenas preparada');
}
function confirmLocal(message) { return window.confirm(message); }
function runAction(action,btn) {
  const id=Number(btn.dataset.id);
  try {
    switch(action) {
      case 'tab': tab=btn.dataset.tab;render();break;
      case 'bank': bank=Number(btn.dataset.bank);render();break;
      case 'select': selected=id;tab='channel';render();break;
      case 'mute':
        if (btn.dataset.id==='master') commit(setMaster(state,{muted:!state.master.muted}));
        else commit(updateChannel(state,id,{muted:!state.channels[id-1].muted})); break;
      case 'solo': commit(updateChannel(state,id,{solo:!state.channels[id-1].solo}));break;
      case 'comp-toggle': {const c=state.channels[selected-1];commit(updateChannel(state,selected,{comp:{...c.comp,enabled:!c.comp.enabled}}));break;}
      case 'gate-toggle': {const c=state.channels[selected-1];commit(updateChannel(state,selected,{gate:{...c.gate,enabled:!c.gate.enabled}}));break;}
      case 'quick-scene':tab='scenes';render();document.getElementById('scene-name')?.focus();break;
      case 'save-scene':{const title=document.getElementById('scene-name').value;commit(saveScene(state,title));notify('Cena salva');break;}
      case 'recall': if(confirmLocal('Restaurar esta cena no SIMULADOR? Os parâmetros virtuais atuais serão substituídos.')) {commit(recallScene(state,btn.dataset.scene));notify('Cena restaurada');}break;
      case 'delete-scene': if(confirmLocal('Excluir esta cena local?')) {commit(deleteScene(state,btn.dataset.scene));notify('Cena excluída');}break;
      case 'import':document.getElementById('scene-file').click();break;
      case 'export':exportScenes();break;
      case 'approve': if(pending){ const proposed=pending;commit(executeActions(state,proposed.actions)); pending=null;
        const last=chat.findLast(m=>m.pending);if(last)last.pending=null;chat.push({role:'assistant',text:`Executado no simulador: ${proposed.description}. Nenhuma alteração real foi enviada.`});render();}break;
      case 'reject':pending=null; { const last=chat.findLast(m=>m.pending);if(last)last.pending=null;}chat.push({role:'assistant',text:'Ação cancelada. Nada foi alterado.'});render();break;
      case 'example': tab='ai';sendCommand(btn.dataset.example);break;
      case 'undo':doUndo();break;
      case 'redo':doRedo();break;
      case 'reset':if(confirmLocal('Apagar cenas e restaurar todos os parâmetros do simulador?')){commit(createInitialState());undoStack=[];redoStack=[];notify('Simulador restaurado');}break;
    }
  } catch(e) {notify(e.message,true);}
}
document.addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(btn&&!btn.disabled)runAction(btn.dataset.action,btn);});
document.addEventListener('submit',e=>{if(e.target.id==='chat-form'){e.preventDefault();const input=document.getElementById('chat-input');sendCommand(input.value);}});
document.addEventListener('input',e=>{
  const t=e.target;if(t.dataset.slider==='fader'){
    const target=document.querySelector(`[data-db-for="${t.dataset.id}"]`);if(target)target.textContent=db(+t.value);
  } else if(t.dataset.slider==='parameter'){
    const out=document.querySelector(`[data-output="${t.dataset.param}"]`);if(out)out.textContent=`${t.value}${t.dataset.param.startsWith('aux')||['low','lowMid','highMid','high','threshold','gateThreshold'].includes(t.dataset.param)?' dB':t.dataset.param==='hpf'?' Hz':t.dataset.param==='ratio'?':1':''}`;
  }
});
document.addEventListener('change',e=>{
  const t=e.target;
  try {
    if(t.dataset.slider==='fader'){
      if(t.dataset.id==='master')commit(setMaster(state,{faderDb:+t.value}));else commit(updateChannel(state,+t.dataset.id,{faderDb:+t.value}));
    } else if(t.dataset.slider==='parameter'){
      const p=t.dataset.param,v=+t.value,c=state.channels[selected-1];
      if(['low','lowMid','highMid','high'].includes(p))commit(updateChannel(state,selected,{eq:{[p]:v}}));
      else if(['hpf','pan'].includes(p))commit(updateChannel(state,selected,{[p]:v}));
      else if(p==='threshold'||p==='ratio')commit(updateChannel(state,selected,{comp:{...c.comp,[p]:v}}));
      else if(p==='gateThreshold')commit(updateChannel(state,selected,{gate:{...c.gate,threshold:v}}));
      else if(/^aux[1-8]$/.test(p)){const a=[...c.aux];a[Number(p.slice(3))-1]=v;commit(updateChannel(state,selected,{aux:a}));}
    } else if(t.dataset.select==='channel'){ selected=+t.value;render();}
    else if(t.dataset.text==='channel-name') commit(updateChannel(state,selected,{name:t.value}));
    else if(t.id==='scene-file') importScenes(t.files[0]);
  }catch(err){notify(err.message,true);render();}
});
async function init() {
  try {const loaded=await storage.load();if(isValidState(loaded))state={...loaded,mode:'SIMULATOR'};else if(loaded)notify('Dados locais inválidos: iniciado estado novo',true);}
  catch(e){console.warn('Não foi possível carregar o estado local:',e);notify('Falha ao ler dados locais',true);}
  chat=[{role:'assistant',text:'Olá! Sou o Aquiles, assistente de mixagem da CENA. Estamos em ambiente 100% simulado e offline. Posso ajustar faders, mutes e salvar cenas. O que deseja testar?'}];
  render();setInterval(animateMeters,115);
}
init();
