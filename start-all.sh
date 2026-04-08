#!/bin/bash

# AI Newsroom - Start All Servers Script
# This script starts all three required servers in the background

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           AI Newsroom Podcast Producer                       ║"
echo "║                Starting All Servers...                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Kill any existing servers first
echo "→ Stopping any existing servers..."
pkill -f "python -m main" 2>/dev/null
pkill -f "npm start" 2>/dev/null  
pkill -f "vite" 2>/dev/null
sleep 2

# Create log directory
mkdir -p logs

echo ""
echo "→ Starting Python Server (Port 8000)..."
cd python_server
python -m main > ../logs/python_server.log 2>&1 &
PYTHON_PID=$!
echo "  ✓ Python Server started (PID: $PYTHON_PID)"
echo "    API: http://localhost:8000"
echo "    Docs: http://localhost:8000/docs"
cd ..

sleep 2

echo ""
echo "→ Starting Node Proxy (Port 3001)..."
cd server
npm start > ../logs/node_proxy.log 2>&1 &
NODE_PID=$!
echo "  ✓ Node Proxy started (PID: $NODE_PID)"
echo "    Proxy: http://localhost:3001"
cd ..

sleep 2

echo ""
echo "→ Starting Vite Dev Server (Port 5173)..."
npm run dev > logs/vite.log 2>&1 &
VITE_PID=$!
echo "  ✓ Vite Dev Server started (PID: $VITE_PID)"
echo "    App: http://localhost:5173"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    🎉 All Servers Running!                   ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                              ║"
echo "║  Open your browser: http://localhost:5173                    ║"
echo "║                                                              ║"
echo "║  View Logs:                                                  ║"
echo "║    tail -f logs/python_server.log   (Python Server)          ║"
echo "║    tail -f logs/node_proxy.log      (Node Proxy)             ║"
echo "║    tail -f logs/vite.log            (Vite Dev)               ║"
echo "║                                                              ║"
echo "║  Stop Servers: Press Ctrl+C                                  ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Save PIDs to file for external stop script
echo "$PYTHON_PID $NODE_PID $VITE_PID" > .server_pids

# Handle Ctrl+C to stop all servers
cleanup() {
    echo ""
    echo "→ Stopping all servers..."
    kill $PYTHON_PID 2>/dev/null
    kill $NODE_PID 2>/dev/null
    kill $VITE_PID 2>/dev/null
    sleep 1
    rm -f .server_pids
    echo "✓ All servers stopped"
    exit 0
}

trap cleanup INT

# Keep script running
wait
