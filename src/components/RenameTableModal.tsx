import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface RenameTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
  currentName: string;
}

export function RenameTableModal({ isOpen, onClose, onRename, currentName }: RenameTableModalProps) {
  const [newName, setNewName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
    }
  }, [isOpen, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || newName === currentName) return;

    setSaving(true);
    await onRename(newName);
    setSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[400px] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold text-lg">Rename Table</h3>
          <button onClick={onClose} className="hover:bg-gray-100 p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">New Table Name</label>
            <input 
              type="text" 
              className="border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded text-sm"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={saving || !newName || newName === currentName}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded text-sm flex items-center gap-1 disabled:opacity-50"
            >
              <Save size={14} /> {saving ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
