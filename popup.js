document.addEventListener('DOMContentLoaded', function() {
    const toggleSwitch = document.getElementById('toggleExtension');
    const recrawlBtn = document.getElementById('recrawlBtn');
    const statusDiv = document.getElementById('status');

    // Initialize toggle state from storage
    chrome.storage.local.get(['enabled'], function(result) {
        toggleSwitch.checked = result.enabled !== false; // Default to true if not set
    });

    // Handle toggle changes
    toggleSwitch.addEventListener('change', function() {
        const enabled = toggleSwitch.checked;
        chrome.storage.local.set({ enabled: enabled });

        // Update status text
        statusDiv.textContent = `Extension ${enabled ? 'enabled' : 'disabled'}`;

        // Notify active tab of state change
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'toggleExtension',
                enabled: enabled
            });
        });
    });

    // Handle recrawl button click
    recrawlBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'scanImages' });
            statusDiv.textContent = 'Scanning page for images...';
            setTimeout(() => {
                statusDiv.textContent = 'Scan complete';
            }, 1500);
        });
    });
});
