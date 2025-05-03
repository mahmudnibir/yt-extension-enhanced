document.addEventListener('DOMContentLoaded', () => {
  const speedInput = document.getElementById('speed');
  const skipAdsCheckbox = document.getElementById('skipAds');
  const saveBtn = document.getElementById('save');

  // Load saved settings
  chrome.storage.sync.get(["speed", "skipAds"], (data) => {
    if (data.speed) speedInput.value = data.speed;
    if (data.skipAds) skipAdsCheckbox.checked = data.skipAds;
  });

  saveBtn.onclick = () => {
    chrome.storage.sync.set({
      speed: speedInput.value,
      skipAds: skipAdsCheckbox.checked
    });
  };
});