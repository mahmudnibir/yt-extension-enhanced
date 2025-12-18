// background.js
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
});
