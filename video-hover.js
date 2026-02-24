/**
 * Universal Video Speed — video-hover.js
 * Shows a minimalistic hover overlay on ANY <video> element across the web.
 * Respects the "universalSpeed" toggle from the extension popup.
 */

(function () {
  'use strict';

  let enabled = false;
  let activeOverlay = null;
  let hideTimer = null;
  const STORAGE_KEY = 'universalSpeed';
  const SPEED_KEY = 'universalSpeedValue';

  // ─── Bootstrap ────────────────────────────────────────────────────────────
  chrome.storage.local.get([STORAGE_KEY, SPEED_KEY], (data) => {
    enabled = !!data[STORAGE_KEY];
    if (enabled) attachListeners();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_KEY]) {
      enabled = !!changes[STORAGE_KEY].newValue;
      if (enabled) {
        attachListeners();
      } else {
        removeOverlay();
        detachListeners();
      }
    }
  });

  // ─── Listener management ──────────────────────────────────────────────────
  function attachListeners() {
    // Use mousemove (more reliable than mouseover on Instagram/TikTok)
    document.addEventListener('mousemove', onMouseMove, true);
    observeDOM();
  }

  function detachListeners() {
    document.removeEventListener('mousemove', onMouseMove, true);
    if (window._vhObserver) {
      window._vhObserver.disconnect();
      window._vhObserver = null;
    }
  }

  function observeDOM() {
    if (window._vhObserver) return;
    window._vhObserver = new MutationObserver(() => {});
    window._vhObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Event handlers ───────────────────────────────────────────────────────
  function findVideoAtPoint(x, y) {
    // 1) Try elementsFromPoint (works even with pointer-events:none on video)
    try {
      const els = document.elementsFromPoint(x, y);
      const v = els.find(el => el.tagName === 'VIDEO');
      if (v) return v;
    } catch (_) {}
    // 2) Fallback: check every <video> bounding rect
    const videos = document.querySelectorAll('video');
    for (const v of videos) {
      const r = v.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return v;
    }
    return null;
  }

  function onMouseMove(e) {
    if (!enabled) return;
    const video = findVideoAtPoint(e.clientX, e.clientY);
    if (video) {
      clearTimeout(hideTimer);
      if (!activeOverlay || activeOverlay._targetVideo !== video) {
        showOverlay(video);
      } else {
        positionOverlay(video);
      }
    } else {
      // Cursor not over a video — schedule hide unless over overlay
      if (activeOverlay && !activeOverlay.matches(':hover')) {
        scheduleHide();
      }
    }
  }

  // ─── Overlay ──────────────────────────────────────────────────────────────
  function createOverlay() {
    const el = document.createElement('div');
    el.id = '__vh_overlay__';
    el.innerHTML = `
      <div class="vh-pill">
        <button class="vh-btn vh-minus" title="Decrease speed">−</button>
        <span class="vh-label">1.0×</span>
        <button class="vh-btn vh-plus" title="Increase speed">+</button>
      </div>
      <input class="vh-slider" type="range" min="0.25" max="5" step="0.25" value="1">
    `;

    const style = document.createElement('style');
    style.textContent = `
      #__vh_overlay__ {
        position: fixed;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 6px 8px;
        background: rgba(0,0,0,0.72);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border-radius: 24px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.45);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        pointer-events: all;
        transition: opacity 0.18s ease;
        opacity: 0;
        user-select: none;
      }
      #__vh_overlay__.vh-visible { opacity: 1; }
      .vh-pill {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .vh-btn {
        background: rgba(255,255,255,0.12);
        border: none;
        color: #fff;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;
        padding: 0;
      }
      .vh-btn:hover { background: rgba(255,255,255,0.28); }
      .vh-label {
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        min-width: 36px;
        text-align: center;
        letter-spacing: 0.02em;
      }
      .vh-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 90px;
        height: 3px;
        border-radius: 2px;
        background: rgba(255,255,255,0.25);
        outline: none;
        cursor: pointer;
      }
      .vh-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #fff;
        cursor: pointer;
      }
      .vh-slider::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #fff;
        border: none;
        cursor: pointer;
      }
    `;

    document.head.appendChild(style);
    return el;
  }

  function showOverlay(video) {
    if (!activeOverlay) {
      activeOverlay = createOverlay();
      // Append to <html> root — avoids CSS transform/overflow traps on body (Instagram, TikTok, etc.)
      document.documentElement.appendChild(activeOverlay);

      // Wire controls
      const minusBtn = activeOverlay.querySelector('.vh-minus');
      const plusBtn  = activeOverlay.querySelector('.vh-plus');
      const slider   = activeOverlay.querySelector('.vh-slider');
      const label    = activeOverlay.querySelector('.vh-label');

      const setSpeed = (s) => {
        s = Math.min(5, Math.max(0.25, Math.round(s * 4) / 4));
        video.playbackRate = s;
        slider.value = s;
        label.textContent = s.toFixed(2).replace(/\.?0+$/, '') + '×';
        chrome.storage.local.set({ [SPEED_KEY]: s });
      };

      minusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setSpeed((video.playbackRate || 1) - 0.25);
      });
      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setSpeed((video.playbackRate || 1) + 0.25);
      });
      slider.addEventListener('input', (e) => {
        e.stopPropagation();
        setSpeed(parseFloat(e.target.value));
      });

      // Keep overlay above video if overlay is hovered
      activeOverlay.addEventListener('mouseenter', () => clearTimeout(hideTimer));
      activeOverlay.addEventListener('mouseleave', () => scheduleHide());
    }

    // Position overlay at top-center of video
    positionOverlay(video);

    // Load stored speed
    chrome.storage.local.get([SPEED_KEY], (data) => {
      const s = parseFloat(data[SPEED_KEY]) || video.playbackRate || 1;
      video.playbackRate = s;
      const slider = activeOverlay.querySelector('.vh-slider');
      const label  = activeOverlay.querySelector('.vh-label');
      slider.value = s;
      label.textContent = s.toFixed(2).replace(/\.?0+$/, '') + '×';
    });

    activeOverlay._targetVideo = video;
    requestAnimationFrame(() => activeOverlay.classList.add('vh-visible'));
  }

  function positionOverlay(video) {
    if (!activeOverlay) return;
    const rect = video.getBoundingClientRect();
    const overlayW = 120; // approximate
    // Position at top-right corner of the video
    activeOverlay.style.top  = `${rect.top + 10}px`;
    activeOverlay.style.left = `${rect.right - overlayW - 10}px`;
  }

  function scheduleHide() {
    hideTimer = setTimeout(() => {
      removeOverlay();
    }, 600);
  }

  function removeOverlay() {
    if (activeOverlay) {
      activeOverlay.classList.remove('vh-visible');
      setTimeout(() => {
        if (activeOverlay && activeOverlay.parentNode) {
          activeOverlay.parentNode.removeChild(activeOverlay);
        }
        activeOverlay = null;
      }, 200);
    }
  }
})();
