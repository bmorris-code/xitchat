#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  watchDir: './dist',
  androidDir: './android',
  debounceTime: 3000, // Wait 3 seconds after changes before building
  maxRetries: 3
};

let buildTimeout = null;
let isBuilding = false;
let lastBuildHash = null;

// Calculate hash of dist directory
function getDistHash() {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5');
  
  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else {
        const content = fs.readFileSync(filePath);
        hash.update(content);
      }
    }
  }
  
  if (fs.existsSync(CONFIG.watchDir)) {
    walkDir(CONFIG.watchDir);
  }
  
  return hash.digest('hex');
}

// Log with timestamp
function log(message, type = 'INFO') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [AUTO-APK] ${type}: ${message}`);
}

// Build and install APK with retry logic
async function buildAndInstallAPK(retryCount = 0) {
  if (isBuilding) {
    log('Build already in progress, skipping...', 'WARN');
    return;
  }
  
  isBuilding = true;
  
  try {
    log('Starting APK build and install...');
    
    // Step 1: Sync Android
    log('Syncing Android project...');
    execSync('npm run sync:android', { stdio: 'inherit', cwd: process.cwd() });
    
    // Step 2: Install APK
    log('Installing APK on device...');
    execSync('./gradlew installDebug', { stdio: 'inherit', cwd: path.resolve(CONFIG.androidDir) });
    
    // Step 3: Restart app
    log('Restarting app on device...');
    try {
      execSync('adb shell am force-stop com.xitchat.app', { stdio: 'pipe' });
      execSync('adb shell am start -n com.xitchat.app/.MainActivity', { stdio: 'pipe' });
    } catch (error) {
      log('App restart failed, but installation succeeded', 'WARN');
    }
    
    log('✅ APK update completed successfully!', 'SUCCESS');
    
  } catch (error) {
    log(`Build failed: ${error.message}`, 'ERROR');
    
    if (retryCount < CONFIG.maxRetries) {
      log(`Retrying... (${retryCount + 1}/${CONFIG.maxRetries})`, 'WARN');
      await new Promise(resolve => setTimeout(resolve, 5000));
      return buildAndInstallAPK(retryCount + 1);
    } else {
      log('Max retries reached, giving up', 'ERROR');
    }
  } finally {
    isBuilding = false;
  }
}

// Watch for changes
function startWatching() {
  log('Starting automatic APK update watcher...');
  log(`Watching: ${CONFIG.watchDir}`);
  log(`Debounce time: ${CONFIG.debounceTime}ms`);
  
  if (!fs.existsSync(CONFIG.watchDir)) {
    log('Dist directory not found, waiting for initial build...', 'WARN');
  }
  
  // Check for changes every 2 seconds
  setInterval(() => {
    if (!fs.existsSync(CONFIG.watchDir)) return;
    
    const currentHash = getDistHash();
    
    if (currentHash !== lastBuildHash && !isBuilding) {
      // Clear previous timeout
      if (buildTimeout) {
        clearTimeout(buildTimeout);
      }
      
      // Set new timeout for debounced build
      buildTimeout = setTimeout(() => {
        log('📦 Changes detected, building APK...');
        buildAndInstallAPK();
        lastBuildHash = currentHash;
      }, CONFIG.debounceTime);
    }
  }, 2000);
}

// Check if device is connected
function checkDeviceConnection() {
  try {
    const result = execSync('adb devices', { encoding: 'utf8' });
    const lines = result.trim().split('\n');
    const devices = lines.slice(1).filter(line => line.includes('\tdevice'));
    
    if (devices.length === 0) {
      log('❌ No Android device connected', 'ERROR');
      log('Please connect your H60 device via USB with USB debugging enabled');
      return false;
    }
    
    log(`✅ Device connected: ${devices[0].split('\t')[0]}`);
    return true;
  } catch (error) {
    log('❌ ADB not available', 'ERROR');
    log('Please ensure Android SDK and platform-tools are installed');
    return false;
  }
}

// Main execution
async function main() {
  log('🚀 Auto APK Updater Starting...');
  
  // Check prerequisites
  if (!checkDeviceConnection()) {
    process.exit(1);
  }
  
  // Initial hash
  if (fs.existsSync(CONFIG.watchDir)) {
    lastBuildHash = getDistHash();
    log('Initial hash calculated');
  }
  
  // Start watching
  startWatching();
  
  // Handle shutdown
  process.on('SIGINT', () => {
    log('Shutting down...', 'INFO');
    if (buildTimeout) clearTimeout(buildTimeout);
    process.exit(0);
  });
  
  log('✅ Auto APK updater is running', 'SUCCESS');
  log('Press Ctrl+C to stop');
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    log(`Fatal error: ${error.message}`, 'ERROR');
    process.exit(1);
  });
}

module.exports = { buildAndInstallAPK, checkDeviceConnection };
