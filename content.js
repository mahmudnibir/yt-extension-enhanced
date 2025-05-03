let manualOverride = false;
let overrideTimeout;

function applySettings() {
  if (manualOverride) return; // Prevent auto-speed adjustment during manual override

  chrome.storage.sync.get(["speed", "skipAds"], ({ speed, skipAds }) => {
    const video = document.querySelector('video');
    if (video && speed) {
      video.playbackRate = parseFloat(speed);
      console.log("Auto: Playback speed set to", speed);
    }

    if (skipAds) {
      const skipBtn = document.querySelector('.ytp-skip-ad-button');
      if (skipBtn) {
        skipBtn.click();
        console.log("Ad skipped");
      }
    }
  }); 
}

// 🕒 Run every second
setInterval(applySettings, 1000);

// ⌨️ Alt + 1~9: Manual speed override
window.addEventListener(
  "keydown",
  (e) => {
    if (!e.altKey || !/^[1-9]$/.test(e.key)) return; // Only listen to Alt+1-9 keys

    const video = document.querySelector("video");
    if (!video) return;

    e.preventDefault();
    e.stopPropagation();

    const speed = parseFloat(e.key);
    video.playbackRate = speed;
    console.log(`Manual: Playback speed set to ${speed}x`);
    showSpeedOverlay(speed);

    // ✅ Save new speed so auto-setting won't override it
    chrome.storage.sync.set({ speed: speed.toString() });

    // Pause auto-setting for 5 seconds
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
