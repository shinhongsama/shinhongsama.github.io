/**
 * Stacked Cover Gallery (iOS App-Switcher Style)
 * Supports touch swipe, mouse drag, trackpad horizontal wheel, arrow keys, dot scrub, and click-to-center / click-to-jump.
 */
(function() {
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function initCoverStack(root) {
    const viewport = root.querySelector('.cover-stack-viewport');
    const cards = Array.from(root.querySelectorAll('.cover-stack-card'));
    if (!viewport || cards.length === 0) return;

    const bgA = root.querySelector('.cover-stack-bg-a');
    const bgB = root.querySelector('.cover-stack-bg-b');
    const btnPrev = root.querySelector('.cover-stack-nav.prev');
    const btnNext = root.querySelector('.cover-stack-nav.next');
    const titleEl = root.querySelector('.cover-stack-title');
    const counterEl = root.querySelector('.cover-stack-counter');
    const captionEl = root.querySelector('.cover-stack-caption');
    const dotsWrap = root.querySelector('.cover-stack-dots');

    const total = cards.length;
    let activeIndex = 0;
    let targetIndex = 0;
    let visualIndex = 0;
    let rafId = null;
    let bgToggle = false;
    let lastBgSrc = '';

    // Build indicator controls (dots for <= 24 cards, range slider for larger decks)
    let dots = [];
    let rangeInput = null;
    if (dotsWrap) {
      if (total <= 24) {
        cards.forEach((card, idx) => {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'cover-stack-dot';
          dot.setAttribute('aria-label', card.dataset.title || ('第 ' + (idx + 1) + ' 张'));
          dot.addEventListener('click', (e) => {
            e.stopPropagation();
            goTo(idx);
          });
          dotsWrap.appendChild(dot);
          dots.push(dot);
        });
      } else {
        const wrap = document.createElement('div');
        wrap.className = 'cover-stack-range-wrap';
        rangeInput = document.createElement('input');
        rangeInput.type = 'range';
        rangeInput.className = 'cover-stack-range';
        rangeInput.min = '0';
        rangeInput.max = String(total - 1);
        rangeInput.value = '0';
        rangeInput.addEventListener('input', () => {
          goTo(parseInt(rangeInput.value, 10) || 0);
        });
        wrap.appendChild(rangeInput);
        dotsWrap.appendChild(wrap);
      }
    }

    function preloadAround(centerIdx) {
      const start = Math.max(0, centerIdx - 5);
      const end = Math.min(total - 1, centerIdx + 5);
      for (let i = start; i <= end; i++) {
        const img = cards[i].querySelector('img');
        if (img && img.getAttribute('loading') === 'lazy') {
          img.setAttribute('loading', 'eager');
        }
      }
    }

    function updateBackdrop(src) {
      if (!src || src === lastBgSrc) return;
      lastBgSrc = src;
      const incoming = bgToggle ? bgA : bgB;
      const outgoing = bgToggle ? bgB : bgA;
      bgToggle = !bgToggle;

      if (incoming) {
        incoming.style.backgroundImage = 'url("' + src.replace(/"/g, '\\"') + '")';
        incoming.classList.add('is-visible');
      }
      if (outgoing) {
        outgoing.classList.remove('is-visible');
      }
    }

    function syncHud(idx) {
      const card = cards[idx];
      if (!card) return;
      if (titleEl) titleEl.textContent = card.dataset.title || ('#' + (idx + 1));
      if (counterEl) counterEl.textContent = (idx + 1) + ' / ' + total;
      if (captionEl) {
        if (card.dataset.target) {
          captionEl.classList.add('is-clickable');
          captionEl.setAttribute('title', '点击跳转到对应锐评');
        } else {
          captionEl.classList.remove('is-clickable');
          captionEl.removeAttribute('title');
        }
      }
      if (btnPrev) btnPrev.disabled = idx <= 0;
      if (btnNext) btnNext.disabled = idx >= total - 1;
      dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
      if (rangeInput) rangeInput.value = String(idx);
      updateBackdrop(card.dataset.src);
      preloadAround(idx);
    }

    function renderStack() {
      const stageW = viewport.clientWidth || 720;
      // Adaptive card spread step so mobile & desktop show natural app-switcher overlap
      const baseStep = Math.min(138, Math.max(66, stageW * 0.195));
      const ratio = 0.64;

      for (let i = 0; i < total; i++) {
        const card = cards[i];
        const d = i - visualIndex;
        const absD = Math.abs(d);

        if (absD > 5.2) {
          card.style.opacity = '0';
          card.style.visibility = 'hidden';
          card.style.pointerEvents = 'none';
          card.classList.remove('is-active');
          continue;
        }

        const sign = d < 0 ? -1 : 1;
        // Geometric series produces tight app-switcher stacking toward the edges
        const tx = d === 0 ? 0 : sign * (baseStep * (1 - Math.pow(ratio, absD)) / (1 - ratio));
        const tz = -absD * 44;
        const sc = Math.max(0.56, 1 - absD * 0.115);
        const rotY = clamp(-d * 7.5, -24, 24);
        const ty = Math.min(10, absD * 2.5);
        const opacity = absD > 4.2 ? Math.max(0, 1 - (absD - 4.2)) : Math.max(0.32, 1 - absD * 0.14);
        const brightness = Math.max(0.68, 1 - absD * 0.08);
        const zIndex = 100 - Math.round(absD * 10);

        card.style.visibility = 'visible';
        card.style.pointerEvents = 'auto';
        card.style.zIndex = String(zIndex);
        card.style.opacity = opacity.toFixed(3);
        card.style.filter = 'brightness(' + brightness.toFixed(3) + ')';
        card.style.transform =
          'translate3d(' + tx.toFixed(2) + 'px, ' + ty.toFixed(2) + 'px, ' + tz.toFixed(2) + 'px) ' +
          'rotateY(' + rotY.toFixed(2) + 'deg) scale(' + sc.toFixed(4) + ')';
        card.classList.toggle('is-active', absD < 0.35);
      }

      const nearest = clamp(Math.round(visualIndex), 0, total - 1);
      if (nearest !== activeIndex) {
        activeIndex = nearest;
        syncHud(activeIndex);
      }
    }

    function tick() {
      const diff = targetIndex - visualIndex;
      if (Math.abs(diff) < 0.002) {
        visualIndex = targetIndex;
        renderStack();
        rafId = null;
        return;
      }
      visualIndex += diff * 0.2;
      renderStack();
      rafId = requestAnimationFrame(tick);
    }

    function startAnimation() {
      if (rafId === null) {
        rafId = requestAnimationFrame(tick);
      }
    }

    function goTo(idx) {
      targetIndex = clamp(idx, 0, total - 1);
      if (targetIndex !== activeIndex) {
        syncHud(targetIndex);
      }
      startAnimation();
    }

    function jumpToTarget(targetSelector) {
      if (!targetSelector) return;
      const id = targetSelector.replace(/^#/, '');
      const el = document.getElementById(id);
      if (!el) return;
      const headerOffset = window.self !== window.top ? 24 : 84;
      const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }

    // Drag / Touch Swipe Physics
    let pointerActive = false;
    let dragLocked = false;
    let didDrag = false;
    let startX = 0;
    let startY = 0;
    let dragStartVisual = 0;
    let activePointerId = null;
    const samples = [];

    viewport.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pointerActive = true;
      dragLocked = e.pointerType === 'mouse';
      didDrag = false;
      startX = e.clientX;
      startY = e.clientY;
      dragStartVisual = visualIndex;
      activePointerId = e.pointerId;
      samples.length = 0;
      samples.push({ x: e.clientX, t: performance.now() });

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (dragLocked) {
        viewport.classList.add('is-dragging');
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!pointerActive || e.pointerId !== activePointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!dragLocked) {
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
          // Yield to vertical page scroll
          pointerActive = false;
          startAnimation();
          return;
        }
        if (Math.abs(dx) > 6 && Math.abs(dx) >= Math.abs(dy)) {
          dragLocked = true;
          viewport.classList.add('is-dragging');
        } else {
          return;
        }
      }

      if (Math.abs(dx) > 5) {
        didDrag = true;
      }

      const stageW = viewport.clientWidth || 720;
      const dragStep = Math.min(130, Math.max(75, stageW * 0.18));
      let raw = dragStartVisual - dx / dragStep;
      // Rubber-band beyond bounds
      if (raw < 0) raw = raw * 0.28;
      if (raw > total - 1) raw = (total - 1) + (raw - (total - 1)) * 0.28;
      visualIndex = raw;
      renderStack();

      const now = performance.now();
      samples.push({ x: e.clientX, t: now });
      while (samples.length > 2 && now - samples[0].t > 90) {
        samples.shift();
      }
    });

    function finishDrag(e) {
      if (!pointerActive || (e && e.pointerId !== activePointerId)) return;
      pointerActive = false;
      viewport.classList.remove('is-dragging');

      let velocity = 0;
      if (samples.length >= 2) {
        const first = samples[0];
        const last = samples[samples.length - 1];
        const dt = Math.max(12, last.t - first.t);
        velocity = (last.x - first.x) / dt; // px per ms
      }

      const flickOffset = clamp(-velocity * 1.45, -3.5, 3.5);
      const nextTarget = clamp(Math.round(visualIndex + flickOffset), 0, total - 1);
      goTo(nextTarget);
      if (didDrag) {
        setTimeout(() => { didDrag = false; }, 60);
      }
    }

    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);

    // Card Click: side card -> bring to front; centered card -> jump to review
    cards.forEach((card, idx) => {
      card.addEventListener('click', (e) => {
        if (didDrag) {
          e.preventDefault();
          return;
        }
        if (idx !== targetIndex) {
          goTo(idx);
        } else if (card.dataset.target) {
          jumpToTarget(card.dataset.target);
        }
      });
    });

    if (captionEl) {
      captionEl.addEventListener('click', () => {
        const card = cards[activeIndex];
        if (card && card.dataset.target) {
          jumpToTarget(card.dataset.target);
        }
      });
    }

    if (btnPrev) {
      btnPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        goTo(targetIndex - 1);
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', (e) => {
        e.stopPropagation();
        goTo(targetIndex + 1);
      });
    }

    // Mouse wheel & trackpad inside cover container controls horizontal stack
    let wheelAccum = 0;
    let lastWheelAt = 0;
    root.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();

      let delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (e.deltaMode === 1) delta *= 34;
      else if (e.deltaMode === 2) delta *= 300;
      if (Math.abs(delta) < 1) return;

      const now = performance.now();
      if (now - lastWheelAt > 180) wheelAccum = 0;
      lastWheelAt = now;

      // Discrete mouse wheel notch (>= 80px) steps 1 card cleanly per click
      if (Math.abs(delta) >= 80 && Math.abs(wheelAccum) < 15) {
        wheelAccum = 0;
        goTo(targetIndex + (delta > 0 ? 1 : -1));
        return;
      }

      // Smooth trackpad / high-res wheel accumulates before stepping
      wheelAccum += delta;
      if (Math.abs(wheelAccum) >= 55) {
        const dir = wheelAccum > 0 ? 1 : -1;
        wheelAccum = 0;
        goTo(targetIndex + dir);
      }
    }, { passive: false });

    // Keyboard navigation when focused
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(targetIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(targetIndex + 1);
      }
    });

    window.addEventListener('resize', renderStack);

    // Initial render & backdrop
    syncHud(0);
    renderStack();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.post-cover--stack').forEach(initCoverStack);
  });
})();
