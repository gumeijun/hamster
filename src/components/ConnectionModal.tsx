import React, { useState } from 'react';
import { ConnectionConfig } from '../types';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ConnectionConfig) => void;
  initialConfig?: ConnectionConfig;
}

export function ConnectionModal({ isOpen, onClose, onSave, initialConfig }: ConnectionModalProps) {
  const [formData, setFormData] = useState<ConnectionConfig>(
    initialConfig || {
      id: crypto.randomUUID(),
      name: 'New Connection',
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: '',
    }
  );

  // Reset form when initialConfig changes (e.g. switching from Add to Edit)
  // Or just rely on component re-mounting if key changes. 
  // Better: use useEffect to sync if isOpen changes to true?
  // Let's assume parent manages key or unmounts.
  // Actually, if we reuse the modal component, we need to update state when initialConfig changes.
  
  React.useEffect(() => {
    if (isOpen) {
        setFormData(initialConfig || {
            id: crypto.randomUUID(),
            name: 'New Connection',
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: '',
            database: '',
        });
        setStatus('');
    }
  }, [isOpen, initialConfig]);

  const [status, setStatus] = useState<string>('');

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'port' ? parseInt(value) : value
    }));
  };

  const handleTest = async () => {
    setStatus('Testing...');
    try {
      const res = await window.ipcRenderer.invoke('db:connect', formData);
      if (res.success) {
        setStatus('Connection successful!');
        // Close the test connection immediately
        await window.ipcRenderer.invoke('db:close', res.id);
      } else {
        setStatus('Error: ' + res.error);
      }
    } catch (err: any) {
      setStatus('Error: ' + err.message);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h2 className="text-xl font-bold mb-4">Connection Details</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Connection Name</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Host</label>
              <input
                name="host"
                value={formData.host}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium mb-1">Port</label>
              <input
                name="port"
                type="number"
                value={formData.port}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              name="user"
              value={formData.user}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          
          {status && (
            <div className={`text-sm ${status.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
              {status}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={handleTest}
              className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded"
            >
              Test Connection
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border hover:bg-gray-50 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
