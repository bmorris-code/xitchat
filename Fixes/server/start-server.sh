#!/bin/bash
# Start XitChat Signaling Server for Android Testing

echo "🔗 Starting XitChat Signaling Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi

# Navigate to server directory
cd "$(dirname "$0")"

# Start the signaling server
echo "📡 Starting server on port 8443..."
node signaling-server.js

echo "✅ Signaling server stopped"
