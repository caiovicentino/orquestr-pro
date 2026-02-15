import { contextBridge, ipcRenderer } from "electron"

const api = {
  gateway: {
    start: () => ipcRenderer.invoke("gateway:start"),
    stop: () => ipcRenderer.invoke("gateway:stop"),
    restart: () => ipcRenderer.invoke("gateway:restart"),
    status: () => ipcRenderer.invoke("gateway:status"),
    port: () => ipcRenderer.invoke("gateway:port"),
    token: () => ipcRenderer.invoke("gateway:token"),
    wsUrl: () => ipcRenderer.invoke("gateway:ws-url"),
  },
  config: {
    get: () => ipcRenderer.invoke("config:get"),
    set: (config: Record<string, unknown>) => ipcRenderer.invoke("config:set", config),
    patch: (patch: Record<string, unknown>) => ipcRenderer.invoke("config:patch", patch),
    patchModel: (modelId: string) => ipcRenderer.invoke("config:patch-model", modelId),
    path: () => ipcRenderer.invoke("config:path"),
    stateDir: () => ipcRenderer.invoke("config:state-dir"),
  },
  app: {
    version: () => ipcRenderer.invoke("app:version"),
    platform: () => ipcRenderer.invoke("app:platform"),
    arch: () => ipcRenderer.invoke("app:arch"),
    nodeVersion: () => ipcRenderer.invoke("app:node-version"),
  },
  cuts: {
    scan: (dirs: string[]) => ipcRenderer.invoke("cuts:scan", dirs),
    open: (filePath: string) => ipcRenderer.invoke("cuts:open", filePath),
    showInFolder: (filePath: string) => ipcRenderer.invoke("cuts:show-in-folder", filePath),
  },
  fetch: {
    json: (url: string) => ipcRenderer.invoke("fetch:json", url),
    post: (url: string, body: unknown) => ipcRenderer.invoke("fetch:post", url, body),
  },
  privy: {
    getConfig: () => ipcRenderer.invoke("privy:get-config"),
    setConfig: (appId: string, appSecret: string) => ipcRenderer.invoke("privy:set-config", appId, appSecret),
  },
  credentials: {
    get: () => ipcRenderer.invoke("credentials:get"),
    set: (envVar: string, value: string) => ipcRenderer.invoke("credentials:set", envVar, value),
    delete: (envVar: string) => ipcRenderer.invoke("credentials:delete", envVar),
    listProviders: () => ipcRenderer.invoke("credentials:list-providers"),
  },
  navigation: {
    onNavigate: (callback: (path: string) => void) => {
      ipcRenderer.on("navigate", (_, path) => callback(path))
    },
  },
}

contextBridge.exposeInMainWorld("api", api)
