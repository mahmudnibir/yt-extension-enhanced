(function () {
  let bookmarks = [];
  let currentIndex = -1;
  let video = null;
  let storageKey = null;

  let manualOverride = false;
  let overrideTimeout;
  let deletedBookmarks = [];
  
  // Time saved tracking
  let totalTimeSaved = 0;
  let lastUpdateTime = 0;

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
    setInterval(updateTimeSaved, 1000); // Track time saved

    addRemainingTimeOverlay(); // Add the remaining time overlay
    addBookmarkButton(); // Add bookmark button to player controls
    
    // Load saved time from storage
    chrome.storage.local.get(['totalTimeSaved'], (res) => {
      totalTimeSaved = res.totalTimeSaved || 0;
    });
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
  
    // Find the video container
    const videoContainer = document.querySelector('.html5-video-player');
    if (!videoContainer) {
      setTimeout(addRemainingTimeOverlay, 1000);
      return;
    }

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'absolute',
      top: '10px',
      left: '10px',
      padding: '6px 12px',
      background: 'rgba(0,0,0,0.7)',
      color: '#fff',
      fontSize: '14px',
      borderRadius: '6px',
      zIndex: '9999',
      cursor: 'move',
      pointerEvents: 'auto'
    });
    overlay.id = 'yt-remaining-time';
    videoContainer.appendChild(overlay);
  
    function formatTime(seconds) {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      return `${hrs} hour : ${mins} min : ${secs} sec`;
    }
  
    // Dragging logic - constrained to video container
    let isDragging = false, offsetX, offsetY;
    overlay.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - overlay.getBoundingClientRect().left;
      offsetY = e.clientY - overlay.getBoundingClientRect().top;
      e.stopPropagation();
    });
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const containerRect = videoContainer.getBoundingClientRect();
        const overlayRect = overlay.getBoundingClientRect();
        
        let newLeft = e.clientX - offsetX - containerRect.left;
        let newTop = e.clientY - offsetY - containerRect.top;
        
        // Constrain within video container bounds
        newLeft = Math.max(0, Math.min(newLeft, containerRect.width - overlayRect.width));
        newTop = Math.max(0, Math.min(newTop, containerRect.height - overlayRect.height));
        
        overlay.style.left = `${newLeft}px`;
        overlay.style.top = `${newTop}px`;
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
  
  // Toggle bookmark organizer panel
  function toggleBookmarkPanel() {
    let panel = document.getElementById('yt-bookmark-panel');
    
    if (panel) {
      panel.remove();
      return;
    }

    const videoContainer = document.querySelector('.html5-video-player');
    if (!videoContainer) return;

    panel = document.createElement('div');
    panel.id = 'yt-bookmark-panel';
    Object.assign(panel.style, {
      position: 'absolute',
      top: '20px',
      right: '20px',
      width: '420px',
      maxHeight: '500px',
      background: 'rgba(18, 18, 18, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
      zIndex: '10000',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    });

    // Add custom scrollbar styles
    const style = document.createElement('style');
    style.textContent = `
      #yt-bookmark-list {
        overflow-y: scroll;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
      }
      #yt-bookmark-list::-webkit-scrollbar {
        width: 6px;
      }
      #yt-bookmark-list::-webkit-scrollbar-track {
        background: transparent;
      }
      #yt-bookmark-list::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 3px;
        min-height: 30px;
      }
      #yt-bookmark-list::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.5);
      }
      #yt-bookmark-list::-webkit-scrollbar-button {
        display: none;
        height: 0;
        width: 0;
      }
    `;
    document.head.appendChild(style);

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      padding: '16px 20px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      background: 'rgba(0, 0, 0, 0.3)'
    });

    const headerTop = document.createElement('div');
    Object.assign(headerTop.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    });

    const title = document.createElement('div');
    title.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" style="fill: white; vertical-align: middle; margin-right: 8px;">
        <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"></path>
      </svg>
      <span style="color: white; font-size: 16px; font-weight: 600; vertical-align: middle;">Bookmarks</span>
    `;
    
    const timeSavedDiv = document.createElement('div');
    Object.assign(timeSavedDiv.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 14px',
      background: 'rgba(16, 185, 129, 0.1)',
      border: '1px solid rgba(16, 185, 129, 0.2)',
      borderRadius: '8px',
      fontSize: '13px',
      color: 'rgba(16, 185, 129, 0.95)'
    });
    timeSavedDiv.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      <span style="font-weight: 500;">Time Saved: <span id="time-saved-display">${formatTimeSaved(totalTimeSaved)}</span></span>
    `;

    const addBtn = document.createElement('button');
    addBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" style="fill: white;">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path>
      </svg>
    `;
    Object.assign(addBtn.style, {
      background: 'rgba(255, 255, 255, 0.1)',
      border: 'none',
      borderRadius: '6px',
      padding: '8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.2s'
    });
    addBtn.title = 'Add bookmark at current time';
    addBtn.onmouseover = () => addBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    addBtn.onmouseout = () => addBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    addBtn.onclick = () => addBookmarkAtCurrentTime();

    const exportBtn = document.createElement('button');
    exportBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
    `;
    Object.assign(exportBtn.style, {
      background: 'rgba(255, 255, 255, 0.1)',
      border: 'none',
      borderRadius: '6px',
      padding: '8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.2s'
    });
    exportBtn.title = 'Export bookmarks';
    exportBtn.onmouseover = () => exportBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    exportBtn.onmouseout = () => exportBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    exportBtn.onclick = () => exportBookmarks();

    const importBtn = document.createElement('button');
    importBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `;
    Object.assign(importBtn.style, {
      background: 'rgba(255, 255, 255, 0.1)',
      border: 'none',
      borderRadius: '6px',
      padding: '8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.2s'
    });
    importBtn.title = 'Import bookmarks';
    importBtn.onmouseover = () => importBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    importBtn.onmouseout = () => importBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    importBtn.onclick = () => importBookmarks();

    const helpBtn = document.createElement('button');
    helpBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" style="fill: white;">
        <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"></path>
      </svg>
    `;
    Object.assign(helpBtn.style, {
      background: 'rgba(255, 255, 255, 0.1)',
      border: 'none',
      borderRadius: '6px',
      padding: '8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.2s'
    });
    helpBtn.title = 'Help & Shortcuts';
    helpBtn.onmouseover = () => helpBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    helpBtn.onmouseout = () => helpBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    helpBtn.onclick = () => showHelpPanel();

    const undoBtn = document.createElement('button');
    undoBtn.id = 'yt-undo-btn';
    undoBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" style="fill: white;">
        <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"></path>
      </svg>
    `;
    Object.assign(undoBtn.style, {
      background: 'rgba(255, 255, 255, 0.1)',
      border: 'none',
      borderRadius: '6px',
      padding: '8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.2s',
      opacity: '0.3'
    });
    undoBtn.title = 'Undo last deletion';
    undoBtn.disabled = true;
    undoBtn.onmouseover = () => {
      if (deletedBookmarks.length > 0) undoBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    };
    undoBtn.onmouseout = () => undoBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    undoBtn.onclick = () => undoLastDeletion();

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" style="fill: white;">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
      </svg>
    `;
    Object.assign(closeBtn.style, {
      background: 'transparent',
      border: 'none',
      borderRadius: '6px',
      padding: '8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.2s',
      marginLeft: '8px'
    });
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'transparent';
    closeBtn.onclick = () => panel.remove();

    const headerRight = document.createElement('div');
    headerRight.style.display = 'flex';
    headerRight.style.gap = '12px';
    headerRight.appendChild(addBtn);
    headerRight.appendChild(exportBtn);
    headerRight.appendChild(importBtn);
    headerRight.appendChild(helpBtn);
    headerRight.appendChild(undoBtn);
    headerRight.appendChild(closeBtn);

    headerTop.appendChild(title);
    headerTop.appendChild(headerRight);
    
    header.appendChild(headerTop);
    header.appendChild(timeSavedDiv);

    // Bookmark list container
    const listContainer = document.createElement('div');
    Object.assign(listContainer.style, {
      padding: '12px',
      overflowY: 'auto',
      height: '240px',
      minHeight: '240px'
    });
    listContainer.id = 'yt-bookmark-list';
    
    // Prevent YouTube scroll when scrolling in panel
    listContainer.addEventListener('wheel', (e) => {
      e.stopPropagation();
    }, { passive: true });

    panel.appendChild(header);
    panel.appendChild(listContainer);
    videoContainer.appendChild(panel);

    // Prevent YouTube keyboard shortcuts when panel is open
    const blockYTKeys = (e) => {
      e.stopPropagation();
    };
    panel.addEventListener('keydown', blockYTKeys, true);
    panel.addEventListener('keyup', blockYTKeys, true);
    panel.addEventListener('keypress', blockYTKeys, true);

    // Load and display bookmarks
    refreshBookmarkList();
    updateUndoButton();

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function closePanel(e) {
        if (!panel.contains(e.target) && e.target.id !== 'yt-bookmark-btn') {
          panel.remove();
          document.removeEventListener('click', closePanel);
        }
      });
    }, 100);
  }

  // Add bookmark at current time
  function addBookmarkAtCurrentTime() {
    const video = document.querySelector('video');
    if (!video || !storageKey) return;
    
    const time = Math.floor(video.currentTime);
    if (!bookmarks.some(bm => bm.time === time)) {
      const newBookmark = { time, label: "" };
      bookmarks.push(newBookmark);
      bookmarks.sort((a, b) => a.time - b.time);
      chrome.storage.local.set({ [storageKey]: bookmarks }, () => {
        addBookmarkMarker(time);
        currentIndex = bookmarks.findIndex(b => b.time === time);
        refreshBookmarkList();
      });
    }
  }

  // Refresh bookmark list in panel
  function refreshBookmarkList() {
    const listContainer = document.getElementById('yt-bookmark-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (bookmarks.length === 0) {
      const emptyMsg = document.createElement('div');
      Object.assign(emptyMsg.style, {
        color: 'rgba(255, 255, 255, 0.5)',
        textAlign: 'center',
        padding: '40px 20px',
        fontSize: '14px'
      });
      emptyMsg.textContent = 'No bookmarks yet. Press P or click + to add one.';
      listContainer.appendChild(emptyMsg);
      return;
    }

    bookmarks.forEach((bm, index) => {
      const item = document.createElement('div');
      Object.assign(item.style, {
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'background 0.2s'
      });
      item.dataset.expanded = 'false';

      // Top row container
      const topRow = document.createElement('div');
      Object.assign(topRow.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer'
      });
      topRow.onmouseover = () => item.style.background = 'rgba(255, 255, 255, 0.1)';
      topRow.onmouseout = () => item.style.background = 'rgba(255, 255, 255, 0.05)';

      // Time badge
      const timeBadge = document.createElement('div');
      Object.assign(timeBadge.style, {
        background: 'rgba(255, 68, 68, 0.2)',
        color: '#ff4444',
        padding: '6px 10px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: '600',
        minWidth: '70px',
        textAlign: 'center'
      });
      timeBadge.textContent = formatTime(bm.time);

      // Label input (expandable)
      const labelInput = document.createElement('textarea');
      Object.assign(labelInput.style, {
        flex: '1',
        background: 'transparent',
        border: 'none',
        color: 'white',
        fontSize: '14px',
        outline: 'none',
        padding: '4px',
        minWidth: '0',
        resize: 'none',
        overflow: 'hidden',
        height: '22px',
        transition: 'height 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s ease, padding 0.2s ease',
        fontFamily: 'inherit',
        lineHeight: '1.4',
        willChange: 'height'
      });
      labelInput.placeholder = 'Notes...';
      labelInput.value = bm.label || '';
      labelInput.rows = 1;

      // Expand on click/focus
      const expandLabel = () => {
        // Collapse all other expanded items
        document.querySelectorAll('.yt-bookmark-item-expanded').forEach(other => {
          const otherInput = other.querySelector('textarea');
          if (otherInput && otherInput !== labelInput) {
            otherInput.style.height = '22px';
            otherInput.style.background = 'transparent';
            otherInput.style.padding = '4px';
            other.classList.remove('yt-bookmark-item-expanded');
          }
        });

        item.classList.add('yt-bookmark-item-expanded');
        labelInput.style.height = '60px';
        labelInput.style.background = 'rgba(0, 0, 0, 0.3)';
        labelInput.style.borderRadius = '6px';
        labelInput.style.padding = '6px';
      };

      const collapseLabel = () => {
        labelInput.style.height = '22px';
        labelInput.style.background = 'transparent';
        labelInput.style.padding = '4px';
        item.classList.remove('yt-bookmark-item-expanded');
        bm.label = labelInput.value;
        chrome.storage.local.set({ [storageKey]: bookmarks }, refreshMarkers);
      };

      labelInput.onclick = (e) => {
        e.stopPropagation();
        expandLabel();
      };

      labelInput.onfocus = () => {
        expandLabel();
      };

      labelInput.onblur = () => {
        collapseLabel();
      };

      labelInput.oninput = () => {
        bm.label = labelInput.value;
      };

      labelInput.onkeydown = (e) => {
        e.stopPropagation();
      };

      // Click handler - expand on row click
      topRow.onclick = (e) => {
        if (e.target === jumpBtn || e.target.closest('button') === jumpBtn ||
            e.target === deleteBtn || e.target.closest('button') === deleteBtn ||
            e.target === labelInput) {
          return;
        }
        
        labelInput.focus();
      };

      // Jump button
      const jumpBtn = document.createElement('button');
      jumpBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" style="fill: white;">
          <path d="M8 5v14l11-7z"></path>
        </svg>
      `;
      Object.assign(jumpBtn.style, {
        background: 'rgba(255, 255, 255, 0.1)',
        border: 'none',
        borderRadius: '6px',
        padding: '6px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        transition: 'background 0.2s'
      });
      jumpBtn.title = 'Jump to this time';
      jumpBtn.onmouseover = () => jumpBtn.style.background = 'rgba(255, 255, 255, 0.2)';
      jumpBtn.onmouseout = () => jumpBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      jumpBtn.onclick = (e) => {
        e.stopPropagation();
        const video = document.querySelector('video');
        if (video) video.currentTime = bm.time;
      };

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" style="fill: #ff4444;">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path>
        </svg>
      `;
      Object.assign(deleteBtn.style, {
        background: 'rgba(255, 68, 68, 0.1)',
        border: 'none',
        borderRadius: '6px',
        padding: '6px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        transition: 'background 0.2s'
      });
      deleteBtn.title = 'Delete bookmark';
      deleteBtn.onmouseover = () => deleteBtn.style.background = 'rgba(255, 68, 68, 0.2)';
      deleteBtn.onmouseout = () => deleteBtn.style.background = 'rgba(255, 68, 68, 0.1)';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        
        // Add to deletion stack
        deletedBookmarks.push({ bookmark: { ...bm }, index: index });
        
        // Remove bookmark
        bookmarks.splice(index, 1);
        chrome.storage.local.set({ [storageKey]: bookmarks }, () => {
          refreshMarkers();
          refreshBookmarkList();
          updateUndoButton();
        });
      };

      topRow.appendChild(timeBadge);
      topRow.appendChild(labelInput);
      topRow.appendChild(jumpBtn);
      topRow.appendChild(deleteBtn);

      item.appendChild(topRow);

      listContainer.appendChild(item);
    });
  }

  // Undo last deletion
  function undoLastDeletion() {
    if (deletedBookmarks.length === 0) return;
    
    const lastDeleted = deletedBookmarks.pop();
    bookmarks.splice(lastDeleted.index, 0, lastDeleted.bookmark);
    
    chrome.storage.local.set({ [storageKey]: bookmarks }, () => {
      refreshMarkers();
      refreshBookmarkList();
      updateUndoButton();
    });
  }

  // Update time saved tracker
  function updateTimeSaved() {
    if (!video || video.paused) return;
    
    const now = Date.now();
    if (lastUpdateTime === 0) {
      lastUpdateTime = now;
      return;
    }
    
    const currentSpeed = video.playbackRate;
    if (currentSpeed > 1) {
      const elapsed = (now - lastUpdateTime) / 1000;
      const timeSaved = elapsed * (currentSpeed - 1) / currentSpeed;
      totalTimeSaved += timeSaved;
      
      chrome.storage.local.set({ totalTimeSaved });
    }
    
    lastUpdateTime = now;
    
    const timeSavedDisplay = document.getElementById('time-saved-display');
    if (timeSavedDisplay) {
      timeSavedDisplay.textContent = formatTimeSaved(totalTimeSaved);
    }
  }
  
  // Format time saved for display
  function formatTimeSaved(seconds) {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }

  // Update undo button state
  function updateUndoButton() {
    const undoBtn = document.getElementById('yt-undo-btn');
    if (!undoBtn) return;
    
    if (deletedBookmarks.length > 0) {
      undoBtn.disabled = false;
      undoBtn.style.opacity = '1';
      undoBtn.style.cursor = 'pointer';
      undoBtn.title = `Undo last deletion (${deletedBookmarks.length} available)`;
    } else {
      undoBtn.disabled = true;
      undoBtn.style.opacity = '0.3';
      undoBtn.style.cursor = 'not-allowed';
      undoBtn.title = 'No deletions to undo';
    }
  }

  // Export bookmarks
  function exportBookmarks() {
    if (bookmarks.length === 0) {
      alert('No bookmarks to export!');
      return;
    }

    const videoId = new URLSearchParams(window.location.search).get("v");
    const videoTitle = document.title.replace(' - YouTube', '');
    
    const exportData = {
      videoId: videoId,
      videoTitle: videoTitle,
      url: window.location.href,
      exportDate: new Date().toISOString(),
      bookmarks: bookmarks
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookmarks_${videoId}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Import bookmarks
  function importBookmarks() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importData = JSON.parse(event.target.result);
          
          if (!importData.bookmarks || !Array.isArray(importData.bookmarks)) {
            alert('Invalid bookmark file format!');
            return;
          }

          // Merge with existing bookmarks
          const merged = [...bookmarks, ...importData.bookmarks];
          const unique = merged.filter((bm, index, self) => 
            index === self.findIndex(b => b.time === bm.time)
          );
          unique.sort((a, b) => a.time - b.time);

          bookmarks = unique;
          chrome.storage.local.set({ [storageKey]: bookmarks }, () => {
            refreshMarkers();
            refreshBookmarkList();
            alert(`Imported ${importData.bookmarks.length} bookmarks!`);
          });
        } catch (error) {
          alert('Error reading bookmark file!');
          console.error(error);
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  }

  // Show help panel
  function showHelpPanel() {
    const existingHelp = document.getElementById('yt-help-overlay');
    if (existingHelp) {
      existingHelp.remove();
      return;
    }

    const videoContainer = document.querySelector('.html5-video-player');
    if (!videoContainer) return;

    const overlay = document.createElement('div');
    overlay.id = 'yt-help-overlay';
    Object.assign(overlay.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(5px)',
      zIndex: '10001',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    });

    const helpBox = document.createElement('div');
    Object.assign(helpBox.style, {
      background: 'rgba(18, 18, 18, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      padding: '24px',
      maxWidth: '480px',
      maxHeight: '85vh',
      overflowY: 'auto',
      color: 'white',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent'
    });

    helpBox.innerHTML = `
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Keyboard Shortcuts</h3>
      <div style="display: grid; gap: 8px; font-size: 14px; line-height: 1.6;">
        <div><kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 3px;">P</kbd> - Add bookmark at current time</div>
        <div><kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 3px;">L</kbd> - Label bookmark at current time</div>
        <div><kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 3px;">Shift + PageUp/Down</kbd> - Navigate bookmarks</div>
        <div><kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 3px;">Shift + R</kbd> - Remove bookmark at current time</div>
        <div><kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 3px;">Shift + C</kbd> - Clear all bookmarks</div>
        <div><kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 3px;">Alt + 1-9</kbd> - Set playback speed (1x-9x)</div>
        <div><kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 3px;">+/-</kbd> - Increase/decrease speed by 0.25x</div>
        <div><kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 3px;">Alt + R</kbd> - Toggle remaining time overlay</div>
      </div>
      <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 13px; color: rgba(255,255,255,0.7); text-align: center;">
        Having problems? <a href="mailto:nibirbbkr@gmail.com" style="color: #3ea6ff; text-decoration: none;">Contact us</a>
      </div>
      <button id="close-help" style="margin-top: 16px; width: 100%; padding: 10px; background: rgba(255,255,255,0.1); border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 14px;">Close</button>
    `;

    overlay.appendChild(helpBox);
    videoContainer.appendChild(overlay);

    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };

    helpBox.querySelector('#close-help').onclick = () => overlay.remove();
  }

  
  // ⏳ Wait for video to load, then add overlay
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
    bookmarkBtn.title = 'Bookmarks (P to add)';
    bookmarkBtn.setAttribute('aria-label', 'Open Bookmarks');
    
    // Bookmark ribbon/tie icon SVG (outline style) - MUCH LARGER
    bookmarkBtn.innerHTML = `
      <svg height="36px" version="1.1" viewBox="0 0 24 24" width="36px">
        <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z" fill="white"></path>
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

    bookmarkBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleBookmarkPanel();
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
        
        // Clear old bookmarks and markers
        bookmarks = [];
        currentIndex = -1;
        storageKey = null;
        deletedBookmarks = [];
        document.querySelectorAll(".yt-bookmark-marker").forEach(el => el.remove());
        
        // Close bookmark panel if open
        const panel = document.getElementById('yt-bookmark-panel');
        if (panel) panel.remove();
        
        // Reinitialize for new video
        setTimeout(init, 1000);
      }
    });
    observer.observe(body, { childList: true, subtree: true });
  };

  init();
  observeUrlChange();
})();
