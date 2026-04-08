#!/bin/bash

# AI Newsroom - Stop All Servers Script

echo "→ Stopping AI Newsroom servers..."

# Try to kill by PID file first
if [ -f .server_pids ]; then
    PIDS=$(cat .server_pids)
    for PID in $PIDS; do
        kill $PID 2>/dev/null
    done
    rm -f .server_pids
fi

# Also kill by process name as fallback
pkill -f "python -m main" 2>/dev/null
pkill -f "npm start" 2>/dev/null
pkill -f "vite" 2>/dev/null

echo "✓ All servers stopped"
