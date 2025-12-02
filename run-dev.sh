#!/bin/bash

# Script to run Tauri app in development mode on Ubuntu

echo "=========================================="
echo "Starting Tauri Development Server"
echo "=========================================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

# Check file watch limit
WATCH_LIMIT=$(cat /proc/sys/fs/inotify/max_user_watches)
echo "Current file watch limit: $WATCH_LIMIT"

if [ "$WATCH_LIMIT" -lt 524288 ]; then
    echo ""
    echo "⚠️  Warning: File watch limit is low ($WATCH_LIMIT)"
    echo "   If you encounter 'OS file watch limit reached' error, run:"
    echo "   sudo sysctl -w fs.inotify.max_user_watches=524288"
    echo "   Or add to /etc/sysctl.conf: fs.inotify.max_user_watches=524288"
    echo ""
fi

echo ""
echo "Starting Tauri dev server..."
echo "Press Ctrl+C to stop"
echo ""

# Run Tauri dev
npm run tauri dev

