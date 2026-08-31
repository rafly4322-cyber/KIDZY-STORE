const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const inputPath = 'C:\\Users\\ASUS TUF\\.gemini\\antigravity-ide\\brain\\43d56534-9acd-48fe-a6f7-5cd9c7c0a6f0\\.user_uploaded\\media_1788136610212.png';
const outputLogoPath = path.join(__dirname, 'public', 'assets', 'kidzyy-logo.png');

fs.createReadStream(inputPath)
  .pipe(new PNG({ filterType: 4 }))
  .on('parsed', function() {
    console.log(`Parsed PNG size: ${this.width}x${this.height}`);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = (this.width * y + x) << 2;
        const r = this.data[idx];
        const g = this.data[idx + 1];
        const b = this.data[idx + 2];

        // Gray/Chrome detection (high brightness across all channels)
        const minChannel = Math.min(r, g, b);
        const maxChannel = Math.max(r, g, b);
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

        let alpha = 0;

        if (minChannel > 100) {
          // Pure metallic chrome letters
          alpha = 255;
        } else if (r > 110 && (r > g * 1.5 || r > b * 1.5)) {
          // Electric red lightning / glowing bolt edges
          const intensity = (r - 70) / 140;
          alpha = Math.min(255, Math.max(0, Math.round(intensity * 255)));
        } else if (brightness > 80) {
          const intensity = (brightness - 70) / 70;
          alpha = Math.min(255, Math.max(0, Math.round(intensity * 255)));
        } else {
          alpha = 0;
        }

        this.data[idx + 3] = alpha;
      }
    }

    this.pack().pipe(fs.createWriteStream(outputLogoPath)).on('finish', () => {
      console.log('✅ Refined transparent logo saved to:', outputLogoPath);
    });
  });
