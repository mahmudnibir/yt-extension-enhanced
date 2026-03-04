/**
 * Universal Video Speed â€” video-hover.js
 * Shows a minimalistic hover overlay on ANY <video> element across the web.
 * Handles: speed control, loop toggle, voice mode (Web Audio DSP).
 * Respects the "universalSpeed" toggle from the extension popup.
 */

(function () {
  'use strict';

  let enabled = false;
  let activeOverlay = null;
  let hideTimer = null;
  let positionRaf = null;   // single-frame throttle (mousemove path)
  let anchorLoop = null;    // continuous RAF anchor â€” keeps overlay pinned to video
  const STORAGE_KEY  = 'universalSpeed';
  const SPEED_KEY    = 'universalSpeedValue';

  // Voice mode labels shown inside the overlay button
  const VOICE_LABELS = { normal: 'Nrm', chipmunk: 'Chip', bassboost: 'Bass', robot: 'Robo', echo: 'Echo' };
  const VOICE_ORDER  = ['normal', 'chipmunk', 'bassboost', 'robot', 'echo'];

  // Current settings (kept in sync with storage)
  let currentVoiceMode = 'normal';
  let currentLoop      = false;

  // â”€â”€â”€ Bootstrap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  chrome.storage.local.get([STORAGE_KEY, SPEED_KEY], (localData) => {
    enabled = !!localData[STORAGE_KEY];
    if (enabled) attachListeners();
  });

  // Load voice + loop from sync storage and apply to all existing videos
  chrome.storage.sync.get(['voiceMode', 'loopVideo', 'pitchCorrection'], (data) => {
    currentVoiceMode = data.voiceMode || (data.pitchCorrection === false ? 'chipmunk' : 'normal');
    currentLoop      = !!data.loopVideo;
    applySettingsToAllVideos();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]) {
      enabled = !!changes[STORAGE_KEY].newValue;
      if (enabled) attachListeners();
      else { removeOverlay(); detachListeners(); }
    }
    if (area === 'sync') {
      let changed = false;
      if (changes.voiceMode)    { currentVoiceMode = changes.voiceMode.newValue || 'normal'; changed = true; }
      if (changes.pitchCorrection && !changes.voiceMode) {
        currentVoiceMode = changes.pitchCorrection.newValue === false ? 'chipmunk' : 'normal'; changed = true;
      }
      if (changes.loopVideo)    { currentLoop = !!changes.loopVideo.newValue; changed = true; }
      if (changed) {
        applySettingsToAllVideos();
        updateOverlayControls(); // refresh button states on open overlay
      }
    }
  });

  // --- Apply to all videos --------------------------------------------------
  /**
   * Applies current loop + voice settings to every <video> on the page.
   * Also hooks each video's 'play' event so the AudioContext resumes after
   * the first user gesture and re-applies the active voice mode immediately.
   */
  function applySettingsToAllVideos() {
    if (location.hostname.includes('youtube.com')) return;
    document.querySelectorAll('video').forEach(hookVideo);
  }

  /**
   * Applies settings to one video and attaches a play-event hook if not
   * already present. The play hook is the fix for AudioContext activation:
   * Chrome suspends new AudioContexts until a real user gesture fires;
   * the 'play' event counts as one, so we re-apply the voice mode there.
   * @param {HTMLVideoElement} v
   */
  function hookVideo(v) {
    if (location.hostname.includes('youtube.com')) return;
    v.loop = currentLoop;
    applyVoiceMode(v, currentVoiceMode);
    if (!v._vhHooked) {
      v._vhHooked = true;
      v.addEventListener('play', () => {
        v.loop = currentLoop;
        applyVoiceMode(v, currentVoiceMode);
      });
    }
  }

  // Watch for <video> elements added after page load (SPAs, lazy embeds)
  const _videoObserver = new MutationObserver(() => {
    if (location.hostname.includes('youtube.com')) return;
    document.querySelectorAll('video').forEach(v => { if (!v._vhHooked) hookVideo(v); });
  });
  _videoObserver.observe(document.documentElement, { childList: true, subtree: true });

  // â”€â”€â”€ Listener management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function attachListeners() {
    document.addEventListener('mousemove', onMouseMove, true);
  }

  function detachListeners() {
    document.removeEventListener('mousemove', onMouseMove, true);
  }

  // â”€â”€â”€ Event handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /**
   * Returns the video element under the cursor.
   * Many sites (Netflix, Twitch, etc.) place transparent <div> overlays on top
   * of the video, so elementsFromPoint returns the div instead of the video.
   * We therefore always also do a manual bounding-rect scan as a reliable fallback.
   */
  function findVideoAtPoint(x, y) {
    // 1. Native hit-test (fastest when no overlay covers the video)
    try {
      const els = document.elementsFromPoint(x, y);
      const v = els.find(el => el.tagName === 'VIDEO');
      if (v) return v;
    } catch (_) {}
    // 2. Manual rect scan â€” handles transparent overlays covering the video
    let best = null;
    let bestArea = 0;
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect();
      // Skip invisible / zero-size / scrolled-away elements
      if (r.width <= 0 || r.height <= 0) continue;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        const area = r.width * r.height;
        // Prefer the smallest video that contains this point (avoids picking
        // a huge background video when a small foreground one also matches)
        if (!best || area < bestArea) { best = v; bestArea = area; }
      }
    }
    return best;
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
        // Switched to a different video â€” re-anchor immediately
        activeOverlay._targetVideo = video;
        syncSpeedUI(video);
        updateOverlayControls();
        positionOverlay(video);   // instant reposition, then loop takes over
      }
      // The anchor loop keeps position correct â€” no extra call needed
    } else {
      if (activeOverlay) scheduleHide();
    }
  }

  // â”€â”€â”€ Continuous anchor loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /**
   * Runs every animation frame while the overlay is visible.
   * Re-pins the overlay to the target video's current bounding rect so it
   * stays correct through scroll, resize, CSS transitions, and video switches.
   */
  function startAnchorLoop() {
    if (anchorLoop) return;   // already running
    function tick() {
      if (!activeOverlay || !activeOverlay._targetVideo) {
        anchorLoop = null;
        return;
      }
      positionOverlay(activeOverlay._targetVideo);
      anchorLoop = requestAnimationFrame(tick);
    }
    anchorLoop = requestAnimationFrame(tick);
  }

  function stopAnchorLoop() {
    if (anchorLoop) { cancelAnimationFrame(anchorLoop); anchorLoop = null; }
  }

  // â”€â”€â”€ Speed helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    const text  = s % 1 === 0 ? `${s}\u00D7` : `${parseFloat(s.toFixed(2))}\u00D7`;
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

  // â”€â”€â”€ Loop helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** Toggles loop on the target video and persists to sync storage. */
  function toggleLoop() {
    const video = activeOverlay && activeOverlay._targetVideo;
    if (!video) return;
    currentLoop = !currentLoop;
    applySettingsToAllVideos(); // apply to all videos, not just hovered one
    chrome.storage.sync.set({ loopVideo: currentLoop });
    updateOverlayControls();
  }

  // â”€â”€â”€ Voice mode helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** Cycles to the next voice mode on the target video and persists. */
  function cycleVoiceMode() {
    const video = activeOverlay && activeOverlay._targetVideo;
    if (!video) return;
    const idx = VOICE_ORDER.indexOf(currentVoiceMode);
    currentVoiceMode = VOICE_ORDER[(idx + 1) % VOICE_ORDER.length];
    // Derive legacy pitchCorrection for content.js compat
    const pitchCorrection = (currentVoiceMode !== 'chipmunk');
    chrome.storage.sync.set({ voiceMode: currentVoiceMode, pitchCorrection });
    applySettingsToAllVideos();
    updateOverlayControls();
  }

  /** Refreshes loop and voice button visual state on the open overlay. */
  function updateOverlayControls() {
    if (!activeOverlay) return;
    const loopBtn  = activeOverlay.querySelector('.vh-loop');
    const voiceBtn = activeOverlay.querySelector('.vh-voice');
    if (loopBtn)  loopBtn.style.opacity  = currentLoop ? '1'   : '0.5';
    if (loopBtn)  loopBtn.title = currentLoop ? 'Loop ON (click to disable)' : 'Loop OFF (click to enable)';
    if (voiceBtn) voiceBtn.textContent = VOICE_LABELS[currentVoiceMode] || 'Nrm';
    if (voiceBtn) voiceBtn.title = `Voice: ${currentVoiceMode} (click to cycle)`;
  }

  // â”€â”€â”€ Voice Mode Audio Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /**
   * Stores one AudioContext + MediaElementSource per <video> element.
   * WeakMap ensures old video elements are garbage-collected naturally.
   */
  const _audioChains = new WeakMap();

  /** Returns (or lazily creates) the AudioContext chain for a video element. */
  function getOrCreateAudioChain(videoEl) {
    if (_audioChains.has(videoEl)) return _audioChains.get(videoEl);
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(videoEl);
      const chain = { ctx, source, activeNodes: [], oscNodes: [] };
      _audioChains.set(videoEl, chain);
      const resume = () => { if (ctx.state === 'suspended') ctx.resume(); };
      videoEl.addEventListener('play', resume, { once: false });
      document.addEventListener('click', resume, { once: true });
      return chain;
    } catch (e) {
      console.warn('[VoiceMode] AudioContext init failed:', e);
      return null;
    }
  }

  /** Tears down all active DSP nodes without destroying the context/source. */
  function clearChainNodes(chain) {
    try { chain.source.disconnect(); } catch (_) {}
    chain.oscNodes.forEach(osc => { try { osc.stop(); } catch (_) {} try { osc.disconnect(); } catch (_) {} });
    chain.activeNodes.forEach(n => { try { n.disconnect(); } catch (_) {} });
    chain.activeNodes = [];
    chain.oscNodes = [];
  }

  /**
   * Applies a voice mode to a video element.
   * Skipped on YouTube â€” content.js handles it there.
   * @param {HTMLVideoElement} videoEl
   * @param {string} mode  normal | chipmunk | bassboost | robot | echo
   */
  function applyVoiceMode(videoEl, mode) {
    if (!videoEl) return;
    if (location.hostname.includes('youtube.com')) return;

    // preservesPitch: only chipmunk wants pitch to follow rate
    const preservePitch = (mode !== 'chipmunk');
    if (typeof videoEl.preservesPitch    !== 'undefined') videoEl.preservesPitch    = preservePitch;
    if (typeof videoEl.mozPreservesPitch !== 'undefined') videoEl.mozPreservesPitch = preservePitch;

    // Normal / chipmunk â€” no Web Audio DSP needed
    if (mode === 'normal' || mode === 'chipmunk') {
      if (_audioChains.has(videoEl)) {
        const chain = _audioChains.get(videoEl);
        clearChainNodes(chain);
        chain.source.connect(chain.ctx.destination);
      }
      return;
    }

    const chain = getOrCreateAudioChain(videoEl);
    if (!chain) return;
    const { ctx, source } = chain;
    if (ctx.state === 'suspended') ctx.resume();
    clearChainNodes(chain);

    if (mode === 'bassboost') {
      const shelf = ctx.createBiquadFilter();
      shelf.type = 'lowshelf';
      shelf.frequency.value = 200;
      shelf.gain.value = 10;
      source.connect(shelf);
      shelf.connect(ctx.destination);
      chain.activeNodes = [shelf];

    } else if (mode === 'robot') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 30;
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0;
      source.connect(gainNode);
      osc.connect(gainNode.gain);
      gainNode.connect(ctx.destination);
      osc.start();
      chain.activeNodes = [gainNode];
      chain.oscNodes    = [osc];

    } else if (mode === 'echo') {
      const delay    = ctx.createDelay(3.0);
      delay.delayTime.value = 0.25;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.45;
      const wetGain  = ctx.createGain();
      wetGain.gain.value = 0.55;
      source.connect(ctx.destination);       // dry
      source.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);               // feedback loop
      delay.connect(wetGain);
      wetGain.connect(ctx.destination);
      chain.activeNodes = [delay, feedback, wetGain];
    }
  }

  // â”€â”€â”€ Overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        background: rgba(0,0,0,0.55);
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
      .vh-sep {
        width: 1px;
        height: 12px;
        background: rgba(255,255,255,0.2);
        flex-shrink: 0;
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
      .vh-loop {
        font-size: 12px;
        width: 20px;
        height: 20px;
        overflow: visible;
        opacity: 0.5;
      }
      .vh-voice {
        font-size: 9px;
        font-weight: 700;
        width: 26px;
        height: 18px;
        letter-spacing: 0.02em;
        border-radius: 3px;
        background: rgba(255,255,255,0.1);
        opacity: 0.85;
      }
      .vh-voice:hover { background: rgba(255,255,255,0.2); opacity: 1; }
    `;
    document.head.appendChild(style);
  }

  function createOverlay() {
    ensureStyle();
    const el = document.createElement('div');
    el.id = '__vh_overlay__';
    el.innerHTML = `
      <button class="vh-btn vh-minus" title="Slower (-0.25x)">&minus;</button>
      <span class="vh-label">1&#xD7;</span>
      <button class="vh-btn vh-plus" title="Faster (+0.25x)">+</button>
      <div class="vh-sep"></div>
      <button class="vh-btn vh-loop" title="Loop">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 .49-3.36"></path></svg>
      </button>
      <button class="vh-btn vh-voice" title="Voice mode">Nrm</button>
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
      // Mount on <html> â€” escapes CSS transform/overflow stacking context on <body> (Instagram, TikTok)
      document.documentElement.appendChild(activeOverlay);

      // Controls always read _targetVideo â€” never stale closure
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
      // Double-click label to reset to 1Ã—
      activeOverlay.querySelector('.vh-label').addEventListener('dblclick', (e) => {
        e.stopPropagation();
        setSpeed(1);
      });
      activeOverlay.querySelector('.vh-loop').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLoop();
      });
      activeOverlay.querySelector('.vh-voice').addEventListener('click', (e) => {
        e.stopPropagation();
        cycleVoiceMode();
      });
      activeOverlay.addEventListener('mouseenter', () => clearTimeout(hideTimer));
      activeOverlay.addEventListener('mouseleave', () => scheduleHide());
    }

    activeOverlay._targetVideo = video;
    trackSocialVideo(video);
    positionOverlay(video);
    syncSpeedUI(video);
    updateOverlayControls();
    requestAnimationFrame(() => {
      activeOverlay.classList.add('vh-visible');
      positionOverlay(video);   // recalculate with real offsetWidth after render
    });
    startAnchorLoop();          // keep the overlay pinned continuously
  }

  function positionOverlay(video) {
    if (!activeOverlay || !video) return;
    const rect = video.getBoundingClientRect();
    // If the video has scrolled off-screen or collapsed, hide the overlay
    if (rect.width <= 0 || rect.height <= 0 ||
        rect.bottom < 0 || rect.top > window.innerHeight ||
        rect.right  < 0 || rect.left > window.innerWidth) {
      activeOverlay.style.opacity = '0';
      return;
    }
    activeOverlay.style.opacity = '';   // restore if it was hidden
    // offsetWidth may be 0 on first render; fall back to a measured constant
    const W = activeOverlay.offsetWidth > 0 ? activeOverlay.offsetWidth : 120;
    const H = activeOverlay.offsetHeight > 0 ? activeOverlay.offsetHeight : 26;
    // Pin to top-right corner of the video with 6 px inset
    let top  = rect.top  + 6;
    let left = rect.right - W - 6;
    // Clamp so the overlay never goes off-screen
    top  = Math.max(4, Math.min(top,  window.innerHeight - H - 4));
    left = Math.max(4, Math.min(left, window.innerWidth  - W - 4));
    activeOverlay.style.top  = `${top}px`;
    activeOverlay.style.left = `${left}px`;
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(removeOverlay, 0);
  }

  function removeOverlay() {
    if (!activeOverlay) return;
    stopAnchorLoop();
    activeOverlay.classList.remove('vh-visible');
    const el = activeOverlay;
    activeOverlay = null;
    setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 180);
  }

  // â”€â”€â”€ Global keyboard speed control (+/-) for all sites â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /**
   * Finds the best candidate video to receive keyboard speed changes:
   * prefers the currently hovered video, then a playing video, then first video.
   * @returns {HTMLVideoElement|null}
   */
  function getKeyboardTargetVideo() {
    if (activeOverlay && activeOverlay._targetVideo) return activeOverlay._targetVideo;
    const videos = Array.from(document.querySelectorAll('video'));
    return videos.find(v => !v.paused && v.readyState > 1) || videos[0] || null;
  }

  /**
   * Show a brief speed feedback overlay for keyboard-triggered speed changes.
   * Auto-hides after 1.2 s so it doesn't clutter the page.
   * @param {HTMLVideoElement} video
   * @param {number} speed
   */
  function showKeyboardFeedback(video, speed) {
    clearTimeout(hideTimer);
    if (!activeOverlay) {
      activeOverlay = createOverlay();
      document.documentElement.appendChild(activeOverlay);
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
      activeOverlay.querySelector('.vh-label').addEventListener('dblclick', (e) => {
        e.stopPropagation();
        setSpeed(1);
      });
      activeOverlay.querySelector('.vh-loop').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLoop();
      });
      activeOverlay.querySelector('.vh-voice').addEventListener('click', (e) => {
        e.stopPropagation();
        cycleVoiceMode();
      });
      activeOverlay.addEventListener('mouseenter', () => clearTimeout(hideTimer));
      activeOverlay.addEventListener('mouseleave', () => scheduleHide());
    }
    activeOverlay._targetVideo = video;
    updateSpeedUI(speed);
    updateOverlayControls();
    positionOverlay(video);
    requestAnimationFrame(() => {
      activeOverlay.classList.add('vh-visible');
      positionOverlay(video);   // recalculate with real offsetWidth after render
    });
    startAnchorLoop();
    // Auto-dismiss
    hideTimer = setTimeout(removeOverlay, 1200);
  }

  /**
   * Handles global keydown for +/= (speed up) and -/_ (slow down) on any site.
   * Skips YouTube â€” content.js manages shortcuts there to avoid double-handling.
   * Skips when focus is in a text input or contenteditable element.
   * @param {KeyboardEvent} e
   */
  function onGlobalKeyDown(e) {
    // Let YouTube's own content.js handle it
    if (location.hostname.includes('youtube.com')) return;

    // Don't hijack keystrokes while user is typing
    const tag = (document.activeElement || {}).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (document.activeElement && document.activeElement.isContentEditable) return;

    const isIncrease = e.key === '+' || e.key === '=';
    const isDecrease = e.key === '-' || e.key === '_';
    if (!isIncrease && !isDecrease) return;

    const video = getKeyboardTargetVideo();
    if (!video) return;

    const current = parseFloat(video.playbackRate.toFixed(2));
    const newSpeed = parseFloat(
      (isIncrease
        ? Math.min(4,    Math.round((current + 0.25) * 4) / 4)
        : Math.max(0.25, Math.round((current - 0.25) * 4) / 4)
      ).toFixed(2)
    );

    video.playbackRate = newSpeed;
    chrome.storage.local.set({ [SPEED_KEY]: newSpeed });

    showKeyboardFeedback(video, newSpeed);
    e.preventDefault();
  }

  document.addEventListener('keydown', onGlobalKeyDown, true);

})();
