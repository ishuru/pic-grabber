/**
 * Kai Background Agent v3.0 - Enhanced Autonomous Development System
 * ContextSnap Extension Background Service Worker
 */

// Core system state
let sidebarImages = new Map();
let sidebarPorts = new Set();
let systemMetrics = {
    screenshot: { count: 0, avgTime: 0, errors: 0 },
    api: { count: 0, avgTime: 0, errors: 0 },
    memory: { current: 0, peak: 0, avg: 0 },
    cpu: { current: 0, peak: 0, avg: 0 }
};
let startTime = Date.now();

// Performance monitoring and optimization
class PerformanceOptimizer {
    constructor() {
        this.metrics = new Map();
        this.thresholds = {
            memory: 50 * 1024 * 1024, // 50MB
            cpu: 0.8, // 80% CPU usage
            response: 2000 // 2 seconds
        };
    }
    
    async optimizeScreenshot(dataUrl) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        return new Promise((resolve) => {
            img.onload = () => {
                const { width, height } = this.calculateOptimalSize(
                    img.width, img.height, 1920
                );
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = dataUrl;
        });
    }
    
    calculateOptimalSize(width, height, maxDimension = 1920) {
        const ratio = Math.min(
            maxDimension / width, 
            maxDimension / height
        );
        
        return {
            width: Math.round(width * ratio),
            height: Math.round(height * ratio)
        };
    }
}

// Security and data management
class SecurityManager {
    constructor() {
        this.sensitiveFields = ['password', 'credit_card', 'ssn', 'token'];
        this.dataRetentionDays = 30;
    }
    
    sanitizeData(data) {
        const sanitized = { ...data };
        this.sensitiveFields.forEach(field => {
            if (sanitized[field]) delete sanitized[field];
        });
        return sanitized;
    }
    
    async cleanupOldData() {
        const cutoff = Date.now() - (this.dataRetentionDays * 24 * 60 * 60 * 1000);
        const result = await chrome.storage.local.get(null);
        const keysToDelete = Object.entries(result)
            .filter(([key, value]) => value.timestamp && value.timestamp < cutoff)
            .map(([key]) => key);
        
        if (keysToDelete.length > 0) {
            await chrome.storage.local.remove(keysToDelete);
        }
    }
}

// Error handling and recovery
class ErrorHandler {
    constructor() {
        this.errorCount = 0;
        this.maxErrors = 10;
        this.errorWindow = 60000; // 1 minute
        this.circuitBreaker = new Map();
    }
    
    handleError(error, context) {
        const now = Date.now();
        const contextKey = `${context}-${Math.floor(now / this.errorWindow)}`;
        
        this.errorCount++;
        
        // Circuit breaker pattern
        if (this.errorCount >= this.maxErrors) {
            this.circuitBreaker.set(context, now + 300000); // 5 minute cooldown
            this.disableFeature(context);
        }
        
        // Log and report
        this.logError(error, context, now);
    }
    
    async logError(error, context, timestamp) {
        console.error(`[Kai Error] ${context}:`, error);
        await chrome.runtime.sendMessage({
            action: 'log-error',
            error: error.message,
            context,
            timestamp,
            stack: error.stack
        });
    }
    
    disableFeature(context) {
        console.warn(`[Kai] Feature disabled due to errors: ${context}`);
    }
}

// Browser compatibility layer
class BrowserAPI {
    constructor() {
        this.browser = this.detectBrowser();
        this.api = this.getUnifiedAPI();
    }
    
    detectBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return 'chrome';
        if (ua.includes('Edge')) return 'edge';
        if (ua.includes('Brave')) return 'brave';
        return 'chrome'; // Default fallback
    }
    
    getUnifiedAPI() {
        return {
            tabs: chrome.tabs || browser.tabs,
            storage: chrome.storage || browser.storage,
            runtime: chrome.runtime || browser.runtime,
            scripting: chrome.scripting || browser.scripting
        };
    }
}

// Initialize core systems
const performanceOptimizer = new PerformanceOptimizer();
const securityManager = new SecurityManager();
const errorHandler = new ErrorHandler();
const browserAPI = new BrowserAPI();

// Keep-alive mechanism for service worker
chrome.alarms.create('keep-alive', { 
    delayInMinutes: 1, 
    periodInMinutes: 1 
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keep-alive') {
        // Maintain service worker activity
        console.log('[Kai] Service worker keep-alive tick');
    }
});

// Set up side panel behavior on installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Kai] ContextSnap Extension v1.0.0 initialized');
    
    // Configure the side panel to open when clicking the action button
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch(error => {
            errorHandler.handleError(error, 'sidePanel-config');
        });
    
    // Initialize system metrics
    systemMetrics.startTime = Date.now();
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
    try {
        const startTime = performance.now();
        
        // Open the side panel
        await chrome.sidePanel.open({ tabId: tab.id });
        
        // Trigger image scan
        chrome.tabs.sendMessage(tab.id, { type: 'scanImagesForSidebar' });
        
        // Track performance
        const duration = performance.now() - startTime;
        systemMetrics.api.count++;
        systemMetrics.api.avgTime = (systemMetrics.api.avgTime + duration) / 2;
        
    } catch (error) {
        errorHandler.handleError(error, 'action-click');
        systemMetrics.api.errors++;
    }
});

// Handle connections from sidebar
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'sidebar') {
        sidebarPorts.add(port);
        
        // Send existing images if any
        if (sidebarImages.size > 0) {
            port.postMessage({ type: 'initialImages', images: Array.from(sidebarImages.values()) });
        }

        port.onDisconnect.addListener(() => {
            sidebarPorts.delete(port);
        });

        // When sidebar connects, trigger a scan on the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'scanImagesForSidebar' });
            }
        });
    }
});

// Handle messages from content script and sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const startTime = performance.now();
    
    try {
        if (message.type === 'fetchImage') {
            fetch(message.url, {
                headers: {
                    'Accept': 'image/webp,image/apng,image/*,*/*',
                    'Content-Type': message.mimeType || 'image/webp'
                }
            })
                .then(response => response.blob())
                .then(blob => {
                    const newBlob = new Blob([blob], { type: message.mimeType || blob.type });
                    sendResponse({ blob: newBlob });
                    
                    // Track performance
                    const duration = performance.now() - startTime;
                    systemMetrics.api.count++;
                    systemMetrics.api.avgTime = (systemMetrics.api.avgTime + duration) / 2;
                })
                .catch(error => {
                    errorHandler.handleError(error, 'fetch-image');
                    systemMetrics.api.errors++;
                    sendResponse({ error: error.message });
                });
            return true;
        } 
        else if (message.type === 'clearImages') {
            sidebarImages.clear();
            // Broadcast to all connected sidebars
            for (const port of sidebarPorts) {
                port.postMessage({ type: 'clearImages' });
            }
        }
        else if (message.type === 'newImage') {
            const imageData = securityManager.sanitizeData(message.data);
            if (!sidebarImages.has(imageData.url)) {
                sidebarImages.set(imageData.url, imageData);
                // Broadcast to all connected sidebars
                for (const port of sidebarPorts) {
                    port.postMessage({ type: 'newImage', data: imageData });
                }
            }
        }
        else if (message.type === 'scanComplete') {
            // Broadcast scan completion to all connected sidebars
            for (const port of sidebarPorts) {
                port.postMessage({ type: 'scanComplete' });
            }
        }
        else if (message.type === 'captureScreenshot') {
            // Enhanced screenshot capture with optimization
            chrome.tabs.captureVisibleTab(null, { format: 'png' }, async (dataUrl) => {
                try {
                    const optimizedDataUrl = await performanceOptimizer.optimizeScreenshot(dataUrl);
                    sendResponse({ dataUrl: optimizedDataUrl });
                    
                    // Track screenshot performance
                    const duration = performance.now() - startTime;
                    systemMetrics.screenshot.count++;
                    systemMetrics.screenshot.avgTime = (systemMetrics.screenshot.avgTime + duration) / 2;
                    
                } catch (error) {
                    errorHandler.handleError(error, 'screenshot-capture');
                    systemMetrics.screenshot.errors++;
                    sendResponse({ error: error.message });
                }
            });
            return true;
        }
        else if (message.type === 'getMetrics') {
            // Return system metrics for monitoring
            sendResponse({ 
                metrics: systemMetrics,
                uptime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        errorHandler.handleError(error, 'message-handler');
    }
});

// Periodic cleanup and maintenance
setInterval(async () => {
    try {
        await securityManager.cleanupOldData();
        
        // Update memory metrics
        if (performance.memory) {
            systemMetrics.memory.current = performance.memory.usedJSHeapSize;
            systemMetrics.memory.peak = Math.max(systemMetrics.memory.peak, performance.memory.usedJSHeapSize);
            systemMetrics.memory.avg = (systemMetrics.memory.avg + performance.memory.usedJSHeapSize) / 2;
        }
        
    } catch (error) {
        errorHandler.handleError(error, 'maintenance');
    }
}, 300000); // Every 5 minutes

// Export for testing and debugging
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PerformanceOptimizer,
        SecurityManager,
        ErrorHandler,
        BrowserAPI
    };
}
