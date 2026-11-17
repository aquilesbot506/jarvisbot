import { clamp, FADER_MIN, FADER_MAX } from './mixer.js';
/** Offline deterministic Portuguese command parser. This is NOT a generative LLM. */
export const normalizeText = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const aliases = [
  [/^(vocal|voz)( principal| lead)?$/, 'Voz Principal'],
  [/^baixo$/, 'Baixo'], [/^bumbo$/, 'Bumbo'], [/^caixa$/, 'Caixa'],
  [/^guitarra( esquerda| l)?$/, 'Guitarra L'], [/^guitarra( direita| r| 2)$/, 'Guitarra R'],
  [/^violao$/, 'Violão'], [/^teclado( esquerda| l)?$/, 'Teclado L'], [/^teclado( direita| r)?$/, 'Teclado R']
];
export function resolveChannel(text, state) {
  const norm = normalizeText(text);
  const match = norm.match(/\b(?:canal|ch|channel)\s*#?\s*(\d{1,2})\b/);
  if (match) return state.channels[Number(match[1])-1]?.id ?? null;
  const names = state.channels.map(c=>({id:c.id, name:normalizeText(c.name)})).filter(c => norm.includes(c.name)).sort((a,b)=>b.name.length-a.name.length);
  if (names.length) return names[0].id;
  for (const [pattern, name] of aliases) {
    if (pattern.test(norm) || (name === 'Voz Principal' && /\b(?:voz principal|vocal principal|voz lead)\b/.test(norm))) {
      const c = state.channels.find(c=>normalizeText(c.name)===normalizeText(name));
      if (c) return c.id;
    }
  }
  return null;
}
const unknown = (reply) => ({reply, actions:[], description:'Nenhuma ação proposta'});
export function planCommand(message, state) {
  const text = normalizeText(message).replace(/^aquiles[,!: ]+/, '');
  if (!text) return unknown('Pode falar. Exemplo: "abaixa o canal 4 em 3 dB".');
  if (/\b(?:ajuda|comandos|o que voce faz)\b/.test(text)) return unknown('No simulador posso aumentar ou diminuir canais em dB, mutar/desmutar, salvar cenas e mostrar um resumo dos níveis simulados. Nenhum comando vai para a mesa real.');
  if (/\b(?:analisa|analise|clipping|nivel|niveis|monitoramento)\b/.test(text)) {
    const hot = state.channels.filter(c=>!c.muted && c.faderDb>1).map(c=>c.name);
    return unknown(hot.length ? `Simulação: faders elevados em ${hot.join(', ')}. Atenção: isto NÃO é uma medição de áudio real.` : 'Simulação: não há faders acima de +1 dB. Isto NÃO indica ausência de clipping real; o áudio não está sendo capturado.');
  }
  const save = text.match(/\b(?:salv[ae]|cri[ae])(?:r)?\s+(?:uma\s+)?cena\s+(?:(?:chamada|com o nome|nome)\s+)?(.+)/);
  if (save) {
    const name = save[1].trim().replace(/[.!?]$/,'');
    return {reply:`Posso salvar a cena local “${name}”.`,actions:[{type:'SAVE_SCENE',name}],description:`Salvar cena “${name}”`};
  }
  const muteMatch = /\b(?:muta|mute|mutar|silencia|desliga|desmuta|desmutar|unmute|ativa o som|tira o mute)\b/.exec(text);
  if (muteMatch) {
    const unmute = /\b(?:desmuta|desmutar|unmute|ativa o som|tira o mute)\b/.test(text);
    const all = /\b(?:todos|todas|tudo)\b/.test(text);
    if (all) {
      const except = text.match(/\b(?:menos|exceto)\s+(.+)$/);
      const excluded = except ? resolveChannel(except[1],state) : null;
      if (except && !excluded) return unknown('Não consegui identificar o canal que deve ficar de fora. Use “menos o canal 15”, por exemplo.');
      const actions = state.channels.filter(c=>c.id!==excluded).map(c=>({type:'SET_MUTE',channelId:c.id,value:!unmute}));
      return {reply:`Vou ${unmute?'desmutar':'mutar'} ${actions.length} canais no simulador.`,description:`${unmute?'Desmutar':'Mutar'} ${actions.length} canais`,actions};
    }
    const channelId = resolveChannel(text,state);
    if (!channelId) return unknown('Qual canal? Exemplo: “muta o canal 4”.');
    const c=state.channels[channelId-1];
    return {reply:`Vou ${unmute?'desmutar':'mutar'} ${c.name} (CH ${channelId}) no simulador.`,description:`${unmute?'Desmutar':'Mutar'} ${c.name}`,actions:[{type:'SET_MUTE',channelId,value:!unmute}]};
  }
  const up = /\b(?:aumenta|aumentar|sobe|subir|eleva|mais alto|acrescenta)\b/.test(text);
  const down = /\b(?:abaixa|abaixar|diminui|diminuir|reduz|reduzir|desce|descer|menos volume)\b/.test(text);
  if (up || down) {
    const channelId = resolveChannel(text,state);
    if (!channelId) return unknown('Preciso saber qual canal alterar. Exemplo: “abaixa o canal 4 em 3 dB”.');
    const amount = text.match(/(?:em|de|mais|menos)\s+(\d+(?:[,.]\d+)?)\s*(?:db|decibeis)?\b/) || text.match(/(\d+(?:[,.]\d+)?)\s*(?:db|decibeis)\b/);
    if (!amount || !/\b(?:db|decibeis)\b/.test(text)) return unknown('Informe a alteração em dB para evitar ambiguidades. Exemplo: “aumenta o canal 15 em 2 dB”.');
    const db = Number(amount[1].replace(',','.'));
    if (!Number.isFinite(db) || db <= 0 || db > 12) return unknown('Por segurança, cada comando aceita alterações maiores que 0 e de até 12 dB.');
    const c=state.channels[channelId-1];
    const desired=clamp(c.faderDb+(up?db:-db),FADER_MIN,FADER_MAX);
    return {reply:`Vou ajustar ${c.name} (CH ${channelId}) de ${c.faderDb.toFixed(1)} para ${desired.toFixed(1)} dB no simulador.`,description:`${c.name}: ${up?'+':'−'}${db} dB`,actions:[{type:'SET_FADER',channelId,value:desired}]};
  }
  return unknown('Ainda não reconheço esse comando offline. Tente “abaixa o canal 4 em 3 dB”, “muta o canal 10” ou “salva cena Passagem de Som”.');
}
