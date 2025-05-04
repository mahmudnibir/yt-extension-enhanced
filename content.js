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
    marker.style.width = "4px";
    marker.style.height = "100%";
    marker.style.backgroundColor = "#00BCD4";
    marker.style.cursor = "pointer";
    marker.title = label ? `📌 ${label} (${formatTime(time)})` : `📌 Bookmark at ${formatTime(time)}`;
    marker.dataset.time = time;

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
