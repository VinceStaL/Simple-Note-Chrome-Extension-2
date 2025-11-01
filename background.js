// Service worker for the extension
self.addEventListener('install', (event) => {
  console.log('Service worker installed');
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
});

// Toggle side panel when extension icon is clicked
// Track panel state per window
const panelStates = new Map();

chrome.action.onClicked.addListener(async (tab) => {
  const windowId = tab.windowId;
  const isOpen = panelStates.get(windowId) || false;

  if (isOpen) {
    // Send message to side panel to close itself
    chrome.runtime.sendMessage({ action: 'closeSidePanel' });
    panelStates.set(windowId, false);
  } else {
    // Open the panel
    await chrome.sidePanel.open({ windowId });
    panelStates.set(windowId, true);
  }
});

// Listen for messages from the side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'panelOpened') {
    const windowId = sender.tab?.windowId;
    if (windowId) {
      panelStates.set(windowId, true);
    }
  }
});

// Clean up state when window is closed
chrome.windows.onRemoved.addListener((windowId) => {
  panelStates.delete(windowId);
});