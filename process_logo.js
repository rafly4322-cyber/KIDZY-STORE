const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const inputPath = 'C:\\Users\\ASUS TUF\\.gemini\\antigravity-ide\\brain\\43d56534-9acd-48fe-a6f7-5cd9c7c0a6f0\\.user_uploaded\\media_1788136610212.png';
const outputLogoPath = path.join(__dirname, 'public', 'assets', 'kidzyy-logo.png');

fs.createReadStream(inputPath)
  .pipe(new PNG({ filterType: 4 }))
  .on('parsed', function() {
    const width = this.width;
    const height = this.height;

    // First pass: identify foreground pixels
    const isFg = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        const r = this.data[idx];
        const g = this.data[idx + 1];
        const b = this.data[idx + 2];

        // Strong foreground condition: chrome letter, bright red lightning, or glass body
        if (r > 90 || g > 50 || b > 50) {
          isFg[width * y + x] = 1;
        }
      }
    }

    // Morphological closing on foreground mask to make sure interior of 3D letters is solid
    const solidMask = new Uint8Array(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = width * y + x;
        if (isFg[i]) {
          solidMask[i] = 1;
        } else {
          // Check neighbors
          let count = 0;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                if (isFg[width * ny + nx]) count++;
              }
            }
          }
          if (count >= 14) {
            solidMask[i] = 1;
          }
        }
      }
    }

    // Apply alpha based on solid mask and edge softness
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = width * y + x;
        const idx = i << 2;
        const r = this.data[idx];
        const g = this.data[idx + 1];
        const b = this.data[idx + 2];

        if (solidMask[i]) {
          // If it's a solid letter or lightning pixel, ensure full opacity and boosted color
          const maxVal = Math.max(r, g, b);
          if (maxVal < 40) {
            // Dark interior shadow of 3D letter -> give rich deep crimson metallic color
            this.data[idx] = 120;
            this.data[idx + 1] = 10;
            this.data[idx + 2] = 10;
            this.data[idx + 3] = 255;
          } else {
            this.data[idx + 3] = 255;
          }
        } else {
          // Outside background -> completely transparent
          this.data[idx] = 0;
          this.data[idx + 1] = 0;
          this.data[idx + 2] = 0;
          this.data[idx + 3] = 0;
        }
      }
    }

    this.pack().pipe(fs.createWriteStream(outputLogoPath)).on('finish', () => {
      console.log('✅ Solid, sharp & pristine transparent logo saved to:', outputLogoPath);
    });
  });
