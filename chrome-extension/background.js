const TIA_API_BASE = 'http://127.0.0.1:3000/api/tia';

chrome.runtime.onInstalled.addListener(() => {
  console.log('TIA Browser Hunter Extension Installed');
  chrome.storage.local.set({ lastPositionId: null });
});

// We can define background service worker tasks here if needed.
// For example, making network requests to bypass CORS in some complex cases.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TIA_IMPORT_CANDIDATE') {
    fetch(`${TIA_API_BASE}/import/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [request.payload] })
    })
    .then(res => res.json())
    .then(data => sendResponse({ success: true, data }))
    .catch(error => sendResponse({ success: false, error: error.message }));

    return true; // Keep message channel open for async response
  }
});
