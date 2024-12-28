class ImageDownloader {
  constructor() {
    this.processedImages = new WeakSet();
    this.setupMutationObserver();
    this.processExistingImages();
  }

  createDownloadButton(img) {
    // Create container
    const container = document.createElement('div');
    container.className = 'img-container';
    img.parentNode.insertBefore(container, img);
    container.appendChild(img);

    // Create download button with icon
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.innerHTML = `
      <svg class="download-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    `;

    // Add download functionality
    downloadBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      try {
        downloadBtn.classList.add('loading');
        const imageUrl = img.src;
        const filename = ImageUtils.generateFileName(imageUrl);
        const blobUrl = await ImageUtils.getDownloadableUrl(imageUrl);

        // Create and trigger download
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Cleanup
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
    if (this.processedImages.has(img) || !ImageUtils.isValidImage(img)) {
      return;
    }

    this.processedImages.add(img);
    this.createDownloadButton(img);
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
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach(node => {
            // Direct image node
            if (node.nodeName === 'IMG') {
              this.processImage(node);
            }
            // Images inside added nodes
            if (node.getElementsByTagName) {
              const images = node.getElementsByTagName('img');
              for (const img of images) {
                this.processImage(img);
              }
            }
          });
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ImageDownloader());
} else {
  new ImageDownloader();
}
