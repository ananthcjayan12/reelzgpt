#!/usr/bin/env node

/**
 * This script helps debug deployment issues by logging environment variables
 * and server configuration.
 * 
 * Run with: node scripts/debug-deployment.js
 */

console.log('=== DEPLOYMENT DEBUG INFO ===');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV);
console.log('Hostname:', process.env.HOSTNAME);
console.log('Port:', process.env.PORT);

// Log all environment variables (excluding sensitive ones)
console.log('\n=== ENVIRONMENT VARIABLES ===');
Object.keys(process.env)
  .filter(key => !key.includes('KEY') && !key.includes('SECRET') && !key.includes('TOKEN') && !key.includes('PASSWORD'))
  .sort()
  .forEach(key => {
    console.log(`${key}=${process.env[key]}`);
  });

// Check file system access
console.log('\n=== FILE SYSTEM ACCESS ===');
const fs = require('fs');
try {
  const files = fs.readdirSync('.');
  console.log('Current directory files:', files.slice(0, 10).join(', ') + (files.length > 10 ? '...' : ''));
  
  if (fs.existsSync('.next')) {
    const nextFiles = fs.readdirSync('.next');
    console.log('.next directory files:', nextFiles.slice(0, 10).join(', ') + (nextFiles.length > 10 ? '...' : ''));
  } else {
    console.log('.next directory not found');
  }
} catch (error) {
  console.error('Error accessing file system:', error.message);
}

// Check network access
console.log('\n=== NETWORK ACCESS ===');
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Debug server is running');
});

try {
  server.listen(0, () => {
    const port = server.address().port;
    console.log(`Debug server listening on random port: ${port}`);
    server.close();
  });
} catch (error) {
  console.error('Error creating test server:', error.message);
}

console.log('\n=== END DEBUG INFO ==='); 