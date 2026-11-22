/**
 * Monet Dynamic Gradient Theme Engine
 * - Extracts 3-4 harmonious colors from active artwork / cover / page visuals via Canvas
 * - Light mode renders OPT editorial pastel silk gradients + luminous glass cards
 * - Dark mode renders BLAST Premier broadcast ambient neon gradients + obsidian glass cards
 * - Works on every page, syncs across modal iframes, and toggles cleanly on main UI
 */
(function() {
  const STORAGE_KEY = 'monetEnabled';
  const CACHE_VARS_KEY = 'monetCachedVars';
  const CACHE_COLORS_KEY = 'monetLastColors';
  const paletteCache = new Map();

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  }

  function colorDist(a, b) {
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11) * 1.73;
  }

  function hs(h, s, l, a) {
    const hh = ((Math.round(h) % 360) + 360) % 360;
    const ss = Math.round(clamp(s, 0, 100));
    const ll = Math.round(clamp(l, 0, 100));
    return typeof a === 'number'
      ? `hsla(${hh}, ${ss}%, ${ll}%, ${a})`
      : `hsl(${hh}, ${ss}%, ${ll}%)`;
  }

  function defaultFallbackColors() {
    // Harmonious cyan / sakura pink / violet / warm cream palette
    return [
      [110, 198, 244],
      [236, 152, 202],
      [164, 150, 240],
      [246, 212, 134]
    ];
  }

  function extractFromImageElement(img) {
    try {
      const size = 48;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;

      const bins = new Map();
      const allBins = new Map();

      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 160) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const [, s, l] = rgbToHsl(r, g, b);
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

        let ab = allBins.get(key);
        if (!ab) { ab = { r: 0, g: 0, b: 0, count: 0, s: 0, l: 0 }; allBins.set(key, ab); }
        ab.r += r; ab.g += g; ab.b += b; ab.s += s; ab.l += l; ab.count++;

        // Skip washed white paper & pitch black shadows for cleaner Monet tones
        if ((l > 92 && s < 14) || (l < 8 && s < 22)) continue;
        let bin = bins.get(key);
        if (!bin) { bin = { r: 0, g: 0, b: 0, count: 0, s: 0, l: 0 }; bins.set(key, bin); }
        bin.r += r; bin.g += g; bin.b += b; bin.s += s; bin.l += l; bin.count++;
      }

      const pool = Array.from((bins.size >= 4 ? bins : allBins).values()).map(b => {
        const ar = b.r / b.count, ag = b.g / b.count, ab = b.b / b.count;
        const as = (b.s / b.count) / 100;
        const al = (b.l / b.count) / 100;
        const satBoost = 0.22 + Math.pow(as, 1.35) * 1.45;
        const midWeight = 1.0 - Math.min(0.65, Math.abs(al - 0.54) * 1.15);
        const score = Math.pow(b.count, 0.55) * satBoost * midWeight;
        return { rgb: [Math.round(ar), Math.round(ag), Math.round(ab)], score };
      });

      if (pool.length === 0) return null;
      pool.sort((x, y) => y.score - x.score);

      const picked = [pool[0].rgb];
      for (const minDist of [64, 44, 28, 12]) {
        for (const item of pool) {
          if (picked.length >= 4) break;
          if (picked.every(p => colorDist(p, item.rgb) >= minDist)) {
            picked.push(item.rgb);
          }
        }
        if (picked.length >= 4) break;
      }

      while (picked.length < 4) {
        const base = picked[picked.length - 1];
        const [h, s, l] = rgbToHsl(base[0], base[1], base[2]);
        // Analogous harmonic shift
        const nh = (h + 32 * picked.length) % 360;
        const c = (1 - Math.abs(2 * (clamp(l, 40, 72) / 100) - 1)) * (clamp(s, 32, 78) / 100);
        const x = c * (1 - Math.abs(((nh / 60) % 2) - 1));
        const m = (clamp(l, 40, 72) / 100) - c / 2;
        let rr = 0, gg = 0, bb = 0;
        if (nh < 60) [rr, gg, bb] = [c, x, 0];
        else if (nh < 120) [rr, gg, bb] = [x, c, 0];
        else if (nh < 180) [rr, gg, bb] = [0, c, x];
        else if (nh < 240) [rr, gg, bb] = [0, x, c];
        else if (nh < 300) [rr, gg, bb] = [x, 0, c];
        else [rr, gg, bb] = [c, 0, x];
        picked.push([
          Math.round((rr + m) * 255),
          Math.round((gg + m) * 255),
          Math.round((bb + m) * 255)
        ]);
      }

      return picked.slice(0, 4);
    } catch (e) {
      return null;
    }
  }

  function extractFromUrl(url) {
    if (!url) return Promise.resolve(defaultFallbackColors());
    if (paletteCache.has(url)) {
      return Promise.resolve(paletteCache.get(url));
    }
    return new Promise((resolve) => {
      const img = new Image();
      try {
        const resolved = new URL(url, window.location.href);
        if (resolved.origin !== window.location.origin) {
          img.crossOrigin = 'anonymous';
        }
      } catch (e) {}

      img.onload = () => {
        const colors = extractFromImageElement(img) || defaultFallbackColors();
        paletteCache.set(url, colors);
        resolve(colors);
      };
      img.onerror = () => resolve(defaultFallbackColors());
      img.src = url;
    });
  }

  function buildVarsForMode(colors, isDark) {
    const hsls = colors.map(([r, g, b]) => rgbToHsl(r, g, b));

    if (isDark) {
      // BLAST Premier esports broadcast neon gradients over obsidian
      const sats = hsls.map(([, s]) => (s < 8 ? 18 : clamp(s * 1.18, 50, 88)));
      const lums = [48, 44, 52, 38];
      return {
        '--monet-base': '#0a0d14',
        '--monet-a1': hs(hsls[0][0], sats[0], lums[0], 0.36),
        '--monet-a2': hs(hsls[1][0], sats[1], lums[1], 0.32),
        '--monet-a3': hs(hsls[2][0], sats[2], lums[2], 0.30),
        '--monet-a4': hs(hsls[3][0], sats[3], lums[3], 0.34),
        '--monet-band1': hs(hsls[0][0], sats[0], 54, 0.17),
        '--monet-band2': hs(hsls[1][0], sats[1], 50, 0.17),
        '--monet-dot-1': hs(hsls[0][0], clamp(sats[0], 58, 92), 64),
        '--monet-dot-2': hs(hsls[1][0], clamp(sats[1], 58, 92), 64),
        '--monet-dot-3': hs(hsls[2][0], clamp(sats[2], 58, 92), 66),
        '--monet-accent': hs(hsls[0][0], clamp(sats[0], 62, 92), 64)
      };
    } else {
      // OPT Student ID Card luminous pastel silk washes
      const sats = hsls.map(([, s]) => (s < 8 ? 14 : clamp(s * 0.8, 34, 72)));
      const lums = [80, 83, 86, 78];
      return {
        '--monet-base': '#f6f8fc',
        '--monet-a1': hs(hsls[0][0], sats[0], lums[0], 0.70),
        '--monet-a2': hs(hsls[1][0], sats[1], lums[1], 0.64),
        '--monet-a3': hs(hsls[2][0], sats[2], lums[2], 0.60),
        '--monet-a4': hs(hsls[3][0], sats[3], lums[3], 0.66),
        '--monet-band1': hs(hsls[0][0], sats[0], 78, 0.28),
        '--monet-band2': hs(hsls[1][0], sats[1], 80, 0.28),
        '--monet-dot-1': hs(hsls[0][0], clamp(sats[0], 48, 86), 60),
        '--monet-dot-2': hs(hsls[1][0], clamp(sats[1], 48, 86), 60),
        '--monet-dot-3': hs(hsls[2][0], clamp(sats[2], 48, 86), 62),
        '--monet-accent': hs(hsls[0][0], clamp(sats[0], 50, 86), 56)
      };
    }
  }

  function getSurfaceGradientCss(vars) {
    return [
      `radial-gradient(ellipse 68% 58% at 12% 14%, ${vars['--monet-a1']} 0%, transparent 66%)`,
      `radial-gradient(ellipse 62% 54% at 88% 18%, ${vars['--monet-a2']} 0%, transparent 64%)`,
      `radial-gradient(ellipse 72% 60% at 82% 86%, ${vars['--monet-a3']} 0%, transparent 68%)`,
      `radial-gradient(ellipse 66% 56% at 16% 84%, ${vars['--monet-a4']} 0%, transparent 65%)`,
      `linear-gradient(135deg, ${vars['--monet-band1']} 0%, transparent 46%, ${vars['--monet-band2']} 100%)`
    ].join(', ');
  }

  function extractCssBgUrl(el) {
    if (!el) return '';
    const raw = el.style.backgroundImage || window.getComputedStyle(el).backgroundImage || '';
    const m = raw.match(/url\(["']?([^"')]+)["']?\)/i);
    return m ? m[1] : '';
  }

  function discoverPageImageUrl() {
    // 1. Active card inside Cover Stack
    const activeCard =
      document.querySelector('.post-cover--stack .cover-stack-card.is-active') ||
      document.querySelector('.post-cover--stack .cover-stack-card[data-index="0"]');
    if (activeCard && activeCard.dataset.src) return activeCard.dataset.src;

    // 2. Standard Post Cover
    const postCoverImg = document.querySelector('.post-cover:not(.post-cover--stack) img');
    if (postCoverImg && (postCoverImg.currentSrc || postCoverImg.getAttribute('src'))) {
      return postCoverImg.currentSrc || postCoverImg.getAttribute('src');
    }

    // 3. Homepage Author Card Banner
    const authorBg = document.querySelector('.author-card--with-bg');
    const authorBgUrl = extractCssBgUrl(authorBg);
    if (authorBgUrl) return authorBgUrl;

    // 4. First article card cover on Homepage
    const firstArticleImg = document.querySelector('.article-image img');
    if (firstArticleImg && (firstArticleImg.currentSrc || firstArticleImg.getAttribute('src'))) {
      return firstArticleImg.currentSrc || firstArticleImg.getAttribute('src');
    }

    // 5. About page avatar or first interest background
    const aboutAvatar = document.querySelector('.about-avatar img');
    if (aboutAvatar && (aboutAvatar.currentSrc || aboutAvatar.getAttribute('src'))) {
      return aboutAvatar.currentSrc || aboutAvatar.getAttribute('src');
    }

    // 6. First content image
    const contentImg = document.querySelector('.post-content img');
    if (contentImg && (contentImg.currentSrc || contentImg.getAttribute('src'))) {
      return contentImg.currentSrc || contentImg.getAttribute('src');
    }

    // 7. Theme fallback artwork
    return (window.theme && window.theme.monet_fallback) || '/images/御三家.png';
  }

  function getDefaultEnabled() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return saved === 'true';
    if (window.theme && window.theme.features && typeof window.theme.features.monet_default_on === 'boolean') {
      return window.theme.features.monet_default_on;
    }
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (window.theme && window.theme.features && window.theme.features.monet_theme === false) {
      return;
    }

    if (window.self !== window.top) {
      document.documentElement.classList.add('monet-in-iframe');
    }

    // Build background layer and top BLAST-style hairline bar
    let bgLayer = document.getElementById('monet-bg-layer');
    if (!bgLayer) {
      bgLayer = document.createElement('div');
      bgLayer.id = 'monet-bg-layer';
      bgLayer.setAttribute('aria-hidden', 'true');
      const sA = document.createElement('div');
      sA.className = 'monet-bg-surface monet-layer-a is-visible';
      const sB = document.createElement('div');
      sB.className = 'monet-bg-surface monet-layer-b';
      bgLayer.appendChild(sA);
      bgLayer.appendChild(sB);
      document.body.prepend(bgLayer);
    }
    const surfaceA = bgLayer.querySelector('.monet-layer-a');
    const surfaceB = bgLayer.querySelector('.monet-layer-b');
    let surfaceToggle = false;

    if (!document.querySelector('.monet-accent-bar')) {
      const bar = document.createElement('div');
      bar.className = 'monet-accent-bar';
      bar.setAttribute('aria-hidden', 'true');
      document.body.appendChild(bar);
    }

    // Add floating dock toggle button right above dark mode button
    let floatBtn = document.querySelector('.monet-float-toggle');
    if (!floatBtn) {
      let btnContainer = document.querySelector('.button-container');
      if (!btnContainer) {
        btnContainer = document.createElement('div');
        btnContainer.className = 'button-container';
        btnContainer.style.cssText = 'position:fixed;right:20px;bottom:20px;display:flex;flex-direction:column;gap:10px;z-index:1000;';
        document.body.appendChild(btnContainer);
      }
      floatBtn = document.createElement('button');
      floatBtn.type = 'button';
      floatBtn.className = 'monet-float-toggle';
      floatBtn.setAttribute('title', '莫奈取色动态背景（开/关）');
      floatBtn.setAttribute('aria-label', '切换莫奈取色背景');
      floatBtn.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>' +
        '<span class="monet-float-badge" aria-hidden="true"></span>';
      const darkBtn = btnContainer.querySelector('.dark-mode-toggle');
      if (darkBtn) {
        btnContainer.insertBefore(floatBtn, darkBtn);
      } else {
        btnContainer.appendChild(floatBtn);
      }
    }

    const navBtn = document.querySelector('.monet-nav-toggle');
    let enabled = getDefaultEnabled();
    let currentColors = null;
    try {
      const savedColors = localStorage.getItem(CACHE_COLORS_KEY);
      if (savedColors) currentColors = JSON.parse(savedColors);
    } catch (e) {}
    if (!Array.isArray(currentColors) || currentColors.length < 4) {
      currentColors = defaultFallbackColors();
    }

    function isDarkNow() {
      return document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('dark-mode');
    }

    function applyPalette(colors, crossfade) {
      currentColors = colors;
      const vars = buildVarsForMode(colors, isDarkNow());
      const rootStyle = document.documentElement.style;
      Object.keys(vars).forEach((k) => rootStyle.setProperty(k, vars[k]));

      try {
        localStorage.setItem(CACHE_VARS_KEY, JSON.stringify(vars));
        localStorage.setItem(CACHE_COLORS_KEY, JSON.stringify(colors));
      } catch (e) {}

      const gradCss = getSurfaceGradientCss(vars);
      if (!crossfade) {
        surfaceA.style.backgroundImage = gradCss;
        surfaceA.classList.add('is-visible');
        surfaceB.classList.remove('is-visible');
        surfaceToggle = false;
        return;
      }

      const incoming = surfaceToggle ? surfaceA : surfaceB;
      const outgoing = surfaceToggle ? surfaceB : surfaceA;
      surfaceToggle = !surfaceToggle;
      incoming.style.backgroundImage = gradCss;
      incoming.classList.add('is-visible');
      outgoing.classList.remove('is-visible');
    }

    function syncUiState() {
      document.documentElement.classList.toggle('monet-enabled', enabled);
      document.body.classList.toggle('monet-enabled', enabled);
      if (navBtn) {
        navBtn.classList.toggle('is-on', enabled);
        navBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      }
      if (floatBtn) {
        floatBtn.classList.toggle('is-on', enabled);
        floatBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      }
    }

    function setEnabled(nextState, save, broadcast) {
      enabled = !!nextState;
      if (save) {
        try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch (e) {}
      }
      syncUiState();
      if (enabled) {
        applyPalette(currentColors, false);
      }
      if (broadcast !== false) {
        try {
          if (window.self !== window.top && window.parent) {
            window.parent.postMessage({ type: 'monetToggleSync', enabled: enabled }, '*');
          }
          document.querySelectorAll('.article-modal-iframe').forEach((fr) => {
            if (fr.contentWindow) {
              fr.contentWindow.postMessage({ type: 'monetToggleSync', enabled: enabled }, '*');
            }
          });
        } catch (e) {}
      }
    }

    function sampleUrl(url, crossfade) {
      extractFromUrl(url).then((colors) => {
        applyPalette(colors, crossfade);
      });
    }

    if (navBtn) {
      navBtn.addEventListener('click', () => setEnabled(!enabled, true, true));
    }
    if (floatBtn) {
      floatBtn.addEventListener('click', () => setEnabled(!enabled, true, true));
    }

    // Apply cached colors right away to avoid flash, then sample actual page artwork
    syncUiState();
    applyPalette(currentColors, false);
    sampleUrl(discoverPageImageUrl(), true);

    // Sync with Cover Stack switching
    let coverTimer = null;
    window.addEventListener('coverStackChange', (e) => {
      if (!e.detail || !e.detail.src) return;
      clearTimeout(coverTimer);
      coverTimer = setTimeout(() => {
        sampleUrl(e.detail.src, true);
      }, 90);
    });

    // Re-tint Monet gradient immediately when Dark Mode changes
    let lastDarkMode = isDarkNow();
    const onModeChange = () => {
      const dark = isDarkNow();
      if (dark === lastDarkMode) return;
      lastDarkMode = dark;
      applyPalette(currentColors, true);
    };
    window.addEventListener('themeChange', onModeChange);
    const bodyObserver = new MutationObserver(() => onModeChange());
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // Sync Monet enable/disable across tabs & article-modal iframes
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        setEnabled(e.newValue === 'true', false, false);
      }
    });
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'monetToggleSync') {
        setEnabled(!!e.data.enabled, false, false);
      }
    });

    // Expose helper so modal parent/child can stay synced
    window.monetTheme = {
      toggle: () => setEnabled(!enabled, true, true),
      sample: (url) => sampleUrl(url, true),
      isEnabled: () => enabled
    };
  });
})();
