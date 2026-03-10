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
      preload: undefined,
    },
    show: false,
    frame: true,
    autoHideMenuBar: true,
    backgroundColor: '#1a1a2e',
  });

  // Remove menu completely for clean native app look
  Menu.setApplicationMenu(null);

  // Load the application
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  
  console.log('=== FlowPOS Pro Electron ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('isDev:', isDev);
  console.log('app.getAppPath():', app.getAppPath());
  console.log('process.resourcesPath:', process.resourcesPath);
  console.log('__dirname:', __dirname);
  
  if (isDev) {
    console.log('[DEV MODE] Loading from localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: Try multiple paths with detailed logging
    const possiblePaths = [
      path.join(process.resourcesPath, 'dist/index.html'),     // Packaged app (priority)
      path.join(app.getAppPath(), 'dist/index.html'),           // App installation path
      path.join(__dirname, '../dist/index.html'),               // Standard build relative to electron folder
      path.join(__dirname, 'dist/index.html'),                  // Electron subfolder
      path.join(process.cwd(), 'dist/index.html'),              // Working directory
    ];
    
    console.log('[PROD MODE] Searching for dist folder...');
    let distPath = null;
    
    for (const filePath of possiblePaths) {
      console.log('  Checking:', filePath, '...', fs.existsSync(filePath) ? '✓ FOUND' : '✗ NOT FOUND');
      if (fs.existsSync(filePath)) {
        distPath = path.dirname(filePath);
        console.log('✓ Found dist at:', distPath);
        break;
      }
    }
    
    if (distPath && fs.existsSync(path.join(distPath, 'index.html'))) {
      // Load index.html with hash routing support
      const indexPath = path.join(distPath, 'index.html');
      console.log('✓ Loading from:', indexPath);
      
      // Use loadURL with file:// protocol for proper routing
      const fileUrl = url.format({
        pathname: indexPath,
        protocol: 'file:',
        slashes: true,
        hash: '/' // Start at root hash route
      });
      
      console.log('File URL:', fileUrl);
      mainWindow.loadURL(fileUrl);
    } else {
      // Error: Local files not found
      console.error('✗ Local dist folder not found!');
      console.error('Possible solutions:');
      console.error('  1. Run "npm run build" to build the frontend');
      console.error('  2. Ensure dist folder is in the correct location');
      console.error('  3. Check that the Electron build includes the dist folder');
      
      // Show error page
      const errorPage = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>FlowPOS Pro - Error</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, segoe-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; }
            .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 500px; text-align: center; }
            h1 { color: #e53e3e; margin: 0 0 20px 0; }
            p { color: #4a5568; line-height: 1.6; margin: 10px 0; }
            code { background: #f7fafc; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
            button { background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; margin-top: 20px; }
            button:hover { background: #5568d3; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>⚠️ خطأ في التحميل</h1>
            <p><strong>FlowPOS Pro - Build Error</strong></p>
            <p>لم يتم العثور على ملفات التطبيق المترجمة.</p>
            <p>The application build files were not found.</p>
            <p style="background: #f7fafc; padding: 12px; border-radius: 6px; margin: 20px 0; font-size: 14px;">
              Missing: <code>dist/index.html</code>
            </p>
            <p style="color: #718096; font-size: 14px;">
              الحل: شغّل <code>npm run build</code> قبل بناء النسخة المسطبة<br>
              Solution: Run <code>npm run build</code> before building the installer
            </p>
            <button onclick="fetch('https://flowpospro.lovable.app').then(() => window.location.href = 'https://flowpospro.lovable.app').catch(() => alert('Could not reach online version'))">التحميل من الإنترنت / Load from Web</button>
          </div>
        </body>
        </html>
      `;
      
      mainWindow.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorPage)}`);
    }
  }

  // Handle navigation for SPA - redirect all routes to index.html
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Allow external URLs
    if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
      if (!navigationUrl.includes('flowpospro.lovable.app')) {
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

  // Handle load errors with detailed feedback
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('❌ Failed to load:', errorCode, errorDescription, validatedURL);
    
    // Show user-friendly error
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>FlowPOS Pro - Loading Error</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, segoe-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; }
          .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 500px; text-align: center; }
          h1 { color: #e53e3e; }
          p { color: #4a5568; }
          .error-code { background: #f7fafc; padding: 10px; border-radius: 6px; font-family: monospace; color: #c53030; margin: 15px 0; }
          button { background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin: 10px 5px; }
          button:hover { background: #5568d3; }
          .small { font-size: 12px; color: #718096; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ خطأ في التحميل</h1>
          <p><strong>Error Loading Application</strong></p>
          <div class="error-code">Error ${errorCode}: ${errorDescription}</div>
          <p class="small">الرجاء التأكد من أن النسخة تم بناؤها بشكل صحيح</p>
          <p>
            <button onclick="location.reload()">إعادة محاولة / Retry</button>
            <button onclick="fetch('https://flowpospro.lovable.app').then(() => window.location.href = 'https://flowpospro.lovable.app')">الإنترنت / Web</button>
          </p>
        </div>
      </body>
      </html>
    `;
    
    mainWindow.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
  });

  // Handle crashed renderer
  mainWindow.webContents.on('crashed', () => {
    console.error('❌ Renderer process crashed!');
    // Optionally restart
    mainWindow.webContents.reloadIgnoringCache();
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
