#!/bin/bash

# TrussCTR - Quick Start Guide
# Run this to start the dev server from anywhere

echo "🚀 TrussCTR - Starting Development Server"
echo "=========================================="
echo ""

# Navigate to project directory
PROJECT_DIR="/Users/jeffreynewell/Documents/GitHub/crm-kanban-integrate"

if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Project directory not found: $PROJECT_DIR"
    exit 1
fi

echo "📁 Navigating to project directory..."
cd "$PROJECT_DIR" || exit 1
echo "   ✅ Current directory: $(pwd)"
echo ""

# Kill any existing Vite processes
echo "🛑 Stopping any existing dev servers..."
pkill -f "vite" 2>/dev/null
sleep 2
echo "   ✅ Cleared"
echo ""

# Verify files
echo "🔍 Verifying setup..."
if [ -f "public/logo.png" ]; then
    echo "   ✅ Logo file found"
else
    echo "   ❌ Logo file missing"
fi

if [ -f "package.json" ]; then
    echo "   ✅ package.json found"
else
    echo "   ❌ package.json missing"
fi
echo ""

# Start dev server
echo "🚀 Starting dev server..."
echo "=========================================="
echo ""
echo "📌 IMPORTANT: After server starts, do a HARD REFRESH:"
echo "   • Mac: Cmd + Shift + R"
echo "   • Windows: Ctrl + Shift + R"
echo ""
echo "🌐 Server will be available at:"
echo "   http://localhost:8081 (or 8080)"
echo ""
echo "=========================================="
echo ""

npm run dev
