/**
 * Table Designer Component
 * 
 * Visual table structure editor for creating and modifying tables.
 * Features:
 * - Column management (add, edit, delete, reorder)
 * - Data type selection with length/precision
 * - Primary key, auto-increment, nullable settings
 * - Index management (primary, unique, index, fulltext)
 * - Table options (engine, charset, collation, comment)
 * - Support for both new table creation and existing table modification
 */

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
  UPDATE_RULE?: string;
  DELETE_RULE?: string;
  isNew?: boolean;
  isDeleted?: boolean;
  originalName?: string;
}

interface TriggerDefinition {
  Trigger: string;
  Event: string;
  Timing: string;
  Statement: string;
  Table: string;
  Created?: string;
  sql_mode?: string;
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
const FK_ACTIONS = ['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION', 'SET DEFAULT'];
const TRIGGER_TIMINGS = ['BEFORE', 'AFTER'];
const TRIGGER_EVENTS = ['INSERT', 'UPDATE', 'DELETE'];

type Tab = 'fields' | 'indexes' | 'foreign_keys' | 'triggers' | 'options' | 'comments' | 'sql_preview';

export function TableDesigner({ connectionId, database, table, onClose }: TableDesignerProps) {
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [indexes, setIndexes] = useState<IndexDefinition[]>([]);
  const [foreignKeys, setForeignKeys] = useState<ForeignKeyDefinition[]>([]);
  const [tableOptions, setTableOptions] = useState<TableOptions>({});
  
  const [activeTab, setActiveTab] = useState<Tab>('fields');
  const [selectedColumnIndex, setSelectedColumnIndex] = useState<number | null>(null);
  const [selectedIndexIndex, setSelectedIndexIndex] = useState<number | null>(null);
  const [selectedFkIndex, setSelectedFkIndex] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  
  // Table Name State
  const [tableName, setTableName] = useState(table || 'new_table');
  const [isNewTable, setIsNewTable] = useState(!table);

  // Dropdown data
  const [charsets, setCharsets] = useState<any[]>([]);
  const [collations, setCollations] = useState<any[]>([]);
  
  // Tables list for foreign key reference
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [refTableColumns, setRefTableColumns] = useState<any[]>([]);
  
  // Triggers
  const [triggers, setTriggers] = useState<TriggerDefinition[]>([]);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [newTrigger, setNewTrigger] = useState({
    name: '',
    timing: 'BEFORE',
    event: 'INSERT',
    statement: ''
  });
  
  // Original data for SQL preview diff
  const [originalColumns, setOriginalColumns] = useState<ColumnDefinition[]>([]);
  const [originalIndexes, setOriginalIndexes] = useState<IndexDefinition[]>([]);
  const [originalForeignKeys, setOriginalForeignKeys] = useState<ForeignKeyDefinition[]>([]);
  const [originalOptions, setOriginalOptions] = useState<TableOptions>({});

  useEffect(() => {
    if (table) {
       setTableName(table);
       setIsNewTable(false);
       fetchStructure();
       fetchTriggers();
    } else {
       // New Table Mode
       setTableName('new_table');
       setIsNewTable(true);
       const defaultColumns = [{
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
       }];
       const defaultIndexes = [{
          Key_name: 'PRIMARY',
          Column_name: 'id',
          Non_unique: 0,
          Index_type: 'BTREE',
          Seq_in_index: 1,
          IndexKind: 'PRIMARY' as const,
          Comment: ''
       }];
       const defaultOptions = { Engine: 'InnoDB', Charset: 'utf8mb4', Collation: 'utf8mb4_general_ci' };
       
       setColumns(defaultColumns);
       setIndexes(defaultIndexes);
       setForeignKeys([]);
       setTriggers([]);
       setTableOptions(defaultOptions);
       setSelectedColumnIndex(0);
       
       // Set originals for SQL preview
       setOriginalColumns([]);
       setOriginalIndexes([]);
       setOriginalForeignKeys([]);
       setOriginalOptions({});
    }
    fetchMetadata();
    fetchAvailableTables();
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

  const fetchAvailableTables = async () => {
    try {
      const res = await window.ipcRenderer.invoke('db:list-tables', connectionId, database);
      if (res.success) {
        setAvailableTables(res.results.filter((t: string) => t !== table));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTriggers = async () => {
    try {
      const targetTable = tableName || table;
      if (!targetTable) return;
      
      const res = await window.ipcRenderer.invoke('db:get-triggers', connectionId, database, targetTable);
      if (res.success) {
        setTriggers(res.results);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRefTableColumns = async (refTable: string) => {
    try {
      const res = await window.ipcRenderer.invoke('db:get-table-columns', connectionId, database, refTable);
      if (res.success) {
        setRefTableColumns(res.results);
      }
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

      const [res, fksRes] = await Promise.all([
        window.ipcRenderer.invoke('db:get-table-extended-info', connectionId, database, targetTable),
        window.ipcRenderer.invoke('db:get-foreign-keys-with-rules', connectionId, database, targetTable)
      ]);
      
      if (res.success) {
        const { columns: cols, indexes: idxs, tableStatus } = res.results;

        const processedColumns = cols.map((col: any) => {
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
            Charset: col.Collation ? col.Collation.split('_')[0] : null,
            Collation: col.Collation
          };
        });
        
        const processedIndexes = idxs.map((idx: any) => ({
            ...idx,
            IndexKind: idx.Key_name === 'PRIMARY' ? 'PRIMARY' : (idx.Non_unique === 0 ? 'UNIQUE' : 'NORMAL')
        }));

        const processedFks = fksRes.success ? fksRes.results.map((fk: any) => ({
            ...fk,
            originalName: fk.CONSTRAINT_NAME
        })) : [];

        const processedOptions = {
            ...tableStatus,
            Charset: tableStatus?.Collation?.split('_')[0]
        };

        setColumns(processedColumns);
        setIndexes(processedIndexes);
        setForeignKeys(processedFks);
        setTableOptions(processedOptions);
        
        // Store originals for SQL preview
        setOriginalColumns(JSON.parse(JSON.stringify(processedColumns)));
        setOriginalIndexes(JSON.parse(JSON.stringify(processedIndexes)));
        setOriginalForeignKeys(JSON.parse(JSON.stringify(processedFks)));
        setOriginalOptions(JSON.parse(JSON.stringify(processedOptions)));
        
        if (cols.length > 0) setSelectedColumnIndex(0);
        if (idxs.length > 0) setSelectedIndexIndex(0);
        if (processedFks.length > 0) setSelectedFkIndex(0);

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

  const handleAddForeignKey = () => {
    const newFk: ForeignKeyDefinition = {
      CONSTRAINT_NAME: `fk_${tableName}_${Date.now()}`,
      COLUMN_NAME: columns[0]?.Field || '',
      REFERENCED_TABLE_NAME: availableTables[0] || '',
      REFERENCED_COLUMN_NAME: '',
      UPDATE_RULE: 'RESTRICT',
      DELETE_RULE: 'RESTRICT',
      isNew: true
    };
    setForeignKeys(prev => [...prev, newFk]);
    setSelectedFkIndex(foreignKeys.length);
    setIsDirty(true);
    
    // Load columns for the referenced table
    if (availableTables[0]) {
      fetchRefTableColumns(availableTables[0]);
    }
  };

  const handleUpdateForeignKey = (index: number, field: keyof ForeignKeyDefinition, value: any) => {
    setForeignKeys(prev => prev.map((fk, i) => {
      if (i !== index) return fk;
      const updated = { ...fk, [field]: value };
      
      // When referenced table changes, reset referenced column and fetch new columns
      if (field === 'REFERENCED_TABLE_NAME') {
        updated.REFERENCED_COLUMN_NAME = '';
        fetchRefTableColumns(value);
      }
      
      return updated;
    }));
    setIsDirty(true);
  };

  const handleDeleteForeignKey = (index: number) => {
    const fk = foreignKeys[index];
    if (fk.isNew) {
      // Just remove from list if it's new
      setForeignKeys(prev => prev.filter((_, i) => i !== index));
    } else {
      // Mark as deleted for existing FK
      setForeignKeys(prev => prev.map((f, i) => 
        i === index ? { ...f, isDeleted: true } : f
      ));
    }
    setIsDirty(true);
    if (selectedFkIndex === index) setSelectedFkIndex(null);
  };

  const handleCreateTrigger = async () => {
    if (!newTrigger.name || !newTrigger.statement) {
      alert('Please provide trigger name and statement');
      return;
    }
    
    try {
      const sql = `CREATE TRIGGER \`${newTrigger.name}\` ${newTrigger.timing} ${newTrigger.event} ON \`${tableName}\` FOR EACH ROW ${newTrigger.statement}`;
      const res = await window.ipcRenderer.invoke('db:create-trigger', connectionId, database, sql);
      
      if (res.success) {
        setShowTriggerModal(false);
        setNewTrigger({ name: '', timing: 'BEFORE', event: 'INSERT', statement: '' });
        fetchTriggers();
      } else {
        alert('Error creating trigger: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const handleDeleteTrigger = async (triggerName: string) => {
    if (!confirm(`Are you sure you want to delete trigger "${triggerName}"?`)) return;
    
    try {
      const res = await window.ipcRenderer.invoke('db:drop-trigger', connectionId, database, triggerName);
      if (res.success) {
        fetchTriggers();
      } else {
        alert('Error deleting trigger: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
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

            // If table name was changed, notify to update the tables list
            if (!isNewTable && table !== tableName) {
                // Update the table name in the sidebar by calling the parent's callback
                // We need to get the active connection config id to update the local state
                const res = await window.ipcRenderer.invoke('db:list-tables', connectionId, database);
                if (res.success) {
                    // We need to notify the sidebar to update its tables list
                    // Since we're in a modal, we can use a global event or a callback
                    // For simplicity, let's dispatch a custom event
                    const event = new CustomEvent('table-name-changed', {
                        detail: {
                            oldName: table,
                            newName: tableName,
                            database: database
                        }
                    });
                    window.dispatchEvent(event);
                }
                // Refresh structure to get updated state (e.g. normalized types)
                fetchStructure();
            } else {
                // Refresh structure to get updated state (e.g. normalized types)
                fetchStructure();
            }
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

  // Generate SQL Preview
  const generateSqlPreview = (): string => {
    const buildColumnDef = (col: ColumnDefinition): string => {
      let def = `\`${col.Field}\` ${col.Type}`;
      
      if (col.Unsigned && !col.Type.toLowerCase().includes('unsigned')) def += ' UNSIGNED';
      if (col.Zerofill && !col.Type.toLowerCase().includes('zerofill')) def += ' ZEROFILL';
      if (col.Charset && col.Charset !== 'Default') def += ` CHARACTER SET ${col.Charset}`;
      if (col.Collation && col.Collation !== 'Default') def += ` COLLATE ${col.Collation}`;
      if (col.Null === 'NO') def += ' NOT NULL';
      else def += ' NULL';
      
      if (col.Default !== null && col.Default !== undefined && col.Default !== '') {
        if (col.Default === 'CURRENT_TIMESTAMP') def += ' DEFAULT CURRENT_TIMESTAMP';
        else if (col.Default === 'NULL') def += ' DEFAULT NULL';
        else def += ` DEFAULT '${col.Default}'`;
      } else if (col.Null === 'YES') {
        def += ' DEFAULT NULL';
      }
      
      if (col.AutoIncrement) def += ' AUTO_INCREMENT';
      if (col.Comment) def += ` COMMENT '${col.Comment}'`;
      
      return def;
    };

    const buildIndexDef = (keyName: string, idx: IndexDefinition): string => {
      const cols = `\`${idx.Column_name}\``;
      if (keyName === 'PRIMARY') return `PRIMARY KEY (${cols})`;
      if (idx.IndexKind === 'UNIQUE') return `UNIQUE KEY \`${keyName}\` (${cols})`;
      if (idx.IndexKind === 'FULLTEXT') return `FULLTEXT KEY \`${keyName}\` (${cols})`;
      return `KEY \`${keyName}\` (${cols}) USING ${idx.Index_type}`;
    };

    const buildFkDef = (fk: ForeignKeyDefinition): string => {
      return `CONSTRAINT \`${fk.CONSTRAINT_NAME}\` FOREIGN KEY (\`${fk.COLUMN_NAME}\`) REFERENCES \`${fk.REFERENCED_TABLE_NAME}\` (\`${fk.REFERENCED_COLUMN_NAME}\`) ON UPDATE ${fk.UPDATE_RULE || 'RESTRICT'} ON DELETE ${fk.DELETE_RULE || 'RESTRICT'}`;
    };

    if (isNewTable) {
      // CREATE TABLE statement
      const lines: string[] = [];
      
      // Columns
      columns.forEach(col => {
        lines.push('  ' + buildColumnDef(col));
      });
      
      // Indexes
      indexes.forEach(idx => {
        lines.push('  ' + buildIndexDef(idx.Key_name, idx));
      });
      
      // Foreign Keys
      foreignKeys.filter(fk => !fk.isDeleted).forEach(fk => {
        lines.push('  ' + buildFkDef(fk));
      });
      
      let sql = `CREATE TABLE \`${database}\`.\`${tableName}\` (\n`;
      sql += lines.join(',\n');
      sql += `\n)`;
      
      if (tableOptions.Engine) sql += ` ENGINE=${tableOptions.Engine}`;
      if (tableOptions.Charset) sql += ` DEFAULT CHARSET=${tableOptions.Charset}`;
      if (tableOptions.Collation) sql += ` COLLATE=${tableOptions.Collation}`;
      if (tableOptions.Comment) sql += ` COMMENT='${tableOptions.Comment}'`;
      if (tableOptions.Auto_increment) sql += ` AUTO_INCREMENT=${tableOptions.Auto_increment}`;
      
      sql += ';';
      return sql;
    } else {
      // ALTER TABLE statements
      const alterStatements: string[] = [];
      
      // Column changes
      const originalColNames = new Set(originalColumns.map(c => c.originalField || c.Field));
      
      // Added columns
      columns.filter(c => c.isNew).forEach(col => {
        alterStatements.push(`ADD COLUMN ${buildColumnDef(col)}`);
      });
      
      // Modified columns
      columns.filter(c => !c.isNew && c.originalField && originalColNames.has(c.originalField)).forEach(col => {
        const orig = originalColumns.find(o => o.Field === col.originalField);
        if (orig) {
          if (col.Field !== orig.Field) {
            alterStatements.push(`CHANGE COLUMN \`${orig.Field}\` ${buildColumnDef(col)}`);
          } else {
            // Check if any properties changed
            const changed = col.Type !== orig.Type || 
                           col.Null !== orig.Null || 
                           col.Default !== orig.Default ||
                           col.Comment !== orig.Comment;
            if (changed) {
              alterStatements.push(`MODIFY COLUMN ${buildColumnDef(col)}`);
            }
          }
        }
      });
      
      // Dropped columns
      originalColumns.forEach(orig => {
        const stillExists = columns.some(c => c.originalField === orig.Field || c.Field === orig.Field);
        if (!stillExists) {
          alterStatements.push(`DROP COLUMN \`${orig.Field}\``);
        }
      });
      
      // Index changes - simplified: compare by Key_name
      const origIndexNames = new Set(originalIndexes.map(i => i.Key_name));
      const currIndexNames = new Set(indexes.map(i => i.Key_name));
      
      // Dropped indexes
      originalIndexes.forEach(idx => {
        if (!currIndexNames.has(idx.Key_name)) {
          if (idx.Key_name === 'PRIMARY') {
            alterStatements.push('DROP PRIMARY KEY');
          } else {
            alterStatements.push(`DROP INDEX \`${idx.Key_name}\``);
          }
        }
      });
      
      // Added indexes
      indexes.forEach(idx => {
        if (!origIndexNames.has(idx.Key_name)) {
          alterStatements.push(`ADD ${buildIndexDef(idx.Key_name, idx)}`);
        }
      });
      
      // Foreign Key changes
      // Dropped foreign keys
      foreignKeys.filter(fk => fk.isDeleted && fk.originalName).forEach(fk => {
        alterStatements.push(`DROP FOREIGN KEY \`${fk.originalName}\``);
      });
      
      // Added foreign keys
      foreignKeys.filter(fk => fk.isNew && !fk.isDeleted).forEach(fk => {
        alterStatements.push(`ADD ${buildFkDef(fk)}`);
      });
      
      // Modified foreign keys (drop old, add new)
      foreignKeys.filter(fk => !fk.isNew && !fk.isDeleted && fk.originalName).forEach(fk => {
        const orig = originalForeignKeys.find(o => o.CONSTRAINT_NAME === fk.originalName);
        if (orig) {
          const changed = fk.COLUMN_NAME !== orig.COLUMN_NAME ||
                         fk.REFERENCED_TABLE_NAME !== orig.REFERENCED_TABLE_NAME ||
                         fk.REFERENCED_COLUMN_NAME !== orig.REFERENCED_COLUMN_NAME ||
                         fk.UPDATE_RULE !== orig.UPDATE_RULE ||
                         fk.DELETE_RULE !== orig.DELETE_RULE;
          if (changed) {
            alterStatements.push(`DROP FOREIGN KEY \`${fk.originalName}\``);
            alterStatements.push(`ADD ${buildFkDef(fk)}`);
          }
        }
      });
      
      // Table options
      const optionChanges: string[] = [];
      if (tableOptions.Engine !== originalOptions.Engine) optionChanges.push(`ENGINE=${tableOptions.Engine}`);
      if (tableOptions.Charset !== originalOptions.Charset) optionChanges.push(`DEFAULT CHARSET=${tableOptions.Charset}`);
      if (tableOptions.Collation !== originalOptions.Collation) optionChanges.push(`COLLATE=${tableOptions.Collation}`);
      if (tableOptions.Comment !== originalOptions.Comment) optionChanges.push(`COMMENT='${tableOptions.Comment || ''}'`);
      if (optionChanges.length > 0) {
        alterStatements.push(optionChanges.join(' '));
      }
      
      if (alterStatements.length === 0) {
        return '-- No changes detected';
      }
      
      return `ALTER TABLE \`${database}\`.\`${tableName}\`\n  ${alterStatements.join(',\n  ')};`;
    }
  };
  
  const renderForeignKeyProperties = () => {
    if (selectedFkIndex === null) return <div className="p-4 text-gray-400">Select a foreign key to edit properties</div>;
    
    const fk = foreignKeys[selectedFkIndex];
    if (!fk || fk.isDeleted) return null;
    
    return (
      <div className="grid grid-cols-2 gap-4 p-4 text-sm">
        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-600">Constraint Name</label>
          <input 
            className="border rounded p-1"
            value={fk.CONSTRAINT_NAME}
            onChange={(e) => handleUpdateForeignKey(selectedFkIndex, 'CONSTRAINT_NAME', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-600">Column</label>
          <select 
            className="border rounded p-1"
            value={fk.COLUMN_NAME}
            onChange={(e) => handleUpdateForeignKey(selectedFkIndex, 'COLUMN_NAME', e.target.value)}
          >
            {columns.map(c => <option key={c.Field} value={c.Field}>{c.Field}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-600">Referenced Table</label>
          <select 
            className="border rounded p-1"
            value={fk.REFERENCED_TABLE_NAME}
            onChange={(e) => handleUpdateForeignKey(selectedFkIndex, 'REFERENCED_TABLE_NAME', e.target.value)}
          >
            <option value="">-- Select Table --</option>
            {availableTables.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-600">Referenced Column</label>
          <select 
            className="border rounded p-1"
            value={fk.REFERENCED_COLUMN_NAME}
            onChange={(e) => handleUpdateForeignKey(selectedFkIndex, 'REFERENCED_COLUMN_NAME', e.target.value)}
          >
            <option value="">-- Select Column --</option>
            {refTableColumns.map((c: any) => <option key={c.Field} value={c.Field}>{c.Field}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-600">On Update</label>
          <select 
            className="border rounded p-1"
            value={fk.UPDATE_RULE || 'RESTRICT'}
            onChange={(e) => handleUpdateForeignKey(selectedFkIndex, 'UPDATE_RULE', e.target.value)}
          >
            {FK_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-600">On Delete</label>
          <select 
            className="border rounded p-1"
            value={fk.DELETE_RULE || 'RESTRICT'}
            onChange={(e) => handleUpdateForeignKey(selectedFkIndex, 'DELETE_RULE', e.target.value)}
          >
            {FK_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
    );
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
          {(activeTab === 'fields' || activeTab === 'indexes' || activeTab === 'foreign_keys') && (
             <button 
               onClick={
                 activeTab === 'fields' ? handleAddColumn : 
                 activeTab === 'indexes' ? handleAddIndex : 
                 handleAddForeignKey
               } 
               className="flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
             >
               <Plus size={14} /> {activeTab === 'fields' ? 'Add Field' : activeTab === 'indexes' ? 'Add Index' : 'Add FK'}
             </button>
          )}
          {activeTab === 'indexes' && selectedIndexIndex !== null && (
             <button onClick={() => handleDeleteIndex(selectedIndexIndex)} className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200">
                <Trash2 size={14} /> Delete Index
             </button>
          )}
          {activeTab === 'foreign_keys' && selectedFkIndex !== null && !foreignKeys[selectedFkIndex]?.isDeleted && (
             <button onClick={() => handleDeleteForeignKey(selectedFkIndex)} className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200">
                <Trash2 size={14} /> Delete FK
             </button>
          )}
          {activeTab === 'triggers' && (
             <button onClick={() => setShowTriggerModal(true)} className="flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300">
               <Plus size={14} /> Add Trigger
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
            <div className="flex flex-col h-full">
               <div className="flex-1 overflow-auto border-b">
                 <table className="min-w-full border-collapse text-sm">
                   <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
                     <tr>
                       <th className="border p-2 w-10"></th>
                       <th className="border p-2 text-left">Name</th>
                       <th className="border p-2 text-left">Column</th>
                       <th className="border p-2 text-left">Ref Table</th>
                       <th className="border p-2 text-left">Ref Column</th>
                       <th className="border p-2 text-left">On Update</th>
                       <th className="border p-2 text-left">On Delete</th>
                       <th className="border p-2 text-center w-10">Op</th>
                     </tr>
                   </thead>
                   <tbody>
                     {foreignKeys.filter(fk => !fk.isDeleted).map((fk, i) => {
                       const realIndex = foreignKeys.findIndex(f => f === fk);
                       return (
                         <tr 
                           key={i} 
                           className={`hover:bg-blue-50 cursor-pointer ${selectedFkIndex === realIndex ? 'bg-blue-100' : ''} ${fk.isNew ? 'bg-green-50' : ''}`}
                           onClick={() => {
                             setSelectedFkIndex(realIndex);
                             if (fk.REFERENCED_TABLE_NAME) {
                               fetchRefTableColumns(fk.REFERENCED_TABLE_NAME);
                             }
                           }}
                         >
                           <td className="border p-1 text-center text-gray-400 text-xs">{i+1}</td>
                           <td className="border p-1">{fk.CONSTRAINT_NAME}</td>
                           <td className="border p-1">{fk.COLUMN_NAME}</td>
                           <td className="border p-1">{fk.REFERENCED_TABLE_NAME}</td>
                           <td className="border p-1">{fk.REFERENCED_COLUMN_NAME}</td>
                           <td className="border p-1">{fk.UPDATE_RULE || 'RESTRICT'}</td>
                           <td className="border p-1">{fk.DELETE_RULE || 'RESTRICT'}</td>
                           <td className="border p-1 text-center">
                             <button onClick={(e) => { e.stopPropagation(); handleDeleteForeignKey(realIndex); }} className="text-red-500 hover:text-red-700">
                               <Trash2 size={14} />
                             </button>
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
                 {foreignKeys.filter(fk => !fk.isDeleted).length === 0 && (
                   <div className="p-8 text-center text-gray-400">No foreign keys defined. Click "Add FK" to create one.</div>
                 )}
               </div>
               <div className="h-64 border-t bg-gray-50 overflow-auto">
                 {renderForeignKeyProperties()}
               </div>
            </div>
         )}
         
         {activeTab === 'triggers' && (
            <div className="flex flex-col h-full">
               <div className="flex-1 overflow-auto">
                 <table className="min-w-full border-collapse text-sm">
                   <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
                     <tr>
                       <th className="border p-2 w-10"></th>
                       <th className="border p-2 text-left">Name</th>
                       <th className="border p-2 text-left">Timing</th>
                       <th className="border p-2 text-left">Event</th>
                       <th className="border p-2 text-left">Created</th>
                       <th className="border p-2 text-center w-10">Op</th>
                     </tr>
                   </thead>
                   <tbody>
                     {triggers.map((trigger, i) => (
                       <tr key={i} className="hover:bg-blue-50">
                         <td className="border p-1 text-center text-gray-400 text-xs">{i+1}</td>
                         <td className="border p-1 font-mono">{trigger.Trigger}</td>
                         <td className="border p-1">{trigger.Timing}</td>
                         <td className="border p-1">{trigger.Event}</td>
                         <td className="border p-1 text-gray-500 text-xs">{trigger.Created || '-'}</td>
                         <td className="border p-1 text-center">
                           <button onClick={() => handleDeleteTrigger(trigger.Trigger)} className="text-red-500 hover:text-red-700">
                             <Trash2 size={14} />
                           </button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
                 {triggers.length === 0 && (
                   <div className="p-8 text-center text-gray-400">No triggers defined. Click "Add Trigger" to create one.</div>
                 )}
               </div>
               
               {/* Trigger Details Panel */}
               {triggers.length > 0 && (
                 <div className="h-48 border-t bg-gray-50 overflow-auto p-4">
                   <h4 className="font-medium mb-2 text-sm">Trigger Statements</h4>
                   {triggers.map((trigger, i) => (
                     <div key={i} className="mb-3">
                       <div className="text-xs font-medium text-gray-600">{trigger.Trigger}:</div>
                       <pre className="bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto">{trigger.Statement}</pre>
                     </div>
                   ))}
                 </div>
               )}
               
               {/* Create Trigger Modal */}
               {showTriggerModal && (
                 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                   <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] overflow-auto">
                     <div className="flex items-center justify-between p-4 border-b">
                       <h3 className="font-semibold">Create Trigger</h3>
                       <button onClick={() => setShowTriggerModal(false)} className="text-gray-500 hover:text-gray-700">
                         <X size={18} />
                       </button>
                     </div>
                     <div className="p-4 space-y-4">
                       <div className="flex flex-col gap-1">
                         <label className="text-sm font-medium">Trigger Name</label>
                         <input 
                           className="border rounded p-2"
                           value={newTrigger.name}
                           onChange={(e) => setNewTrigger(prev => ({ ...prev, name: e.target.value }))}
                           placeholder="trigger_name"
                         />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                         <div className="flex flex-col gap-1">
                           <label className="text-sm font-medium">Timing</label>
                           <select 
                             className="border rounded p-2"
                             value={newTrigger.timing}
                             onChange={(e) => setNewTrigger(prev => ({ ...prev, timing: e.target.value }))}
                           >
                             {TRIGGER_TIMINGS.map(t => <option key={t} value={t}>{t}</option>)}
                           </select>
                         </div>
                         <div className="flex flex-col gap-1">
                           <label className="text-sm font-medium">Event</label>
                           <select 
                             className="border rounded p-2"
                             value={newTrigger.event}
                             onChange={(e) => setNewTrigger(prev => ({ ...prev, event: e.target.value }))}
                           >
                             {TRIGGER_EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
                           </select>
                         </div>
                       </div>
                       <div className="flex flex-col gap-1">
                         <label className="text-sm font-medium">Statement</label>
                         <textarea 
                           className="border rounded p-2 font-mono text-sm h-32"
                           value={newTrigger.statement}
                           onChange={(e) => setNewTrigger(prev => ({ ...prev, statement: e.target.value }))}
                           placeholder="BEGIN&#10;  -- Your trigger logic here&#10;END"
                         />
                         <span className="text-xs text-gray-400">Enter the trigger body (BEGIN...END block or single statement)</span>
                       </div>
                       <div className="bg-gray-100 p-3 rounded text-xs font-mono">
                         <span className="text-gray-500">Preview: </span>
                         CREATE TRIGGER `{newTrigger.name || 'trigger_name'}` {newTrigger.timing} {newTrigger.event} ON `{tableName}` FOR EACH ROW {newTrigger.statement || '...'}
                       </div>
                     </div>
                     <div className="flex justify-end gap-2 p-4 border-t">
                       <button onClick={() => setShowTriggerModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
                         Cancel
                       </button>
                       <button onClick={handleCreateTrigger} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                         Create Trigger
                       </button>
                     </div>
                   </div>
                 </div>
               )}
            </div>
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
            <div className="flex flex-col h-full p-4">
               <div className="flex items-center justify-between mb-2">
                 <h4 className="font-medium text-sm text-gray-600">
                   {isNewTable ? 'CREATE TABLE Statement' : 'ALTER TABLE Statement'}
                 </h4>
                 <button 
                   onClick={() => {
                     navigator.clipboard.writeText(generateSqlPreview());
                     alert('SQL copied to clipboard!');
                   }}
                   className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                 >
                   Copy SQL
                 </button>
               </div>
               <pre className="flex-1 bg-gray-900 text-green-400 p-4 rounded overflow-auto text-sm font-mono whitespace-pre-wrap">
                  {generateSqlPreview()}
               </pre>
            </div>
         )}
      </div>
    </div>
  );
}
