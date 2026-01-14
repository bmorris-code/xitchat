// Generate XitChat Icons - Simple SVG to PNG converter
const fs = require('fs');
const path = require('path');

// SVG template for XitChat icon
const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="512" height="512" fill="#000000"/>
  
  <!-- X Logo -->
  <g transform="translate(256, 256)">
    <!-- Outer glow -->
    <circle cx="0" cy="0" r="120" fill="none" stroke="#00ff41" stroke-width="4" opacity="0.3"/>
    <circle cx="0" cy="0" r="100" fill="none" stroke="#00ff41" stroke-width="2" opacity="0.5"/>
    
    <!-- X shape -->
    <path d="M -60,-60 L 60,60 M 60,-60 L -60,60" 
          stroke="#00ff41" 
          stroke-width="12" 
          stroke-linecap="round"
          filter="url(#glow)"/>
    
    <!-- Center dot -->
    <circle cx="0" cy="0" r="8" fill="#00ff41"/>
    
    <!-- Terminal text -->
    <text x="0" y="180" 
          font-family="monospace" 
          font-size="24" 
          fill="#00ff41" 
          text-anchor="middle"
          opacity="0.8">XitChat</text>
  </g>
  
  <!-- Glow filter -->
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
</svg>`;

// Create SVG file
fs.writeFileSync(path.join(__dirname, 'icon.svg'), svgIcon);

console.log('✅ SVG icon created! Convert to PNG using online tool or Node.js canvas');
console.log('📱 Sizes needed: 72, 96, 128, 144, 152, 192, 384, 512');
console.log('🌐 Visit: https://svgtopng.com/ to convert SVG to PNG sizes');
