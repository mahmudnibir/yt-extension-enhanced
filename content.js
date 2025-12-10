(function () {
  let bookmarks = [];
  let currentIndex = -1;
  let video = null;
  let storageKey = null;

  let manualOverride = false;
  let overrideTimeout;

  const init = () => {
    video = document.querySelector("video");
    const progressBar = document.querySelector(".ytp-progress-bar");
    if (!video || !progressBar) {
      setTimeout(init, 1000);
      return;
    }

    const videoId = new URLSearchParams(window.location.search).get("v");
    if (!videoId) return;
    storageKey = `yt_bm_${videoId}`;

    chrome.storage.local.get([storageKey], (res) => {
      bookmarks = Array.isArray(res[storageKey]) ? res[storageKey] : [];
      bookmarks.sort((a, b) => a.time - b.time);
      bookmarks.forEach(bm => addBookmarkMarker(bm.time, bm.label));
    });

    document.addEventListener("keydown", handleKeyPress);
    setInterval(applySettings, 1000); // Adjust speed periodically

    addRemainingTimeOverlay(); // Add the remaining time overlay
    addBookmarkButton(); // Add bookmark button to player controls
  };

  const handleKeyPress = (e) => {
    if (!video || !storageKey) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    const shift = e.shiftKey;

    if (e.code === "KeyP") {
      const time = Math.floor(video.currentTime);
      if (!bookmarks.some(bm => bm.time === time)) {
        const newBookmark = { time, label: "" };
        bookmarks.push(newBookmark);
        bookmarks.sort((a, b) => a.time - b.time);
        chrome.storage.local.set({ [storageKey]: bookmarks }, () => {
          addBookmarkMarker(time);
          showBookmarkOverlay(`📌 Bookmarked at ${formatTime(time)}`);
          currentIndex = bookmarks.findIndex(b => b.time === time);
        });
      }
    }

    if (e.code === "KeyL") {
      const label = prompt("Enter bookmark label:");
      if (!label) return;
      const time = Math.floor(video.currentTime);
      const existing = bookmarks.find(bm => bm.time === time);
      if (existing) {
        existing.label = label;
        chrome.storage.local.set({ [storageKey]: bookmarks }, refreshMarkers);
      }
    }

    if (shift && e.code === "PageUp") {
      if (bookmarks.length === 0) return;
      currentIndex = Math.min(currentIndex + 1, bookmarks.length - 1);
      video.currentTime = bookmarks[currentIndex].time;
    }

    if (shift && e.code === "PageDown") {
      if (bookmarks.length === 0) return;
      currentIndex = Math.max(currentIndex - 1, 0);
      video.currentTime = bookmarks[currentIndex].time;
    }

    if (shift && e.code === "KeyR") {
      const time = Math.floor(video.currentTime);
      bookmarks = bookmarks.filter(bm => bm.time !== time);
      chrome.storage.local.set({ [storageKey]: bookmarks }, () => refreshMarkers());
    }

    if (shift && e.code === "KeyC") {
      bookmarks = [];
      chrome.storage.local.remove(storageKey, refreshMarkers);
    }

    if (e.code === "Slash" && shift) {
      alert("Shortcuts:\nP - Add bookmark\nL - Label bookmark\nShift+PageUp/Down - Navigate\nShift+R - Remove\nShift+C - Clear all\nShift+/ - Show help");
    }

    // Manual speed override (Alt + 1-9)
    if (e.altKey && /^[1-9]$/.test(e.key)) {
      const speed = parseFloat(e.key);
      video.playbackRate = speed;
      console.log(`Manual: Playback speed set to ${speed}x`);
      showSpeedOverlay(speed);
      chrome.storage.sync.set({ speed: speed.toString() });

      manualOverride = true;
      clearTimeout(overrideTimeout);
      overrideTimeout = setTimeout(() => {
        manualOverride = false;
      }, 5000);
    }

    // Increase speed with + key
    if (e.key === '+' || e.key === '=') {
      let currentSpeed = parseFloat(video.playbackRate.toFixed(2));
      let newSpeed = Math.min(20, currentSpeed + 0.25);
      newSpeed = parseFloat(newSpeed.toFixed(2));
      video.playbackRate = newSpeed;
      showSpeedOverlay(newSpeed);
      chrome.storage.sync.set({ speed: newSpeed.toString() });
      console.log(`Speed increased to ${newSpeed}x`);
    }

    // Decrease speed with - key
    if (e.key === '-' || e.key === '_') {
      let currentSpeed = parseFloat(video.playbackRate.toFixed(2));
      let newSpeed = Math.max(0.25, currentSpeed - 0.25);
      newSpeed = parseFloat(newSpeed.toFixed(2));
      video.playbackRate = newSpeed;
      showSpeedOverlay(newSpeed);
      chrome.storage.sync.set({ speed: newSpeed.toString() });
      console.log(`Speed decreased to ${newSpeed}x`);
    }
  };

  // Apply speed settings
  function applySettings() {
    if (manualOverride) return; // Prevent auto-speed adjustment during manual override

    chrome.storage.sync.get(["speed"], ({ speed }) => {
      const video = document.querySelector('video');
      if (video && speed) {
        video.playbackRate = parseFloat(speed);
        console.log("Auto: Playback speed set to", speed);
      }
    }); 
  }

  // Add bookmark marker to the progress bar
  const addBookmarkMarker = (time, label = "") => {
    const progressBar = document.querySelector(".ytp-progress-bar");
    if (!progressBar || !video) return;

    const marker = document.createElement("div");
    marker.className = "yt-bookmark-marker";
    marker.style.left = `${(time / video.duration) * 100}%`;
    marker.style.position = "absolute";
    marker.style.width = "0";
    marker.style.height = "0";
    marker.style.cursor = "pointer";
    marker.style.zIndex = "100";
    marker.style.transform = "translateX(-50%)";
    marker.title = label ? `📌 ${label} (${formatTime(time)})` : `📌 Bookmark at ${formatTime(time)}`;
    marker.dataset.time = time;

    // Add bookmark ribbon icon in circle (aligned with timeline)
    marker.innerHTML = `
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; background: #ff4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
        <svg viewBox="0 0 24 24" width="10" height="10" style="fill: white;">
          <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"></path>
        </svg>
      </div>
    `;

    marker.addEventListener("click", () => {
      video.currentTime = time;
    });

    progressBar.appendChild(marker);
  };

  const refreshMarkers = () => {
    document.querySelectorAll(".yt-bookmark-marker").forEach(el => el.remove());
    bookmarks.forEach(bm => addBookmarkMarker(bm.time, bm.label));
  };

  const formatTime = (secs) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };
  
  // Show overlay with bookmark confirmation
  const showBookmarkOverlay = (text) => {
    let overlay = document.getElementById("yt-bookmark-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      Object.assign(overlay.style, {
        position: "fixed",
        top: "10%",
        right: "10%",
        padding: "10px 20px",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        color: "#fff",
        fontSize: "22px",
        zIndex: "9999",
        borderRadius: "8px",
        transition: "opacity 0.5s",
      });
      overlay.id = "yt-bookmark-overlay";
      document.body.appendChild(overlay);
    }
    overlay.textContent = text;
    overlay.style.opacity = "1";
    setTimeout(() => {
      overlay.style.opacity = "0";
    }, 1200);
  };

  // Show overlay with speed change confirmation
  function showSpeedOverlay(speed) {
    let overlay = document.getElementById("yt-speed-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      Object.assign(overlay.style, {
        position: "fixed",
        top: "10%",
        right: "10%",
        padding: "10px 20px",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        color: "#fff",
        fontSize: "24px",
        zIndex: "9999",
        borderRadius: "8px",
        transition: "opacity 0.5s",
      });
      overlay.id = "yt-speed-overlay";
      document.body.appendChild(overlay);
    }
    overlay.textContent = `Speed: ${speed}x`;
    overlay.style.opacity = "1";
    setTimeout(() => {
      overlay.style.opacity = "0";
    }, 1000);
  }

  // Add remaining time overlay
  function addRemainingTimeOverlay() {
    const video = document.querySelector('video');
    if (!video || document.getElementById('yt-remaining-time')) return;
  
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '60px',     // 20px from top
      left: '10px',    // top-left corner
      padding: '6px 12px',
      background: 'rgba(0,0,0,0.7)',
      color: '#fff',
      fontSize: '14px',
      borderRadius: '6px',
      zIndex: '9999',
      cursor: 'move'
    });
    overlay.id = 'yt-remaining-time';
    document.body.appendChild(overlay);
  
    function formatTime(seconds) {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      return `${hrs} hour : ${mins} min : ${secs} sec`;
    }
  
    // Dragging logic
    let isDragging = false, offsetX, offsetY;
    overlay.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - overlay.getBoundingClientRect().left;
      offsetY = e.clientY - overlay.getBoundingClientRect().top;
    });
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        overlay.style.left = `${e.clientX - offsetX}px`;
        overlay.style.top = `${e.clientY - offsetY}px`;
      }
    });
    document.addEventListener('mouseup', () => isDragging = false);
  
    // Update loop
    setInterval(() => {
      if (!video.duration || isNaN(video.duration)) return;
      const remaining = video.duration - video.currentTime;
      const percent = ((remaining / video.duration) * 100).toFixed(1);
      overlay.textContent = `⏳ ${formatTime(remaining)}  |  ${percent}% left`;
    }, 1000);
  }
  
  // ⏳ Wait for video to load, then add overlay
  const checkForVideo = setInterval(() => {
    const video = document.querySelector("video");
    if (video) {
      clearInterval(checkForVideo);
      addRemainingTimeOverlay();
    }
  }, 1000);
  
  // ⌨️ Toggle Overlay with Alt + R
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 'r') {
      const overlay = document.getElementById('yt-remaining-time');
      if (overlay) {
        overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
        console.log('⏳ Remaining time overlay toggled');
      }
    }
  });
  
  // Add bookmark button to YouTube player controls
  function addBookmarkButton() {
    const video = document.querySelector('video');
    if (!video) {
      setTimeout(addBookmarkButton, 1000);
      return;
    }

    // Wait for controls to be available
    const rightControls = document.querySelector('.ytp-right-controls');
    if (!rightControls) {
      setTimeout(addBookmarkButton, 1000);
      return;
    }

    // Don't add if already exists
    if (document.getElementById('yt-bookmark-btn')) return;

    const bookmarkBtn = document.createElement('button');
    bookmarkBtn.id = 'yt-bookmark-btn';
    bookmarkBtn.className = 'ytp-button';
    bookmarkBtn.title = 'Add Bookmark (P)';
    bookmarkBtn.setAttribute('aria-label', 'Add Bookmark');
    
    // Bookmark ribbon/tie icon SVG (standard bookmark shape) - MUCH LARGER
    bookmarkBtn.innerHTML = `
      <svg height="36px" version="1.1" viewBox="0 0 24 24" width="36px">
        <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z" fill="white"></path>
      </svg>
    `;

    Object.assign(bookmarkBtn.style, {
      width: '48px',
      height: '48px',
      padding: '0',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      opacity: '1',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      top: '-2px'
    });

    bookmarkBtn.addEventListener('mouseover', () => {
      bookmarkBtn.style.opacity = '1';
    });

    bookmarkBtn.addEventListener('mouseout', () => {
      bookmarkBtn.style.opacity = '0.9';
    });

    bookmarkBtn.addEventListener('click', () => {
      const videoId = new URLSearchParams(window.location.search).get("v");
      if (!videoId) return;
      const key = `yt_bm_${videoId}`;
      const time = Math.floor(video.currentTime);
      
      chrome.storage.local.get([key], (res) => {
        let bms = Array.isArray(res[key]) ? res[key] : [];
        if (!bms.some(bm => bm.time === time)) {
          const newBookmark = { time, label: "" };
          bms.push(newBookmark);
          bms.sort((a, b) => a.time - b.time);
          chrome.storage.local.set({ [key]: bms }, () => {
            bookmarks = bms;
            addBookmarkMarker(time);
            showBookmarkOverlay(`📌 Bookmarked at ${formatTime(time)}`);
            currentIndex = bms.findIndex(b => b.time === time);
          });
        }
      });
    });

    // Insert before autoplay button (to the left of it)
    try {
      // Look for common right control buttons in order
      const autoplayBtn = rightControls.querySelector('.ytp-button[data-tooltip-target-id="ytp-autonav-toggle-button"]');
      const settingsBtn = rightControls.querySelector('.ytp-settings-button');
      
      if (autoplayBtn && autoplayBtn.parentNode === rightControls) {
        rightControls.insertBefore(bookmarkBtn, autoplayBtn);
      } else if (settingsBtn && settingsBtn.parentNode === rightControls) {
        rightControls.insertBefore(bookmarkBtn, settingsBtn);
      } else {
        // Insert as first child if we can't find reference buttons
        rightControls.insertBefore(bookmarkBtn, rightControls.firstChild);
      }
    } catch (err) {
      console.error('Bookmark button insertion error:', err);
      rightControls.appendChild(bookmarkBtn);
    }
  }

  // Observe URL changes
  const observeUrlChange = () => {
    let oldHref = location.href;
    const body = document.querySelector("body");
    const observer = new MutationObserver(() => {
      if (location.href !== oldHref) {
        oldHref = location.href;
        setTimeout(init, 1000);
      }
    });
    observer.observe(body, { childList: true, subtree: true });
  };

  init();
  observeUrlChange();
})();
