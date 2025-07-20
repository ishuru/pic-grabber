/**
 * ContextSnap Content Script - Enhanced Autonomous Development System
 * Kai Background Agent v3.0 - Intelligent Behavior Tracking & Screenshot Optimization
 */

// Intelligent behavior tracking system
class IntelligentTracker {
    constructor() {
        this.sampleRate = 0.1; // 10% sampling
        this.importantEvents = new Set(['click', 'scroll', 'hover', 'focus']);
        this.contextWindow = 5000; // 5 seconds
        this.events = [];
        this.engagementMetrics = {
            scrollDepth: 0,
            dwellTime: 0,
            interactionCount: 0,
            lastInteraction: Date.now()
        };
    }
    
    shouldTrack(eventType, context) {
        // Always track important events
        if (this.importantEvents.has(eventType)) {
            return true;
        }
        
        // Context-aware sampling
        if (this.isHighEngagementContext(context)) {
            return Math.random() < this.sampleRate * 2; // Double sampling
        }
        
        // Standard sampling
        return Math.random() < this.sampleRate;
    }
    
    isHighEngagementContext(context) {
        return context.scrollDepth > 0.7 || 
               context.dwellTime > 10000 ||
               context.interactionCount > 5;
    }
    
    trackEvent(event, context) {
        if (this.shouldTrack(event.type, context)) {
            this.events.push({
                ...event,
                context,
                timestamp: Date.now()
            });
            
            // Update engagement metrics
            this.updateEngagementMetrics(event, context);
            
            // Batch processing
            if (this.events.length >= 50) {
                this.processBatch();
            }
        }
    }
    
    updateEngagementMetrics(event, context) {
        this.engagementMetrics.lastInteraction = Date.now();
        this.engagementMetrics.interactionCount++;
        
        if (event.type === 'scroll') {
            this.engagementMetrics.scrollDepth = Math.max(
                this.engagementMetrics.scrollDepth,
                context.scrollDepth || 0
            );
        }
    }
    
    async processBatch() {
        const batch = [...this.events];
        this.events = [];
        
        // Send to background for processing
        await chrome.runtime.sendMessage({
            action: 'process-behavior-batch',
            events: batch
        });
    }
}

// Screenshot optimization system
class ScreenshotOptimizer {
    constructor() {
        this.quality = 0.8;
        this.maxSize = 1024 * 1024; // 1MB
        this.maxDimension = 1920;
    }
    
    async optimizeScreenshot(dataUrl) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        return new Promise((resolve) => {
            img.onload = () => {
                const { width, height } = this.calculateOptimalSize(
                    img.width, img.height
                );
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                let optimizedDataUrl = canvas.toDataURL('image/jpeg', this.quality);
                
                // Progressive compression if needed
                while (this.getDataUrlSize(optimizedDataUrl) > this.maxSize && this.quality > 0.3) {
                    this.quality -= 0.1;
                    optimizedDataUrl = canvas.toDataURL('image/jpeg', this.quality);
                }
                
                resolve(optimizedDataUrl);
            };
            img.src = dataUrl;
        });
    }
    
    calculateOptimalSize(width, height) {
        const ratio = Math.min(
            this.maxDimension / width, 
            this.maxDimension / height
        );
        
        return {
            width: Math.round(width * ratio),
            height: Math.round(height * ratio)
        };
    }
    
    getDataUrlSize(dataUrl) {
        return Math.ceil((dataUrl.length * 3) / 4);
    }
}

// Enhanced image downloader with autonomous capabilities
class ContextSnapDownloader {
    constructor() {
        this.processedElements = new WeakSet();
        this.processedSources = new Set();
        this.enabled = true;
        this.intelligentTracker = new IntelligentTracker();
        this.screenshotOptimizer = new ScreenshotOptimizer();
        
        this.setupMutationObserver();
        this.setupMessageListener();
        this.setupEventCapture();
        this.setupBehaviorTracking();
        this.initializeState();
        
        // Start scanning for sidebar immediately
        this.scanImagesForSidebar();
    }

    /**
     * Initializes the extension's state from local storage.
     */
    async initializeState() {
        const result = await chrome.storage.local.get(['enabled']);
        this.enabled = result.enabled !== false; 
        if (this.enabled) {
            this.scanImagesForSidebar();
        }
    }

    /**
     * Sets up intelligent behavior tracking
     */
    setupBehaviorTracking() {
        // Track scroll events
        let scrollTimeout;
        document.addEventListener('scroll', (e) => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const scrollDepth = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
                this.intelligentTracker.trackEvent(e, { scrollDepth });
            }, 100);
        }, { passive: true });

        // Track interaction events
        ['click', 'hover', 'focus'].forEach(eventType => {
            document.addEventListener(eventType, (e) => {
                const context = {
                    scrollDepth: (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight,
                    dwellTime: Date.now() - this.intelligentTracker.engagementMetrics.lastInteraction,
                    interactionCount: this.intelligentTracker.engagementMetrics.interactionCount
                };
                this.intelligentTracker.trackEvent(e, context);
            }, { passive: true });
        });
    }

    /**
     * Removes all download buttons from the page.
     */
    removeAllButtons() {
        const buttons = document.querySelectorAll('.download-btn');
        buttons.forEach(button => button.remove());
    }

    /**
     * Sets up event listeners for right-click and canvas events.
     */
    setupEventCapture() {
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.download-btn')) {
                e.stopPropagation();
                return;
            }
        }, true);

        document.addEventListener('mouseup', (e) => {
            const canvas = e.target.closest('canvas');
            if (canvas && !this.processedElements.has(canvas)) {
                this.processCanvas(canvas);
            }
        }, true);
    }

    /**
     * Sets up a message listener for communication with the background script.
     */
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'scanImagesForSidebar') {
                this.scanImagesForSidebar();
            } else if (message.type === 'toggleExtension') {
                this.enabled = message.enabled;
                if (this.enabled) {
                    this.scanImagesForSidebar();
                }
            } else if (message.type === 'captureScreenshot') {
                this.captureOptimizedScreenshot();
            }
        });
    }

    /**
     * Captures and optimizes a screenshot of the current page
     */
    async captureOptimizedScreenshot() {
        try {
            const startTime = performance.now();
            
            // Request screenshot from background
            const response = await chrome.runtime.sendMessage({ 
                type: 'captureScreenshot' 
            });
            
            if (response.dataUrl) {
                // Further optimize if needed
                const optimizedDataUrl = await this.screenshotOptimizer.optimizeScreenshot(response.dataUrl);
                
                // Track performance
                const duration = performance.now() - startTime;
                console.log(`[Kai] Screenshot captured and optimized in ${duration.toFixed(2)}ms`);
                
                // Store or process the optimized screenshot
                await this.processScreenshot(optimizedDataUrl);
            }
            
        } catch (error) {
            console.error('[Kai] Screenshot capture failed:', error);
        }
    }
    
    /**
     * Processes captured screenshot data
     */
    async processScreenshot(dataUrl) {
        // Store in local storage with metadata
        const screenshotData = {
            dataUrl,
            timestamp: Date.now(),
            url: window.location.href,
            title: document.title,
            engagement: this.intelligentTracker.engagementMetrics
        };
        
        await chrome.storage.local.set({
            [`screenshot_${Date.now()}`]: screenshotData
        });
        
        console.log('[Kai] Screenshot processed and stored');
    }

    /**
     * Recursively scans a DOM element for images.
     * @param {Element} root - The root element to scan.
     */
    async deepScanElement(root) {
        if (!root) return;
        await this.processElement(root);
        const elements = root.querySelectorAll('*');
        for (const element of elements) {
            await this.processElement(element);
        }
        if (root.shadowRoot) {
            await this.deepScanElement(root.shadowRoot);
        }
    }

    /**
     * Processes comments for potential image sources.
     * @param {Element} root - The root element to scan.
     */
    processComments(root) {
        const iterator = document.createNodeIterator(
            root,
            NodeFilter.SHOW_COMMENT,
            null,
            false
        );
        let comment;
        while (comment = iterator.nextNode()) {
            const text = comment.textContent;
            const urls = text.match(/(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|svg|avif))/gi);
            if (urls) {
                urls.forEach(url => {
                    if (!this.processedSources.has(url)) {
                        this.processedSources.add(url);
                    }
                });
            }
        }
    }

    /**
     * Scans all images on the page and adds download buttons.
     */
    async scanAllImages() {
        console.log("[Kai] Starting intelligent image scan...");
        this.processedElements = new WeakSet();
        this.processedSources = new Set();
        this.removeAllButtons();
        await this.deepScanElement(document.documentElement);
        this.processComments(document.documentElement);

        const frames = document.getElementsByTagName('iframe');
        for (const frame of frames) {
            try {
                const frameDoc = frame.contentDocument || frame.contentWindow.document;
                await this.deepScanElement(frameDoc.documentElement);
                this.processComments(frameDoc.documentElement);
            } catch (e) {
                console.warn('[Kai] Cannot access iframe content:', e);
            }
        }

        const styles = document.getElementsByTagName('style');
        for (const style of styles) {
            const cssText = style.textContent;
            const urls = cssText.match(/url\("?(.*?\.(?:jpg|jpeg|png|gif|webp|svg|avif))["']?\)/gi);
            if (urls) {
                urls.forEach(url => {
                    const cleanUrl = url.slice(4, -1).replace(/["']/g, "");
                    if (!this.processedSources.has(cleanUrl)) {
                        this.processedSources.add(cleanUrl);
                    }
                });
            }
        }

        console.log("[Kai] Intelligent image scan completed.");
    }

    /**
     * Processes a single DOM element for images.
     * @param {Element} element - The element to process.
     */
    async processElement(element) {
        if (this.processedElements.has(element)) return;
        this.processedElements.add(element);

        const sources = ImageUtils.getAllPossibleSources(element);
        for (const src of sources) {
            if (!this.processedSources.has(src)) {
                this.processedSources.add(src);
            }
        }
    }

    /**
     * Processes a canvas element to extract its image data.
     * @param {HTMLCanvasElement} canvas - The canvas element.
     */
    processCanvas(canvas) {
        const imageData = ImageUtils.getCanvasImage(canvas);
        if (imageData) {
            // Enhanced canvas processing with optimization
            this.screenshotOptimizer.optimizeScreenshot(imageData)
                .then(optimizedData => {
                    console.log('[Kai] Canvas image optimized');
                })
                .catch(error => {
                    console.error('[Kai] Canvas optimization failed:', error);
                });
        }
    }

    /**
     * Scans images specifically for the sidebar view with enhanced processing
     */
    async scanImagesForSidebar() {
        if (!this.enabled) return;
        
        console.log("[Kai] Starting enhanced image scan for sidebar...");
        chrome.runtime.sendMessage({ type: 'clearImages' });

        const processImageForSidebar = async (element, src) => {
            try {
                if (!src || !ImageUtils.isPossibleImageSource(src)) return;
                if (this.processedSources.has(src)) return;
                this.processedSources.add(src);

                // Get image dimensions with enhanced detection
                let dimensions = 'Unknown';
                if (element instanceof HTMLImageElement && element.complete) {
                    dimensions = `${element.naturalWidth}x${element.naturalHeight}`;
                } else if (element instanceof HTMLCanvasElement) {
                    dimensions = `${element.width}x${element.height}`;
                }

                const imageData = {
                    url: src,
                    filename: ImageUtils.generateFileName(src),
                    dimensions: dimensions,
                    element: element,
                    timestamp: Date.now(),
                    engagement: this.intelligentTracker.engagementMetrics
                };

                chrome.runtime.sendMessage({
                    type: 'newImage',
                    data: imageData
                });
            } catch (error) {
                console.error('[Kai] Error processing image for sidebar:', error);
            }
        };

        // Reset processed sources for new scan
        this.processedSources = new Set();

        // Process all images in the document with enhanced detection
        const images = document.getElementsByTagName('img');
        for (const img of images) {
            if (ImageUtils.isValidImage(img)) {
                await processImageForSidebar(img, img.src);
                if (img.srcset) {
                    const srcset = img.srcset.split(',').map(src => src.trim().split(' ')[0]);
                    for (const src of srcset) {
                        await processImageForSidebar(img, src);
                    }
                }
            }
        }

        // Enhanced canvas detection
        const canvases = document.getElementsByTagName('canvas');
        for (const canvas of canvases) {
            if (!this.processedElements.has(canvas)) {
                this.processCanvas(canvas);
                this.processedElements.add(canvas);
            }
        }

        // Process background images
        const allElements = document.querySelectorAll('*');
        for (const element of allElements) {
            this.processBackgroundImage(element);
        }

        // Process SVG elements
        const svgs = document.querySelectorAll('svg');
        for (const svg of svgs) {
            this.processSVG(svg);
        }

        // Find base64 images
        this.findBase64Images(document.documentElement);

        // Send scan completion
        chrome.runtime.sendMessage({ type: 'scanComplete' });
        console.log("[Kai] Enhanced sidebar scan completed.");
    }

    /**
     * Processes an SVG element.
     * @param {SVGSVGElement} svg - The SVG element.
     */
    processSVG(svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        // Track SVG processing
        this.intelligentTracker.trackEvent({ type: 'svg-processed' }, {
            elementType: 'svg',
            size: svgData.length
        });
    }

    /**
     * Processes background images of an element.
     * @param {Element} element - The element to process.
     */
    processBackgroundImage(element) {
        const bgImage = window.getComputedStyle(element).backgroundImage;
        const urls = bgImage.match(/url\("?(.*?\.(?:jpg|jpeg|png|gif|webp|svg|avif))["']?\)/g) || [];
        urls.forEach(url => {
            const cleanUrl = url.slice(4, -1).replace(/["']/g, "");
            if (!this.processedSources.has(cleanUrl)) {
                this.processedSources.add(cleanUrl);
            }
        });
    }

    /**
     * Finds base64 encoded images in the document.
     * @param {Element} element - The element to search in.
     */
    findBase64Images(element) {
        const base64Pattern = /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g;
        const textContent = element.textContent || '';
        const matches = textContent.match(base64Pattern);
        
        if (matches) {
            matches.forEach(match => {
                if (!this.processedSources.has(match)) {
                    this.processedSources.add(match);
                }
            });
        }
    }

    /**
     * Sets up a mutation observer to watch for dynamic content changes.
     */
    setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldRescan = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'IMG' || node.querySelector('img')) {
                                shouldRescan = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldRescan && this.enabled) {
                // Debounced rescan
                clearTimeout(this.rescanTimeout);
                this.rescanTimeout = setTimeout(() => {
                    this.scanImagesForSidebar();
                }, 1000);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// Initialize the enhanced ContextSnap system
const contextSnap = new ContextSnapDownloader();

// Export for testing and debugging
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ContextSnapDownloader,
        IntelligentTracker,
        ScreenshotOptimizer
    };
}
