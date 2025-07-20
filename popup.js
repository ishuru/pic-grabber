/**
 * ContextSnap Popup Controller - Enhanced Autonomous Development System
 * Kai Background Agent v3.0 - User Interface Management
 */

class ContextSnapPopup {
    constructor() {
        this.metrics = {
            screenshotCount: 0,
            imageCount: 0,
            avgResponseTime: 0,
            uptime: 0
        };
        this.isEnabled = true;
        this.autoCapture = false;
        this.behaviorTracking = true;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadState();
        this.startMetricsUpdate();
    }

    initializeElements() {
        // Buttons
        this.captureBtn = document.getElementById('captureBtn');
        this.openSidebarBtn = document.getElementById('openSidebarBtn');
        this.scanBtn = document.getElementById('scanBtn');
        
        // Toggles
        this.autoCaptureToggle = document.getElementById('autoCaptureToggle');
        this.trackingToggle = document.getElementById('trackingToggle');
        
        // Status and metrics
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        this.screenshotCount = document.getElementById('screenshotCount');
        this.imageCount = document.getElementById('imageCount');
        this.avgResponseTime = document.getElementById('avgResponseTime');
        this.uptime = document.getElementById('uptime');
        
        // Loading indicator
        this.loadingIndicator = document.getElementById('loadingIndicator');
    }

    setupEventListeners() {
        // Screenshot capture
        this.captureBtn.addEventListener('click', () => {
            this.captureScreenshot();
        });

        // Open sidebar
        this.openSidebarBtn.addEventListener('click', () => {
            this.openSidebar();
        });

        // Scan images
        this.scanBtn.addEventListener('click', () => {
            this.scanImages();
        });

        // Auto capture toggle
        this.autoCaptureToggle.addEventListener('change', (e) => {
            this.autoCapture = e.target.checked;
            this.saveState();
            this.updateStatus();
        });

        // Behavior tracking toggle
        this.trackingToggle.addEventListener('change', (e) => {
            this.behaviorTracking = e.target.checked;
            this.saveState();
            this.updateStatus();
        });
    }

    async loadState() {
        try {
            const result = await chrome.storage.local.get([
                'enabled', 
                'autoCapture', 
                'behaviorTracking',
                'screenshotCount',
                'imageCount'
            ]);
            
            this.isEnabled = result.enabled !== false;
            this.autoCapture = result.autoCapture || false;
            this.behaviorTracking = result.behaviorTracking !== false;
            this.metrics.screenshotCount = result.screenshotCount || 0;
            this.metrics.imageCount = result.imageCount || 0;
            
            this.updateUI();
            this.updateStatus();
            
        } catch (error) {
            console.error('[Kai] Error loading state:', error);
        }
    }

    async saveState() {
        try {
            await chrome.storage.local.set({
                enabled: this.isEnabled,
                autoCapture: this.autoCapture,
                behaviorTracking: this.behaviorTracking,
                screenshotCount: this.metrics.screenshotCount,
                imageCount: this.metrics.imageCount
            });
        } catch (error) {
            console.error('[Kai] Error saving state:', error);
        }
    }

    async captureScreenshot() {
        try {
            this.showLoading(true);
            this.captureBtn.disabled = true;
            
            const startTime = performance.now();
            
            // Get current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                throw new Error('No active tab found');
            }

            // Send capture message to content script
            const response = await chrome.tabs.sendMessage(tab.id, { 
                type: 'captureScreenshot' 
            });
            
            if (response && response.success) {
                const duration = performance.now() - startTime;
                this.metrics.screenshotCount++;
                this.metrics.avgResponseTime = (this.metrics.avgResponseTime + duration) / 2;
                
                this.updateMetrics();
                this.saveState();
                
                // Show success feedback
                this.showSuccessFeedback('Screenshot captured successfully!');
                
                console.log(`[Kai] Screenshot captured in ${duration.toFixed(2)}ms`);
            } else {
                throw new Error('Screenshot capture failed');
            }
            
        } catch (error) {
            console.error('[Kai] Screenshot capture error:', error);
            this.showErrorFeedback('Screenshot capture failed');
        } finally {
            this.showLoading(false);
            this.captureBtn.disabled = false;
        }
    }

    async openSidebar() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab) {
                await chrome.sidePanel.open({ tabId: tab.id });
                window.close(); // Close popup after opening sidebar
            }
        } catch (error) {
            console.error('[Kai] Error opening sidebar:', error);
            this.showErrorFeedback('Failed to open sidebar');
        }
    }

    async scanImages() {
        try {
            this.showLoading(true);
            this.scanBtn.disabled = true;
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab) {
                await chrome.tabs.sendMessage(tab.id, { type: 'scanImagesForSidebar' });
                
                // Update image count after scan
                setTimeout(() => {
                    this.updateMetrics();
                }, 1000);
                
                this.showSuccessFeedback('Image scan completed');
            }
            
        } catch (error) {
            console.error('[Kai] Error scanning images:', error);
            this.showErrorFeedback('Image scan failed');
        } finally {
            this.showLoading(false);
            this.scanBtn.disabled = false;
        }
    }

    async updateMetrics() {
        try {
            // Get metrics from background script
            const response = await chrome.runtime.sendMessage({ type: 'getMetrics' });
            
            if (response && response.metrics) {
                this.metrics.screenshotCount = response.metrics.screenshot.count;
                this.metrics.avgResponseTime = response.metrics.screenshot.avgTime;
                this.metrics.uptime = response.uptime || 0;
                
                this.updateMetricsDisplay();
            }
        } catch (error) {
            console.error('[Kai] Error updating metrics:', error);
        }
    }

    updateMetricsDisplay() {
        this.screenshotCount.textContent = this.metrics.screenshotCount;
        this.imageCount.textContent = this.metrics.imageCount;
        this.avgResponseTime.textContent = `${this.metrics.avgResponseTime.toFixed(0)}ms`;
        
        // Format uptime
        const uptimeSeconds = Math.floor(this.metrics.uptime / 1000);
        const minutes = Math.floor(uptimeSeconds / 60);
        const seconds = uptimeSeconds % 60;
        this.uptime.textContent = `${minutes}m ${seconds}s`;
    }

    updateUI() {
        this.autoCaptureToggle.checked = this.autoCapture;
        this.trackingToggle.checked = this.behaviorTracking;
        this.updateMetricsDisplay();
    }

    updateStatus() {
        if (this.isEnabled && this.behaviorTracking) {
            this.statusDot.classList.remove('inactive');
            this.statusText.textContent = 'System Active';
        } else if (this.isEnabled) {
            this.statusDot.classList.remove('inactive');
            this.statusText.textContent = 'Basic Mode';
        } else {
            this.statusDot.classList.add('inactive');
            this.statusText.textContent = 'System Disabled';
        }
    }

    showLoading(show) {
        this.loadingIndicator.style.display = show ? 'block' : 'none';
    }

    showSuccessFeedback(message) {
        // Create temporary success message
        const feedback = document.createElement('div');
        feedback.textContent = message;
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #4ade80;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 1000;
            animation: fadeInOut 3s ease-in-out;
        `;
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
        }, 3000);
    }

    showErrorFeedback(message) {
        // Create temporary error message
        const feedback = document.createElement('div');
        feedback.textContent = message;
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #f87171;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 1000;
            animation: fadeInOut 3s ease-in-out;
        `;
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
        }, 3000);
    }

    startMetricsUpdate() {
        // Update metrics every 5 seconds
        setInterval(() => {
            this.updateMetrics();
        }, 5000);
        
        // Initial update
        this.updateMetrics();
    }
}

// Add CSS animation for feedback messages
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        20% { opacity: 1; transform: translateX(-50%) translateY(0); }
        80% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    }
`;
document.head.appendChild(style);

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const popup = new ContextSnapPopup();
    
    // Export for testing
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ContextSnapPopup;
    }
});
