const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

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
    autoHideMenuBar: true, // Hide menu bar by default
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
      path.join(__dirname, '../dist/index.html'),      // Standard build
      path.join(__dirname, 'dist/index.html'),          // Electron folder
      path.join(process.resourcesPath, 'dist/index.html'), // Packaged app
      path.join(app.getAppPath(), 'dist/index.html'),   // App path
    ];
    
    let loaded = false;
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        console.log('Loading from:', filePath);
        mainWindow.loadFile(filePath);
        loaded = true;
        break;
      }
    }
    
    // Fallback to online version if local files not found
    if (!loaded) {
      console.log('Local files not found, loading online version');
      mainWindow.loadURL('https://propos.lovable.app');
    }
  }

  // Handle load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
    
    // Try loading error page
    const errorPath = path.join(__dirname, 'error.html');
    if (fs.existsSync(errorPath)) {
      mainWindow.loadFile(errorPath);
    } else {
      // Fallback to online version
      mainWindow.loadURL('https://propos.lovable.app');
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

app.whenReady().then(createWindow);

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

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.protocol !== 'file:' && parsedUrl.protocol !== 'https:') {
      event.preventDefault();
    }
  });
});
