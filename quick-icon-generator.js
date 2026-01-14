const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Quick icon generator for XitChat
async function generateQuickIcons() {
  const inputFile = 'public/icon.svg';
  
  if (!fs.existsSync(inputFile)) {
    console.error('icon.svg not found in public folder');
    return;
  }

  // Create output directories
  const dirs = ['icons/ios', 'icons/android', 'icons/store'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Store icons (most critical)
  const storeIcons = [
    { size: 1024, name: 'icons/store/app-store-icon.png' },
    { size: 512, name: 'icons/store/play-store-icon.png' }
  ];

  // iOS icons (essential)
  const iosIcons = [
    { size: 120, name: 'icons/ios/Icon-App-60x60@2x.png' },
    { size: 180, name: 'icons/ios/Icon-App-60x60@3x.png' },
    { size: 152, name: 'icons/ios/Icon-App-76x76@2x.png' }
  ];

  // Android icons (essential)
  const androidIcons = [
    { size: 192, name: 'icons/android/ic_launcher.png' },
    { size: 512, name: 'icons/android/ic_launcher_foreground.png' }
  ];

  try {
    // Generate store icons
    for (const { size, name } of storeIcons) {
      await sharp(inputFile)
        .resize(size, size)
        .png({ quality: 95 })
        .toFile(name);
      console.log(`✅ Generated ${name} (${size}x${size})`);
    }

    // Generate iOS icons
    for (const { size, name } of iosIcons) {
      await sharp(inputFile)
        .resize(size, size)
        .png({ quality: 90 })
        .toFile(name);
      console.log(`✅ Generated ${name} (${size}x${size})`);
    }

    // Generate Android icons
    for (const { size, name } of androidIcons) {
      await sharp(inputFile)
        .resize(size, size)
        .png({ quality: 90 })
        .toFile(name);
      console.log(`✅ Generated ${name} (${size}x${size})`);
    }

    console.log('\n🎉 All essential icons generated successfully!');
    console.log('📱 Store icons ready for App Store and Play Store submission');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error);
  }
}

generateQuickIcons();
