import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Key, X, ChevronUp, ChevronDown } from 'lucide-react';

interface TableDesignerProps {
  connectionId: string;
  database: string;
  table: string;
  onClose: () => void;
}

interface ColumnDefinition {
  Field: string;
  Type: string;
  Length?: string; // Parsed from Type
  ParsedType?: string; // Parsed type name
  Null: string;
  Key: string;
  Default: string | null;
  Extra: string;
  Comment: string;
  // UI states
  isNew?: boolean;
  isDeleted?: boolean;
  originalField?: string;
  isVirtual?: boolean;
  
  // Extended properties
  Unsigned?: boolean;
  Zerofill?: boolean;
  AutoIncrement?: boolean;
  Charset?: string;
  Collation?: string;
}

interface IndexDefinition {
  Key_name: string;
  Column_name: string;
  Non_unique: number;
  Index_type: string; // BTREE, etc.
  Seq_in_index: number;
  // UI helper for grouping
  Columns?: string[];
  IndexKind?: 'PRIMARY' | 'UNIQUE' | 'FULLTEXT' | 'NORMAL'; // Mapped from Non_unique/Key_name
  Comment?: string;
}

interface ForeignKeyDefinition {
  CONSTRAINT_NAME: string;
  COLUMN_NAME: string;
  REFERENCED_TABLE_NAME: string;
  REFERENCED_COLUMN_NAME: string;
}

interface TableOptions {
  Engine?: string;
  Auto_increment?: number;
  Collation?: string;
  Comment?: string;
  Row_format?: string;
  // Helper
  Charset?: string; 
}

const MYSQL_TYPES = [
  'int', 'varchar', 'text', 'datetime', 'timestamp', 
  'tinyint', 'smallint', 'mediumint', 'bigint', 
  'float', 'double', 'decimal', 
  'date', 'time', 'year', 
  'char', 'mediumtext', 'longtext', 
  'blob', 'mediumblob', 'longblob', 
  'json', 'enum', 'set'
];

const INDEX_TYPES = ['NORMAL', 'UNIQUE', 'FULLTEXT']; // PRIMARY handled separately usually
const INDEX_METHODS = ['BTREE', 'HASH'];
const ROW_FORMATS = ['Default', 'Dynamic', 'Fixed', 'Compressed', 'Redundant', 'Compact'];
const ENGINES = ['InnoDB', 'MyISAM', 'MEMORY', 'CSV', 'ARCHIVE'];

type Tab = 'fields' | 'indexes' | 'foreign_keys' | 'triggers' | 'options' | 'comments' | 'sql_preview';

export function TableDesigner({ connectionId, database, table, onClose }: TableDesignerProps) {
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [indexes, setIndexes] = useState<IndexDefinition[]>([]);
  const [foreignKeys, setForeignKeys] = useState<ForeignKeyDefinition[]>([]);
  const [tableOptions, setTableOptions] = useState<TableOptions>({});
  
  const [activeTab, setActiveTab] = useState<Tab>('fields');
  const [selectedColumnIndex, setSelectedColumnIndex] = useState<number | null>(null);
  const [selectedIndexIndex, setSelectedIndexIndex] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  
  // Table Name State
  const [tableName, setTableName] = useState(table || 'new_table');
  const [isNewTable, setIsNewTable] = useState(!table);

  // Dropdown data
  const [charsets, setCharsets] = useState<any[]>([]);
  const [collations, setCollations] = useState<any[]>([]);

  useEffect(() => {
    if (table) {
       setTableName(table);
       setIsNewTable(false);
       fetchStructure();
    } else {
       // New Table Mode
       setTableName('new_table');
       setIsNewTable(true);
       setColumns([{
          Field: 'id',
          Type: 'int(11)',
          ParsedType: 'int',
          Length: '11',
          Null: 'NO',
          Key: 'PRI',
          Default: null,
          Extra: 'auto_increment',
          Comment: '',
          isNew: true,
          originalField: '',
          isVirtual: false,
          Unsigned: false,
          Zerofill: false,
          AutoIncrement: true
       }]);
       setIndexes([{
          Key_name: 'PRIMARY',
          Column_name: 'id',
          Non_unique: 0,
          Index_type: 'BTREE',
          Seq_in_index: 1,
          IndexKind: 'PRIMARY',
          Comment: ''
       }]);
       setForeignKeys([]);
       setTableOptions({ Engine: 'InnoDB', Charset: 'utf8mb4', Collation: 'utf8mb4_general_ci' });
       setSelectedColumnIndex(0);
    }
    fetchMetadata();
    setIsDirty(false); 
  }, [connectionId, database, table]);

  const parseType = (fullType: string) => {
    const match = fullType.match(/^(\w+)(?:\((.+)\))?(?: (.+))?$/);
    const type = match ? match[1] : fullType;
    const length = match ? match[2] : '';
    const extra = match ? match[3] || '' : '';
    
    return {
      type,
      length,
      extra,
      unsigned: extra.includes('unsigned'),
      zerofill: extra.includes('zerofill')
    };
  };

  const fetchMetadata = async () => {
    try {
      const resCharsets = await window.ipcRenderer.invoke('db:get-charsets', connectionId);
      if (resCharsets.success) setCharsets(resCharsets.results);
      
      const resCollations = await window.ipcRenderer.invoke('db:get-collations', connectionId);
      if (resCollations.success) setCollations(resCollations.results);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStructure = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use tableName state if available (for reload after save), otherwise prop
      const targetTable = tableName || table; 
      if (!targetTable) return;

      const res = await window.ipcRenderer.invoke('db:get-table-extended-info', connectionId, database, targetTable);
      if (res.success) {
        const { columns: cols, indexes: idxs, tableStatus, foreignKeys: fks } = res.results;

        setColumns(cols.map((col: any) => {
          const parsed = parseType(col.Type);
          return { 
            ...col, 
            originalField: col.Field,
            ParsedType: parsed.type,
            Length: parsed.length,
            isVirtual: col.Extra.includes('GENERATED'),
            Unsigned: parsed.unsigned,
            Zerofill: parsed.zerofill,
            AutoIncrement: col.Extra.includes('auto_increment'),
            Charset: col.Collation ? col.Collation.split('_')[0] : null, // Naive charset extraction
            Collation: col.Collation
          };
        }));
        
        // Process indexes to group by Key_name if needed, or keep flat but enhance properties
        // For MVP flat list but map types
        setIndexes(idxs.map((idx: any) => ({
            ...idx,
            IndexKind: idx.Key_name === 'PRIMARY' ? 'PRIMARY' : (idx.Non_unique === 0 ? 'UNIQUE' : 'NORMAL')
        })));

        setForeignKeys(fks);
        setTableOptions({
            ...tableStatus,
            Charset: tableStatus?.Collation?.split('_')[0]
        });
        
        if (cols.length > 0) setSelectedColumnIndex(0);
        if (idxs.length > 0) setSelectedIndexIndex(0);

      } else {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateColumn = (index: number, field: keyof ColumnDefinition, value: any) => {
    setColumns(prev => prev.map((col, i) => {
      if (i !== index) return col;
      
      const newCol = { ...col, [field]: value };
      
      // Reconstruct Type string if needed
      if (['ParsedType', 'Length', 'Unsigned', 'Zerofill'].includes(field as string)) {
        const t = field === 'ParsedType' ? value : col.ParsedType;
        const l = field === 'Length' ? value : col.Length;
        const u = field === 'Unsigned' ? value : col.Unsigned;
        const z = field === 'Zerofill' ? value : col.Zerofill;
        
        let typeStr = t;
        if (l) typeStr += `(${l})`;
        if (u) typeStr += ' unsigned';
        if (z) typeStr += ' zerofill';
        
        newCol.Type = typeStr;
        newCol.ParsedType = t;
        newCol.Length = l;
        newCol.Unsigned = u;
        newCol.Zerofill = z;
      }

      if (field === 'AutoIncrement') {
        if (value) {
            newCol.Extra = newCol.Extra.replace(/auto_increment/g, '').trim() + ' auto_increment';
        } else {
            newCol.Extra = newCol.Extra.replace(/auto_increment/g, '').trim();
        }
      }

      if (field === 'isVirtual') {
         newCol.Extra = value ? 'VIRTUAL GENERATED' : '';
      }

      return newCol;
    }));
    setIsDirty(true);
  };

  const handleUpdateIndex = (index: number, field: keyof IndexDefinition, value: any) => {
    setIndexes(prev => prev.map((idx, i) => {
        if (i !== index) return idx;
        return { ...idx, [field]: value };
    }));
    setIsDirty(true);
  };

  const handleUpdateOptions = (field: keyof TableOptions, value: any) => {
    setTableOptions(prev => {
        const next = { ...prev, [field]: value };
        // Reset collation when charset changes
        if (field === 'Charset') {
            next.Collation = ''; 
        }
        return next;
    });
    setIsDirty(true);
  };

  const handleAddColumn = () => {
    const newCol: ColumnDefinition = {
      Field: 'new_column',
      Type: 'varchar(255)',
      ParsedType: 'varchar',
      Length: '255',
      Null: 'YES',
      Key: '',
      Default: null,
      Extra: '',
      Comment: '',
      isNew: true,
      originalField: '',
      isVirtual: false,
      Unsigned: false,
      Zerofill: false,
      AutoIncrement: false
    };
    setColumns(prev => [...prev, newCol]);
    setSelectedColumnIndex(columns.length); // Select new column
    setIsDirty(true);
  };

  const handleAddIndex = () => {
    const newIndex: IndexDefinition = {
        Key_name: 'new_index',
        Column_name: columns[0]?.Field || '',
        Non_unique: 1,
        Index_type: 'BTREE',
        Seq_in_index: 1,
        IndexKind: 'NORMAL',
        Comment: ''
    };
    setIndexes(prev => [...prev, newIndex]);
    setSelectedIndexIndex(indexes.length);
    setIsDirty(true);
  };

  const handleDeleteColumn = (index: number) => {
    setColumns(prev => prev.filter((_, i) => i !== index));
    setIsDirty(true);
    if (selectedColumnIndex === index) setSelectedColumnIndex(null);
  };

  const handleDeleteIndex = (index: number) => {
    setIndexes(prev => prev.filter((_, i) => i !== index));
    setIsDirty(true);
    if (selectedIndexIndex === index) setSelectedIndexIndex(null);
  };

  const handleSave = async () => {
    if (!tableName) {
        alert("Table name is required");
        return;
    }
    setLoading(true);
    try {
        const res = await window.ipcRenderer.invoke('db:save-table-structure', 
            connectionId, 
            database, 
            isNewTable ? '' : table, // Old table name from prop (assuming prop matches original loaded table)
            tableName, // New table name from state
            columns, 
            indexes, 
            foreignKeys, 
            tableOptions,
            isNewTable
        );
        
        if (res.success) {
            alert('Table saved successfully!');
            setIsDirty(false);
            if (isNewTable) {
                setIsNewTable(false);
            }
            // Refresh structure to get updated state (e.g. normalized types)
            fetchStructure();
        } else {
            alert('Error saving table: ' + res.error);
        }
    } catch (e: any) {
        alert('Error: ' + e.message);
    } finally {
        setLoading(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      if (window.confirm("You have unsaved changes. Are you sure you want to close?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };
  
  const renderIndexProperties = () => {
    if (selectedIndexIndex === null) return <div className="p-4 text-gray-400">Select an index to edit properties</div>;
    
    const idx = indexes[selectedIndexIndex];
    if (!idx) return null;
    
    return (
      <div className="grid grid-cols-2 gap-4 p-4 text-sm">
         <div className="flex flex-col gap-1">
            <label className="font-medium text-gray-600">Name</label>
            <input 
              className="border rounded p-1"
              value={idx.Key_name}
              onChange={(e) => handleUpdateIndex(selectedIndexIndex, 'Key_name', e.target.value)}
            />
         </div>
         <div className="flex flex-col gap-1">
             <label className="font-medium text-gray-600">Columns</label>
             <select 
               className="border rounded p-1"
               value={idx.Column_name}
               onChange={(e) => handleUpdateIndex(selectedIndexIndex, 'Column_name', e.target.value)}
             >
                {columns.map(c => <option key={c.Field} value={c.Field}>{c.Field}</option>)}
             </select>
             <span className="text-xs text-gray-400">Multi-column index editing not supported in MVP</span>
         </div>
         <div className="flex flex-col gap-1">
             <label className="font-medium text-gray-600">Index Type</label>
             <select 
               className="border rounded p-1"
               value={idx.IndexKind}
               onChange={(e) => handleUpdateIndex(selectedIndexIndex, 'IndexKind', e.target.value)}
             >
                {INDEX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
             </select>
         </div>
         <div className="flex flex-col gap-1">
             <label className="font-medium text-gray-600">Index Method</label>
             <select 
               className="border rounded p-1"
               value={idx.Index_type}
               onChange={(e) => handleUpdateIndex(selectedIndexIndex, 'Index_type', e.target.value)}
             >
                {INDEX_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
             </select>
         </div>
         <div className="col-span-2 flex flex-col gap-1">
             <label className="font-medium text-gray-600">Comment</label>
             <input 
               className="border rounded p-1"
               value={idx.Comment || ''}
               onChange={(e) => handleUpdateIndex(selectedIndexIndex, 'Comment', e.target.value)}
             />
         </div>
      </div>
    );
  };

  const renderFieldProperties = () => {
    if (selectedColumnIndex === null) return <div className="p-4 text-gray-400">Select a column to edit properties</div>;
    
    const col = columns[selectedColumnIndex];
    if (!col) return null;
    
    const type = col.ParsedType?.toLowerCase() || '';
    const isNumeric = ['int', 'tinyint', 'smallint', 'mediumint', 'bigint', 'float', 'double', 'decimal'].includes(type);
    const isString = ['char', 'varchar', 'text', 'mediumtext', 'longtext', 'tinytext'].includes(type);
    
    return (
      <div className="grid grid-cols-2 gap-4 p-4 text-sm">
         {/* Common Properties */}
         <div className="flex flex-col gap-1">
            <label className="font-medium text-gray-600">Default Value</label>
            <input 
              className="border rounded p-1"
              value={col.Default || ''}
              onChange={(e) => handleUpdateColumn(selectedColumnIndex, 'Default', e.target.value)}
              placeholder="NULL"
            />
         </div>
         
         <div className="flex flex-col gap-1">
             <label className="font-medium text-gray-600">Comment</label>
             <input 
               className="border rounded p-1"
               value={col.Comment || ''}
               onChange={(e) => handleUpdateColumn(selectedColumnIndex, 'Comment', e.target.value)}
             />
         </div>

         {/* Numeric Specific */}
         {isNumeric && (
           <>
             <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="chk_autoinc"
                  checked={col.AutoIncrement || false}
                  onChange={(e) => handleUpdateColumn(selectedColumnIndex, 'AutoIncrement', e.target.checked)}
                />
                <label htmlFor="chk_autoinc">Auto Increment</label>
             </div>
             <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="chk_unsigned"
                  checked={col.Unsigned || false}
                  onChange={(e) => handleUpdateColumn(selectedColumnIndex, 'Unsigned', e.target.checked)}
                />
                <label htmlFor="chk_unsigned">Unsigned</label>
             </div>
             <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="chk_zerofill"
                  checked={col.Zerofill || false}
                  onChange={(e) => handleUpdateColumn(selectedColumnIndex, 'Zerofill', e.target.checked)}
                />
                <label htmlFor="chk_zerofill">Zerofill</label>
             </div>
           </>
         )}
         
         {/* String Specific */}
         {isString && (
           <>
             <div className="flex flex-col gap-1">
                <label className="font-medium text-gray-600">Charset</label>
                <select 
                  className="border rounded p-1"
                  value={col.Charset || ''}
                  onChange={(e) => handleUpdateColumn(selectedColumnIndex, 'Charset', e.target.value)}
                >
                  <option value="">Default</option>
                  {charsets.map((c: any) => <option key={c.Charset} value={c.Charset}>{c.Charset}</option>)}
                </select>
             </div>
             <div className="flex flex-col gap-1">
                <label className="font-medium text-gray-600">Collation</label>
                <select 
                  className="border rounded p-1"
                  value={col.Collation || ''}
                  onChange={(e) => handleUpdateColumn(selectedColumnIndex, 'Collation', e.target.value)}
                >
                  <option value="">Default</option>
                  {collations
                    .filter((c: any) => !col.Charset || c.Collation.startsWith(col.Charset))
                    .map((c: any) => <option key={c.Collation} value={c.Collation}>{c.Collation}</option>)
                  }
                </select>
             </div>
           </>
         )}
      </div>
    );
  };

  if (loading) return <div className="p-4 text-gray-500">Loading structure...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Top Bar */}
      <div className="h-10 border-b flex items-center px-2 bg-gray-50 gap-2 justify-between shrink-0">
        <div className="flex gap-2 items-center">
          <div className="flex flex-col px-2">
             <label className="text-[10px] text-gray-500 font-medium">Table Name</label>
             <input 
               className="border rounded px-1 py-0.5 text-sm w-48"
               value={tableName}
               onChange={(e) => { setTableName(e.target.value); setIsDirty(true); }}
               placeholder="Table Name"
             />
          </div>
          <div className="h-6 border-l mx-2"></div>
          <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            <Save size={14} /> Save
          </button>
          {(activeTab === 'fields' || activeTab === 'indexes') && (
             <button onClick={activeTab === 'fields' ? handleAddColumn : handleAddIndex} className="flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300">
               <Plus size={14} /> {activeTab === 'fields' ? 'Add Field' : 'Add Index'}
             </button>
          )}
          {activeTab === 'indexes' && selectedIndexIndex !== null && (
             <button onClick={() => handleDeleteIndex(selectedIndexIndex)} className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200">
                <Trash2 size={14} /> Delete Index
             </button>
          )}
        </div>
        <button onClick={handleClose} className="p-1 hover:bg-gray-200 rounded text-gray-600">
          <X size={16} />
        </button>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b bg-gray-50 px-2 shrink-0">
         {['fields', 'indexes', 'foreign_keys', 'triggers', 'options', 'comments', 'sql_preview'].map(tab => (
           <button 
             key={tab}
             className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tab ? 'border-blue-500 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
             onClick={() => setActiveTab(tab as Tab)}
           >
             {tab.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
           </button>
         ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
         {activeTab === 'fields' && (
           <div className="flex flex-col h-full">
             <div className="flex-1 overflow-auto border-b">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
                    <tr>
                      <th className="border p-2 w-10"></th>
                      <th className="border p-2 text-left">Name</th>
                      <th className="border p-2 text-left w-32">Type</th>
                      <th className="border p-2 text-left w-20">Length</th>
                      <th className="border p-2 text-center w-20">Not Null</th>
                      <th className="border p-2 text-center w-10">Key</th>
                      <th className="border p-2 text-center w-10">Op</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map((col, i) => (
                      <tr 
                        key={i} 
                        className={`hover:bg-blue-50 cursor-pointer ${selectedColumnIndex === i ? 'bg-blue-100' : ''}`}
                        onClick={() => setSelectedColumnIndex(i)}
                      >
                        <td className="border p-1 text-center text-gray-400 text-xs">{i+1}</td>
                        <td className="border p-1">
                          <input 
                            className="w-full px-1 py-0.5 border-none bg-transparent focus:bg-white focus:ring-1"
                            value={col.Field}
                            onChange={(e) => handleUpdateColumn(i, 'Field', e.target.value)}
                          />
                        </td>
                        <td className="border p-1">
                          <select 
                            className="w-full px-1 py-0.5 border-none bg-transparent focus:bg-white focus:ring-1"
                            value={col.ParsedType}
                            onChange={(e) => handleUpdateColumn(i, 'ParsedType', e.target.value)}
                          >
                            {MYSQL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="border p-1">
                          <input 
                            className="w-full px-1 py-0.5 border-none bg-transparent focus:bg-white focus:ring-1"
                            value={col.Length || ''}
                            onChange={(e) => handleUpdateColumn(i, 'Length', e.target.value)}
                          />
                        </td>
                        <td className="border p-1 text-center">
                          <input 
                            type="checkbox" 
                            checked={col.Null === 'NO'} 
                            onChange={(e) => handleUpdateColumn(i, 'Null', e.target.checked ? 'NO' : 'YES')}
                          />
                        </td>
                        <td className="border p-1 text-center">
                           {col.Key === 'PRI' && <Key size={12} className="text-yellow-600 inline" />}
                        </td>
                        <td className="border p-1 text-center">
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteColumn(i); }} className="text-red-500 hover:text-red-700">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
             {/* Bottom Panel */}
             <div className="h-64 border-t bg-gray-50 overflow-auto">
               {renderFieldProperties()}
             </div>
           </div>
         )}
         
         {activeTab === 'indexes' && (
           <div className="flex flex-col h-full">
              <div className="flex-1 overflow-auto border-b">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
                    <tr>
                      <th className="border p-2 w-10"></th>
                      <th className="border p-2 text-left">Name</th>
                      <th className="border p-2 text-left">Type</th>
                      <th className="border p-2 text-left">Method</th>
                      <th className="border p-2 text-left">Columns</th>
                      <th className="border p-2 text-center w-10">Op</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indexes.map((idx, i) => (
                        <tr 
                          key={i} 
                          className={`hover:bg-blue-50 cursor-pointer ${selectedIndexIndex === i ? 'bg-blue-100' : ''}`}
                          onClick={() => setSelectedIndexIndex(i)}
                        >
                          <td className="border p-1 text-center text-gray-400 text-xs">{i+1}</td>
                          <td className="border p-1">
                              <div className="px-1 py-0.5">{idx.Key_name}</div>
                          </td>
                          <td className="border p-1">
                              <div className="px-1 py-0.5">{idx.IndexKind}</div>
                          </td>
                          <td className="border p-1">
                              <div className="px-1 py-0.5">{idx.Index_type}</div>
                          </td>
                          <td className="border p-1">{idx.Column_name}</td>
                          <td className="border p-1 text-center">
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteIndex(i); }} className="text-red-500 hover:text-red-700">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="h-64 border-t bg-gray-50 overflow-auto">
                 {renderIndexProperties()}
              </div>
           </div>
         )}

         {activeTab === 'foreign_keys' && (
            <div className="p-4 overflow-auto">
               <table className="w-full text-sm border">
                 <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-2 text-left">Name</th>
                      <th className="border p-2 text-left">Column</th>
                      <th className="border p-2 text-left">Ref Table</th>
                      <th className="border p-2 text-left">Ref Column</th>
                    </tr>
                 </thead>
                 <tbody>
                    {foreignKeys.map((fk, i) => (
                       <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="p-2 border-r">{fk.CONSTRAINT_NAME}</td>
                          <td className="p-2 border-r">{fk.COLUMN_NAME}</td>
                          <td className="p-2 border-r">{fk.REFERENCED_TABLE_NAME}</td>
                          <td className="p-2">{fk.REFERENCED_COLUMN_NAME}</td>
                       </tr>
                    ))}
                 </tbody>
               </table>
               <div className="mt-4 text-gray-500 italic text-sm">Foreign Key editing coming soon...</div>
            </div>
         )}
         
         {activeTab === 'triggers' && (
            <div className="p-4 text-gray-500 italic">Triggers configuration coming soon...</div>
         )}

         {activeTab === 'options' && (
            <div className="p-8 grid gap-4 max-w-lg">
               <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Engine</label>
                  <select 
                     className="border p-1 rounded" 
                     value={tableOptions.Engine || ''} 
                     onChange={(e) => handleUpdateOptions('Engine', e.target.value)}
                  >
                     <option value="">Default</option>
                     {ENGINES.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
               </div>
               <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Tablespace</label>
                  <select className="border p-1 rounded" disabled>
                     <option value="">Default</option>
                  </select>
               </div>
               <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Auto Increment Value</label>
                  <input 
                     className="border p-1 rounded" 
                     value={tableOptions.Auto_increment || ''} 
                     onChange={(e) => handleUpdateOptions('Auto_increment', e.target.value)}
                  />
               </div>
               <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Default Charset</label>
                  <select 
                     className="border p-1 rounded" 
                     value={tableOptions.Charset || ''} 
                     onChange={(e) => handleUpdateOptions('Charset', e.target.value)}
                  >
                     <option value="">Default</option>
                     {charsets.map((c: any) => <option key={c.Charset} value={c.Charset}>{c.Charset}</option>)}
                  </select>
               </div>
               <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Default Collation</label>
                  <select 
                     className="border p-1 rounded" 
                     value={tableOptions.Collation || ''} 
                     onChange={(e) => handleUpdateOptions('Collation', e.target.value)}
                  >
                     <option value="">Default</option>
                     {collations
                        .filter((c: any) => !tableOptions.Charset || c.Collation.startsWith(tableOptions.Charset))
                        .map((c: any) => <option key={c.Collation} value={c.Collation}>{c.Collation}</option>)
                     }
                  </select>
               </div>
               <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Row Format</label>
                  <select 
                     className="border p-1 rounded" 
                     value={tableOptions.Row_format || ''} 
                     onChange={(e) => handleUpdateOptions('Row_format', e.target.value)}
                  >
                     {ROW_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
               </div>
            </div>
         )}

         {activeTab === 'comments' && (
            <div className="p-4 h-full flex flex-col">
               <label className="text-sm font-medium mb-2">Table Comment</label>
               <textarea 
                  className="border p-2 rounded flex-1 resize-none" 
                  value={tableOptions.Comment || ''}
                  readOnly
               />
            </div>
         )}

         {activeTab === 'sql_preview' && (
            <div className="p-4 h-full">
               <pre className="bg-gray-100 p-4 rounded h-full overflow-auto text-xs font-mono">
                  {`-- SQL Preview is not yet implemented.\n-- It would show ALTER TABLE statements here.`}
               </pre>
            </div>
         )}
      </div>
    </div>
  );
}
