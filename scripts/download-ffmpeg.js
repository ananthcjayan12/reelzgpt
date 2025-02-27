const https = require('https');
const fs = require('fs');
const path = require('path');

const FFMPEG_VERSION = '0.10.0';
const FILES_TO_DOWNLOAD = [
  {
    url: `https://unpkg.com/@ffmpeg/core@${FFMPEG_VERSION}/dist/ffmpeg-core.js`,
    filename: 'ffmpeg-core.js'
  },
  {
    url: `https://unpkg.com/@ffmpeg/core@${FFMPEG_VERSION}/dist/ffmpeg-core.wasm`,
    filename: 'ffmpeg-core.wasm'
  },
  {
    url: `https://unpkg.com/@ffmpeg/core@${FFMPEG_VERSION}/dist/ffmpeg-core.worker.js`,
    filename: 'ffmpeg-core.worker.js'
  }
];

const PUBLIC_FFMPEG_PATH = path.join(__dirname, '../public/ffmpeg');

// Create the ffmpeg directory if it doesn't exist
if (!fs.existsSync(PUBLIC_FFMPEG_PATH)) {
  fs.mkdirSync(PUBLIC_FFMPEG_PATH, { recursive: true });
}

// Download function with retry logic
async function downloadFile(url, outputPath, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        console.log(`Downloading ${url}... (attempt ${attempt}/${retries})`);
        
        const file = fs.createWriteStream(outputPath);
        https.get(url, response => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download: ${response.statusCode}`));
            return;
          }

          response.pipe(file);
          
          file.on('finish', () => {
            file.close();
            console.log(`Downloaded ${outputPath}`);
            resolve();
          });
        }).on('error', err => {
          fs.unlink(outputPath, () => {});
          reject(err);
        });
      });
      
      return; // Success, exit the retry loop
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      if (attempt === retries) {
        throw error; // Throw on final attempt
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Download all files
async function downloadAll() {
  try {
    for (const file of FILES_TO_DOWNLOAD) {
      const outputPath = path.join(PUBLIC_FFMPEG_PATH, file.filename);
      await downloadFile(file.url, outputPath);
    }
    console.log('All FFmpeg core files downloaded successfully!');
  } catch (error) {
    console.error('Error downloading FFmpeg core files:', error);
    process.exit(1);
  }
}

downloadAll(); 