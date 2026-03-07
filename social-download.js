/**
 * social-download.js
 *
 * Injects a "Download Reel" / "Download Video" button directly into
 * Instagram and Facebook's native 3-dot context menus (the bottom-sheet
 * overlay that appears when a user taps ••• on a Reel or video post).
 *
 * Flow:
 *  1. MutationObserver watches for newly-added dialog / menu nodes.
 *  2. When a node appears that contains known menu-item text (Save, Copy link…)
 *     it is identified as a video-options menu.
 *  3. A visually-matching download button is prepended to that menu.
 *  4. On click the best HTTP(S) video src is found on the page and a
 *     { type: 'downloadVideo', url, filename } message is sent to background.js,
 *     which calls chrome.downloads.download() with the CDN URL.
 */
(function () {
  'use strict';

  const isIG = location.hostname.includes('instagram.com');
  const isFB =
    location.hostname.includes('facebook.com') ||
    location.hostname.includes('fb.com');

  if (!isIG && !isFB) return;

  const ITEM_ID    = 'yt-ext-dl-item';
  const TOAST_ID   = 'yt-ext-dl-toast';
  const LABEL      = isIG ? 'Download Reel' : 'Download Video';

  // Keywords that identify "video options" menus on each platform.
  const MENU_HINTS = isIG
    ? ['save', 'reel', 'copy link', 'report', 'not interested']
    : ['save video', 'copy link', 'share', 'download video', 'report'];

  // ── Locate the best playable video URL on the active page ───────────────
  /**
   * Iterates all <video> elements sorted by duration (longest first), so the
   * main content is preferred over avatar loops or thumbnail previews.
   * Returns the first CDN URL found, or null if none is available yet.
   *
   * @returns {string|null} HTTP(S) video URL or null
   */
  function getBestVideoSrc() {
    const videos = Array.from(document.querySelectorAll('video'));
    videos.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    for (const v of videos) {
      const src = v.currentSrc || v.src || '';
      if (src.startsWith('http')) return src;
      // Fallback: explicit <source> children
      for (const s of v.querySelectorAll('source')) {
        if ((s.src || '').startsWith('http')) return s.src;
      }
    }
    return null;
  }

  // ── Dispatch the download via background.js ──────────────────────────────
  /**
   * Resolves the video URL and sends a message to background.js to trigger
   * chrome.downloads.download(). Shows a page-level toast with the result.
   */
  function triggerDownload() {
    const src = getBestVideoSrc();

    if (!src) {
      showPageToast('❌ No downloadable video found on this page.');
      return;
    }
    if (src.startsWith('blob:')) {
      showPageToast('❌ This video is DRM-protected and cannot be saved directly.');
      return;
    }

    const platform = isIG ? 'instagram' : 'facebook';
    const filename  = `${platform}_${Date.now()}.mp4`;

    chrome.runtime.sendMessage({ type: 'downloadVideo', url: src, filename }, (res) => {
      if (chrome.runtime.lastError || !res?.success) {
        showPageToast('❌ Download failed. Try again.');
      } else {
        showPageToast('✅ Download started!');
      }
    });
  }

  // ── Minimal fixed-position toast for user feedback ───────────────────────
  /**
   * Renders a brief toast at the bottom-centre of the page and removes it
   * after 3 seconds. Only one toast is shown at a time.
   *
   * @param {string} text - Message with an optional leading ✅ or ❌ emoji.
   */
  function showPageToast(text) {
    let t = document.getElementById(TOAST_ID);
    if (t) t.remove();

    t = document.createElement('div');
    t.id = TOAST_ID;

    const ok = text.startsWith('✅');
    Object.assign(t.style, {
      position:   'fixed',
      bottom:     '80px',
      left:       '50%',
      transform:  'translateX(-50%)',
      background: ok ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
      color:      '#fff',
      fontSize:   '13px',
      fontWeight: '600',
      padding:    '10px 22px',
      borderRadius: '24px',
      zIndex:     '2147483647',
      whiteSpace: 'nowrap',
      boxShadow:  '0 4px 20px rgba(0,0,0,0.5)',
      pointerEvents: 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    });
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 3000);
  }

  // ── Build the injected <button> element ─────────────────────────────────
  /**
   * Creates a button styled to visually blend with existing menu items.
   * Copies font, colour and padding from a reference sibling element so it
   * automatically adapts to Instagram's and Facebook's theming.
   *
   * @param {Element|null} referenceItem - An existing menu item to mirror.
   * @returns {HTMLButtonElement}
   */
  function buildDownloadItem(referenceItem) {
    const item = document.createElement('button');
    item.id   = ITEM_ID;
    item.type = 'button';

    const ref = referenceItem ? getComputedStyle(referenceItem) : null;

    Object.assign(item.style, {
      display:    'flex',
      alignItems: 'center',
      gap:        '12px',
      width:      '100%',
      padding:    ref ? ref.padding : '12px 16px',
      background: 'transparent',
      border:     'none',
      cursor:     'pointer',
      fontSize:   ref ? ref.fontSize   : '14px',
      fontWeight: ref ? ref.fontWeight  : '400',
      color:      ref ? ref.color       : '#ffffff',
      textAlign:  'left',
      fontFamily: ref
        ? ref.fontFamily
        : '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      lineHeight:  '1.4',
      boxSizing:   'border-box',
    });

    // Download arrow icon (clean outline style, matches IG/FB aesthetic)
    item.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
           viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
           style="flex-shrink:0;opacity:0.85">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>${LABEL}</span>`;

    item.addEventListener('mouseenter', () => {
      item.style.background = 'rgba(255,255,255,0.08)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = 'transparent';
    });
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerDownload();
    });

    return item;
  }

  // ── Check whether a node looks like a video options menu ─────────────────
  /**
   * Returns true when the node's text content contains at least one of the
   * expected platform-specific phrases, indicating it is the video-options
   * bottom-sheet and not an unrelated dialog (login modal, etc.).
   *
   * @param {Element} node
   * @returns {boolean}
   */
  function isVideoOptionsMenu(node) {
    const text = (node.textContent || '').toLowerCase();
    return MENU_HINTS.some(hint => text.includes(hint));
  }

  // ── Inject the download button into a candidate menu node ────────────────
  /**
   * Validates the node, finds the list of interactive items, then prepends the
   * download button above the first item.  Idempotent — skips if already
   * injected.
   *
   * @param {Element} menuNode
   */
  function tryInject(menuNode) {
    // Skip if already injected into this node's subtree
    if (menuNode.querySelector('#' + ITEM_ID)) return;

    if (!isVideoOptionsMenu(menuNode)) return;

    // Collect interactive items (buttons / role=button / role=menuitem)
    const items = Array.from(
      menuNode.querySelectorAll('button, [role="button"], [role="menuitem"]')
    ).filter(el => el.textContent.trim().length > 1 && !el.id);

    // Require at least 2 real items so we don't accidentally target tiny overlays
    if (items.length < 2) return;

    const firstItem = items[0];
    const dlItem    = buildDownloadItem(firstItem);

    // Insert before the first real menu item
    firstItem.parentNode.insertBefore(dlItem, firstItem);
  }

  // ── MutationObserver — watch for new modal / menu nodes ──────────────────
  const observer = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType !== 1) continue;

        // Collect the node itself plus any dialog/menu descendants
        const candidates = [
          node,
          ...node.querySelectorAll('[role="dialog"], [role="menu"], [role="listbox"]'),
        ];

        for (const candidate of candidates) {
          tryInject(candidate);
        }
      }
    }
  });

  // Observe the entire document — menus are often mounted at the root level
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
