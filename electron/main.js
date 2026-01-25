const { app, BrowserWindow, Menu, shell, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, '../resources/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    frame: true,
    autoHideMenuBar: true,
    backgroundColor: '#1a1a2e',
  });

  // Remove menu completely for clean native app look
  Menu.setApplicationMenu(null);

  // Load the application
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: Try multiple paths
    const possiblePaths = [
      path.join(process.resourcesPath, 'dist/index.html'), // Packaged app (priority)
      path.join(__dirname, '../dist/index.html'),          // Standard build
      path.join(__dirname, 'dist/index.html'),             // Electron folder
      path.join(app.getAppPath(), 'dist/index.html'),      // App path
    ];
    
    let distPath = null;
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        distPath = path.dirname(filePath);
        console.log('Found dist at:', distPath);
        break;
      }
    }
    
    if (distPath) {
      // Load index.html with hash routing support
      const indexPath = path.join(distPath, 'index.html');
      console.log('Loading from:', indexPath);
      
      // Use loadURL with file:// protocol for proper routing
      mainWindow.loadURL(url.format({
        pathname: indexPath,
        protocol: 'file:',
        slashes: true,
        hash: '/' // Start at root hash route
      }));
    } else {
      // Fallback to online version if local files not found
      console.log('Local files not found, loading online version');
      mainWindow.loadURL('https://propos.lovable.app');
    }
  }

  // Handle navigation for SPA - redirect all routes to index.html
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Allow external URLs
    if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
      if (!navigationUrl.includes('propos.lovable.app')) {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
      return;
    }
    
    // For file:// protocol, prevent navigation and use hash routing
    if (parsedUrl.protocol === 'file:') {
      // Don't prevent if it's just loading index.html
      if (parsedUrl.pathname.endsWith('index.html')) {
        return;
      }
    }
  });

  // Handle load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
    
    // If it's a file:// navigation error (like 404), redirect to index with hash
    if (errorCode === -6 || errorDescription.includes('ERR_FILE_NOT_FOUND')) {
      // Try loading error page with option to load cloud version
      const errorPath = path.join(__dirname, 'error.html');
      if (fs.existsSync(errorPath)) {
        mainWindow.loadFile(errorPath);
      } else {
        // Fallback to online version
        mainWindow.loadURL('https://propos.lovable.app');
      }
    }
  });

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Register custom protocol handler for SPA
app.whenReady().then(() => {
  // Handle file:// protocol for SPA routing
  protocol.interceptFileProtocol('file', (request, callback) => {
    let filePath = request.url.replace('file:///', '').replace('file://', '');
    
    // Decode URI components
    filePath = decodeURIComponent(filePath);
    
    // On Windows, paths might start with drive letter
    if (process.platform === 'win32' && filePath.startsWith('/')) {
      filePath = filePath.substring(1);
    }
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
      callback({ path: filePath });
    } else {
      // For non-existent paths (SPA routes), serve index.html
      const possiblePaths = [
        path.join(process.resourcesPath, 'dist/index.html'),
        path.join(__dirname, '../dist/index.html'),
        path.join(__dirname, 'dist/index.html'),
      ];
      
      for (const indexPath of possiblePaths) {
        if (fs.existsSync(indexPath)) {
          callback({ path: indexPath });
          return;
        }
      }
      
      // File truly not found
      callback({ error: -6 }); // ERR_FILE_NOT_FOUND
    }
  });
  
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
