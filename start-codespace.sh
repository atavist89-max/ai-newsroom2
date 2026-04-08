#!/bin/bash

echo "🚀 Starting AI Newsroom for GitHub Codespaces..."
echo ""

# Kill existing servers
pkill -f "python -m main" 2>/dev/null
pkill -f "ts-node index.ts" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

mkdir -p logs

echo "→ Starting Python Server..."
cd python_server
python -m main > ../logs/python.log 2>&1 &
echo "  PID: $!"
cd ..

sleep 3

echo "→ Starting Node Proxy..."
cd server
npm start > ../logs/proxy.log 2>&1 &
echo "  PID: $!"
cd ..

sleep 2

echo "→ Starting Vite (with 0.0.0.0 binding)..."
npm run dev -- --host 0.0.0.0 > ../logs/vite.log 2>&1 &
echo "  PID: $!"

echo ""
echo "⏳ Waiting for servers to start..."
sleep 5

echo ""
echo "=== Status ==="
echo "Python:  $(curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health)"
echo "Proxy:   $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001)"
echo "Vite:    $(curl -s -o /dev/null -w '%{http_code}' http://localhost:5173)"

echo ""
echo "🌐 To access the app:"
echo "   1. Open the 'Ports' tab in VS Code (bottom panel)"
echo "   2. Find port 5173, right-click → 'Port Visibility' → 'Public'"
echo "   3. Click the 🌐 icon to open in browser"
echo ""
echo "Press Ctrl+C to stop all servers"

# Keep script running
trap "pkill -f 'python -m main'; pkill -f 'ts-node index.ts'; pkill -f 'vite'; exit" INT
wait
