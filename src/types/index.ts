export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  database?: string;
}

export interface DBResult {
  success: boolean;
  id?: string;
  results?: any;
  error?: string;
}

declare global {
  interface Window {
    ipcRenderer: {
      invoke(channel: string, ...args: any[]): Promise<any>;
      send(channel: string, ...args: any[]): void;
      on(channel: string, func: (...args: any[]) => void): () => void;
      off(channel: string, func: (...args: any[]) => void): void;
    };
  }
}
