/* S'unlimited Solar — homepage interactions
   Designed & developed by aiDzines
   Optional enhancers: GSAP + ScrollTrigger (pinned process), Lenis (smooth scroll).
   Everything degrades gracefully if they fail to load or reduced motion is on. */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const root = document.documentElement;
  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const WA_NUMBER = '919561131103';
  const waLink = text => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

  /* =========================================================
     Smooth scroll (Lenis)
     ========================================================= */
  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    if (hasGsap) {
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add(t => lenis.raf(t * 1000));
      window.gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  /* Body scroll lock shared by menu, modal and drawer */
  const locks = new Set();
  const lock = (key, on) => {
    on ? locks.add(key) : locks.delete(key);
    const locked = locks.size > 0;
    body.classList.toggle('isLocked', locked);
    if (lenis) locked ? lenis.stop() : lenis.start();
  };

  /* =========================================================
     Header height → CSS var
     ========================================================= */
  const header = $('#siteHeader');
  const navH = () => ($('.navBar', header)?.offsetHeight || 76);
  const setHeaderVar = () => {
    if (!header) return;
    const top = $('.topBarInner', header);
    root.style.setProperty('--siteHeaderH', `${navH() + (top ? top.scrollHeight : 0)}px`);
  };
  setHeaderVar();
  window.addEventListener('resize', setHeaderVar);

  /* Anchor links: smooth scroll with fixed-header offset */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute('data-quote-open')) return;
    const id = a.getAttribute('href');
    if (id === '#') { e.preventDefault(); return; }
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    const offset = id === '#home' ? 0 : -navH() + 1;
    if (lenis) lenis.scrollTo(target, { offset, duration: 1.4 });
    else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY + offset, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* =========================================================
     Theme (light / dark)
     ========================================================= */
  const themeBtn = $('#themeToggle');
  const metaTheme = $('meta[name="theme-color"]');
  const applyTheme = (t, save) => {
    root.setAttribute('data-theme', t);
    themeBtn?.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    themeBtn?.setAttribute('aria-pressed', String(t === 'dark'));
    metaTheme?.setAttribute('content', t === 'dark' ? '#0a1120' : '#070d1a');
    if (save) { try { localStorage.setItem('sunTheme', t); } catch (e) { /* storage blocked */ } }
  };
  applyTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light', false);
  themeBtn?.addEventListener('click', () => applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    let saved = null;
    try { saved = localStorage.getItem('sunTheme'); } catch (err) { /* ignore */ }
    if (!saved) applyTheme(e.matches ? 'dark' : 'light', false);
  });

  /* =========================================================
     Mobile menu
     ========================================================= */
  const toggle = $('#menuToggle');
  const menu = $('#mobileMenu');
  const setMenu = open => {
    if (!toggle || !menu) return;
    toggle.classList.toggle('isOpen', open);
    menu.classList.toggle('isOpen', open);
    lock('menu', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!open));
  };
  toggle?.addEventListener('click', () => setMenu(!menu.classList.contains('isOpen')));
  $$('a', menu || document.createElement('div')).forEach(a => a.addEventListener('click', () => setMenu(false)));
  window.matchMedia('(min-width: 1024px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

  /* =========================================================
     Nav: active section + sliding indicator
     ========================================================= */
  const navLinks = $$('.navLink');
  const indicator = $('#navIndicator');
  const moveIndicator = () => {
    const active = navLinks.find(l => l.classList.contains('isActive'));
    if (!indicator || !active) return;
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.transform = `translateX(${active.offsetLeft}px)`;
  };
  const setActive = id => {
    navLinks.forEach(l => l.classList.toggle('isActive', l.getAttribute('href') === `#${id}`));
    moveIndicator();
  };
  if ('IntersectionObserver' in window) {
    const navObs = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) setActive(en.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.map(l => $(l.getAttribute('href'))).filter(Boolean).forEach(s => navObs.observe(s));
  }
  window.addEventListener('resize', moveIndicator);
  document.fonts?.ready.then(moveIndicator);

  /* =========================================================
     Hero carousel (rAF timer drives tab bars + next-card ring)
     ========================================================= */
  const hero = $('#home');
  const slides = $$('.heroSlide');
  const bgs = $$('.heroSlideBg');
  const tabs = $$('.heroTab');
  const pauseBtn = $('#heroPause');
  const counter = $('#heroCurrent');
  const nextImg = $('#heroNextImg');
  const nextTitle = $('#heroNextTitle');
  const DUR = 7000;
  let current = 0;
  let elapsed = 0;
  let userPaused = reduceMotion;
  let hoverPaused = false;
  let offscreen = false;
  let running = false;

  const syncPause = () => {
    if (!pauseBtn) return;
    pauseBtn.setAttribute('aria-label', userPaused ? 'Play slideshow' : 'Pause slideshow');
    pauseBtn.innerHTML = `<i class="bi bi-${userPaused ? 'play' : 'pause'}-fill"></i>`;
  };

  const goTo = i => {
    if (!slides.length) return;
    const prev = current;
    current = (i + slides.length) % slides.length;
    elapsed = 0;
    if (prev === current) return;

    slides.forEach((s, n) => {
      const on = n === current;
      s.classList.toggle('isActive', on);
      s.classList.toggle('isLeaving', n === prev);
      s.setAttribute('aria-hidden', String(!on));
      $$('a, button', s).forEach(el => { el.tabIndex = on ? 0 : -1; });
    });
    setTimeout(() => slides[prev]?.classList.remove('isLeaving'), 750);

    bgs.forEach((b, n) => {
      b.classList.remove('isPrev');
      if (n === prev) { b.classList.remove('isActive'); b.classList.add('isPrev'); }
      else if (n !== current) b.classList.remove('isActive');
    });
    const bg = bgs[current];
    if (bg) { bg.classList.remove('isActive'); void bg.offsetWidth; bg.classList.add('isActive'); }

    tabs.forEach((t, n) => {
      t.classList.toggle('isActive', n === current);
      t.classList.toggle('isDone', n < current);
      t.setAttribute('aria-selected', String(n === current));
    });

    if (counter) {
      counter.textContent = String(current + 1).padStart(2, '0');
      counter.classList.remove('isSwap'); void counter.offsetWidth; counter.classList.add('isSwap');
    }
    const nxt = slides[(current + 1) % slides.length];
    if (nxt && nextImg) nextImg.src = nxt.dataset.thumb;
    if (nxt && nextTitle) nextTitle.innerHTML = nxt.dataset.title;
  };

  const heroLoop = (() => {
    let last = performance.now();
    const tick = now => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!userPaused && !hoverPaused && !offscreen) elapsed += dt;
      const p = clamp(elapsed / DUR);
      hero?.style.setProperty('--prog', p.toFixed(4));
      if (p >= 1) goTo(current + 1);
      requestAnimationFrame(tick);
    };
    return () => { if (!running) { running = true; requestAnimationFrame(t => { last = t; tick(t); }); } };
  })();

  if (hero && slides.length) {
    tabs.forEach((tab, n) => tab.addEventListener('click', () => goTo(n)));
    $('#heroNext')?.addEventListener('click', () => goTo(current + 1));
    $('#heroNextCard')?.addEventListener('click', () => goTo(current + 1));
    $('#heroPrev')?.addEventListener('click', () => goTo(current - 1));
    pauseBtn?.addEventListener('click', () => { userPaused = !userPaused; syncPause(); });

    const content = $('#heroSlides');
    content?.addEventListener('mouseenter', () => { hoverPaused = true; });
    content?.addEventListener('mouseleave', () => { hoverPaused = false; });
    hero.addEventListener('focusin', e => { if (e.target.matches(':focus-visible')) hoverPaused = true; });
    hero.addEventListener('focusout', () => { hoverPaused = false; });
    hero.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') goTo(current + 1);
      if (e.key === 'ArrowLeft') goTo(current - 1);
    });

    let sx = 0, sy = 0;
    hero.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    hero.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) goTo(current + (dx < 0 ? 1 : -1));
    }, { passive: true });

    document.addEventListener('visibilitychange', () => { offscreen = document.hidden; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { offscreen = !en.isIntersecting; }).observe(hero);
    }
    slides.forEach((s, n) => $$('a, button', s).forEach(el => { el.tabIndex = n === 0 ? 0 : -1; }));
    syncPause();

    // Mouse depth parallax on decorative layers
    if (finePointer && !reduceMotion) {
      const layers = $$('[data-depth]', hero);
      let tx = 0, ty = 0, cx = 0, cy = 0;
      hero.addEventListener('pointermove', e => {
        tx = e.clientX / window.innerWidth - 0.5;
        ty = e.clientY / window.innerHeight - 0.5;
      });
      const loop = () => {
        cx = lerp(cx, tx, 0.06);
        cy = lerp(cy, ty, 0.06);
        layers.forEach(l => {
          const d = +l.dataset.depth;
          l.style.translate = `${(cx * d).toFixed(2)}px ${(cy * d).toFixed(2)}px`;
        });
        requestAnimationFrame(loop);
      };
      loop();
    }
  }

  /* =========================================================
     Preloader → start
     ========================================================= */
  let loaded = false;
  const finishLoad = () => {
    if (loaded) return;
    loaded = true;
    $('#preLoader')?.classList.add('isDone');
    setTimeout(() => body.classList.add('isReady'), 250);
    setHeaderVar();
    moveIndicator();
    heroLoop();
    if (hasGsap) window.ScrollTrigger.refresh();
  };
  if (document.readyState === 'complete') setTimeout(finishLoad, 300);
  else window.addEventListener('load', () => setTimeout(finishLoad, 300));
  setTimeout(finishLoad, 3000);

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* =========================================================
     Services: stacked sticky cards shrink & dim as the next covers them
     ========================================================= */
  const stackCards = $('#serviceStack .serviceCard');
  const updateStack = vh => {
    stackCards.forEach((card, i) => {
      const next = stackCards[i + 1];
      if (!next) return;
      const top = card.getBoundingClientRect().top;
      const nTop = next.getBoundingClientRect().top;
      const p = clamp(1 - (nTop - top) / (vh * 0.75));
      card.style.setProperty('--s', (1 - p * 0.07).toFixed(4));
      card.style.setProperty('--dim', (p * 0.45).toFixed(3));
    });
  };

  /* =========================================================
     Scroll-driven UI
     ========================================================= */
  const progress = $('#scrollProgress');
  const backTop = $('#backTop');
  const ring = $('#backTopRing');
  const heroBg = $('.heroSlidesBg');
  const heroInner = $('.heroInner');
  const ctaPanel = $('#ctaPanel');
  const RING_LEN = 138.2;
  let lastY = window.scrollY;
  let scrollVel = 0;
  let scrollDir = 1;
  let ticking = false;

  const onScroll = () => {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    const pct = max > 0 ? y / max : 0;

    if (progress) progress.style.transform = `scaleX(${pct})`;
    if (ring) ring.style.strokeDashoffset = RING_LEN * (1 - pct);
    backTop?.classList.toggle('isVisible', y > 600);
    header?.classList.toggle('isScrolled', y > 30);

    if (!reduceMotion && y < vh * 1.2) {
      if (heroBg) heroBg.style.transform = `translate3d(0, ${y * 0.3}px, 0)`;
      if (heroInner) {
        heroInner.style.transform = `translate3d(0, ${y * 0.12}px, 0)`;
        heroInner.style.opacity = String(clamp(1 - y / (vh * 0.85)));
      }
    }

    if (stackCards.length && !reduceMotion) updateStack(vh);

    if (ctaPanel && !reduceMotion) {
      const r = ctaPanel.getBoundingClientRect();
      const p = clamp((vh - r.top) / (vh * 0.6 + r.height * 0.5));
      ctaPanel.style.setProperty('--rise', (1 - p).toFixed(3));
    } else if (ctaPanel) {
      ctaPanel.style.setProperty('--rise', '0');
    }

    const d = y - lastY;
    if (Math.abs(d) > 0.5) scrollDir = d > 0 ? 1 : -1;
    scrollVel = d;
    lastY = y;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* =========================================================
     Velocity ticker (direction follows scroll, speed boosts)
     ========================================================= */
  const tickerRows = $$('[data-ticker]').map(row => ({
    row,
    track: $('.tickerTrack', row),
    dir: +row.dataset.ticker || -1,
    speed: +row.dataset.speed || 60,
    x: 0,
    w: 0,
    visible: true,
  }));
  if (tickerRows.length && !reduceMotion) {
    const measure = () => tickerRows.forEach(t => { t.w = $('.tickerGroup', t.track)?.offsetWidth || 0; });
    measure();
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => entries.forEach(en => {
        const t = tickerRows.find(r => r.row === en.target);
        if (t) t.visible = en.isIntersecting;
      }));
      tickerRows.forEach(t => io.observe(t.row));
    }
    let boost = 0;
    let last = performance.now();
    const loop = now => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      boost = lerp(boost, Math.min(Math.abs(scrollVel) * 9, 900), 0.08);
      scrollVel *= 0.9;
      const skew = clamp(boost / 120, 0, 6) * scrollDir;
      tickerRows.forEach(t => {
        if (!t.visible || !t.w) return;
        t.x += t.dir * scrollDir * (t.speed + boost) * dt;
        if (t.x <= -t.w) t.x += t.w;
        if (t.x > 0) t.x -= t.w;
        t.track.style.transform = `translate3d(${t.x.toFixed(2)}px,0,0) skewX(${(-skew * t.dir).toFixed(2)}deg)`;
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* =========================================================
     Reveals & counters
     ========================================================= */
  const reveals = $$('.reveal, .imgReveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const revObs = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('isIn'); obs.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    reveals.forEach(el => revObs.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('isIn'));
  }

  const fmt = n => n.toLocaleString('en-IN');
  const runCount = el => {
    const target = +el.dataset.count;
    if (reduceMotion) { el.textContent = fmt(target); return; }
    const start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / 2000);
      el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - t, 4))));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const counters = $$('[data-count]');
  if ('IntersectionObserver' in window) {
    const cObs = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => { if (en.isIntersecting) { runCount(en.target); obs.unobserve(en.target); } });
    }, { threshold: 0.6 });
    counters.forEach(c => cObs.observe(c));
  } else {
    counters.forEach(c => { c.textContent = fmt(+c.dataset.count); });
  }

  /* =========================================================
     Pointer FX: cursor, magnetic buttons, service image follow
     ========================================================= */
  if (finePointer && !reduceMotion) {
    const dot = $('#cursorDot');
    const ringEl = $('#cursorRing');
    const label = $('#cursorLabel');
    let mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener('pointermove', e => {
      mx = e.clientX; my = e.clientY;
      dot?.classList.add('isOn'); ringEl?.classList.add('isOn');
    }, { passive: true });
    document.addEventListener('pointerleave', () => { dot?.classList.remove('isOn'); ringEl?.classList.remove('isOn'); });
    document.addEventListener('pointerover', e => {
      const el = e.target.closest('a, button, [data-cursor], label, input, select, textarea');
      const lab = e.target.closest('[data-cursor]')?.dataset.cursor || '';
      ringEl?.classList.toggle('isHover', !!el && !lab);
      ringEl?.classList.toggle('hasLabel', !!lab);
      if (label) label.textContent = lab;
    });
    const loop = () => {
      rx = lerp(rx, mx, 0.16);
      ry = lerp(ry, my, 0.16);
      if (dot) dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      if (ringEl) ringEl.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(loop);
    };
    loop();

    $$('.magnetic').forEach(btn => {
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });

  }

  /* =========================================================
     Solutions accordion
     ========================================================= */
  const solCards = $$('.solutionCard');
  const openSol = card => solCards.forEach(c => c.classList.toggle('isOpen', c === card));
  solCards.forEach(card => {
    card.addEventListener('mouseenter', () => { if (window.innerWidth >= 1024) openSol(card); });
    card.addEventListener('focus', () => openSol(card));
    card.addEventListener('click', () => openSol(card));
  });

  /* =========================================================
     Process: draggable card carousel (mouse drag, touch swipe, arrows)
     ========================================================= */
  const processTrack = $('#processTrack');
  const processViewport = $('#processViewport');
  const processFill = $('#processFill');
  const setPadL = () => {
    const c = $('.processPin .container');
    if (!c) return;
    const left = c.getBoundingClientRect().left + parseFloat(getComputedStyle(c).paddingLeft || 0);
    root.style.setProperty('--padL', `${Math.max(16, left)}px`);
  };
  setPadL();
  window.addEventListener('resize', setPadL);

  // Progress bar + arrow state follow the horizontal scroll position
  const procPrev = $('#processPrev');
  const procNext = $('#processNext');
  const syncProcess = () => {
    if (!processViewport) return;
    const m = processViewport.scrollWidth - processViewport.clientWidth;
    const x = processViewport.scrollLeft;
    processFill?.style.setProperty('--p', m > 0 ? (x / m).toFixed(3) : '0');
    if (procPrev) procPrev.disabled = x <= 4;
    if (procNext) procNext.disabled = x >= m - 4;
  };
  processViewport?.addEventListener('scroll', syncProcess, { passive: true });
  window.addEventListener('resize', syncProcess);
  syncProcess();

  // Arrow buttons: move one card at a time
  const cardStep = () => {
    const card = $('.processCard', processTrack);
    const gap = processTrack ? parseFloat(getComputedStyle(processTrack).columnGap || 0) : 0;
    return card ? card.getBoundingClientRect().width + gap : 320;
  };
  procPrev?.addEventListener('click', () => processViewport.scrollBy({ left: -cardStep(), behavior: 'smooth' }));
  procNext?.addEventListener('click', () => processViewport.scrollBy({ left: cardStep(), behavior: 'smooth' }));

  // Mouse drag-to-scroll with momentum (touch uses native swipe scrolling)
  if (processViewport) {
    let down = false, moved = false, startX = 0, startScroll = 0, lastX = 0, lastT = 0, vel = 0, glide = 0;
    const endDrag = () => {
      if (!down) return;
      down = false;
      processViewport.classList.remove('isDragging');
      // momentum glide, then let scroll-snap settle on the nearest card
      const step = () => {
        vel *= 0.94;
        processViewport.scrollLeft -= vel;
        if (Math.abs(vel) > 0.4) glide = requestAnimationFrame(step);
        else processViewport.classList.remove('isGliding');
      };
      if (!reduceMotion && Math.abs(vel) > 1) {
        processViewport.classList.add('isGliding');
        glide = requestAnimationFrame(step);
      }
    };
    processViewport.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      cancelAnimationFrame(glide);
      processViewport.classList.remove('isGliding');
      down = true; moved = false;
      startX = lastX = e.clientX;
      startScroll = processViewport.scrollLeft;
      lastT = performance.now();
      vel = 0;
    });
    window.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 4) { moved = true; processViewport.classList.add('isDragging'); }
      if (!moved) return;
      e.preventDefault();
      processViewport.scrollLeft = startScroll - dx;
      const now = performance.now();
      vel = (e.clientX - lastX) / Math.max(1, now - lastT) * 16;
      lastX = e.clientX; lastT = now;
    });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    // A drag should not count as a click on something inside a card
    processViewport.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    processViewport.addEventListener('dragstart', e => e.preventDefault());

    // Keyboard: arrow keys when the carousel has focus
    processViewport.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); procNext?.click(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); procPrev?.click(); }
    });
  }

  /* =========================================================
     Savings calculator
     Assumptions (indicative): tariff ₹9/unit home, ₹11/unit business;
     1 kW ≈ 120 units/month; ~90% bill offset; cost ≈ ₹60k/kW home,
     ₹50k/kW business; PM Surya Ghar subsidy ₹30k/kW up to 2 kW,
     ₹78k cap from 3 kW.
     ========================================================= */
  const range = $('#billRange');
  if (range) {
    const out = { bill: $('#billValue'), size: $('#resSize'), year: $('#resYear'), subsidy: $('#resSubsidy'), payback: $('#resPayback') };
    const calcWa = $('#calcWa');
    const rupee = n => '₹' + Math.round(n).toLocaleString('en-IN');
    let type = 'home';
    const subsidyFor = kw => (type !== 'home' ? 0 : kw >= 3 ? 78000 : kw >= 2 ? 60000 : 30000 * kw);
    const setVal = (el, v) => {
      if (el.textContent === v) return;
      el.textContent = v;
      el.classList.remove('isBump'); void el.offsetWidth; el.classList.add('isBump');
    };
    const calc = () => {
      const bill = +range.value;
      const tariff = type === 'home' ? 9 : 11;
      const kw = Math.max(1, Math.round((bill / tariff / 120) * 2) / 2);
      const yearly = bill * 12 * 0.9;
      const cost = kw * (type === 'home' ? 60000 : 50000);
      const subsidy = subsidyFor(kw);
      const payback = Math.max(0.5, (cost - subsidy) / yearly);
      range.style.setProperty('--fill', `${((bill - range.min) / (range.max - range.min)) * 100}%`);
      out.bill.textContent = rupee(bill);
      setVal(out.size, `${kw} kW`);
      setVal(out.year, rupee(yearly));
      setVal(out.subsidy, subsidy ? rupee(subsidy) : 'N/A');
      setVal(out.payback, `${payback.toFixed(1)} yrs`);
      if (calcWa) {
        calcWa.href = waLink(
          `Hello S'unlimited Solar! I used the savings calculator on your website.\n\n` +
          `Property: ${type === 'home' ? 'Home' : 'Business'}\n` +
          `Monthly bill: ${rupee(bill)}\n` +
          `Suggested system: ${kw} kW\n` +
          `Estimated yearly savings: ${rupee(yearly)}\n` +
          (subsidy ? `Estimated subsidy: ${rupee(subsidy)}\n` : '') +
          `\nPlease share an exact quote.`
        );
      }
    };
    range.addEventListener('input', calc);
    $$('.calcToggleBtn').forEach(btn => btn.addEventListener('click', () => {
      type = btn.dataset.type;
      $$('.calcToggleBtn').forEach(b => { b.classList.toggle('isActive', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
      calc();
    }));
    calc();
  }

  /* =========================================================
     Testimonials slider (autoplay, dots with progress, swipe)
     ========================================================= */
  const tSlider = $('#testiSlider');
  const tSlides = $$('.testiSlide');
  const tDots = $$('.testiDot');
  const tCount = $('#testiCurrent');
  if (tSlider && tSlides.length) {
    const T_DUR = 6500;
    let tIdx = 0, tElapsed = 0, tHover = false, tVisible = false, tTabHidden = false;
    document.addEventListener('visibilitychange', () => { tTabHidden = document.hidden; });
    const tGo = i => {
      const prev = tIdx;
      tIdx = (i + tSlides.length) % tSlides.length;
      tElapsed = 0;
      if (prev === tIdx) return;
      tSlides.forEach((s2, n) => {
        s2.classList.toggle('isActive', n === tIdx);
        s2.classList.toggle('isLeaving', n === prev);
        s2.setAttribute('aria-hidden', String(n !== tIdx));
      });
      setTimeout(() => tSlides[prev].classList.remove('isLeaving'), 700);
      tDots.forEach((d, n) => {
        d.classList.toggle('isActive', n === tIdx);
        d.classList.toggle('isDone', n < tIdx);
        d.setAttribute('aria-selected', String(n === tIdx));
      });
      if (tCount) tCount.textContent = String(tIdx + 1).padStart(2, '0');
    };
    $('#testiPrev')?.addEventListener('click', () => tGo(tIdx - 1));
    $('#testiNext')?.addEventListener('click', () => tGo(tIdx + 1));
    tDots.forEach((d, n) => d.addEventListener('click', () => tGo(n)));
    tSlider.addEventListener('mouseenter', () => { tHover = true; });
    tSlider.addEventListener('mouseleave', () => { tHover = false; });
    let tsx = 0;
    tSlider.addEventListener('touchstart', e => { tsx = e.touches[0].clientX; }, { passive: true });
    tSlider.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - tsx;
      if (Math.abs(dx) > 50) tGo(tIdx + (dx < 0 ? 1 : -1));
    }, { passive: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { tVisible = en.isIntersecting; }).observe(tSlider);
    } else { tVisible = true; }
    let tLast = performance.now();
    const tLoop = now => {
      const dt = Math.min(64, now - tLast);
      tLast = now;
      if (!reduceMotion && !tHover && tVisible && !tTabHidden) tElapsed += dt;
      const p = clamp(tElapsed / T_DUR);
      tSlider.style.setProperty('--tprog', p.toFixed(4));
      if (p >= 1) tGo(tIdx + 1);
      requestAnimationFrame(tLoop);
    };
    requestAnimationFrame(tLoop);
  }

  /* =========================================================
     Dialogs: focus trap, quote drawer, video modal
     ========================================================= */
  const trapFocus = (container, e) => {
    if (e.key !== 'Tab' || !container) return;
    const f = $$('a[href], button:not([disabled]), input, select, textarea', container).filter(el => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const panel = $('#quotePanel');
  const form = $('#quoteForm');
  let lastFocus = null;
  const setQuote = open => {
    if (!panel) return;
    if (open) lastFocus = document.activeElement;
    panel.classList.toggle('isOpen', open);
    panel.setAttribute('aria-hidden', String(!open));
    lock('quote', open);
    if (open) setTimeout(() => $('#qName')?.focus({ preventScroll: true }), 350);
    else lastFocus?.focus?.({ preventScroll: true });
  };
  $$('[data-quote-open]').forEach(el => el.addEventListener('click', e => {
    e.preventDefault();
    setMenu(false);
    setQuote(true);
  }));
  $$('[data-quote-close]').forEach(el => el.addEventListener('click', () => setQuote(false)));
  panel?.addEventListener('keydown', e => trapFocus($('.quoteSheet', panel), e));

  if (form) {
    const name = $('#qName');
    const err = $('#qNameError');
    const showErr = on => {
      name.classList.toggle('isInvalid', on);
      err.classList.toggle('isShown', on);
      name.setAttribute('aria-invalid', String(on));
    };
    name.addEventListener('input', () => { if (name.value.trim()) showErr(false); });
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!name.value.trim()) { showErr(true); name.focus(); return; }
      const d = new FormData(form);
      const msg =
        `Hello S'unlimited Solar! I'd like a free solar quote.\n\n` +
        `Name: ${d.get('name').trim()}\n` +
        `City: ${d.get('city')}\n` +
        `Property: ${d.get('property')}\n` +
        `Monthly bill: ${d.get('bill')}` +
        (d.get('message').trim() ? `\nMessage: ${d.get('message').trim()}` : '');
      window.open(waLink(msg), '_blank', 'noopener');
      setQuote(false);
    });
  }

  const modal = $('#videoModal');
  const box = $('#videoBox');
  const playBtn = $('#playBtn');
  const closeBtn = $('#videoClose');
  const VIDEO_ID = 'JLg5Nqq7a5o';
  const openVideo = () => {
    box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0" title="S'unlimited Solar video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    modal.classList.add('isOpen');
    modal.setAttribute('aria-hidden', 'false');
    lock('video', true);
    closeBtn.focus();
  };
  const closeVideo = () => {
    if (!modal.classList.contains('isOpen')) return;
    modal.classList.remove('isOpen');
    modal.setAttribute('aria-hidden', 'true');
    lock('video', false);
    setTimeout(() => { box.innerHTML = ''; }, 400);
    playBtn.focus({ preventScroll: true });
  };
  if (modal && playBtn) {
    playBtn.addEventListener('click', openVideo);
    $('.videoFrame')?.addEventListener('click', e => { if (e.target !== playBtn && !playBtn.contains(e.target)) openVideo(); });
    closeBtn.addEventListener('click', closeVideo);
    modal.addEventListener('click', e => { if (e.target === modal) closeVideo(); });
    modal.addEventListener('keydown', e => trapFocus(modal, e));
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (modal?.classList.contains('isOpen')) closeVideo();
    else if (panel?.classList.contains('isOpen')) setQuote(false);
    else setMenu(false);
  });
})();
