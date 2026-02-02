/**
 * Create Database Modal Component
 * 
 * Modal dialog for creating a new database.
 * Features:
 * - Database name input
 * - Character set selection (fetched from server)
 * - Collation selection (filtered by charset)
 * - Creates database with specified options
 */

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface CreateDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  onSuccess: () => void;
}

export function CreateDatabaseModal({ isOpen, onClose, connectionId, onSuccess }: CreateDatabaseModalProps) {
  const [dbName, setDbName] = useState('');
  const [charset, setCharset] = useState('utf8mb4');
  const [collation, setCollation] = useState('utf8mb4_general_ci');
  const [availableCharsets, setAvailableCharsets] = useState<any[]>([]);
  const [availableCollations, setAvailableCollations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDbName('');
      fetchOptions();
    }
  }, [isOpen]);

  const fetchOptions = async () => {
    setLoading(true);
    try {
      // Fetch options
      const charsetsRes = await window.ipcRenderer.invoke('db:get-charsets', connectionId);
      if (charsetsRes.success) {
        setAvailableCharsets(charsetsRes.results);
      }

      const collationsRes = await window.ipcRenderer.invoke('db:get-collations', connectionId);
      if (collationsRes.success) {
        setAvailableCollations(collationsRes.results);
      }
    } catch (err) {
      console.error("Failed to fetch db options", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!dbName.trim()) {
      alert("Database name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await window.ipcRenderer.invoke('db:create-database', connectionId, dbName, charset, collation);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        alert("Failed to create database: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const filteredCollations = availableCollations.filter(c => c.Charset === charset);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[500px] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold text-lg">Create New Database</h3>
          <button onClick={onClose} className="hover:bg-gray-100 p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {loading ? (
            <div className="text-gray-500">Loading options...</div>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Database Name</label>
                <input 
                  type="text"
                  className="border rounded p-2 text-sm"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  placeholder="Enter database name"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Character Set</label>
                <select 
                  className="border rounded p-2 text-sm"
                  value={charset}
                  onChange={(e) => {
                    setCharset(e.target.value);
                    // Reset collation when charset changes to default of that charset
                    const defaultCol = availableCollations.find(c => c.Charset === e.target.value && c.Default === 'Yes');
                    if (defaultCol) setCollation(defaultCol.Collation);
                  }}
                >
                  {availableCharsets.map(c => (
                    <option key={c.Charset} value={c.Charset}>
                      {c.Charset} - {c.Description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Collation</label>
                <select 
                  className="border rounded p-2 text-sm"
                  value={collation}
                  onChange={(e) => setCollation(e.target.value)}
                >
                  {filteredCollations.map(c => (
                    <option key={c.Collation} value={c.Collation}>
                      {c.Collation}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-lg">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={loading || saving}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded text-sm flex items-center gap-1 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
