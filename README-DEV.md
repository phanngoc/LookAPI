# Running Tauri App in Development Mode on Ubuntu 22

## Prerequisites

1. **Install System Dependencies**

   Tauri requires GTK and WebKit dependencies on Linux. Run:

   ```bash
   ./install-deps-ubuntu.sh
   ```

   Or manually install:

   ```bash
   sudo apt-get update
   sudo apt-get install -y \
       libwebkit2gtk-4.1-dev \
       build-essential \
       curl \
       wfile \
       libssl-dev \
       libgtk-3-dev \
       libayatana-appindicator3-dev \
       librsvg2-dev \
       libgdk-pixbuf2.0-dev \
       libpango1.0-dev \
       libcairo2-dev \
       libatk1.0-dev
   ```

2. **Install Node.js Dependencies**

   ```bash
   npm install
   ```

3. **Increase File Watch Limit (Optional but Recommended)**

   If you encounter "OS file watch limit reached" error:

   ```bash
   sudo sysctl -w fs.inotify.max_user_watches=524288
   ```

   To make it permanent, add to `/etc/sysctl.conf`:

   ```
   fs.inotify.max_user_watches=524288
   ```

## Running Development Server

### Option 1: Using npm script

```bash
npm run tauri dev
```

### Option 2: Using helper script

```bash
./run-dev.sh
```

## What Happens When You Run `npm run tauri dev`

1. **Vite Dev Server** starts on `http://localhost:1420`
2. **Rust Compilation** begins (first time may take a few minutes)
3. **Tauri App Window** opens automatically when compilation completes

## Troubleshooting

### Error: "OS file watch limit reached"

Increase the file watch limit as described above.

### Error: "system library `gdk-pixbuf-2.0` required by crate `gdk-pixbuf-sys` was not found"

Install system dependencies using `./install-deps-ubuntu.sh`

### Error: "cargo run could not determine which binary to run"

This should be fixed by setting `default-run = "tauri-app"` in `Cargo.toml`.

### Vite server runs but app window doesn't open

Check the terminal output for Rust compilation errors. The app window only opens after successful compilation.

## Development Workflow

- **Frontend changes**: Hot reloaded automatically by Vite
- **Rust/Backend changes**: Requires recompilation (automatic on file save)
- **Stop the server**: Press `Ctrl+C` in the terminal

