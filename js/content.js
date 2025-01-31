/**
 * Manages image downloading functionality.
 */
class ImageDownloader {
    constructor() {
        this.processedElements = new WeakSet();
        this.processedSources = new Set();
        this.enabled = true;
        this.setupMutationObserver();
        this.setupMessageListener();
        this.setupEventCapture();
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
            }
        });
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
        console.log("Starting full rescan...");
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
                console.warn('Cannot access iframe content:', e);
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

        console.log("Finished rescanning.");
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
        }
    }

    /**
     * Processes an SVG element.
     * @param {SVGSVGElement} svg - The SVG element.
     */
    processSVG(svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
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
        });
    }

    /**
     * Scans images specifically for the sidebar view
     */
    async scanImagesForSidebar() {
        if (!this.enabled) return;
        
        console.log("Starting image scan for sidebar...");
        chrome.runtime.sendMessage({ type: 'clearImages' });

        const processImageForSidebar = async (element, src) => {
            try {
                if (!src || !ImageUtils.isPossibleImageSource(src)) return;
                if (this.processedSources.has(src)) return;
                this.processedSources.add(src);

                // Get image dimensions
                let dimensions = 'Unknown';
                if (element instanceof HTMLImageElement && element.complete) {
                    dimensions = `${element.naturalWidth}x${element.naturalHeight}`;
                }

                const imageData = {
                    url: src,
                    filename: ImageUtils.generateFileName(src),
                    dimensions: dimensions,
                    element: element
                };

                chrome.runtime.sendMessage({
                    type: 'newImage',
                    data: imageData
                });
            } catch (error) {
                console.error('Error processing image for sidebar:', error);
            }
        };

        // Reset processed sources for new scan
        this.processedSources = new Set();

        // Process all images in the document
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

        // Process background images
        const elements = document.getElementsByTagName('*');
        for (const element of elements) {
            const style = window.getComputedStyle(element);
            const bgImage = style.backgroundImage;
            if (bgImage && bgImage !== 'none') {
                const urls = bgImage.match(/url\(['"]?(.*?)['"]?\)/g);
                if (urls) {
                    for (const url of urls) {
                        const cleanUrl = url.slice(4, -1).replace(/["']/g, "");
                        await processImageForSidebar(element, cleanUrl);
                    }
                }
            }
        }

        // Process canvas elements
        const canvases = document.getElementsByTagName('canvas');
        for (const canvas of canvases) {
            try {
                const dataUrl = canvas.toDataURL('image/png');
                await processImageForSidebar(canvas, dataUrl);
            } catch (e) {
                console.warn('Canvas may be tainted:', e);
            }
        }

        // Process SVG elements
        const svgs = document.getElementsByTagName('svg');
        for (const svg of svgs) {
            try {
                const svgData = new XMLSerializer().serializeToString(svg);
                const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);
                await processImageForSidebar(svg, url);
            } catch (e) {
                console.warn('Error processing SVG:', e);
            }
        }

        // Process base64 images
        for (const element of elements) {
            const base64Images = this.findBase64Images(element);
            for (const { element: imgElement, src } of base64Images) {
                await processImageForSidebar(imgElement, src);
            }
        }

        console.log("Finished scanning images for sidebar");
        chrome.runtime.sendMessage({ type: 'scanComplete' });
    }

    /**
     * Finds base64 encoded images within an element.
     * @param {Element} element - The element to search.
     * @returns {Array<{element: Element, src: string}>} Array of base64 images.
     */
    findBase64Images(element) {
        const images = [];
        if (element.attributes) {
            Array.from(element.attributes).forEach(attr => {
                if (ImageUtils.isBase64Image(attr.value)) {
                    images.push({
                        element: element,
                        src: attr.value
                    });
                }
            });
        }
        const style = window.getComputedStyle(element);
        const backgroundImage = style.backgroundImage;
        if (backgroundImage) {
            const base64Match = backgroundImage.match(/url\("?(data:image\n[^"]+)"?\)/);
            if (base64Match && ImageUtils.isBase64Image(base64Match[1])) {
                images.push({
                    element: element,
                    src: base64Match[1]
                });
            }
        }
        if (element.style && element.style.backgroundImage) {
            const base64Match = element.style.backgroundImage.match(/url\("?(data:image\n[^"]+)"?\)/);
            if (base64Match && ImageUtils.isBase64Image(base64Match[1])) {
                images.push({
                    element: element,
                    src: base64Match[1]
                });
            }
        }
        return images;
    }

    /**
     * Sets up a mutation observer to detect changes in the DOM.
     */
    setupMutationObserver() {
        const observer = new MutationObserver(async (mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach(async (node) => {
                    if (node.nodeType === 1) { 
                        await this.deepScanElement(node); 
                    }
                });

                if (mutation.type === 'attributes') {
                    const target = mutation.target;
                    await this.processElement(target); 
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'style', 'data-src'],
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const downloader = new ImageDownloader();
    });
} else {
    const downloader = new ImageDownloader();
}
