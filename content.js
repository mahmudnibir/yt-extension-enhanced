let manualOverride = false;
let overrideTimeout;

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

// 🕒 Run every second
setInterval(applySettings, 1000);

// ⌨️ Alt + 1~9: Manual speed override
window.addEventListener(
  "keydown",
  (e) => {
    if (!e.altKey || !/^[1-9]$/.test(e.key)) return;

    const video = document.querySelector("video");
    if (!video) return;

    e.preventDefault();
    e.stopPropagation();

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
  },
  true
);

// 🔘 Overlay to show speed change
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

// 🕐 Remaining Time Overlay (including percent and draggable feature)
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
