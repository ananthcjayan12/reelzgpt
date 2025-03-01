const fs = require('fs');
const path = require('path');
const https = require('https');

// Create directories if they don't exist
const publicDir = path.join(process.cwd(), 'public');
const ffmpegDir = path.join(publicDir, 'ffmpeg');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

if (!fs.existsSync(ffmpegDir)) {
  fs.mkdirSync(ffmpegDir, { recursive: true });
}

// FFmpeg files to download
const files = [
  {
    url: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
    dest: path.join(ffmpegDir, 'ffmpeg-core.js')
  },
  {
    url: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.wasm',
    dest: path.join(ffmpegDir, 'ffmpeg-core.wasm')
  },
  {
    url: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.worker.js',
    dest: path.join(ffmpegDir, 'ffmpeg-core.worker.js')
  }
];

console.log('Downloading FFmpeg files...');

// Download each file
const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${dest}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {}); // Delete the file on error
      console.error(`Error downloading ${url}: ${err.message}`);
      reject(err);
    });
  });
};

// Download all files
Promise.all(files.map(file => downloadFile(file.url, file.dest)))
  .then(() => {
    console.log('All FFmpeg files downloaded successfully!');
  })
  .catch(err => {
    console.error('Error downloading FFmpeg files:', err);
    process.exit(1);
  }); 