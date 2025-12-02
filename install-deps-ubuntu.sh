#!/bin/bash

# Script to install Tauri dependencies on Ubuntu 22.04

echo "=========================================="
echo "Installing Tauri Dependencies for Ubuntu"
echo "=========================================="
echo ""

echo "Installing system dependencies..."
echo "You may be prompted for your password."
echo ""

# Install required packages for Tauri on Ubuntu
sudo apt-get update
sudo apt-get install -y \
    libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libgdk-pixbuf2.0-dev \
    libpango1.0-dev \
    libcairo2-dev \
    libatk1.0-dev

echo ""
echo "✅ Dependencies installed successfully!"
echo ""
echo "You can now run: npm run tauri dev"

