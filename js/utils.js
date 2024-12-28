// Utility functions for image handling
const ImageUtils = {
  /**
   * Generate a filename for the image
   * @param {string} url - Image URL or data URI
   * @returns {string} Generated filename
   */
  generateFileName: (url) => {
    if (url.startsWith('data:image')) {
      const extension = url.split(';')[0].split('/')[1];
      return `image_${Date.now()}.${extension}`;
    }
    
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/');
      let fileName = pathSegments[pathSegments.length - 1];
      
      // If filename doesn't have extension, add one
      if (!fileName.match(/\.(jpg|jpeg|png|gif|webp|svg|avif)$/i)) {
        fileName += '.jpg';
      }
      return fileName;
    } catch {
      return `image_${Date.now()}.jpg`;
    }
  },

  /**
   * Convert image to blob URL
   * @param {string} url - Image URL or data URI
   * @returns {Promise<string>} Blob URL
   */
  getDownloadableUrl: async (url) => {
    try {
      if (url.startsWith('data:image')) {
        const response = await fetch(url);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }

      const response = await fetch(url, {
        mode: 'no-cors',
        credentials: 'include'
      });
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error creating blob URL:', error);
      throw error;
    }
  },

  /**
   * Check if an image is valid and loaded
   * @param {HTMLImageElement} img - Image element to check
   * @returns {boolean} Whether the image is valid
   */
  isValidImage: (img) => {
    return img.complete && 
           img.naturalWidth !== 0 && 
           img.naturalHeight !== 0 &&
           !img.classList.contains('download-icon');
  }
};

// Export for use in content.js
window.ImageUtils = ImageUtils;
