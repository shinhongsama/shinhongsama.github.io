/**
 * 加载动画控制
 */
(function() {
  function removeOverlay(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  function initLoadingAnimation() {
    let loadingOverlay = document.getElementById('loading-overlay') || document.querySelector('.loading-overlay');
    const enabled = !!(window.theme && window.theme.features && window.theme.features.loading_animation);

    if (!enabled) {
      removeOverlay(loadingOverlay);
      return;
    }

    if (!loadingOverlay) {
      loadingOverlay = document.createElement('div');
      loadingOverlay.id = 'loading-overlay';
      loadingOverlay.className = 'loading-overlay';
      loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
      document.body.prepend(loadingOverlay);
    }

    let hidden = false;
    let fallbackTimer = null;

    function hideOverlay() {
      if (hidden) return;
      hidden = true;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      setTimeout(function() {
        loadingOverlay.style.opacity = '0';
        loadingOverlay.style.visibility = 'hidden';

        // 动画结束后从DOM中移除
        setTimeout(function() {
          removeOverlay(loadingOverlay);
        }, 500); // 等待淡出动画完成
      }, 300); // 短暂延迟以确保内容已渲染
    }

    if (document.readyState === 'complete') {
      hideOverlay();
    } else {
      window.addEventListener('load', hideOverlay, { once: true });
      fallbackTimer = setTimeout(hideOverlay, 10000);
    }

    window.addEventListener('pageshow', function(e) {
      if (e.persisted) {
        removeOverlay(document.getElementById('loading-overlay') || document.querySelector('.loading-overlay'));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoadingAnimation);
  } else {
    initLoadingAnimation();
  }
})();
