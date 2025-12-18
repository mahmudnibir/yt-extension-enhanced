document.addEventListener('DOMContentLoaded', () => {
  const speedInput = document.getElementById('speed');
  const speedDisplay = document.getElementById('speedDisplay');
  const skipAdsCheckbox = document.getElementById('skipAds');
  const hideCommentsCheckbox = document.getElementById('hideComments');
  const hideShortsCheckbox = document.getElementById('hideShorts');
  const hideDescriptionCheckbox = document.getElementById('hideDescription');
  const saveBtn = document.getElementById('save');
  const resetBtn = document.getElementById('reset');

  // Default values
  const defaults = { 
    speed: '1.0', 
    skipAds: false,
    hideComments: false,
    hideShorts: false,
    hideDescription: false
  };

  // Update speed display with enhanced formatting
  const updateSpeedDisplay = (value) => {
    const speed = parseFloat(value);
    speedDisplay.textContent = `${speed.toFixed(1)}×`;
    
    // Add visual feedback for extreme speeds
    if (speed >= 2.5) {
      speedDisplay.style.background = 'linear-gradient(135deg, #FF6B35, #F7931E)';
    } else if (speed <= 0.5) {
      speedDisplay.style.background = 'linear-gradient(135deg, #4ECDC4, #44A08D)';
    } else {
      speedDisplay.style.background = 'transparent';
    }
  };

  // Load stored settings with animation
  chrome.storage.sync.get(defaults, (data) => {
    speedInput.value = data.speed;
    skipAdsCheckbox.checked = data.skipAds;
    hideCommentsCheckbox.checked = data.hideComments || false;
    hideShortsCheckbox.checked = data.hideShorts || false;
    hideDescriptionCheckbox.checked = data.hideDescription || false;
    updateSpeedDisplay(data.speed);
    
    // Animate elements in
    document.querySelectorAll('.control-group').forEach((group, index) => {
      group.style.animationDelay = `${index * 0.1}s`;
    });
  });

  // Real-time speed display update with haptic feedback
  speedInput.addEventListener('input', (e) => {
    updateSpeedDisplay(e.target.value);
    // Add subtle scale animation to display
    speedDisplay.style.transform = 'scale(1.05)';
    setTimeout(() => {
      speedDisplay.style.transform = 'scale(1)';
    }, 150);
  });

  // Save settings with enhanced feedback
  saveBtn.addEventListener('click', () => {
    let speed = parseFloat(speedInput.value);
    if (isNaN(speed) || speed < 0.1) speed = parseFloat(defaults.speed);

    const skipAds = !!skipAdsCheckbox.checked;
    const hideComments = !!hideCommentsCheckbox.checked;
    const hideShorts = !!hideShortsCheckbox.checked;
    const hideDescription = !!hideDescriptionCheckbox.checked;

    // Add loading state
    saveBtn.style.transform = 'scale(0.95)';
    saveBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Saving...';
    
    chrome.storage.sync.set({
      speed: speed.toString(),
      skipAds,
      hideComments,
      hideShorts,
      hideDescription
    }, () => {
      // Success animation
      saveBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Saved!';
      saveBtn.style.background = 'linear-gradient(135deg, #00D562, #00A651)';
      saveBtn.style.transform = 'scale(1)';
      
      // Notify content script to apply changes
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'updateSettings',
            settings: { hideComments, hideShorts, hideDescription }
          });
        }
      });
      
      // Reset after delay
      setTimeout(() => {
        saveBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Save';
        saveBtn.style.background = 'linear-gradient(135deg, #4f82ff 0%, #3461e6 100%)';
      }, 2000);
    });
  });

  // Reset functionality
  resetBtn.addEventListener('click', () => {
    speedInput.value = defaults.speed;
    skipAdsCheckbox.checked = defaults.skipAds;
    updateSpeedDisplay(defaults.speed);
    
    // Visual feedback
    resetBtn.innerHTML = '<span>✨</span>Reset Complete!';
    setTimeout(() => {
      resetBtn.innerHTML = '<span>🔄</span>Reset to Defaults';
    }, 1500);
  });

  // Add hover effects for interactive elements
  document.querySelectorAll('.control-group').forEach(group => {
    group.addEventListener('mouseenter', () => {
      group.style.transform = 'translateY(-2px)';
    });
    
    group.addEventListener('mouseleave', () => {
      group.style.transform = 'translateY(0)';
    });
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target === speedInput) {
      saveBtn.click();
    }
    if (e.key === 'Escape') {
      window.close();
    }
  });
});
