import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ConnectionConfig } from '../types';

interface ConnectionState {
  savedConnections: ConnectionConfig[];
  activeConnectionId: string | null; // The ID returned by backend
  activeConnectionConfigId: string | null; // The ID of the saved config
  
  addConnection: (config: ConnectionConfig) => void;
  removeConnection: (id: string) => void;
  updateConnection: (id: string, config: ConnectionConfig) => void;
  setActiveConnection: (id: string | null, configId: string | null) => void;
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set) => ({
      savedConnections: [],
      activeConnectionId: null,
      activeConnectionConfigId: null,

      addConnection: (config) =>
        set((state) => ({
          savedConnections: [...state.savedConnections, config],
        })),

      removeConnection: (id) =>
        set((state) => ({
          savedConnections: state.savedConnections.filter((c) => c.id !== id),
        })),

      updateConnection: (id, config) =>
        set((state) => ({
          savedConnections: state.savedConnections.map((c) =>
            c.id === id ? config : c
          ),
        })),

      setActiveConnection: (id, configId) =>
        set({ activeConnectionId: id, activeConnectionConfigId: configId }),
    }),
    {
      name: 'connection-storage',
      partialize: (state) => ({ savedConnections: state.savedConnections }),
    }
  )
);
