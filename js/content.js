class ImageDownloader {
  constructor() {
    this.processedElements = new WeakSet();
    this.setupMutationObserver();
    this.setupMessageListener();
    this.setupEventCapture();
    this.processExistingImages();
  }

  setupEventCapture() {
    // Capture right-click events
    document.addEventListener('contextmenu', (e) => {
      // Allow right-click but prevent default only if it's our download button
      if (e.target.closest('.download-btn')) {
        e.stopPropagation();
        return;
      }
    }, true);

    // Monitor canvas changes
    document.addEventListener('mouseup', (e) => {
      const canvas = e.target.closest('canvas');
      if (canvas && !this.processedElements.has(canvas)) {
        this.processCanvas(canvas);
      }
    }, true);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'scanImages') {
        this.scanAllImages();
      }
    });
  }

  findBase64Images(element) {
    const images = [];

    // Check element attributes
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

    // Check background-image CSS
    const style = window.getComputedStyle(element);
    const backgroundImage = style.backgroundImage;
    if (backgroundImage) {
      const base64Match = backgroundImage.match(/url\("?(data:image\/[^"]+)"?\)/);
      if (base64Match && ImageUtils.isBase64Image(base64Match[1])) {
        images.push({
          element: element,
          src: base64Match[1]
        });
      }
    }

    // Check inline style
    if (element.style && element.style.backgroundImage) {
      const base64Match = element.style.backgroundImage.match(/url\("?(data:image\/[^"]+)"?\)/);
      if (base64Match && ImageUtils.isBase64Image(base64Match[1])) {
        images.push({
          element: element,
          src: base64Match[1]
        });
      }
    }

    return images;
  }

  async scanAllImages() {
    this.processedElements = new WeakSet();

    // Scan all elements
    const elements = document.querySelectorAll('*');
    for (const element of elements) {
      // Process regular images
      if (ImageUtils.isImageElement(element)) {
        await this.processElement(element);
      }

      // Find and process base64 images
      const base64Images = this.findBase64Images(element);
      for (const img of base64Images) {
        await this.processBase64Image(img.element, img.src);
      }
    }

    // Check for React/Vue rendered images
    this.scanShadowDOM(document.documentElement);
  }

  async processBase64Image(element, base64Src) {
    if (this.processedElements.has(element)) return;
    this.processedElements.add(element);

    // Create container and download button
    this.createDownloadButton(element, base64Src);
  }

  async processElement(element) {
    if (this.processedElements.has(element)) return;
    this.processedElements.add(element);

    if (element.tagName === 'IMG') {
      // Check for base64 src
      if (ImageUtils.isBase64Image(element.src)) {
        this.processBase64Image(element, element.src);
      } else {
        this.processImage(element);
      }
    } else if (element.tagName === 'CANVAS') {
      this.processCanvas(element);
    } else if (element.tagName === 'SVG') {
      this.processSVG(element);
    } else {
      // Handle background images
      const base64Images = this.findBase64Images(element);
      for (const img of base64Images) {
        await this.processBase64Image(img.element, img.src);
      }
    }
  }

  processCanvas(canvas) {
    const imageData = ImageUtils.getCanvasImage(canvas);
    if (imageData) {
      this.createDownloadButton(canvas, imageData);
    }
  }

  processSVG(svg) {
    // Convert SVG to data URL
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    this.createDownloadButton(svg, url);
  }

  processBackgroundImage(element) {
    const bgImage = window.getComputedStyle(element).backgroundImage;
    const urls = bgImage.match(/url\(['"]?(.*?)['"]?\)/g) || [];
    urls.forEach(url => {
      const cleanUrl = url.slice(4, -1).replace(/['"]/g, '');
      this.createDownloadButton(element, cleanUrl);
    });
  }

  createDownloadButton(element, imageUrl) {
    // Create container if needed
    let container = element.closest('.img-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'img-container';
      element.parentNode.insertBefore(container, element);
      container.appendChild(element);
    }

    // Create download button
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.innerHTML = `
      <svg class="download-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    `;

    downloadBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();

      try {
        downloadBtn.classList.add('loading');
        const blob = await ImageUtils.bypassCORS(imageUrl);
        const blobUrl = URL.createObjectURL(blob);
        const filename = ImageUtils.generateFileName(imageUrl);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      } catch (error) {
        console.error('Download failed:', error);
        alert('Failed to download image. Please try again.');
      } finally {
        downloadBtn.classList.remove('loading');
      }
    });

    container.appendChild(downloadBtn);
  }

  processImage(img) {
    if (this.processedElements.has(img) || !ImageUtils.isValidImage(img)) {
      return;
    }

    this.processedElements.add(img);
    this.createDownloadButton(img, img.src);
  }

  processExistingImages() {
    const images = document.getElementsByTagName('img');
    for (const img of images) {
      this.processImage(img);
    }
  }

  setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Handle added nodes
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            // Check if it's an image element
            if (ImageUtils.isImageElement(node)) {
              this.processElement(node);
            }

            // Check for base64 images
            const base64Images = this.findBase64Images(node);
            base64Images.forEach(img => {
              this.processBase64Image(img.element, img.src);
            });

            // Check child elements
            if (node.getElementsByTagName) {
              const elements = node.getElementsByTagName('*');
              Array.from(elements).forEach(element => {
                if (ImageUtils.isImageElement(element)) {
                  this.processElement(element);
                }
                const childBase64Images = this.findBase64Images(element);
                childBase64Images.forEach(img => {
                  this.processBase64Image(img.element, img.src);
                });
              });
            }
          }
        });

        // Handle attribute changes
        if (mutation.type === 'attributes') {
          const element = mutation.target;
          const base64Images = this.findBase64Images(element);
          base64Images.forEach(img => {
            this.processBase64Image(img.element, img.src);
          });
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'style', 'data-src']
    });
  }

  scanShadowDOM(root) {
    // Handle shadow DOM
    if (root.shadowRoot) {
      const elements = root.shadowRoot.querySelectorAll('*');
      elements.forEach(element => {
        if (ImageUtils.isImageElement(element)) {
          this.processElement(element);
        }
        this.scanShadowDOM(element);
      });
    }
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ImageDownloader());
} else {
  new ImageDownloader();
}
