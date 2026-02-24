#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Start processes
function startDev() {
  log('🚀 Starting XitChat Development with Auto APK Updates', 'bright');
  log('═'.repeat(60), 'cyan');
  
  // Check if H60 is connected
  try {
    const { execSync } = require('child_process');
    const result = execSync('adb devices', { encoding: 'utf8' });
    const devices = result.trim().split('\n').slice(1).filter(line => line.includes('\tdevice'));
    
    if (devices.length > 0) {
      log(`✅ H60 Device Connected: ${devices[0].split('\t')[0]}`, 'green');
    } else {
      log('❌ No Android device connected', 'red');
      log('   Connect your H60 via USB with USB debugging enabled', 'yellow');
    }
  } catch (error) {
    log('❌ ADB not available - APK auto-update disabled', 'red');
  }
  
  log('═'.repeat(60), 'cyan');
  
  // Start Vite dev server
  log('📦 Starting Vite development server...', 'blue');
  const viteProcess = spawn('npm', ['run', 'dev'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  });
  
  // Handle Vite output
  viteProcess.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(colors.green + '[VITE] ' + colors.reset + output);
  });
  
  viteProcess.stderr.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(colors.red + '[VITE-ERROR] ' + colors.reset + output);
  });
  
  // Wait a bit for Vite to start, then start auto-updater
  setTimeout(() => {
    log('📱 Starting APK auto-updater...', 'magenta');
    const autoUpdateProcess = spawn('node', ['scripts/auto-update-apk.js'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true
    });
    
    // Handle auto-updater output
    autoUpdateProcess.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(colors.cyan + '[AUTO-APK] ' + colors.reset + output);
    });
    
    autoUpdateProcess.stderr.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(colors.red + '[AUTO-APK-ERROR] ' + colors.reset + output);
    });
    
    autoUpdateProcess.on('close', (code) => {
      if (code !== 0) {
        log(`❌ Auto-updater exited with code ${code}`, 'red');
      }
    });
    
    // Handle shutdown
    process.on('SIGINT', () => {
      log('\n🛑 Shutting down...', 'yellow');
      viteProcess.kill('SIGINT');
      autoUpdateProcess.kill('SIGINT');
      process.exit(0);
    });
    
  }, 3000);
  
  log('\n✅ Development environment ready!', 'green');
  log('   • Web app: http://localhost:5173', 'blue');
  log('   • Auto-APK updates: ENABLED', 'cyan');
  log('   • Press Ctrl+C to stop', 'yellow');
  log('═'.repeat(60), 'cyan');
}

// Start the development environment
startDev();
