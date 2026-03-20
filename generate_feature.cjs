const sharp = require('sharp');

const svg = `
<svg width="800" height="400">
  <text x="50%" y="45%" font-family="Arial, sans-serif" font-weight="bold" font-size="90" fill="white" text-anchor="middle" dominant-baseline="middle">XitChat</text>
  <text x="50%" y="70%" font-family="Arial, sans-serif" font-size="40" fill="#94a3b8" text-anchor="middle" dominant-baseline="middle">Decentralized Mesh Messaging</text>
  <text x="50%" y="85%" font-family="Arial, sans-serif" font-size="30" fill="#38bdf8" text-anchor="middle" dominant-baseline="middle">Works Offline • No Servers • Total Privacy</text>
</svg>
`;

sharp({
    create: {
        width: 1024,
        height: 500,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 } // slate-900 background
    }
})
.composite([{
    input: Buffer.from(svg),
    gravity: 'center'
}])
.png()
.toFile('play_store_feature_graphic.png')
.then(() => console.log('Feature graphic created!'))
.catch(e => console.error(e));
