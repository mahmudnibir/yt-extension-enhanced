document.addEventListener('DOMContentLoaded', () => {
  const speedInput = document.getElementById('speed');
  const speedDisplay = document.getElementById('speedDisplay');
  const skipAdsCheckbox = document.getElementById('skipAds');
  const hideCommentsCheckbox = document.getElementById('hideComments');
  const hideShortsCheckbox = document.getElementById('hideShorts');
  const hideDescriptionCheckbox = document.getElementById('hideDescription');
  const rememberSpeedCheckbox = document.getElementById('rememberSpeed');

  // Default values
  const defaults = { 
    speed: '1.0', 
    skipAds: false,
    hideComments: false,
    hideShorts: false,
    hideDescription: false,
    rememberSpeed: false
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
    rememberSpeedCheckbox.checked = data.rememberSpeed || false;
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
    const rememberSpeed = !!rememberSpeedCheckbox.checked;
    
    chrome.storage.sync.set({
      speed: speed.toString(),
      skipAds,
      hideComments,
      hideShorts,
      hideDescription,
      rememberSpeed
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
  rememberSpeedCheckbox.addEventListener('change', autoSave);
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

  // Default shortcuts
  const defaultShortcuts = {
    addBookmark: 'P',
    prevBookmark: 'Shift+PageDown',
    nextBookmark: 'Shift+PageUp',
    labelBookmark: 'L',
    removeBookmark: 'Shift+R',
    clearBookmarks: 'Shift+C',
    increaseSpeed: '+',
    decreaseSpeed: '-',
    showHelp: 'Shift+?',
    toggleTime: 'Alt+R'
  };

  // Load and apply custom shortcuts
  let customShortcuts = {};
  chrome.storage.sync.get(['shortcuts'], (data) => {
    customShortcuts = data.shortcuts || {};
    updateShortcutDisplays();
  });

  function updateShortcutDisplays() {
    document.querySelectorAll('.shortcut-input').forEach(input => {
      const action = input.getAttribute('data-action');
      input.textContent = customShortcuts[action] || defaultShortcuts[action];
    });
  }

  // Shortcut recording
  let recordingAction = null;
  
  document.querySelectorAll('.shortcut-input').forEach(input => {
    input.addEventListener('click', (e) => {
      if (recordingAction) return;
      
      recordingAction = e.target.getAttribute('data-action');
      e.target.classList.add('recording');
      e.target.textContent = 'Press keys...';
    });
  });

  document.addEventListener('keydown', (e) => {
    if (!recordingAction) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Cancel recording on ESC
    if (e.key === 'Escape') {
      const input = document.querySelector(`.shortcut-input[data-action="${recordingAction}"]`);
      input.classList.remove('recording');
      input.textContent = customShortcuts[recordingAction] || defaultShortcuts[recordingAction];
      recordingAction = null;
      return;
    }
    
    // Build shortcut string
    let shortcut = '';
    if (e.ctrlKey) shortcut += 'Ctrl+';
    if (e.altKey) shortcut += 'Alt+';
    if (e.shiftKey) shortcut += 'Shift+';
    
    // Add the actual key
    if (e.key.length === 1) {
      shortcut += e.key.toUpperCase();
    } else {
      shortcut += e.key;
    }
    
    // Save the shortcut
    customShortcuts[recordingAction] = shortcut;
    chrome.storage.sync.set({ shortcuts: customShortcuts }, () => {
      const input = document.querySelector(`.shortcut-input[data-action="${recordingAction}"]`);
      input.classList.remove('recording');
      input.textContent = shortcut;
      recordingAction = null;
      
      // Notify content script about shortcut change
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'updateShortcuts',
            shortcuts: customShortcuts
          });
        }
      });
    });
  });

  // Reset shortcuts
  document.querySelectorAll('.shortcut-reset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = e.target.getAttribute('data-action');
      delete customShortcuts[action];
      
      chrome.storage.sync.set({ shortcuts: customShortcuts }, () => {
        updateShortcutDisplays();
        
        // Notify content script
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'updateShortcuts',
              shortcuts: customShortcuts
            });
          }
        });
      });
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

  // Clear All Data functionality
  const clearDataBtn = document.getElementById('clearDataBtn');
  
  clearDataBtn.addEventListener('click', async () => {
    // Step 1: Initial confirmation
    const confirmed = await showModal({
      title: 'Clear All Data',
      message: 'This will permanently delete all your bookmarks, settings, and video-specific speeds. This action cannot be undone.',
      warning: '⚠️ This is a destructive action and cannot be reversed.',
      buttons: [
        { text: 'Cancel', type: 'secondary' },
        { text: 'Continue', type: 'primary' }
      ]
    });

    if (!confirmed) return;

    // Step 2: Type confirmation
    const typeConfirmed = await showConfirmationInput({
      title: 'Type to Confirm',
      message: 'To confirm deletion, please type <strong>DELETE ALL DATA</strong> in the box below:',
      confirmText: 'DELETE ALL DATA',
      placeholder: 'Type here...'
    });

    if (!typeConfirmed) return;

    // Step 3: Offer to export data
    const exportData = await showModal({
      title: 'Export Data First?',
      message: 'Would you like to export your bookmarks before deleting everything? This will download a backup file.',
      buttons: [
        { text: 'Skip Export', type: 'secondary' },
        { text: 'Export & Delete', type: 'export' }
      ]
    });

    if (exportData === 'export') {
      await exportBookmarks();
    }

    // Step 4: Final deletion
    performClearData();
  });

  // Create modal dialog
  function showModal({ title, message, warning, buttons }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <div class="modal-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <div class="modal-title">${title}</div>
          </div>
          <div class="modal-body">
            <div class="modal-text">${message}</div>
            ${warning ? `<div class="modal-warning">${warning}</div>` : ''}
          </div>
          <div class="modal-actions">
            ${buttons.map((btn, idx) => `
              <button class="modal-btn modal-btn-${btn.type}" data-index="${idx}">${btn.text}</button>
            `).join('')}
          </div>
        </div>
      `;
      
      document.body.appendChild(overlay);
      
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
        
        const btn = e.target.closest('.modal-btn');
        if (btn) {
          const index = parseInt(btn.dataset.index);
          overlay.remove();
          resolve(buttons[index].type === 'secondary' ? false : buttons[index].type);
        }
      });
    });
  }

  // Create confirmation input modal
  function showConfirmationInput({ title, message, confirmText, placeholder }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <div class="modal-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <div class="modal-title">${title}</div>
          </div>
          <div class="modal-body">
            <div class="modal-text">${message}</div>
            <label class="modal-label">Confirmation Text</label>
            <input type="text" class="modal-input" placeholder="${placeholder}" id="confirmInput">
          </div>
          <div class="modal-actions">
            <button class="modal-btn modal-btn-secondary" id="cancelBtn">Cancel</button>
            <button class="modal-btn modal-btn-primary" id="confirmBtn" disabled>Confirm</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(overlay);
      
      const input = overlay.querySelector('#confirmInput');
      const confirmBtn = overlay.querySelector('#confirmBtn');
      const cancelBtn = overlay.querySelector('#cancelBtn');
      
      input.addEventListener('input', () => {
        if (input.value === confirmText) {
          confirmBtn.disabled = false;
          input.classList.remove('error');
        } else {
          confirmBtn.disabled = true;
        }
      });
      
      confirmBtn.addEventListener('click', () => {
        if (input.value === confirmText) {
          overlay.remove();
          resolve(true);
        } else {
          input.classList.add('error');
          setTimeout(() => input.classList.remove('error'), 400);
        }
      });
      
      cancelBtn.addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });
      
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });
      
      input.focus();
    });
  }

  // Export bookmarks function
  async function exportBookmarks() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (data) => {
        const bookmarkData = {};
        
        // Filter bookmark data
        for (const key in data) {
          if (key.startsWith('yt_bm_')) {
            bookmarkData[key] = data[key];
          }
        }
        
        chrome.storage.sync.get(null, (syncData) => {
          const exportData = {
            bookmarks: bookmarkData,
            settings: syncData,
            exportDate: new Date().toISOString(),
            version: '2.0'
          };
          
          const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `youtube-enhancer-backup-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          
          setTimeout(() => resolve(), 500);
        });
      });
    });
  }

  // Perform the actual data clearing
  function performClearData() {
    chrome.storage.local.clear(() => {
      chrome.storage.sync.clear(() => {
        // Show success message
        showModal({
          title: 'Data Cleared',
          message: 'All data has been successfully deleted. The extension will now reset to default settings.',
          buttons: [
            { text: 'Close', type: 'primary' }
          ]
        }).then(() => {
          window.location.reload();
        });
      });
    });
  }
});
