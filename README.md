# Image Downloader Plus (Pic-Grabber)

A powerful Chrome extension that allows you to download any image from any webpage, including protected and dynamically loaded images.

## Features

- Download any visible image with a single click
- Smart icon positioning to avoid overlapping with website elements
- Support for protected and dynamically loaded images
- Works with:
  - Regular images (`<img>` tags)
  - Background images (CSS)
  - Canvas elements
  - SVG images
  - Base64 encoded images
  - Lazy-loaded images
  - Images in iframes
  - Images in shadow DOM

## Installation

1. Clone this repository or download the zip file
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory

## Usage

- Click the extension icon in the toolbar to scan the current page for images
- Hover over any image to reveal the download button
- Click the download button to save the image

## Smart Icon Positioning

The extension implements smart icon positioning to avoid conflicts with website elements:

- Default position: Bottom-left corner of images
- Automatic repositioning if conflicts are detected
- Four possible positions (bottom-left, bottom-right, top-left, top-right)
- Lower z-index to avoid overlapping with critical website elements

## Technical Details

### Directory Structure
```
./
├── assets/
│   ├── download-16.png
│   ├── download-32.png
│   └── download-48.png
├── css/
│   └── styles.css
├── js/
│   ├── background.js
│   ├── content.js
│   └── utils.js
└── manifest.json
```

### Permissions
- `downloads`: For saving images
- `scripting`: For injecting content scripts
- `activeTab`: For accessing the current tab
- `webRequest`: For handling image requests

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License - feel free to use and modify as needed.

## Troubleshooting

### Common Issues

1. Icon overlapping with website elements
   - The extension uses smart positioning to avoid conflicts
   - Icons will automatically reposition if conflicts are detected
   - Default position is bottom-left to minimize interference

2. Images not downloading
   - Check if the image is fully loaded
   - Some websites may require authentication
   - Check browser console for error messages

### Reporting Issues

Please report issues through GitHub issues with:
- Browser version
- Steps to reproduce
- Screenshot if possible
- Website URL where the issue occurs

## Future Improvements

- [ ] Implement batch download functionality
- [ ] Add image format conversion options
- [ ] Include image preview on hover