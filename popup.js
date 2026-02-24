document.addEventListener('DOMContentLoaded', () => {
    // --- Productivity Graph ---
    const prodRange = document.getElementById('prodRange');
    const prodStatsGraph = document.getElementById('prodStatsGraph');
    let prodStatsData = {};

    // Helper: get range dates
    function getRangeDates(range) {
      const now = new Date();
      let start, end;
      end = new Date(now);
      if (range === '1d') {
        start = new Date(now);
        start.setHours(start.getHours() - 23, 0, 0, 0);
      } else if (range === '3d') {
        start = new Date(now);
        start.setDate(start.getDate() - 2);
        start.setHours(0, 0, 0, 0);
      } else if (range === '7d') {
        start = new Date(now);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
      } else if (range === '1m') {
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
      } else {
        start = new Date(now);
      }
      return { start, end };
    }

    // Draw minimalistic line graph (videos watched per day/hour)
    function drawProdGraph(stats, range) {
      if (!prodStatsGraph) return;
      const ctx = prodStatsGraph.getContext('2d');
      ctx.clearRect(0, 0, prodStatsGraph.width, prodStatsGraph.height);
      // Use computed styles for theme colors
      const root = document.documentElement;
      const computed = getComputedStyle(root);
      const axisColor = computed.getPropertyValue('--border-color')?.trim() || '#888';
      const lineColor = computed.getPropertyValue('--accent-color')?.trim() || '#ff0000';
      const pointColor = computed.getPropertyValue('--accent-color')?.trim() || '#ff0000';
      const labelColor = computed.getPropertyValue('--text-primary')?.trim() || '#fff';
      const bgColor = computed.getPropertyValue('--bg-card')?.trim() || '#181818';
      // Fill background to match card
      ctx.save();
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, prodStatsGraph.width, prodStatsGraph.height);
      ctx.restore();

      // Prepare data
      let labels = [];
      let values = [];
      const { start, end } = getRangeDates(range);
      if (range === '1d') {
        // Last 24 hours, show by hour
        for (let h = 0; h < 24; h++) {
          const d = new Date(start);
          d.setHours(start.getHours() + h);
          const key = d.toDateString();
          // Sum all videos for this hour
          let hourVal = 0;
          for (let k in stats) {
            const statDate = new Date(k);
            if (statDate.toDateString() === d.toDateString() && stats[k].hourly) {
              hourVal = stats[k].hourly[d.getHours()] || 0;
            }
          }
          labels.push(d.getHours() + ':00');
          values.push(hourVal);
        }
      } else {
        // By day
        let d = new Date(start);
        d.setHours(0, 0, 0, 0);
        while (d <= end) {
          const key = d.toDateString();
          labels.push(new Date(d));
          values.push((stats[key]?.videos) || 0);
          d.setDate(d.getDate() + 1);
        }
      }

      // Graph area
      const w = prodStatsGraph.width;
      const h = prodStatsGraph.height;
      const pad = 24;
      const maxVal = Math.max(1, ...values);
      // Draw axis
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pad, h - pad);
      ctx.lineTo(w - pad, h - pad);
      ctx.moveTo(pad, h - pad);
      ctx.lineTo(pad, pad);
      ctx.stroke();
      // Draw line
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      values.forEach((v, i) => {
        const x = pad + (i * (w - 2 * pad)) / (values.length - 1 || 1);
        const y = h - pad - (v * (h - 2 * pad)) / maxVal;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.shadowColor = lineColor + '55';
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Draw points
      ctx.fillStyle = pointColor;
      values.forEach((v, i) => {
        const x = pad + (i * (w - 2 * pad)) / (values.length - 1 || 1);
        const y = h - pad - (v * (h - 2 * pad)) / maxVal;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
        ctx.fill();
      });
      // Draw min/max labels
      ctx.fillStyle = labelColor;
      ctx.font = '11px "Segoe UI", Arial, sans-serif';
      ctx.fillText(maxVal, 2, pad + 6);
      ctx.fillText('0', 6, h - pad + 10);
      // Draw X axis labels
      ctx.save();
      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = labelColor;
      ctx.textAlign = 'center';
      let labelStep = 1;
      if (labels.length > 8) labelStep = Math.ceil(labels.length / 8);
      labels.forEach((lbl, i) => {
        let showLabel = false;
        let text = '';
        if (range === '1d') {
          // Show only 6 labels: every 4 hours, and always last (23:00)
          if (i % 4 === 0 || i === labels.length - 1) showLabel = true;
          text = lbl;
        } else if (range === '1m') {
          showLabel = (i % labelStep === 0 || i === labels.length - 1);
          text = lbl.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
          showLabel = (i % labelStep === 0 || i === labels.length - 1);
          text = lbl.toLocaleDateString('en-US', { weekday: 'short' });
        }
        if (showLabel) {
          const x = pad + (i * (w - 2 * pad)) / (labels.length - 1 || 1);
          ctx.fillText(text, x, h - pad + 16);
        }
      });
      ctx.restore();
    }

    function updateProdGraph() {
      if (!prodStatsData || !prodRange.value) return;
      drawProdGraph(prodStatsData, prodRange.value);
    }

    if (prodRange) {
      prodRange.addEventListener('change', updateProdGraph);
    }
  const speedInput = document.getElementById('speed');
  const speedDisplay = document.getElementById('speedDisplay');
  const skipAdsCheckbox = document.getElementById('skipAds');
  const hideCommentsCheckbox = document.getElementById('hideComments');
  const hideShortsCheckbox = document.getElementById('hideShorts');
  const hideDescriptionCheckbox = document.getElementById('hideDescription');
  const hideSuggestionsCheckbox = document.getElementById('hideSuggestions');
  const rememberSpeedCheckbox = document.getElementById('rememberSpeed');
  const cloudSyncCheckbox = document.getElementById('cloudSync');
  const cloudSyncDesc = document.getElementById('cloudSyncDesc');
  const loopVideoCheckbox = document.getElementById('loopVideo');
  const universalSpeedCheckbox = document.getElementById('universalSpeed');

  // Default values
  const defaults = { 
    speed: '1.0', 
    skipAds: false,
    hideComments: false,
    hideShorts: false,
    hideDescription: false,
    hideSuggestions: false,
    rememberSpeed: false,
    cloudSync: true,
    loopVideo: false
  };

  // Update speed display with enhanced formatting
  const updateSpeedDisplay = (value) => {
    const speed = parseFloat(value);
    speedDisplay.textContent = `${speed.toFixed(1)}×`;
  };

  // Load stored settings with animation
  chrome.storage.sync.get(defaults, (data) => {
    speedInput.value = data.speed;
    skipAdsCheckbox.checked = data.skipAds;
    hideCommentsCheckbox.checked = data.hideComments || false;
    hideShortsCheckbox.checked = data.hideShorts || false;
    hideDescriptionCheckbox.checked = data.hideDescription || false;
    hideSuggestionsCheckbox.checked = data.hideSuggestions || false;
    rememberSpeedCheckbox.checked = data.rememberSpeed || false;
    cloudSyncCheckbox.checked = data.cloudSync !== false;
    loopVideoCheckbox.checked = data.loopVideo || false;
    updateCloudSyncDesc(data.cloudSync !== false);

    // Load universalSpeed from local storage (used by video-hover.js)
    chrome.storage.local.get(['universalSpeed'], (localData) => {
      universalSpeedCheckbox.checked = !!localData.universalSpeed;
    });
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
    const hideSuggestions = !!hideSuggestionsCheckbox.checked;
    const rememberSpeed = !!rememberSpeedCheckbox.checked;
    const cloudSync = !!cloudSyncCheckbox.checked;
    const loopVideo = !!loopVideoCheckbox.checked;
    const universalSpeed = !!universalSpeedCheckbox.checked;

    // Save universalSpeed to local storage so video-hover.js can read it
    chrome.storage.local.set({ universalSpeed });

    chrome.storage.sync.set({
      speed: speed.toString(),
      skipAds,
      hideComments,
      hideShorts,
      hideDescription,
      hideSuggestions,
      rememberSpeed,
      cloudSync,
      loopVideo
    }, () => {
      // Notify content script to apply changes and update speed immediately
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'updateSettings',
            speed: speed,
            settings: { hideComments, hideShorts, hideDescription, hideSuggestions, loopVideo }
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('Message sending error:', chrome.runtime.lastError.message);
            } else {
              console.log('Settings and speed applied successfully');
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
  hideSuggestionsCheckbox.addEventListener('change', autoSave);
  hideDescriptionCheckbox.addEventListener('change', autoSave);
  loopVideoCheckbox.addEventListener('change', autoSave);
  universalSpeedCheckbox.addEventListener('change', autoSave);
  
  // Cloud sync toggle with migration
  cloudSyncCheckbox.addEventListener('change', async () => {
    const isCloudSync = cloudSyncCheckbox.checked;
    updateCloudSyncDesc(isCloudSync);
    
    // Migrate bookmarks between storage types
    await migrateBookmarks(isCloudSync);
    
    autoSave();
  });
  
  // Update cloud sync description
  function updateCloudSyncDesc(isCloudSync) {
    if (isCloudSync) {
      cloudSyncDesc.textContent = 'Sync bookmarks across devices (~50-100 limit)';
    } else {
      cloudSyncDesc.textContent = 'Local storage only (unlimited bookmarks)';
    }
  }
  
  // Migrate bookmarks between storage types
  async function migrateBookmarks(toCloudSync) {
    const sourceStorage = toCloudSync ? chrome.storage.local : chrome.storage.sync;
    const targetStorage = toCloudSync ? chrome.storage.sync : chrome.storage.local;
    
    return new Promise((resolve) => {
      sourceStorage.get(null, (sourceData) => {
        const bookmarkData = {};
        let hasBookmarks = false;
        
        // Find all bookmark keys
        for (const key in sourceData) {
          if (key.startsWith('yt_bm_')) {
            bookmarkData[key] = sourceData[key];
            hasBookmarks = true;
          }
        }
        
        if (!hasBookmarks) {
          resolve();
          return;
        }
        
        // Copy to target storage
        targetStorage.set(bookmarkData, () => {
          if (chrome.runtime.lastError) {
            alert(`⚠️ Migration failed: ${chrome.runtime.lastError.message}\n\nYou may have too many bookmarks for cloud sync. Try removing some first.`);
            cloudSyncCheckbox.checked = !toCloudSync;
            updateCloudSyncDesc(!toCloudSync);
          } else {
            // Remove from source storage
            sourceStorage.remove(Object.keys(bookmarkData), () => {
              alert(`✅ Successfully migrated ${Object.keys(bookmarkData).length} video(s) of bookmarks to ${toCloudSync ? 'cloud sync' : 'local storage'}!`);
            });
          }
          resolve();
        });
      });
    });
  }

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
  let pressedModifiers = { ctrl: false, alt: false, shift: false, tab: false };
  let liveShortcut = '';

  function getModifierString(e) {
    let mods = [];
    if (e.ctrlKey) mods.push('Ctrl');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    if (e.key === 'Tab' || pressedModifiers.tab) mods.push('Tab');
    return mods.join('+');
  }

  function isModifierKey(key) {
    return (
      key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Tab' ||
      key === 'Meta'
    );
  }

  document.querySelectorAll('.shortcut-input').forEach(input => {
    input.addEventListener('click', (e) => {
      if (recordingAction) return;
      recordingAction = e.target.getAttribute('data-action');
      e.target.classList.add('recording');
      e.target.textContent = 'Press keys...';
      pressedModifiers = { ctrl: false, alt: false, shift: false, tab: false };
      liveShortcut = '';
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

    // Track modifier keys
    if (e.key === 'Control') pressedModifiers.ctrl = true;
    if (e.key === 'Alt') pressedModifiers.alt = true;
    if (e.key === 'Shift') pressedModifiers.shift = true;
    if (e.key === 'Tab') pressedModifiers.tab = true;

    // If only modifier keys are pressed, update display and wait
    if (isModifierKey(e.key)) {
      const input = document.querySelector(`.shortcut-input[data-action="${recordingAction}"]`);
      input.textContent = getModifierString(e) || 'Press keys...';
      return;
    }

    // Only allow one non-modifier key
    let shortcut = getModifierString(e);
    if (shortcut) shortcut += '+';
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
      pressedModifiers = { ctrl: false, alt: false, shift: false, tab: false };
      liveShortcut = '';
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

  document.addEventListener('keyup', (e) => {
    if (!recordingAction) return;
    // Reset modifier state on keyup
    if (e.key === 'Control') pressedModifiers.ctrl = false;
    if (e.key === 'Alt') pressedModifiers.alt = false;
    if (e.key === 'Shift') pressedModifiers.shift = false;
    if (e.key === 'Tab') pressedModifiers.tab = false;
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
        { text: 'Cancel', type: 'cancel' },
        { text: 'Skip & Delete', type: 'skip' },
        { text: 'Export & Delete', type: 'export' }
      ]
    });

    // If user cancelled or clicked outside, stop
    if (!exportData || exportData === 'cancel') return;

    // Export if user chose to
    if (exportData === 'export') {
      await exportBookmarks();
    }

    // Step 4: Final deletion (only reaches here if user chose 'skip' or 'export')
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
      chrome.storage.sync.get(['cloudSync'], (result) => {
        const useCloudSync = result.cloudSync !== false;
        const bookmarkStorage = useCloudSync ? chrome.storage.sync : chrome.storage.local;
        
        chrome.storage.sync.get(null, (syncData) => {
          bookmarkStorage.get(null, (bookmarkStorageData) => {
            const bookmarkData = {};
            
            // Filter bookmark data from appropriate storage
            for (const key in bookmarkStorageData) {
              if (key.startsWith('yt_bm_')) {
                bookmarkData[key] = bookmarkStorageData[key];
              }
            }
            
            chrome.storage.local.get(['statistics', 'totalTimeSaved'], (localData) => {
              const exportData = {
                bookmarks: bookmarkData,
                settings: syncData,
                statistics: localData.statistics || {},
                totalTimeSaved: localData.totalTimeSaved || 0,
                storageMode: useCloudSync ? 'cloud' : 'local',
                exportDate: new Date().toISOString(),
                version: '2.1.0'
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

  // Statistics Functions
  function formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  function formatTimeShort(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    if (hours > 0) {
      return `${hours}h`;
    }
    return `${mins}m`;
  }

  function loadStatistics() {
    chrome.storage.local.get(['statistics'], (data) => {
      const stats = data.statistics || {
        totalVideos: 0,
        totalWatchTime: 0,
        totalTimeSaved: 0,
        speedUsage: {},
        dailyStats: {},
        weeklyStats: []
      };

      // Update overall statistics
      document.getElementById('totalVideos').textContent = stats.totalVideos || 0;
      document.getElementById('totalWatchTime').textContent = formatTime(stats.totalWatchTime || 0);
      document.getElementById('timeSaved').textContent = formatTime(stats.totalTimeSaved || 0);

      // Calculate average speed
      const speedUsage = stats.speedUsage || {};
      const speeds = Object.keys(speedUsage);
      if (speeds.length > 0) {
        let totalSpeedTime = 0;
        let weightedSpeed = 0;
        speeds.forEach(speed => {
          const time = speedUsage[speed];
          totalSpeedTime += time;
          weightedSpeed += parseFloat(speed) * time;
        });
        const avgSpeed = totalSpeedTime > 0 ? (weightedSpeed / totalSpeedTime).toFixed(1) : '1.0';
        document.getElementById('avgSpeed').textContent = `${avgSpeed}×`;
      } else {
        document.getElementById('avgSpeed').textContent = '1.0×';
      }

      // Save dailyStats for graph
      prodStatsData = stats.dailyStats || {};

      // Draw graph for default range (last 7 days)
      setTimeout(updateProdGraph, 100);

      // Update today's statistics
      const today = new Date().toDateString();
      const todayStats = stats.dailyStats[today] || { videos: 0, watchTime: 0, avgSpeed: 1.0 };
      
      document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      document.getElementById('todayVideos').textContent = todayStats.videos || 0;
      document.getElementById('todayTime').textContent = formatTimeShort(todayStats.watchTime || 0);
      document.getElementById('todaySpeed').textContent = `${(todayStats.avgSpeed || 1.0).toFixed(1)}×`;

      // Update weekly statistics
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      let weekVideos = 0;
      let weekTime = 0;
      let weekSaved = 0;
      
      Object.keys(stats.dailyStats).forEach(dateStr => {
        const date = new Date(dateStr);
        if (date >= weekAgo) {
          const dayStats = stats.dailyStats[dateStr];
          weekVideos += dayStats.videos || 0;
          weekTime += dayStats.watchTime || 0;
          weekSaved += dayStats.timeSaved || 0;
        }
      });
      
      document.getElementById('weekVideos').textContent = weekVideos;
      document.getElementById('weekTime').textContent = formatTimeShort(weekTime);
      document.getElementById('weekSaved').textContent = formatTimeShort(weekSaved);
    });
  }

  // Refresh stats button
  const refreshStatsBtn = document.getElementById('refreshStats');
  if (refreshStatsBtn) {
    refreshStatsBtn.addEventListener('click', () => {
      loadStatistics();
      
      // Visual feedback
      refreshStatsBtn.style.transform = 'rotate(360deg)';
      setTimeout(() => {
        refreshStatsBtn.style.transform = 'rotate(0deg)';
      }, 500);
    });
  }

  // Platform stats tab switching with PIN gate for Instagram/Facebook
  // Platform stats tab switching
  function switchToPlatform(platform) {
    document.querySelectorAll('.platform-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.platform-panel').forEach(p => p.classList.remove('active'));
    const tab = document.querySelector(`.platform-tab[data-platform="${platform}"]`);
    if (tab) tab.classList.add('active');
    const panel = document.getElementById(`panel-${platform}`);
    if (panel) panel.classList.add('active');
  }

  document.querySelectorAll('.platform-tab').forEach(tab => {
    tab.addEventListener('click', () => switchToPlatform(tab.dataset.platform));
  });

  // ─── Social stats (Instagram / Facebook) ────────────────────────────────
  function loadSocialStats() {
    const today = new Date().toDateString();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    function sumWeek(dailyData) {
      let videos = 0, time = 0, chat = 0;
      Object.keys(dailyData).forEach(dateStr => {
        if (new Date(dateStr) >= weekAgo) {
          videos += dailyData[dateStr].videosWatched || 0;
          time   += dailyData[dateStr].activeTime    || 0;
          chat   += dailyData[dateStr].chatTime      || 0;
        }
      });
      return { videos, time, chat };
    }

    function sumAll(dailyData) {
      let videos = 0, time = 0;
      Object.keys(dailyData).forEach(dateStr => {
        videos += dailyData[dateStr].videosWatched || 0;
        time   += dailyData[dateStr].activeTime    || 0;
      });
      return { videos, time };
    }

    // Instagram
    chrome.storage.local.get(['igStats'], (data) => {
      const daily = (data.igStats || {}).dailyData || {};
      const todayD = daily[today] || {};
      const week   = sumWeek(daily);
      const all    = sumAll(daily);

      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('ig-total-reels',     all.videos);
      set('ig-total-time',      formatTime(all.time / 60));
      set('ig-today-reels',     todayD.videosWatched || 0);
      set('ig-today-time',      formatTimeShort(todayD.activeTime / 60 || 0));
      set('ig-chat-time-today', formatTimeShort(todayD.chatTime / 60 || 0));
      set('ig-day-reels',       todayD.videosWatched || 0);
      set('ig-day-time',        formatTimeShort(todayD.activeTime / 60 || 0));
      set('ig-day-chat',        formatTimeShort(todayD.chatTime / 60 || 0));
      set('ig-week-reels',      week.videos);
      set('ig-week-time',       formatTimeShort(week.time / 60));
      set('ig-week-chat',       formatTimeShort(week.chat / 60));
      const igDate = document.getElementById('ig-today-date');
      if (igDate) igDate.textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    // Facebook
    chrome.storage.local.get(['fbStats'], (data) => {
      const daily = (data.fbStats || {}).dailyData || {};
      const todayD = daily[today] || {};
      const week   = sumWeek(daily);
      const all    = sumAll(daily);

      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('fb-total-videos',    all.videos);
      set('fb-total-time',      formatTime(all.time / 60));
      set('fb-today-videos',    todayD.videosWatched || 0);
      set('fb-today-time',      formatTimeShort(todayD.activeTime / 60 || 0));
      set('fb-chat-time-today', formatTimeShort(todayD.chatTime / 60 || 0));
      set('fb-day-videos',      todayD.videosWatched || 0);
      set('fb-day-time',        formatTimeShort(todayD.activeTime / 60 || 0));
      set('fb-day-chat',        formatTimeShort(todayD.chatTime / 60 || 0));
      set('fb-week-videos',     week.videos);
      set('fb-week-time',       formatTimeShort(week.time / 60));
      set('fb-week-chat',       formatTimeShort(week.chat / 60));
      const fbDate = document.getElementById('fb-today-date');
      if (fbDate) fbDate.textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
  }

  // Refresh buttons for social panels
  const refreshIgBtn = document.getElementById('refreshIgStats');
  if (refreshIgBtn) {
    refreshIgBtn.addEventListener('click', () => {
      loadSocialStats();
      refreshIgBtn.style.transition = 'transform 0.5s';
      refreshIgBtn.style.transform = 'rotate(360deg)';
      setTimeout(() => { refreshIgBtn.style.transform = 'rotate(0deg)'; }, 500);
    });
  }
  const refreshFbBtn = document.getElementById('refreshFbStats');
  if (refreshFbBtn) {
    refreshFbBtn.addEventListener('click', () => {
      loadSocialStats();
      refreshFbBtn.style.transition = 'transform 0.5s';
      refreshFbBtn.style.transform = 'rotate(360deg)';
      setTimeout(() => { refreshFbBtn.style.transform = 'rotate(0deg)'; }, 500);
    });
  }
  const resetFbBtn = document.getElementById('resetFbStats');
  if (resetFbBtn) {
    resetFbBtn.addEventListener('click', () => {
      if (!confirm('Reset all Facebook stats? This cannot be undone.')) return;
      chrome.storage.local.remove(['fbStats'], () => {
        loadSocialStats();
      });
    });
  }

  // Load statistics on page load
  loadStatistics();
  loadSocialStats();
  
  // Refresh statistics every 30 seconds
  setInterval(() => { loadStatistics(); loadSocialStats(); }, 30000);
});
