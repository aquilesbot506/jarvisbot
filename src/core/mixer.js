/** Aquiles AI simulator: offline only. No mixer network client is loaded by this module. */
export const INPUT_COUNT = 24;
export const AUX_COUNT = 8;
export const FADER_MIN = -60;
export const FADER_MAX = 10;
const DEFAULT_NAMES = [
  'Bumbo', 'Caixa', 'Chimbal', 'Tom 1', 'Tom 2', 'Surdo', 'Over L', 'Over R',
  'Baixo', 'Guitarra L', 'Guitarra R', 'Violão', 'Teclado L', 'Teclado R',
  'Voz Principal', 'Voz 2', 'Voz 3', 'Voz 4', 'Playback L', 'Playback R',
  'Ambiente L', 'Ambiente R', 'Talkback', 'Reserva'
];
const COLORS = ['#e75e5e','#ec854f','#e5aa53','#aabb64','#54b6ad','#4fa2d6','#8e8be8','#ce7bce'];
export const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(+value) ? +value : min));
export const createChannel = (id) => ({
  id, name: DEFAULT_NAMES[id - 1] || `Canal ${id}`, color: COLORS[(id - 1) % COLORS.length],
  faderDb: -12, muted: false, solo: false, pan: 0, hpf: 80,
  eq: { low: 0, lowMid: 0, highMid: 0, high: 0 },
  comp: { enabled: false, threshold: -18, ratio: 3 },
  gate: { enabled: false, threshold: -45 },
  aux: Array(AUX_COUNT).fill(-60), fx: Array(4).fill(-60)
});
export const createInitialState = () => ({
  version: 1, mode: 'SIMULATOR', channels: Array.from({ length: INPUT_COUNT }, (_, i) => createChannel(i + 1)),
  master: { faderDb: -6, muted: false }, scenes: [], audit: [], updatedAt: new Date().toISOString()
});
export function isValidState(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.channels) ||
      state.channels.length !== INPUT_COUNT || !Array.isArray(state.scenes) ||
      state.scenes.length > 200 || !state.master ||
      !Number.isFinite(state.master.faderDb) || state.master.faderDb < FADER_MIN ||
      state.master.faderDb > FADER_MAX || typeof state.master.muted !== 'boolean') return false;
  return state.channels.every((c, i) => c && c.id === i + 1 &&
    typeof c.name === 'string' && c.name.length <= 36 && typeof c.color === 'string' &&
    Number.isFinite(c.faderDb) && c.faderDb >= FADER_MIN && c.faderDb <= FADER_MAX &&
    typeof c.muted === 'boolean' && typeof c.solo === 'boolean' &&
    Number.isFinite(c.pan) && c.pan >= -100 && c.pan <= 100 &&
    Number.isFinite(c.hpf) && c.hpf >= 20 && c.hpf <= 400 &&
    c.eq && ['low','lowMid','highMid','high'].every(k => Number.isFinite(c.eq[k]) && c.eq[k] >= -15 && c.eq[k] <= 15) &&
    c.comp && typeof c.comp.enabled === 'boolean' && Number.isFinite(c.comp.threshold) && Number.isFinite(c.comp.ratio) &&
    c.gate && typeof c.gate.enabled === 'boolean' && Number.isFinite(c.gate.threshold) &&
    Array.isArray(c.aux) && c.aux.length === AUX_COUNT && c.aux.every(v=>Number.isFinite(v) && v >= FADER_MIN && v <= FADER_MAX) &&
    Array.isArray(c.fx) && c.fx.length === 4 && c.fx.every(v=>Number.isFinite(v) && v >= FADER_MIN && v <= FADER_MAX));
}

function changed(state, actor, description) {
  const audit = [...state.audit, { at: new Date().toISOString(), actor, description }].slice(-100);
  return { ...state, audit, updatedAt: new Date().toISOString() };
}
export function updateChannel(state, id, patch, actor='Operador') {
  const index = Number(id) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= INPUT_COUNT) throw new Error('Canal inválido');
  const current = state.channels[index];
  const next = {...current};
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'faderDb') next.faderDb = clamp(value, FADER_MIN, FADER_MAX);
    else if (key === 'muted' || key === 'solo') next[key] = Boolean(value);
    else if (key === 'pan') next.pan = clamp(value, -100, 100);
    else if (key === 'hpf') next.hpf = clamp(value, 20, 400);
    else if (key === 'name') next.name = String(value).slice(0, 36).trim() || current.name;
    else if (key === 'eq' && value && typeof value === 'object') {
      next.eq = {...current.eq};
      for (const band of ['low','lowMid','highMid','high']) if (band in value) next.eq[band] = clamp(value[band], -15, 15);
    } else if (key === 'aux' && Array.isArray(value) && value.length === AUX_COUNT) next.aux = value.map(v=>clamp(v,FADER_MIN,FADER_MAX));
    else if (key === 'comp' && value && typeof value === 'object') next.comp = { ...current.comp, enabled: Boolean(value.enabled ?? current.comp.enabled), threshold: clamp(value.threshold ?? current.comp.threshold, -60, 0), ratio: clamp(value.ratio ?? current.comp.ratio, 1, 20) };
    else if (key === 'gate' && value && typeof value === 'object') next.gate = { ...current.gate, enabled: Boolean(value.enabled ?? current.gate.enabled), threshold: clamp(value.threshold ?? current.gate.threshold, -80, 0) };
    else throw new Error(`Parâmetro não permitido: ${key}`);
  }
  return changed({...state, channels: state.channels.map((c,i) => i === index ? next : c)}, actor, `CH ${id}: ${Object.keys(patch).join(', ')}`);
}
export function setMaster(state, patch, actor='Operador') {
  const allowed = Object.keys(patch).every(k => ['faderDb','muted'].includes(k));
  if (!allowed) throw new Error('Parâmetro master não permitido');
  return changed({...state, master: {
    faderDb: patch.faderDb === undefined ? state.master.faderDb : clamp(patch.faderDb,FADER_MIN,FADER_MAX),
    muted: patch.muted === undefined ? state.master.muted : Boolean(patch.muted)
  }},actor,'Master alterado manualmente');
}
export function saveScene(state, name) {
  const title = String(name || '').trim().slice(0, 60);
  if (!title) throw new Error('Informe o nome da cena');
  if (state.scenes.length >= 200) throw new Error('Limite de 200 cenas atingido');
  const scene = { id: globalThis.crypto?.randomUUID?.() || `scene-${Date.now()}`, name: title,
    createdAt: new Date().toISOString(), channels: structuredClone(state.channels), master: { ...state.master } };
  return changed({...state,scenes:[scene,...state.scenes]}, 'Operador', `Cena salva: ${title}`);
}
export function recallScene(state, sceneId) {
  const scene = state.scenes.find(s => s.id === sceneId);
  if (!scene || !Array.isArray(scene.channels) || scene.channels.length !== INPUT_COUNT) throw new Error('Cena não encontrada ou inválida');
  const next = {...state,channels:structuredClone(scene.channels),master: {...scene.master}};
  if (!isValidState(next)) throw new Error('Cena contém dados inválidos');
  return changed(next,'Operador',`Cena restaurada: ${scene.name}`);
}
export function deleteScene(state, sceneId) {
  return changed({...state, scenes:state.scenes.filter(s=>s.id!==sceneId)},'Operador','Cena excluída');
}
export function executeActions(state, actions, actor='Aquiles') {
  if (!Array.isArray(actions) || actions.length > INPUT_COUNT) throw new Error('Plano excede o limite de ações');
  let current = state;
  for (const action of actions) {
    if (action.type === 'SET_FADER') current = updateChannel(current,action.channelId,{faderDb:action.value},actor);
    else if (action.type === 'SET_MUTE') current = updateChannel(current,action.channelId,{muted:action.value},actor);
    else if (action.type === 'SAVE_SCENE') current = saveScene(current,action.name);
    else throw new Error('Ação não autorizada para Aquiles');
  }
  return current;
}
/** Signals are deliberately synthetic: never interpret these numbers as acoustic measurements. */
export function simulatedMeter(channel, timeMs=Date.now()) {
  if (channel.muted || channel.faderDb <= FADER_MIN) return -60;
  const wave = Math.sin(timeMs/190 + channel.id) * 4 + Math.sin(timeMs/59 + channel.id*3) * 2;
  return clamp(-19 + channel.faderDb * .45 + wave + (channel.id % 4) * 1.4, -60, 3);
}
export function dbToMeterPercent(db) { return clamp((db + 60) / 63 * 100, 0, 100); }
