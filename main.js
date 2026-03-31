const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// 数据存储在用户数据目录
let dataPath;

function getDataPath() {
  if (!dataPath) {
    const userDataPath = app.getPath('userData');
    dataPath = path.join(userDataPath, 'research-ideas.json');
    console.log('Data path:', dataPath);
  }
  return dataPath;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
}

ipcMain.handle('save-data', async (event, data) => {
  try {
    const currentDataPath = getDataPath();
    await fs.writeFile(currentDataPath, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving data:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-data', async () => {
  try {
    const currentDataPath = getDataPath();
    const data = await fs.readFile(currentDataPath, 'utf8');
    return { success: true, data: JSON.parse(data) };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: true, data: [] };
    }
    console.error('Error loading data:', error);
    return { success: false, error: error.message };
  }
});

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