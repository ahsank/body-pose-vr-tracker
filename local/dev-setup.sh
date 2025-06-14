#!/bin/bash
# dev-setup.sh

echo "🚀 Setting up local WebSocket development environment..."

# 1. Install dependencies
npm install

# 2. Start server in background
npm run dev &
SERVER_PID=$!

# 3. Wait for server to start
sleep 2

# 4. Create ngrok tunnel
ngrok http 8080 &
NGROK_PID=$!

# 5. Generate QR code for mobile
sleep 3
curl http://localhost:8080/qr

echo "✅ Development environment ready!"
echo "📱 Scan QR code to connect mobile device"
echo "🥽 VR headset can connect to ngrok URL"

# Cleanup on exit
trap "kill $SERVER_PID $NGROK_PID" EXIT
wait
