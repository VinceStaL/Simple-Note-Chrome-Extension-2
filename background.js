// Service worker for the extension
self.addEventListener('install', (event) => {
  console.log('Service worker installed');
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});