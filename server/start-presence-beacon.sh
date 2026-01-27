#!/bin/bash

echo "Starting XitChat Presence Beacon Server..."
echo "This server enables mobile-safe peer discovery"
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the presence beacon server
echo "Starting server on port 8444..."
npm run dev

echo ""
echo "🗼 Presence Beacon Server is running!"
echo "🗼 HTTP API: http://localhost:8444/api/presence"
echo "🗼 WebSocket: ws://localhost:8444"
echo ""
echo "Press Ctrl+C to stop the server"
