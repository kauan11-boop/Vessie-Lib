/* ============================================================
   FORJA — console de chat local para LM Studio
   API compatível com OpenAI: GET /models · POST /chat/completions
   ============================================================ */

// ---------- ícones (SVG inline, traço 2px) ----------
const ICONS = {
  plus:'<path d="M12 5v14M5 12h14"/>',
  send:'<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
  sliders:'<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  edit:'<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  panel:'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  chevronDown:'<path d="m6 9 6 6 6-6"/>',
  plug:'<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
  flame:'<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
};
const icon = (n, s=16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;

// ---------- utilidades ----------
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const estTokens = s => Math.max(1, Math.round(s.length / 3.8));
const hostOf = u => { try { return new URL(u).host; } catch { return u; } };
function timeoutSignal(ms){ const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; }
function slugify(t){ return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'conversa'; }

// ---------- estado ----------
const DEFAULTS = {
  baseUrl:'http://localhost:1234/v1', model:'', systemPrompt:'',
  temperature:0.7, topP:0.95, maxTokens:-1, stream:true
};
const state = {
  settings:{...DEFAULTS}, conversations:[], activeId:null,
  generating:false, controller:null, connected:false, latency:null, models:[],
  editingId:null
};
const getActive = () => state.conversations.find(c => c.id === state.activeId);
const isActive  = conv => conv && conv.id === state.activeId;
const modelShort = () => (state.settings.model || state.models[0] || 'modelo local').replace(/^.*\//,'');

function loadState(){
  try { state.settings = {...DEFAULTS, ...JSON.parse(localStorage.getItem('forja.settings') || '{}')}; } catch {}
  try { state.conversations = JSON.parse(localStorage.getItem('forja.conversations') || '[]'); } catch { state.conversations = []; }
  state.activeId = localStorage.getItem('forja.active') || (state.conversations[0] && state.conversations[0].id);
  if(!state.conversations.length){
    state.conversations.push({id:uid(), title:'Nova conversa', createdAt:Date.now(), messages:[]});
  }
  if(!getActive()) state.activeId = state.conversations[0].id;
}
function save(){
  localStorage.setItem('forja.settings', JSON.stringify(state.settings));
  localStorage.setItem('forja.conversations', JSON.stringify(state.conversations));
  localStorage.setItem('forja.active', state.activeId);
}

// ---------- elementos ----------
const els = {};
['sidebar','scrim','menuBtn','newChat','chatList','openSettings','chatTitle','connPill','connDot',
 'connText','exportBtn','clearBtn','scroller','msgList','scrollDown','input','sendBtn','counter',
 'footModel','toasts','settingsOverlay','setClose','setUrl','setModel','modelList','setRefresh',
 'setSystem','setTemp','tempVal','setTopP','topPVal','setMaxTok','setStream','setTest','setCancel',
 'setSave','confirmOverlay','cfTitle','cfMsg','cfOk','cfCancel'
].forEach(id => els[id] = document.getElementById(id));

// ---------- markdown ----------
if(window.marked) marked.setOptions({gfm:true, breaks:true});
function mdRender(text){
  if(!window.marked) return esc(text).replace(/\n/g,'<br>');
  let html;
  try { html = marked.parse(text); } catch { return esc(text).replace(/\n/g,'<br>'); }
  if(window.DOMPurify) html = DOMPurify.sanitize(html);
  return html;
}
function enhanceCodeBlocks(scope){
  scope.querySelectorAll('pre').forEach(pre => {
    if(pre.parentElement.classList.contains('codeblock')) return;
    const code = pre.querySelector('code');
    const langClass = code && [...code.classList].find(c => c.startsWith('language-'));
    const lang = langClass ? langClass.replace('language-','') : 'texto';
    const wrap = document.createElement('div'); wrap.className = 'codeblock';
    const head = document.createElement('div'); head.className = 'codeblock-head';
    head.innerHTML = `<span>${esc(lang)}</span><button class="code-copy">${icon('copy',12)} copiar</button>`;
    pre.replaceWith(wrap); wrap.appendChild(head); wrap.appendChild(pre);
    if(code && window.hljs) { try { hljs.highlightElement(code); } catch {} }
  });
  scope.querySelectorAll('.md a').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
}

// ---------- toasts / confirmação ----------
function toast(msg, type='ok'){
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const ic = type === 'ok' ? 'check' : (type === 'err' ? 'x' : 'info');
  t.innerHTML = icon(ic, 15) + `<span>${esc(msg)}</span>`;
  els.toasts.appendChild(t);
  setTimeout(() => t.classList.add('out'), 3400);
  setTimeout(() => t.remove(), 3850);
}
function confirmDialog({title, message, okLabel='Excluir'}){
  return new Promise(res => {
    els.cfTitle.textContent = title;
    els.cfMsg.textContent = message;
    els.cfOk.textContent = okLabel;
    els.confirmOverlay.classList.add('open');
    const done = v => { els.confirmOverlay.classList.remove('open'); cleanup(); res(v); };
    const onOk = () => done(true), onCancel = () => done(false);
    const onKey = e => { if(e.key === 'Escape') done(false); };
    const onBackdrop = e => { if(e.target === els.confirmOverlay) done(false); };
    function cleanup(){
      els.cfOk.removeEventListener('click', onOk);
      els.cfCancel.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKey);
      els.confirmOverlay.removeEventListener('click', onBackdrop);
    }
    els.cfOk.addEventListener('click', onOk);
    els.cfCancel.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKey);
    els.confirmOverlay.addEventListener('click', onBackdrop);
  });
}

// ---------- conexão ----------
async function checkConnection(url){
  const t0 = performance.now();
  try{
    const res = await fetch(url.replace(/\/+$/,'') + '/models', {signal: timeoutSignal(5000)});
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    return {ok:true, ms:Math.round(performance.now() - t0), models:(j.data || []).map(m => m.id)};
  }catch(e){
    return {ok:false, err: e.name === 'AbortError' ? 'tempo esgotado' : e.message};
  }
}
function fillDatalist(models){
  els.modelList.innerHTML = models.map(m => `<option value="${esc(m)}">`).join('');
}
function setStatus(mode){
  els.connDot.className = 'conn-dot ' + mode;
  const host = hostOf(state.settings.baseUrl);
  els.connText.textContent =
    mode === 'online'  ? `${host} · ${state.latency} ms` :
    mode === 'offline' ? `${host} · offline` : 'verificando…';
  els.connPill.title = mode === 'online'
    ? `Conectado a ${state.settings.baseUrl}`
    : mode === 'offline'
    ? 'Sem resposta do LM Studio. Verifique se o servidor está ativo (aba Developer → Start Server) e se o CORS está habilitado.'
    : 'Verificando conexão…';
  const hint = document.getElementById('emptyHint');
  if(hint){
    hint.className = 'empty-hint ' + (mode === 'online' ? 'ok' : mode === 'offline' ? 'bad' : '');
    hint.innerHTML = `<span class="mini-dot ${mode}"></span>` + (
      mode === 'online'  ? `conectado — ${state.models.length} modelo(s) detectado(s)` :
      mode === 'offline' ? 'sem conexão — siga os passos acima e teste novamente' :
      'verificando conexão…');
  }
}
async function ping(manual=false){
  setStatus('checking');
  const r = await checkConnection(state.settings.baseUrl);
  if(r.ok){
    state.connected = true; state.latency = r.ms; state.models = r.models;
    fillDatalist(r.models); setStatus('online');
    if(manual) toast(`Conectado — ${r.models.length} modelo(s) disponível(is)`, 'ok');
  } else {
    state.connected = false; state.models = []; setStatus('offline');
    if(manual) toast('Falha na conexão: ' + r.err, 'err');
  }
}

// ---------- renderização ----------
function renderSidebar(){
  els.chatList.innerHTML = '';
  state.conversations.forEach(conv => {
    const d = document.createElement('div');
    d.className = 'chat-item' + (conv.id === state.activeId ? ' active' : '');
    d.dataset.id = conv.id;
    const meta = `${conv.messages.length} msg · ${new Date(conv.createdAt).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}`;
    d.innerHTML = `<div class="ci-title">${esc(conv.title)}</div><div class="ci-meta">${meta}</div>
      <button class="ci-del" title="Excluir conversa">${icon('trash',13)}</button>`;
    els.chatList.appendChild(d);
  });
}
function renderHeader(){
  const conv = getActive();
  els.chatTitle.textContent = conv ? conv.title : '';
}
function lastAssistantId(conv){
  for(let i = conv.messages.length - 1; i >= 0; i--){
    if(conv.messages[i].role === 'assistant') return conv.messages[i].id;
  }
  return null;
}
function buildEmpty(){
  const d = document.createElement('div');
  d.className = 'empty';
  d.innerHTML = `
    <div class="empty-mark">Forja<span class="accent">.</span></div>
    <div class="empty-sub">console de linguagem · lm studio</div>
    <div class="empty-steps">
      <div class="step"><span class="step-n">01</span><div><b>Abra o LM Studio</b> e carregue um modelo de sua preferência.</div></div>
      <div class="step"><span class="step-n">02</span><div>Vá até a aba <b>Developer</b> e clique em <b>Start Server</b> — a porta padrão é a <b>1234</b>.</div></div>
      <div class="step"><span class="step-n">03</span><div>Quando o indicador no topo ficar <b>verde</b>, escreva sua primeira mensagem abaixo.</div></div>
    </div>
    <button class="btn" id="emptyPing">${icon('plug',15)} testar conexão agora</button>
    <div class="empty-hint" id="emptyHint"></div>`;
  d.querySelector('#emptyPing').addEventListener('click', () => ping(true));
  return d;
}
function formatStats(s){
  const p = [];
  if(s.tokens) p.push(`≈ ${s.tokens.toLocaleString('pt-BR')} tokens`);
  if(s.dur) p.push(`${s.dur < 10 ? s.dur.toFixed(1) : Math.round(s.dur)} s`);
  if(s.dur && s.tokens) p.push(`${Math.round(s.tokens / s.dur).toLocaleString('pt-BR')} tok/s`);
  if(s.aborted) p.push('interrompido');
  return p.join(' · ');
}
function buildMessageEl(m, opts = {}){
  const el = document.createElement('div');
  el.className = 'msg ' + m.role + (m.error ? ' is-error' : '');
  el.dataset.id = m.id;
  const time = new Date(m.ts || Date.now()).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const refs = {el};

  if(m.role === 'user'){
    if(state.editingId === m.id){
      el.innerHTML = `
        <div class="edit-wrap">
          <textarea class="edit-area"></textarea>
          <div class="edit-actions">
            <button class="btn small" data-e="cancel">Cancelar</button>
            <button class="btn primary small" data-e="save">${icon('check',14)} Salvar e reenviar</button>
          </div>
        </div>`;
      const ta = el.querySelector('.edit-area');
      ta.value = m.content;
      const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 260) + 'px'; };
      fit(); ta.addEventListener('input', fit);
      ta.addEventListener('keydown', e => {
        if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); el.querySelector('[data-e=save]').click(); }
        if(e.key === 'Escape'){ el.querySelector('[data-e=cancel]').click(); }
      });
      el.querySelector('[data-e=save]').addEventListener('click', () => saveEdit(m, ta.value));
      el.querySelector('[data-e=cancel]').addEventListener('click', () => { state.editingId = null; renderMessages(); });
      setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 0);
    } else {
      el.innerHTML = `
        <div class="bubble"></div>
        <div class="msg-foot user-foot"><div class="actions">
          <button class="act" data-a="copy" title="Copiar">${icon('copy',14)}</button>
          <button class="act" data-a="edit" title="Editar e reenviar">${icon('edit',14)}</button>
        </div></div>`;
      el.querySelector('.bubble').textContent = m.content;
    }
  } else {
    const brand = m.error
      ? `<span class="msg-brand is-err">${icon('x',12)} erro</span>`
      : `<span class="msg-brand">${icon('flame',13)} forja<span class="msg-model">· ${esc(modelShort())}</span></span>`;
    el.innerHTML = `
      <div class="msg-head">${brand}<span class="msg-time">${time}</span></div>
      <details class="reasoning" hidden>
        <summary>${icon('chevronDown',12)} raciocínio do modelo</summary>
        <div class="reasoning-body"></div>
      </details>
      <div class="msg-body md"></div>
      <div class="msg-foot">
        <span class="stats">${m.stats ? formatStats(m.stats) : ''}</span>
        <div class="actions">
          <button class="act" data-a="copy" title="Copiar">${icon('copy',14)}</button>
          ${opts.isLast && !m.error ? `<button class="act" data-a="regen" title="Regenerar resposta">${icon('refresh',14)}</button>` : ''}
        </div>
      </div>`;
    const body = el.querySelector('.msg-body');
    body.innerHTML = mdRender(m.content || '');
    if(m.reasoning){
      el.querySelector('.reasoning').hidden = false;
      el.querySelector('.reasoning-body').textContent = m.reasoning;
    }
    refs.contentEl = body;
    refs.reasoningWrap = el.querySelector('.reasoning');
    refs.reasoningBody = el.querySelector('.reasoning-body');
  }
  return {el, refs};
}
function renderMessages(){
  const conv = getActive();
  els.msgList.innerHTML = '';
  if(!conv || !conv.messages.length){ els.msgList.appendChild(buildEmpty()); return; }
  const lastId = lastAssistantId(conv);
  conv.messages.forEach(m => {
    const {el} = buildMessageEl(m, {isLast: m.id === lastId});
    els.msgList.appendChild(el);
    if(m.role === 'assistant') enhanceCodeBlocks(el);
  });
  scrollBottom(false);
}

// ---------- scroll ----------
const isNearBottom = () => els.scroller.scrollHeight - els.scroller.scrollTop - els.scroller.clientHeight < 140;
function scrollBottom(smooth){
  els.scroller.scrollTo({top: els.scroller.scrollHeight, behavior: smooth ? 'smooth' : 'auto'});
}
els.scroller.addEventListener('scroll', () => els.scrollDown.classList.toggle('show', !isNearBottom()));
els.scrollDown.addEventListener('click', () => scrollBottom(true));

// ---------- composer ----------
function autosize(){
  const ta = els.input;
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
}
function updateCount(){
  const v = els.input.value;
  els.counter.textContent = v
    ? `~${estTokens(v)} tok no campo · enter envia · shift+enter nova linha`
    : 'enter envia · shift+enter nova linha · ctrl+k nova conversa';
}
function updateComposer(){
  if(state.generating){
    els.sendBtn.classList.add('stop');
    els.sendBtn.innerHTML = icon('stop', 17);
    els.sendBtn.title = 'Parar geração';
  } else {
    els.sendBtn.classList.remove('stop');
    els.sendBtn.innerHTML = icon('send', 17);
    els.sendBtn.title = 'Enviar (Enter)';
  }
  els.footModel.textContent = `${modelShort()} · temp ${state.settings.temperature}`;
}

// ---------- conversas ----------
function newChat(){
  const conv = {id:uid(), title:'Nova conversa', createdAt:Date.now(), messages:[]};
  state.conversations.unshift(conv);
  state.activeId = conv.id; state.editingId = null;
  save(); renderSidebar(); renderHeader(); renderMessages();
  els.input.focus();
}
function selectChat(id){
  if(state.generating){ toast('Aguarde o fim da geração para trocar de conversa','warn'); return; }
  state.activeId = id; state.editingId = null;
  save(); renderSidebar(); renderHeader(); renderMessages();
  closeSidebarMobile();
}
async function deleteChat(id){
  const conv = state.conversations.find(c => c.id === id);
  if(!conv) return;
  const ok = await confirmDialog({title:'Excluir conversa', message:`Excluir “${conv.title}”? Esta ação não pode ser desfeita.`});
  if(!ok) return;
  state.conversations = state.conversations.filter(c => c.id !== id);
  if(state.activeId === id) state.activeId = state.conversations[0] ? state.conversations[0].id : null;
  if(!state.conversations.length){ const c = {id:uid(), title:'Nova conversa', createdAt:Date.now(), messages:[]}; state.conversations.push(c); state.activeId = c.id; }
  if(state.activeId === id) state.activeId = state.conversations[0].id;
  save(); renderSidebar(); renderHeader(); renderMessages();
  toast('Conversa excluída');
}
async function clearChat(){
  const conv = getActive();
  if(!conv || !conv.messages.length) return;
  const ok = await confirmDialog({title:'Limpar conversa', message:'Remover todas as mensagens desta conversa?', okLabel:'Limpar'});
  if(!ok) return;
  conv.messages = []; save(); renderSidebar(); renderMessages();
  toast('Mensagens removidas');
}
function startRename(){
  const conv = getActive(); if(!conv) return;
  const h = els.chatTitle;
  if(h.querySelector('input')) return;
  const inp = document.createElement('input');
  inp.className = 'title-input'; inp.value = conv.title;
  h.innerHTML = ''; h.appendChild(inp);
  inp.focus(); inp.select();
  let done = false;
  const commit = () => {
    if(done) return; done = true;
    const v = inp.value.trim();
    if(v) conv.title = v;
    save(); renderHeader(); renderSidebar();
  };
  inp.addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); commit(); }
    if(e.key === 'Escape'){ done = true; renderHeader(); }
  });
  inp.addEventListener('blur', commit);
}

// ---------- exportação ----------
function exportMd(){
  const conv = getActive();
  if(!conv || !conv.messages.length){ toast('A conversa está vazia.','warn'); return; }
  let md = `# ${conv.title}\n\n> Exportado do Forja · ${new Date().toLocaleString('pt-BR')}\n\n`;
  conv.messages.forEach(m => {
    if(m.error) md += `> **[erro]** ${m.content.replace(/\*\*/g,'')}\n\n`;
    else md += `## ${m.role === 'user' ? 'Você' : 'Forja'}\n\n${m.content}\n\n`;
  });
  const blob = new Blob([md], {type:'text/markdown;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = slugify(conv.title) + '.md';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Conversa exportada em Markdown');
}

// ---------- cópia ----------
async function copyText(text, btn){
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); ta.remove();
  }
  if(btn){
    const old = btn.innerHTML;
    btn.innerHTML = icon('check', 14); btn.classList.add('done');
    setTimeout(() => { btn.innerHTML = old; btn.classList.remove('done'); }, 1200);
  }
}

// ---------- envio e geração ----------
function payloadMessages(conv){
  const out = [];
  if(state.settings.systemPrompt.trim()) out.push({role:'system', content: state.settings.systemPrompt.trim()});
  conv.messages.forEach(m => {
    if(!m.error && m.content && m.content.trim()) out.push({role:m.role, content:m.content});
  });
  return out;
}
function send(){
  if(state.generating) return;
  const txt = els.input.value.trim();
  if(!txt) return;
  const conv = getActive();
  conv.messages.push({id:uid(), role:'user', content:txt, ts:Date.now()});
  if(conv.title === 'Nova conversa') conv.title = txt.length > 42 ? txt.slice(0, 42).trim() + '…' : txt;
  els.input.value = ''; autosize(); updateCount();
  save(); renderSidebar(); renderHeader(); renderMessages();
  generate(conv);
}
function stopGen(){ if(state.controller) state.controller.abort(); }

async function generate(conv){
  if(state.generating) return;
  const history = payloadMessages(conv);
  if(!history.length) return;

  const am = {id:uid(), role:'assistant', content:'', reasoning:'', ts:Date.now()};
  conv.messages.push(am);
  state.generating = true;
  state.controller = new AbortController();
  updateComposer();

  let refs = null;
  if(isActive(conv)){
    const r = buildMessageEl(am, {isLast:true, streaming:true});
    refs = r.refs;
    r.el.querySelector('.msg-body').innerHTML = '<span class="cursor"></span>';
    els.msgList.appendChild(r.el);
    scrollBottom(true);
  }

  const t0 = performance.now();
  let usage = null;

  const paint = () => {
    if(!refs || !refs.el.isConnected) return;
    if(am.reasoning){ refs.reasoningWrap.hidden = false; refs.reasoningBody.textContent = am.reasoning; }
    refs.contentEl.innerHTML = mdRender(am.content) + '<span class="cursor"></span>';
    if(isNearBottom()) els.scroller.scrollTop = els.scroller.scrollHeight;
  };
  let timer = null;
  const schedulePaint = () => { if(!timer) timer = setTimeout(() => { timer = null; paint(); }, 60); };

  try{
    const body = {
      model: state.settings.model || state.models[0] || 'local-model',
      messages: history,
      temperature: state.settings.temperature,
      top_p: state.settings.topP,
      max_tokens: state.settings.maxTokens > 0 ? state.settings.maxTokens : -1,
      stream: state.settings.stream
    };
    const res = await fetch(state.settings.baseUrl.replace(/\/+$/,'') + '/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body),
      signal: state.controller.signal
    });
    if(!res.ok){
      let detail = '';
      try { detail = (await res.json()).error?.message || ''; } catch {}
      throw new Error(`HTTP ${res.status}${detail ? ' — ' + detail : ''}`);
    }

    if(!state.settings.stream){
      const j = await res.json();
      const m0 = j.choices?.[0]?.message || {};
      am.content = m0.content || '';
      am.reasoning = m0.reasoning_content || '';
      usage = j.usage;
      paint();
    } else {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while(true){
        const {done, value} = await reader.read();
        if(done) break;
        buf += dec.decode(value, {stream:true});
        let idx;
        while((idx = buf.indexOf('\n')) >= 0){
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if(!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if(payload === '[DONE]') continue;
          let j; try { j = JSON.parse(payload); } catch { continue; }
          const d = j.choices?.[0]?.delta || {};
          if(d.reasoning_content) am.reasoning += d.reasoning_content;
          if(d.content) am.content += d.content;
          if(d.reasoning_content || d.content) schedulePaint();
        }
      }
    }

    const dur = (performance.now() - t0) / 1000;
    if(!am.content && !am.reasoning){
      am.error = true;
      am.content = 'O modelo retornou uma resposta vazia. Tente regenerar ou ajustar os parâmetros.';
    } else {
      am.stats = {dur, tokens: usage?.completion_tokens || Math.round(am.content.length / 3.8)};
    }
  }catch(err){
    if(err.name === 'AbortError'){
      if(am.content || am.reasoning){
        am.stats = {dur:(performance.now() - t0) / 1000, tokens:Math.round(am.content.length / 3.8), aborted:true};
      } else {
        am.error = true; am.content = 'Geração interrompida antes da primeira resposta.';
      }
    } else {
      am.error = true;
      am.content = '**Falha na requisição** — ' + err.message + '\n\nChecklist rápido:\n' +
        '- O servidor do LM Studio está em execução? *(aba Developer → Start Server)*\n' +
        '- A URL base está correta? (atualmente `' + state.settings.baseUrl + '`)\n' +
        '- O CORS está habilitado nas configurações do servidor do LM Studio?';
      state.connected = false;
      setStatus('offline');
    }
  }finally{
    state.generating = false;
    state.controller = null;
    updateComposer();
    save();
    if(isActive(conv)) renderMessages();
  }
}
function regenerate(){
  if(state.generating) return;
  const conv = getActive(); if(!conv) return;
  while(conv.messages.length && conv.messages[conv.messages.length - 1].role !== 'user') conv.messages.pop();
  if(!conv.messages.length){ renderMessages(); return; }
  save(); generate(conv);
}
function saveEdit(m, val){
  const conv = getActive();
  const v = (val || '').trim();
  state.editingId = null;
  if(!v){ renderMessages(); return; }
  m.content = v;
  const i = conv.messages.indexOf(m);
  conv.messages.splice(i + 1);
  save(); renderMessages(); renderSidebar();
  generate(conv);
}

// ---------- configurações ----------
function openSettings(){
  const s = state.settings;
  els.setUrl.value = s.baseUrl;
  els.setModel.value = s.model;
  els.setSystem.value = s.systemPrompt;
  els.setTemp.value = s.temperature; els.tempVal.textContent = Number(s.temperature).toFixed(2);
  els.setTopP.value = s.topP; els.topPVal.textContent = Number(s.topP).toFixed(2);
  els.setMaxTok.value = s.maxTokens;
  els.setStream.checked = !!s.stream;
  els.settingsOverlay.classList.add('open');
}
async function testFromFields(){
  const url = els.setUrl.value.trim();
  if(!/^https?:\/\//.test(url)){ toast('A URL deve começar com http:// ou https://','err'); return; }
  els.setTest.disabled = true;
  const r = await checkConnection(url);
  els.setTest.disabled = false;
  if(r.ok){
    fillDatalist(r.models);
    toast(`Conectado (${r.ms} ms) — ${r.models.length} modelo(s): ${r.models.slice(0,3).join(', ')}${r.models.length > 3 ? '…' : ''}`, 'ok');
  } else {
    toast('Falha na conexão: ' + r.err, 'err');
  }
}

// ---------- eventos ----------
function bindEvents(){
  els.newChat.addEventListener('click', newChat);
  els.openSettings.addEventListener('click', openSettings);
  els.connPill.addEventListener('click', () => ping(true));
  els.exportBtn.addEventListener('click', exportMd);
  els.clearBtn.addEventListener('click', clearChat);
  els.chatTitle.addEventListener('click', startRename);
  els.sendBtn.addEventListener('click', () => state.generating ? stopGen() : send());

  els.chatList.addEventListener('click', e => {
    const del = e.target.closest('.ci-del');
    const item = e.target.closest('.chat-item');
    if(!item) return;
    if(del){ deleteChat(item.dataset.id); return; }
    selectChat(item.dataset.id);
  });

  els.msgList.addEventListener('click', e => {
    const cc = e.target.closest('.code-copy');
    if(cc){
      const pre = cc.closest('.codeblock').querySelector('pre');
      copyText(pre.textContent, cc);
      return;
    }
    const btn = e.target.closest('.act');
    if(!btn) return;
    const wrap = btn.closest('.msg');
    const conv = getActive();
    const m = conv && conv.messages.find(x => x.id === wrap.dataset.id);
    if(!m) return;
    if(btn.dataset.a === 'copy') copyText(m.content, btn);
    else if(btn.dataset.a === 'edit'){
      if(state.generating){ toast('Aguarde o fim da geração','warn'); return; }
      state.editingId = m.id; renderMessages();
    }
    else if(btn.dataset.a === 'regen') regenerate();
  });

  els.input.addEventListener('input', () => { autosize(); updateCount(); });
  els.input.addEventListener('keydown', e => {
    if(e.key === 'Enter' && !e.shiftKey && !e.isComposing){
      e.preventDefault();
      if(!state.generating) send();
    }
  });

  document.addEventListener('keydown', e => {
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); newChat(); }
  });

  // modais
  els.setClose.addEventListener('click', () => els.settingsOverlay.classList.remove('open'));
  els.setCancel.addEventListener('click', () => els.settingsOverlay.classList.remove('open'));
  els.settingsOverlay.addEventListener('click', e => { if(e.target === els.settingsOverlay) els.settingsOverlay.classList.remove('open'); });
  els.setTemp.addEventListener('input', () => els.tempVal.textContent = Number(els.setTemp.value).toFixed(2));
  els.setTopP.addEventListener('input', () => els.topPVal.textContent = Number(els.setTopP.value).toFixed(2));
  els.setRefresh.addEventListener('click', testFromFields);
  els.setTest.addEventListener('click', testFromFields);
  els.setSave.addEventListener('click', () => {
    const url = els.setUrl.value.trim().replace(/\/+$/,'');
    if(!/^https?:\/\//.test(url)){ toast('A URL base deve começar com http:// ou https://','err'); return; }
    const mt = parseInt(els.setMaxTok.value, 10);
    state.settings = {
      baseUrl: url,
      model: els.setModel.value.trim(),
      systemPrompt: els.setSystem.value,
      temperature: parseFloat(els.setTemp.value),
      topP: parseFloat(els.setTopP.value),
      maxTokens: isNaN(mt) ? -1 : mt,
      stream: els.setStream.checked
    };
    save(); updateComposer();
    els.settingsOverlay.classList.remove('open');
    toast('Configurações salvas','ok');
    ping();
  });

  // mobile
  els.menuBtn.addEventListener('click', () => { els.sidebar.classList.add('open'); els.scrim.classList.add('show'); });
  els.scrim.addEventListener('click', closeSidebarMobile);
}
function closeSidebarMobile(){
  els.sidebar.classList.remove('open');
  els.scrim.classList.remove('show');
}

// ---------- inicialização ----------
function initIcons(){
  document.querySelector('[data-icon="flame"]').innerHTML = icon('flame', 19);
  els.newChat.innerHTML = icon('plus', 16) + '<span>Nova conversa</span>';
  els.openSettings.innerHTML = icon('sliders', 15) + '<span>Configurações</span>';
  els.menuBtn.innerHTML = icon('panel', 18);
  els.exportBtn.innerHTML = icon('download', 16);
  els.clearBtn.innerHTML = icon('trash', 16);
  els.scrollDown.innerHTML = icon('chevronDown', 17);
  els.setClose.innerHTML = icon('x', 16);
  els.setRefresh.innerHTML = icon('refresh', 15);
  els.setTest.innerHTML = icon('plug', 15) + '<span>Testar conexão</span>';
  els.setSave.innerHTML = icon('check', 15) + '<span>Salvar</span>';
}
function init(){
  initIcons();
  loadState();
  bindEvents();
  renderSidebar(); renderHeader(); renderMessages();
  updateComposer(); updateCount(); autosize();
  ping();
  setInterval(() => { if(!state.generating) ping(); }, 20000);
}
init();
