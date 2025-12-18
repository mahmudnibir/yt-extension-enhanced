document.addEventListener('DOMContentLoaded', () => {
  const speedInput = document.getElementById('speed');
  const speedDisplay = document.getElementById('speedDisplay');
  const skipAdsCheckbox = document.getElementById('skipAds');
  const hideCommentsCheckbox = document.getElementById('hideComments');
  const hideShortsCheckbox = document.getElementById('hideShorts');
  const hideDescriptionCheckbox = document.getElementById('hideDescription');

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

  // Auto-save function
  const autoSave = () => {
    let speed = parseFloat(speedInput.value);
    if (isNaN(speed) || speed < 0.1) speed = parseFloat(defaults.speed);

    const skipAds = !!skipAdsCheckbox.checked;
    const hideComments = !!hideCommentsCheckbox.checked;
    const hideShorts = !!hideShortsCheckbox.checked;
    const hideDescription = !!hideDescriptionCheckbox.checked;
    
    chrome.storage.sync.set({
      speed: speed.toString(),
      skipAds,
      hideComments,
      hideShorts,
      hideDescription
    }, () => {
      // Notify content script to apply changes
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'updateSettings',
            settings: { hideComments, hideShorts, hideDescription }
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('Message sending error:', chrome.runtime.lastError.message);
            } else {
              console.log('Settings applied successfully');
            }
          });
        }
      });
    });
  };

  // Real-time speed display update with auto-save
  speedInput.addEventListener('input', (e) => {
    updateSpeedDisplay(e.target.value);
    speedDisplay.style.transform = 'scale(1.05)';
    setTimeout(() => {
      speedDisplay.style.transform = 'scale(1)';
    }, 150);
    autoSave();
  });

  // Auto-save on checkbox changes
  skipAdsCheckbox.addEventListener('change', autoSave);
  hideCommentsCheckbox.addEventListener('change', autoSave);
  hideShortsCheckbox.addEventListener('change', autoSave);
  hideDescriptionCheckbox.addEventListener('change', autoSave);

  // Add hover effects for interactive elements
  document.querySelectorAll('.control-group').forEach(group => {
    group.addEventListener('mouseenter', () => {
      group.style.transform = 'translateY(-2px)';
    });
    
    group.addEventListener('mouseleave', () => {
      group.style.transform = 'translateY(0)';
    });
  });

  // Theme toggle functionality
  const themeToggle = document.getElementById('themeToggle');
  
  // Load saved theme
  chrome.storage.sync.get(['theme'], (data) => {
    const theme = data.theme || 'youtube';
    if (theme === 'blue') {
      document.documentElement.setAttribute('data-theme', 'blue');
    }
  });
  
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'blue' ? 'youtube' : 'blue';
    
    if (newTheme === 'blue') {
      document.documentElement.setAttribute('data-theme', 'blue');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    
    // Save theme preference
    chrome.storage.sync.set({ theme: newTheme });
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.close();
    }
  });

  // Tab switching functionality
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
    });
  });
});
