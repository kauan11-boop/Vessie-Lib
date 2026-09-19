/* ============================================================
   FORJA — responsive.js
   Auto-ajuste para dispositivos portáteis.

   Trabalha junto com css/responsive.css e não altera o app.js:
   só lê o DOM e mexe em variáveis CSS, atributos e classes.
   Se este arquivo for removido, o app continua funcionando
   (o CSS tem valores de reserva para tudo).

   O que ele faz:
   1. Mede a área realmente visível (teclado, barras do navegador)
      e publica em --app-h, --kb e data-keyboard
   2. Mede o campo de mensagem e publica em --composer-h
   3. Marca <html> com data-device / data-orientation / data-touch
   4. Gaveta de conversas: gesto de deslizar, tecla Esc, acessibilidade
   5. Em telas de toque, Enter quebra a linha (enviar = botão ou Ctrl+Enter)
   6. Mostra o status de conexão como dica (title) quando o texto é ocultado
   ============================================================ */
(function () {
  'use strict';

  const CONFIG = {
    phoneMax: 640,      // px: largura até a qual o aparelho é "phone"
    tabletMax: 1024,    // px: largura até a qual o aparelho é "tablet"
    drawerMax: 900,     // px: mesmo valor do @media da gaveta em responsive.css
    swipeEdge: 24,      // px: faixa da borda esquerda que inicia o gesto de abrir
    swipeDist: 60,      // px: distância mínima para abrir/fechar a gaveta
    keyboardMin: 120,   // px: encolhimento mínimo da tela para considerar teclado aberto
    enterIsNewlineOnTouch: true  // false = Enter continua enviando também no celular
  };

  const root = document.documentElement;
  const $ = (id) => document.getElementById(id);
  const mq = (q) => window.matchMedia(q);
  const vv = window.visualViewport || null;

  const sidebar = $('sidebar');
  const scrim = $('scrim');
  const menuBtn = $('menuBtn');
  const scroller = $('scroller');
  const composer = document.querySelector('.composer');
  const input = $('input');
  const counter = $('counter');
  const connPill = $('connPill');
  const connText = $('connText');

  const isTouch = () => mq('(hover:none) and (pointer:coarse)').matches;
  const isDrawer = () => window.innerWidth <= CONFIG.drawerMax;
  const isOpen = () => sidebar.classList.contains('open');
  const modalOpen = () => !!document.querySelector('.overlay.open');


  /* ---------- 1. viewport: altura real, teclado, orientação ---------- */
  let baseline = 0;   // maior altura vista com nenhum campo em foco = tela "cheia"

  function textFocused() {
    const a = document.activeElement;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  }

  function nearBottom() {
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 160;
  }

  function syncViewport() {
    if (vv && vv.scale > 1.02) return;   // usuário deu zoom com pinça: não interfere

    const h = Math.round(vv ? vv.height : window.innerHeight);
    if (!textFocused()) baseline = Math.max(h, window.innerHeight);

    const covered = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    const kbOpen = textFocused() && baseline - h > CONFIG.keyboardMin;
    const stick = nearBottom();

    root.style.setProperty('--app-h', h + 'px');
    root.style.setProperty('--kb', covered + 'px');
    root.dataset.keyboard = kbOpen ? 'open' : 'closed';

    // iOS rola a página inteira ao abrir o teclado; trazemos de volta
    if (vv && vv.offsetTop > 0) window.scrollTo(0, 0);

    // se o usuário estava lendo o fim da conversa, continua no fim
    if (stick) requestAnimationFrame(() => { scroller.scrollTop = scroller.scrollHeight; });
  }

  function syncDevice() {
    const w = window.innerWidth;
    const touch = isTouch();
    let device = w <= CONFIG.phoneMax ? 'phone' : w <= CONFIG.tabletMax ? 'tablet' : 'desktop';
    // celular deitado passa de 640px de largura, mas continua sendo celular
    if (touch && Math.min(screen.width, screen.height) <= 500) device = 'phone';

    // com o teclado aberto a altura encolhe e pareceria "paisagem": só reavalia com o teclado fechado
    if (root.dataset.keyboard !== 'open') {
      root.dataset.orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    }

    root.dataset.device = device;
    root.dataset.touch = touch ? 'true' : 'false';

    // no celular o placeholder longo quebra em duas linhas e engorda o campo
    if (input) {
      if (!input.dataset.phFull) input.dataset.phFull = input.placeholder;
      const ph = device === 'phone' ? 'Escreva sua mensagem…' : input.dataset.phFull;
      if (input.placeholder !== ph) {
        input.placeholder = ph;
        if (!input.value) input.dispatchEvent(new Event('input'));   // o app.js recalcula a altura
      }
    }
  }

  let raf = 0;
  function schedule() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { syncViewport(); syncDevice(); syncDrawer(); });
  }

  window.addEventListener('resize', schedule);
  if (vv) { vv.addEventListener('resize', schedule); vv.addEventListener('scroll', schedule); }
  // iOS informa o tamanho antigo logo após girar a tela; medimos de novo em seguida
  window.addEventListener('orientationchange', () => { [0, 150, 400].forEach((t) => setTimeout(schedule, t)); });
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', () => setTimeout(schedule, 80));


  /* ---------- 2. altura do campo de mensagem ---------- */
  if (composer) {
    const setComposerH = () => root.style.setProperty('--composer-h', composer.offsetHeight + 'px');
    setComposerH();
    if ('ResizeObserver' in window) new ResizeObserver(setComposerH).observe(composer);
    else window.addEventListener('resize', setComposerH);
  }


  /* ---------- 3. gaveta de conversas (sidebar em telas estreitas) ---------- */
  function openDrawer() { sidebar.classList.add('open'); scrim.classList.add('show'); }
  function closeDrawer() { sidebar.classList.remove('open'); scrim.classList.remove('show'); }

  // acessibilidade: gaveta fechada não recebe foco nem é lida por leitor de tela
  function syncDrawer() {
    const drawer = isDrawer();
    if (!drawer && (isOpen() || scrim.classList.contains('show'))) closeDrawer();   // voltou para o desktop
    const hidden = drawer && !isOpen();
    sidebar.toggleAttribute('inert', hidden);
    sidebar.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    menuBtn.setAttribute('aria-expanded', isOpen() ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', 'Conversas');
  }
  // o app.js abre/fecha trocando a classe "open"; acompanhamos essa troca
  new MutationObserver(syncDrawer).observe(sidebar, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isDrawer() && isOpen() && !modalOpen()) closeDrawer();
  });

  // gestos: deslizar da borda esquerda abre; deslizar para a esquerda fecha
  let sx = 0, sy = 0, tracking = null;
  document.addEventListener('touchstart', (e) => {
    if (!isDrawer() || modalOpen() || e.touches.length !== 1) { tracking = null; return; }
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY;
    if (!isOpen() && sx <= CONFIG.swipeEdge) tracking = 'open';
    else if (isOpen()) tracking = 'close';
    else tracking = null;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    const t = e.touches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dy) > Math.abs(dx) * 0.7) return;        // rolagem vertical, não é gesto
    if (tracking === 'open' && dx > CONFIG.swipeDist) { openDrawer(); tracking = null; }
    if (tracking === 'close' && dx < -CONFIG.swipeDist) { closeDrawer(); tracking = null; }
  }, { passive: true });

  document.addEventListener('touchend', () => { tracking = null; }, { passive: true });


  /* ---------- 4. teclado virtual: Enter quebra a linha ---------- */
  // Sem tecla Shift no teclado do celular não existe como pular linha;
  // então, em telas de toque, Enter insere a quebra e o botão envia.
  // Ctrl/Cmd+Enter continua enviando (tablet com teclado físico).
  // O listener em captura roda antes do handler do app.js e o bloqueia.
  if (input && CONFIG.enterIsNewlineOnTouch) {
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.isComposing) return;
      if (!isTouch()) return;
      e.stopImmediatePropagation();   // sem preventDefault: o navegador insere a quebra de linha
    }, true);
  }

  // O contador fala em "enter envia · shift+enter nova linha": no toque isso não vale.
  if (counter) {
    const HINT = /\s*·?\s*enter envia\s*·\s*shift\+enter nova linha(\s*·\s*ctrl\+k nova conversa)?/;
    const cleanCounter = () => {
      if (!isTouch()) return;
      const t = counter.textContent, c = t.replace(HINT, '').trim();
      if (c !== t) counter.textContent = c;
    };
    new MutationObserver(cleanCounter).observe(counter, { childList: true, characterData: true, subtree: true });
    cleanCounter();
  }


  /* ---------- 5. status de conexão vira dica quando o texto some ---------- */
  if (connPill && connText) {
    const syncConn = () => {
      const t = connText.textContent.trim();
      connPill.title = t;
      connPill.setAttribute('aria-label', 'Conexão: ' + t);
    };
    new MutationObserver(syncConn).observe(connText, { childList: true, characterData: true, subtree: true });
    syncConn();
  }


  /* ---------- início ---------- */
  syncViewport();
  syncDevice();
  syncDrawer();

  // pequeno gancho para depurar no console: ForjaResponsive.device etc.
  window.ForjaResponsive = {
    openDrawer, closeDrawer, sync: schedule,
    get device() { return root.dataset.device; },
    get keyboardOpen() { return root.dataset.keyboard === 'open'; }
  };
})();
