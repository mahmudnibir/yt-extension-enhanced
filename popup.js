document.addEventListener('DOMContentLoaded', () => {
  const speedInput      = document.getElementById('speed');
  const skipAdsCheckbox = document.getElementById('skipAds');
  const saveBtn         = document.getElementById('save');

  // Default values
  const defaults = { speed: '1.0', skipAds: false };

  // 1) Load stored (or default) settings
  chrome.storage.sync.get(defaults, (data) => {
    speedInput.value        = data.speed;
    skipAdsCheckbox.checked = data.skipAds;
  });

  // 2) Save on click
  saveBtn.addEventListener('click', () => {
    // Read & sanitize
    let speed = parseFloat(speedInput.value);
    if (isNaN(speed) || speed < 0.1) speed = parseFloat(defaults.speed);

    const skipAds = !!skipAdsCheckbox.checked;

    // Write to storage
    chrome.storage.sync.set({
      speed: speed.toString(),
      skipAds
    }, () => {
      // Feedback: flash button text
      const original = saveBtn.textContent;
      saveBtn.textContent = 'Saved!';
      setTimeout(() => saveBtn.textContent = original, 800);
    });
  });
});
