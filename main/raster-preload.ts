export {};
const { contextBridge, ipcRenderer } = require('electron');
let readySent = false;

/** The raster surface exposes only request delivery and result submission. */
const rasterApi = {
  onRequest: (callback: (request: unknown) => void) => {
    const handler = (_event: unknown, request: unknown) => callback(request);
    ipcRenderer.on('oiu:raster-request', handler);
    ipcRenderer.on('flo:raster-request', handler);
    if (!readySent) {
      readySent = true;
      ipcRenderer.send('oiu:raster-ready');
      ipcRenderer.send('flo:raster-ready');
    }
    return () => {
      ipcRenderer.removeListener('oiu:raster-request', handler);
      ipcRenderer.removeListener('flo:raster-request', handler);
    };
  },
  sendResult: (result: unknown) => {
    ipcRenderer.send('oiu:raster-result', result);
    ipcRenderer.send('flo:raster-result', result);
  },
};

contextBridge.exposeInMainWorld('__oiuRaster', rasterApi);
contextBridge.exposeInMainWorld('__floRaster', rasterApi);
