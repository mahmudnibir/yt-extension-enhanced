// background.js

// ─── Site-time tracking for Instagram & Facebook ─────────────────────────────
let activeTabId = null;
let activeTabDomain = null;
let activeTabUrl = null;
let lastActiveTime = null;

function getDomain(url) {
  try {
    const h = new URL(url).hostname;
    if (h.includes('instagram.com')) return 'ig';
    if (h.includes('facebook.com') || h.includes('fb.com') || h.includes('messenger.com')) return 'fb';
    return null;
  } catch (_) { return null; }
}

function isChat(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('instagram.com') && u.pathname.startsWith('/direct/')) return true;
    if (u.hostname.includes('messenger.com')) return true;
    if (u.hostname.includes('facebook.com') && u.pathname.startsWith('/messages/')) return true;
    return false;
  } catch (_) { return false; }
}

function recordTime(domain) {
  if (!domain || !lastActiveTime) return;
  const elapsed = Math.round((Date.now() - lastActiveTime) / 1000);
  if (elapsed <= 0 || elapsed > 7200) { lastActiveTime = null; return; }
  const today = new Date().toDateString();
  const key = `${domain}Stats`;
  const chat = isChat(activeTabUrl || '');
  chrome.storage.local.get([key], (data) => {
    const stats = data[key] || { dailyData: {} };
    const day = stats.dailyData[today] || { activeTime: 0, videosWatched: 0, chatTime: 0 };
    day.activeTime = (day.activeTime || 0) + elapsed;
    if (chat) day.chatTime = (day.chatTime || 0) + elapsed;
    stats.dailyData[today] = day;
    chrome.storage.local.set({ [key]: stats });
  });
  lastActiveTime = Date.now();
}

function switchActive(tabId, url) {
  recordTime(activeTabDomain);
  activeTabId = tabId;
  activeTabUrl = url;
  activeTabDomain = getDomain(url);
  lastActiveTime = activeTabDomain ? Date.now() : null;
}

chrome.tabs.onActivated.addListener((info) => {
  chrome.tabs.get(info.tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    switchActive(info.tabId, tab.url || '');
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId !== activeTabId || !changeInfo.url) return;
  const newDomain = getDomain(changeInfo.url);
  if (newDomain === activeTabDomain) {
    // Same platform — just update the URL so chat detection stays current, don't reset the clock
    activeTabUrl = changeInfo.url;
  } else {
    // Domain actually changed — flush + restart
    switchActive(tabId, changeInfo.url);
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    recordTime(activeTabDomain);
    lastActiveTime = null;
  } else {
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      if (tabs && tabs[0]) switchActive(tabs[0].id, tabs[0].url || '');
    });
  }
});

// ─── Message handler ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getCloudSync') {
    chrome.storage.sync.get(['cloudSync'], (data) => {
      sendResponse({ cloudSync: data.cloudSync });
    });
    return true;
  }
  if (request.type === 'getShortcuts') {
    chrome.storage.sync.get(['shortcuts'], (data) => {
      sendResponse({ shortcuts: data.shortcuts });
    });
    return true;
  }
  if (request.type === 'socialVideoPlay') {
    const { domain } = request;
    if (domain !== 'ig' && domain !== 'fb') return;
    const today = new Date().toDateString();
    const key = `${domain}Stats`;
    chrome.storage.local.get([key], (data) => {
      const stats = data[key] || { dailyData: {} };
      const day = stats.dailyData[today] || { activeTime: 0, videosWatched: 0 };
      day.videosWatched = (day.videosWatched || 0) + 1;
      stats.dailyData[today] = day;
      chrome.storage.local.set({ [key]: stats });
    });
  }
});
