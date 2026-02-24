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
  let positionRaf = null;
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
    document.addEventListener('mousemove', onMouseMove, true);
  }

  function detachListeners() {
    document.removeEventListener('mousemove', onMouseMove, true);
  }

  // ─── Event handlers ───────────────────────────────────────────────────────
  function findVideoAtPoint(x, y) {
    try {
      const els = document.elementsFromPoint(x, y);
      const v = els.find(el => el.tagName === 'VIDEO');
      if (v) return v;
    } catch (_) {}
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return v;
    }
    return null;
  }

  function onMouseMove(e) {
    if (!enabled) return;
    // Skip if cursor is over the overlay itself
    if (activeOverlay && activeOverlay.contains(e.target)) return;

    const video = findVideoAtPoint(e.clientX, e.clientY);

    if (video) {
      clearTimeout(hideTimer);
      if (!activeOverlay) {
        showOverlay(video);
      } else if (activeOverlay._targetVideo !== video) {
        // Switched to a different video — update target and reposition
        activeOverlay._targetVideo = video;
        syncSpeedUI(video);
        schedulePosition(video);
      } else {
        schedulePosition(video);
      }
    } else {
      if (activeOverlay) scheduleHide();
    }
  }

  // Throttle position updates to once per animation frame
  function schedulePosition(video) {
    if (positionRaf) return;
    positionRaf = requestAnimationFrame(() => {
      positionRaf = null;
      positionOverlay(video);
    });
  }

  // ─── Speed helpers ────────────────────────────────────────────────────────
  function setSpeed(s) {
    const video = activeOverlay && activeOverlay._targetVideo;
    if (!video) return;
    s = Math.min(4, Math.max(0.25, Math.round(s * 4) / 4));
    video.playbackRate = s;
    updateSpeedUI(s);
    chrome.storage.local.set({ [SPEED_KEY]: s });
  }

  function updateSpeedUI(s) {
    if (!activeOverlay) return;
    const label = activeOverlay.querySelector('.vh-label');
    const text  = s % 1 === 0 ? `${s}×` : `${parseFloat(s.toFixed(2))}×`;
    label.textContent = text;
  }

  function syncSpeedUI(video) {
    if (!activeOverlay || !video) return;
    chrome.storage.local.get([SPEED_KEY], (data) => {
      const s = parseFloat(data[SPEED_KEY]) || video.playbackRate || 1;
      video.playbackRate = s;
      updateSpeedUI(s);
    });
  }

  // ─── Overlay ──────────────────────────────────────────────────────────────
  function ensureStyle() {
    if (document.getElementById('__vh_style__')) return;
    const style = document.createElement('style');
    style.id = '__vh_style__';
    style.textContent = `
      #__vh_overlay__ {
        position: fixed;
        z-index: 2147483647;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 7px;
        background: rgba(0,0,0,0.35);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        border: none;
        border-radius: 6px;
        box-shadow: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        pointer-events: all;
        transition: opacity 0.08s ease, transform 0.08s ease;
        opacity: 0;
        transform: scale(0.92);
        user-select: none;
      }
      #__vh_overlay__.vh-visible {
        opacity: 1;
        transform: scale(1);
      }
      .vh-btn {
        background: none;
        border: none;
        color: #fff;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 15px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.1s, transform 0.08s;
        padding: 0;
        flex-shrink: 0;
        opacity: 0.9;
      }
      .vh-btn:hover { opacity: 1; }
      .vh-btn:active { transform: scale(0.82); }
      .vh-label {
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        min-width: 24px;
        text-align: center;
        letter-spacing: 0.01em;
        cursor: default;
        opacity: 0.9;
      }
    `;
    document.head.appendChild(style);
  }

  function createOverlay() {
    ensureStyle();
    const el = document.createElement('div');
    el.id = '__vh_overlay__';
    el.innerHTML = `
      <button class="vh-btn vh-minus" title="Slower (−0.25×)">−</button>
      <span class="vh-label">1×</span>
      <button class="vh-btn vh-plus" title="Faster (+0.25×)">+</button>
    `;
    return el;
  }

  // Track video play on social platforms (once per video element)
  function trackSocialVideo(video) {
    if (video._vhTracked) return;
    video._vhTracked = true;
    const h = location.hostname;
    let domain = null;
    if (h.includes('instagram.com')) domain = 'ig';
    else if (h.includes('facebook.com') || h.includes('fb.com')) domain = 'fb';
    if (!domain) return;
    chrome.runtime.sendMessage({ type: 'socialVideoPlay', domain });
  }

  function showOverlay(video) {
    if (!activeOverlay) {
      activeOverlay = createOverlay();
      // Mount on <html> — escapes CSS transform/overflow stacking context on <body> (Instagram, TikTok)
      document.documentElement.appendChild(activeOverlay);

      // Controls always read _targetVideo — never stale closure
      activeOverlay.querySelector('.vh-minus').addEventListener('click', (e) => {
        e.stopPropagation();
        const v = activeOverlay._targetVideo;
        setSpeed((v ? v.playbackRate : 1) - 0.25);
      });
      activeOverlay.querySelector('.vh-plus').addEventListener('click', (e) => {
        e.stopPropagation();
        const v = activeOverlay._targetVideo;
        setSpeed((v ? v.playbackRate : 1) + 0.25);
      });
      // Double-click label to reset to 1×
      activeOverlay.querySelector('.vh-label').addEventListener('dblclick', (e) => {
        e.stopPropagation();
        setSpeed(1);
      });
      activeOverlay.addEventListener('mouseenter', () => clearTimeout(hideTimer));
      activeOverlay.addEventListener('mouseleave', () => scheduleHide());
    }

    activeOverlay._targetVideo = video;
    trackSocialVideo(video);
    positionOverlay(video);
    syncSpeedUI(video);
    requestAnimationFrame(() => activeOverlay.classList.add('vh-visible'));
  }

  function positionOverlay(video) {
    if (!activeOverlay) return;
    const rect = video.getBoundingClientRect();
    const W = activeOverlay.offsetWidth || 80;
    activeOverlay.style.top  = `${rect.top + 6}px`;
    activeOverlay.style.left = `${rect.right - W - 6}px`;
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(removeOverlay, 0);
  }

  function removeOverlay() {
    if (!activeOverlay) return;
    activeOverlay.classList.remove('vh-visible');
    const el = activeOverlay;
    activeOverlay = null;
    setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 180);
  }

})();
