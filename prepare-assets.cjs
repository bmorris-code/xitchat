const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function prepareAssets() {
    const assetsDir = 'assets';
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir);
    }

    const iconSource = 'public/icon-512.png';
    const splashSource = 'public/splash.svg';

    console.log('Preparing assets...');

    // Icon
    await sharp(iconSource)
        .resize(1024, 1024)
        .toFile(path.join(assetsDir, 'icon-only.png'));

    await sharp(iconSource)
        .resize(1024, 1024)
        .toFile(path.join(assetsDir, 'icon-foreground.png'));

    // Background (solid black for XitChat)
    await sharp({
        create: {
            width: 1024,
            height: 1024,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 }
        }
    })
        .png()
        .toFile(path.join(assetsDir, 'icon-background.png'));

    // Splash Screen
    // SVG to PNG (2732x2732 is standard for Capacitor Assets)
    await sharp(splashSource)
        .resize(2732, 2732, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 1 }
        })
        .toFile(path.join(assetsDir, 'splash.png'));

    await sharp(splashSource)
        .resize(2732, 2732, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 1 }
        })
        .toFile(path.join(assetsDir, 'splash-dark.png'));

    console.log('✅ Assets prepared in /assets folder');
}

prepareAssets().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
