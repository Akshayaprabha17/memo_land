const sharp = require('sharp');
const path = require('path');

async function processImage() {
  const inputPath = path.join(__dirname, 'public', 'lego.webp');
  const outputPath = path.join(__dirname, 'public', 'lego_nobg.webp');
  
  try {
    const image = sharp(inputPath);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    // Ensure we have an alpha channel to work with
    let channels = info.channels;
    let newData = data;
    
    if (channels === 3) {
      // Create a 4-channel buffer
      newData = Buffer.alloc(info.width * info.height * 4);
      for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
        newData[j] = data[i];
        newData[j + 1] = data[i + 1];
        newData[j + 2] = data[i + 2];
        newData[j + 3] = 255; // Fully opaque initially
      }
      channels = 4;
    }

    // The image background is ~ rgb(15, 22, 41)
    const targetR = 15, targetG = 22, targetB = 41;
    // Landing page bg is ~ rgb(6, 9, 24)
    const newR = 6, newG = 9, newB = 24;
    
    // Threshold distance
    const tolerance = 60; // Euclidean distance squared or simple sum

    for (let i = 0; i < newData.length; i += channels) {
      const r = newData[i];
      const g = newData[i + 1];
      const b = newData[i + 2];

      const diff = Math.abs(r - targetR) + Math.abs(g - targetG) + Math.abs(b - targetB);
      
      if (diff < tolerance) {
        // Change to transparent
        newData[i] = newR;
        newData[i+1] = newG;
        newData[i+2] = newB;
        newData[i+3] = 0; // Make background transparent
      } else if (diff < tolerance * 1.5) {
        // Semi-transparent for softer edges (anti-aliasing)
        const alpha = Math.floor(255 * ((diff - tolerance) / (tolerance * 0.5)));
        newData[i] = newR;
        newData[i+1] = newG;
        newData[i+2] = newB;
        newData[i+3] = alpha; 
      }
    }

    await sharp(newData, {
      raw: {
        width: info.width,
        height: info.height,
        channels: channels
      }
    }).webp({ lossless: true }).toFile(outputPath);

    console.log("Image processed successfully.");
  } catch (err) {
    console.error("Error processing image:", err);
  }
}

processImage();
