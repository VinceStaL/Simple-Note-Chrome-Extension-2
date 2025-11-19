let currentTabId = 'tab-0';
let chatHistory = {};
let tabsData = [];
let deleteConfirmTimeout = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'closeSidePanel') {
    window.close();
  }
});

// Notify background script that panel is opened
chrome.runtime.sendMessage({ action: 'panelOpened' });

document.addEventListener('DOMContentLoaded', function() {
  const addTabButton = document.getElementById('add-tab');
  const deleteTabButton = document.getElementById('delete-tab');
  const copyTabButton = document.getElementById('copy-tab');
  const pasteTabButton = document.getElementById('paste-tab');
  const exportTabButton = document.getElementById('export-tab');

  // Load saved chat history and tabs data
  chrome.storage.local.get(['chatHistory', 'tabsData']).then((result) => {
    if (result.chatHistory) {
      chatHistory = JSON.parse(result.chatHistory);
    }
    if (result.tabsData && result.tabsData.length > 0) {
      tabsData = result.tabsData;
    } else {
      tabsData = ['tab-0']; // Default tab if no data
    }

    // Initialize tabs
    tabsData.forEach((tabId, index) => {
      const tab = createTab(tabId, index + 1);
      document.getElementById('tabs').appendChild(tab);
      createChatArea(tabId);
    });

    switchTab(tabsData[0]); // Switch to the first tab
  });

  // Add new tab when clicking the + button
  addTabButton.addEventListener('click', addNewTab);

  // Delete selected tab when clicking the - button
  deleteTabButton.addEventListener('click', confirmDeleteTab);

  // Copy current tab when clicking the C button
  copyTabButton.addEventListener('click', copyCurrentTab);

  // Paste to current tab when clicking the P button
  pasteTabButton.addEventListener('click', pasteToCurrentTab);

  // Export current tab when clicking the > button
  exportTabButton.addEventListener('click', exportCurrentTab);

  // Close popup when clicking outside
  window.addEventListener('blur', function() {
    saveAllData();
  });
});

function createTab(id, number) {
  const tab = document.createElement('button');
  tab.textContent = number;
  tab.id = id;
  tab.classList.add('tab');
  tab.draggable = true;
  tab.addEventListener('click', () => switchTab(id));
  tab.addEventListener('dragstart', handleDragStart);
  tab.addEventListener('dragover', handleDragOver);
  tab.addEventListener('drop', handleDrop);
  return tab;
}

function createChatArea(id) {
  const chatArea = document.createElement('div');
  chatArea.id = `chat-area-${id}`;
  chatArea.classList.add('chat-area');
  chatArea.style.display = 'none';

  const editorWrapper = document.createElement('div');
  editorWrapper.classList.add('editor-wrapper');

  const lineNumbers = document.createElement('div');
  lineNumbers.id = `line-numbers-${id}`;
  lineNumbers.classList.add('line-numbers');

  const textarea = document.createElement('textarea');
  textarea.id = `secureInput-${id}`;
  textarea.classList.add('secure-input');
  textarea.addEventListener('input', function() {
    saveChatContent(id);
    updateLineNumbers(id);
  });
  textarea.addEventListener('scroll', function() {
    lineNumbers.scrollTop = textarea.scrollTop;
  });

  // Update line numbers when textarea is resized
  const resizeObserver = new ResizeObserver(() => {
    updateLineNumbers(id);
  });
  resizeObserver.observe(textarea);

  editorWrapper.appendChild(lineNumbers);
  editorWrapper.appendChild(textarea);
  chatArea.appendChild(editorWrapper);
  document.getElementById('chat-container').appendChild(chatArea);

  return chatArea;
}

function switchTab(tabId) {
  // Hide all chat areas
  document.querySelectorAll('.chat-area').forEach(area => area.style.display = 'none');

  // Show the selected chat area
  const chatArea = document.getElementById(`chat-area-${tabId}`);
  chatArea.style.display = 'block';

  // Load saved content
  const textarea = chatArea.querySelector('textarea');
  textarea.value = chatHistory[tabId] ? decrypt(chatHistory[tabId]) : '';

  // Update active tab styling
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');

  currentTabId = tabId;

  // Update line numbers for the active tab
  updateLineNumbers(tabId);
}

function updateLineNumbers(tabId) {
  const textarea = document.getElementById(`secureInput-${tabId}`);
  const lineNumbers = document.getElementById(`line-numbers-${tabId}`);

  if (!textarea || !lineNumbers) return;

  const text = textarea.value;
  const lines = text.split('\n');

  // Get textarea styles for measuring
  const style = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(style.lineHeight);
  const paddingLeft = parseFloat(style.paddingLeft);
  const paddingRight = parseFloat(style.paddingRight);
  const textareaWidth = textarea.clientWidth - paddingLeft - paddingRight;

  // Create a hidden element to measure text width
  const measureElement = document.createElement('span');
  measureElement.style.cssText = `
    position: absolute;
    visibility: hidden;
    white-space: pre;
    font-family: ${style.fontFamily};
    font-size: ${style.fontSize};
    font-weight: ${style.fontWeight};
    letter-spacing: ${style.letterSpacing};
  `;
  document.body.appendChild(measureElement);

  let numbersHtml = '';
  for (let i = 0; i < lines.length; i++) {
    // Measure the width of this line
    measureElement.textContent = lines[i] || ' ';
    const textWidth = measureElement.offsetWidth;

    // Calculate how many visual lines this text line takes
    const wrappedLines = Math.max(1, Math.ceil(textWidth / textareaWidth));
    const height = wrappedLines * lineHeight;

    numbersHtml += `<div style="height: ${height}px; line-height: ${lineHeight}px;">${i + 1}</div>`;
  }

  document.body.removeChild(measureElement);

  // Ensure at least one line number
  if (lines.length === 0) {
    numbersHtml = `<div style="height: ${lineHeight}px; line-height: ${lineHeight}px;">1</div>`;
  }

  lineNumbers.innerHTML = numbersHtml;
}

function addNewTab() {
  const tabsContainer = document.getElementById('tabs');
  const newTabId = `tab-${Date.now()}`; // Use timestamp for unique IDs
  const newTab = createTab(newTabId, tabsContainer.children.length + 1);
  tabsContainer.appendChild(newTab);
  createChatArea(newTabId);
  tabsData.push(newTabId);
  switchTab(newTabId);
  saveAllData();
}

function confirmDeleteTab() {
  const deleteButton = document.getElementById('delete-tab');
  
  if (deleteButton.style.backgroundColor === 'red') {
    // Second click - proceed with deletion
    deleteSelectedTab();
    resetDeleteButton();
  } else {
    // First click - show confirmation
    deleteButton.style.backgroundColor = 'red';
    deleteButton.style.color = 'white';
    
    if (deleteConfirmTimeout) {
      clearTimeout(deleteConfirmTimeout);
    }
    
    deleteConfirmTimeout = setTimeout(() => {
      resetDeleteButton();
    }, 3000);
  }
}

function resetDeleteButton() {
  const deleteButton = document.getElementById('delete-tab');
  deleteButton.style.backgroundColor = '';
  deleteButton.style.color = '';
  if (deleteConfirmTimeout) {
    clearTimeout(deleteConfirmTimeout);
    deleteConfirmTimeout = null;
  }
}

function deleteSelectedTab() {
  if (tabsData.length === 1) {
    // Clear the content of the last tab instead of showing a warning
    const textarea = document.querySelector(`#chat-area-${currentTabId} textarea`);
    textarea.value = '';
    chatHistory[currentTabId] = encrypt('');
    saveAllData();
    updateLineNumbers(currentTabId);
    return;
  }

  const index = tabsData.indexOf(currentTabId);
  if (index > -1) {
    tabsData.splice(index, 1);
    document.getElementById(currentTabId).remove();
    document.getElementById(`chat-area-${currentTabId}`).remove();
    delete chatHistory[currentTabId];

    // Switch to the previous tab or the first tab if deleting the first
    const newTabId = tabsData[index - 1] || tabsData[0];
    switchTab(newTabId);

    // Renumber remaining tabs
    document.querySelectorAll('.tab').forEach((tab, idx) => {
      tab.textContent = idx + 1;
    });
  }
  saveAllData();
}

function saveChatContent(tabId) {
  const textarea = document.getElementById(`secureInput-${tabId}`);
  chatHistory[tabId] = encrypt(textarea.value);
  saveAllData();
}

function saveAllData() {
  chrome.storage.local.set({
    chatHistory: JSON.stringify(chatHistory),
    tabsData: tabsData
  });
}

function encrypt(text) {
  // Implement your encryption logic here
  return btoa(text); // Simple base64 encoding for demonstration
}

function decrypt(encryptedText) {
  // Implement your decryption logic here
  return atob(encryptedText); // Simple base64 decoding for demonstration
}

function copyCurrentTab() {
  const textarea = document.querySelector(`#chat-area-${currentTabId} textarea`);
  const content = textarea.value;
  
  navigator.clipboard.writeText(content).then(() => {
    const copyButton = document.getElementById('copy-tab');
    const originalText = copyButton.textContent;
    copyButton.style.fontWeight = 'bold';
    setTimeout(() => {
      copyButton.style.fontWeight = 'normal';
    }, 1000);
  }).catch(() => {
    const copyButton = document.getElementById('copy-tab');
    const originalText = copyButton.textContent;
    copyButton.textContent = 'X';
    setTimeout(() => {
      copyButton.textContent = originalText;
    }, 1000);
  });
}

function pasteToCurrentTab() {
  navigator.clipboard.readText().then((clipboardText) => {
    const textarea = document.querySelector(`#chat-area-${currentTabId} textarea`);
    textarea.value += clipboardText;
    saveChatContent(currentTabId);
    updateLineNumbers(currentTabId);

    const pasteButton = document.getElementById('paste-tab');
    pasteButton.style.fontWeight = 'bold';
    setTimeout(() => {
      pasteButton.style.fontWeight = 'normal';
    }, 1000);
  }).catch(() => {
    const pasteButton = document.getElementById('paste-tab');
    const originalText = pasteButton.textContent;
    pasteButton.textContent = 'X';
    setTimeout(() => {
      pasteButton.textContent = originalText;
    }, 1000);
  });
}

let draggedTabId = null;

function handleDragStart(e) {
  draggedTabId = e.target.id;
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
  e.preventDefault();
  const targetTabId = e.target.id;
  
  if (draggedTabId && targetTabId && draggedTabId !== targetTabId) {
    const draggedIndex = tabsData.indexOf(draggedTabId);
    const targetIndex = tabsData.indexOf(targetTabId);
    
    // Reorder tabsData array
    tabsData.splice(draggedIndex, 1);
    tabsData.splice(targetIndex, 0, draggedTabId);
    
    // Renumber and reorder DOM elements
    const tabsContainer = document.getElementById('tabs');
    tabsContainer.innerHTML = '';
    
    tabsData.forEach((tabId, index) => {
      const tab = createTab(tabId, index + 1);
      tabsContainer.appendChild(tab);
    });
    
    // Restore active tab styling
    document.getElementById(currentTabId).classList.add('active');
    
    saveAllData();
  }
  
  draggedTabId = null;
}

function exportCurrentTab() {
  const textarea = document.querySelector(`#chat-area-${currentTabId} textarea`);
  const content = textarea.value;
  const blob = new Blob([content], {type: 'text/plain'});
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `note_${timestamp}.txt`;

  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  }, function(downloadId) {
    URL.revokeObjectURL(url);
  });
}