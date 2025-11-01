# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Simple Note is a Chrome Manifest V3 extension that provides encrypted note-taking functionality with multi-tab support. All notes are stored locally in the browser using Chrome's storage API with base64 encoding.

## Architecture

### Core Components

- **[popup.html](popup.html)**: Extension UI popup with tab controls and chat container
- **[popup.js](popup.js)**: Main application logic handling tabs, encryption, storage, and UI interactions
- **[background.js](background.js)**: Service worker (currently minimal, only logs install/activate events)
- **[manifest.json](manifest.json)**: Chrome extension manifest (v3) defining permissions and entry points

### Data Flow

1. User input in textarea → Auto-saved via `saveChatContent()` → Encrypted with `encrypt()` (base64) → Stored in `chrome.storage.local`
2. Tab switching → Load encrypted data from `chatHistory` object → Decrypt with `decrypt()` → Display in textarea

### Key Data Structures

- `chatHistory`: Object mapping `tabId` to encrypted note content
- `tabsData`: Array of tab IDs in display order (supports drag-and-drop reordering)
- `currentTabId`: Currently active tab identifier (format: `tab-{timestamp}` or `tab-0` for default)

### Storage Schema

Chrome local storage contains:
- `chatHistory`: Stringified JSON object with encrypted notes per tab
- `tabsData`: Array of tab IDs for persistence and ordering

## Development

### Testing the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" and select this directory
4. The extension icon will appear in the toolbar
5. After making code changes, click the refresh icon on the extension card

### Making Changes

When modifying functionality:
- **Tab management**: Edit tab creation/deletion logic in [popup.js](popup.js) (`createTab`, `addNewTab`, `deleteSelectedTab`)
- **Encryption**: The current implementation uses simple base64 encoding (lines 199-207). Real encryption would require replacing `btoa`/`atob` with a proper crypto library
- **Storage**: All persistence uses `chrome.storage.local` API through `saveAllData()`
- **UI/styling**: Modify [styles.css](styles.css) and [popup.html](popup.html)

### Important Implementation Details

**Encryption**: Despite the README claiming "AES encryption", the actual implementation ([popup.js:199-207](popup.js#L199-L207)) uses base64 encoding (btoa/atob), which is NOT encryption. This is an important security limitation to be aware of when making changes.

**Delete Confirmation**: The delete button requires two clicks within 3 seconds to prevent accidental deletion ([popup.js:119-149](popup.js#L119-L149)). First click turns button red, second click executes deletion.

**Last Tab Behavior**: Deleting the last remaining tab clears its content instead of removing the tab ([popup.js:152-159](popup.js#L152-L159)).

**Auto-save**: Content is saved on every input event and when the popup loses focus (blur event).

## Permissions

- `storage`: Required for `chrome.storage.local` to persist notes
- `downloads`: Required for the export-to-file feature
- `clipboardRead`: Required for the paste functionality

## No Build Process

This is a vanilla JavaScript Chrome extension with no build step, bundler, or package manager. Changes to .js, .css, or .html files take effect immediately after reloading the extension in `chrome://extensions/`.
