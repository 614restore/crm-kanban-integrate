#!/bin/bash

# TrussCTR Desktop App Launcher
# Quick script to launch the desktop app from anywhere

echo "🚀 Launching TrussCTR Desktop App..."
echo ""

# Change to project directory
cd ~/Documents/GitHub/crm-kanban-integrate

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "desktop-tauri" ]; then
    echo "⚠️  Warning: Not on desktop-tauri branch. Switching..."
    git checkout desktop-tauri
fi

echo ""
echo "✅ Ready to launch!"
echo "   The desktop app window will open in a moment..."
echo ""
echo "   Press Ctrl+C to stop the app"
echo "   Press Cmd+R in the app to reload"
echo ""

# Launch desktop app
npm run tauri:dev
