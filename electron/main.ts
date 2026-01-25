/**
 * Electron Main Process
 * 
 * The main entry point for the Electron application.
 * Responsibilities:
 * - Create and manage the browser window
 * - Handle IPC communication between renderer and main processes
 * - Register all database operation handlers (connect, query, CRUD operations)
 * - Manage file dialogs for import/export operations
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from './db';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null;
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC || '', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    width: 1200,
    height: 800,
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST || '', 'index.html'));
  }
}

// IPC Handlers
ipcMain.handle('db:connect', async (_, config) => {
  try {
    const id = await db.connect(config);
    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:query', async (_, id, sql, params, database) => {
  try {
    const { results } = await db.query(id, sql, params, database);
    return { success: true, results };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:list-databases', async (_, id) => {
  try {
    const databases = await db.listDatabases(id);
    return { success: true, results: databases };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:list-tables', async (_, id, database) => {
  try {
    const tables = await db.listTables(id, database);
    return { success: true, results: tables };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:get-table-extended-info', async (_, id, database, table) => {
  try {
    const info = await db.getTableExtendedInfo(id, database, table);
    return { success: true, results: info };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:get-table-structure', async (_, id, database, table) => {
  try {
    const columns = await db.getTableStructure(id, database, table);
    return { success: true, results: columns };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:get-database-status', async (_, id, database) => {
  try {
    const status = await db.getDatabaseStatus(id, database);
    return { success: true, results: status };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:get-table-data', async (_, id, database, table, limit, offset, filters) => {
  try {
    const { results, total } = await db.getTableData(id, database, table, limit, offset, filters);
    return { success: true, results, total };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:import-sql', async (_, id, database) => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'SQL Files', extensions: ['sql'] }]
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, error: 'Cancelled' };
    }

    const content = await fs.readFile(filePaths[0], 'utf-8');
    await db.executeSqlFile(id, database, content);
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:export-database', async (_, id, database, includeData) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Database',
      defaultPath: `${database}.sql`,
      filters: [{ name: 'SQL Files', extensions: ['sql'] }]
    });

    if (canceled || !filePath) {
      return { success: false, error: 'Cancelled' };
    }

    const dump = await db.exportDatabase(id, database, includeData);
    await fs.writeFile(filePath, dump, 'utf-8');
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:update-row', async (_, id, database, table, primaryKey, updates) => {
  try {
    await db.updateRow(id, database, table, primaryKey, updates);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:get-database-info', async (_, id, database) => {
  try {
    const info = await db.getDatabaseInfo(id, database);
    return { success: true, results: info };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:get-charsets', async (_, id) => {
  try {
    const results = await db.getCharsets(id);
    return { success: true, results };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:get-collations', async (_, id) => {
  try {
    const results = await db.getCollations(id);
    return { success: true, results };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:create-database', async (_, id, database, charset, collation) => {
  try {
    await db.createDatabase(id, database, charset, collation);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:alter-database', async (_, id, database, charset, collation) => {
  try {
    await db.alterDatabase(id, database, charset, collation);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:truncate-table', async (_, id, database, table) => {
  try {
    await db.truncateTable(id, database, table);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:drop-table', async (_, id, database, table) => {
  try {
    await db.dropTable(id, database, table);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:rename-table', async (_, id, database, oldName, newName) => {
  try {
    await db.renameTable(id, database, oldName, newName);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:export-table', async (_, id, database, table) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Table',
      defaultPath: `${table}.sql`,
      filters: [{ name: 'SQL Files', extensions: ['sql'] }]
    });

    if (canceled || !filePath) {
      return { success: false, error: 'Cancelled' };
    }

    const dump = await db.exportTable(id, database, table);
    await fs.writeFile(filePath, dump, 'utf-8');
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:insert-row', async (_, id, database, table, data) => {
  try {
    await db.insertRow(id, database, table, data);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:delete-rows', async (_, id, database, table, primaryKeyCol, keys) => {
  try {
    await db.deleteRows(id, database, table, primaryKeyCol, keys);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:save-table-structure', async (_, id, database, oldTableName, newTableName, columns, indexes, foreignKeys, options, isNew) => {
  try {
    await db.saveTableStructure(id, database, oldTableName, newTableName, columns, indexes, foreignKeys, options, isNew);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:close', async (_, id) => {
  try {
    await db.close(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Views handlers
ipcMain.handle('db:list-views', async (_, id, database) => {
  try {
    const views = await db.listViews(id, database);
    return { success: true, results: views };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:get-view-definition', async (_, id, database, viewName) => {
  try {
    const definition = await db.getViewDefinition(id, database, viewName);
    return { success: true, results: definition };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:drop-view', async (_, id, database, viewName) => {
  try {
    await db.dropView(id, database, viewName);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:create-view', async (_, id, database, viewName, selectStatement) => {
  try {
    await db.createView(id, database, viewName, selectStatement);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Table columns handler (for foreign key column selection)
ipcMain.handle('db:get-table-columns', async (_, id, database, table) => {
  try {
    const columns = await db.getTableColumns(id, database, table);
    return { success: true, results: columns };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Triggers handlers
ipcMain.handle('db:get-triggers', async (_, id, database, table) => {
  try {
    const triggers = await db.getTriggers(id, database, table);
    return { success: true, results: triggers };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:create-trigger', async (_, id, database, triggerSql) => {
  try {
    await db.createTrigger(id, database, triggerSql);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:drop-trigger', async (_, id, database, triggerName) => {
  try {
    await db.dropTrigger(id, database, triggerName);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Foreign keys with rules handler
ipcMain.handle('db:get-foreign-keys-with-rules', async (_, id, database, table) => {
  try {
    const fks = await db.getForeignKeysWithRules(id, database, table);
    return { success: true, results: fks };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);
