// Simple WebSocket server for testing H60 connection
const WebSocket = require('ws');

const PORT = 8443;
const wss = new WebSocket.Server({ port: PORT });

console.log(`🚀 WebSocket server started on port ${PORT}`);
console.log(`📱 H60 should connect to: ws://192.168.18.3:${PORT}`);

wss.on('connection', (ws) => {
    console.log('✅ New connection established');
    
    ws.on('message', (message) => {
        console.log(`📨 Received: ${message}`);
        
        // Echo message back
        ws.send(JSON.stringify({
            type: 'echo',
            original: message.toString(),
            timestamp: Date.now(),
            server: 'XitChat WebSocket Test Server'
        }));
    });
    
    ws.on('close', () => {
        console.log('❌ Connection closed');
    });
    
    ws.on('error', (error) => {
        console.log(`❌ WebSocket error: ${error.message}`);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to XitChat WebSocket Test Server',
        timestamp: Date.now()
    }));
});

wss.on('error', (error) => {
    console.log(`❌ Server error: ${error.message}`);
});

console.log(`🔗 Waiting for H60 connections...`);
