import mysql from 'mysql2/promise';
import crypto from 'crypto';

interface ConnectionMap {
  [id: string]: mysql.Connection;
}

const connections: ConnectionMap = {};

export async function connect(config: mysql.ConnectionOptions): Promise<string> {
  const id = crypto.randomUUID();
  const connection = await mysql.createConnection(config);
  connections[id] = connection;
  return id;
}

export async function query(id: string, sql: string, params?: any[], database?: string) {
  const connection = connections[id];
  if (!connection) {
    throw new Error('Connection not found');
  }

  if (database) {
    await connection.query(`USE \`${database}\``);
  }

  // Use .query() instead of .execute() to support all SQL commands (text protocol)
  // .execute() uses prepared statements which has limitations (e.g. some DDLs, multiple statements if not carefully handled)
  const [results, fields] = await connection.query(sql, params);
  return { results, fields };
}

export async function listDatabases(id: string) {
  const { results } = await query(id, 'SHOW DATABASES');
  return (results as any[]).map((row: any) => Object.values(row)[0] as string);
}

export async function listTables(id: string, database: string) {
  // Switch to database first? Or use FROM?
  // connection.changeUser({ database }) might be better but let's just query
  // Or SHOW TABLES FROM `database`
  const { results } = await query(id, `SHOW TABLES FROM \`${database}\``);
  return (results as any[]).map((row: any) => Object.values(row)[0] as string);
}

export async function getTableExtendedInfo(id: string, database: string, table: string) {
  // Parallel fetch for efficiency
  const [
    { results: columns },
    { results: indexes },
    { results: tableStatus },
    { results: foreignKeys }
  ] = await Promise.all([
    query(id, `SHOW FULL COLUMNS FROM \`${database}\`.\`${table}\``),
    query(id, `SHOW INDEX FROM \`${database}\`.\`${table}\``),
    query(id, `SHOW TABLE STATUS FROM \`${database}\` LIKE '${table}'`),
    query(id, `
      SELECT 
        CONSTRAINT_NAME, 
        COLUMN_NAME, 
        REFERENCED_TABLE_NAME, 
        REFERENCED_COLUMN_NAME 
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [database, table])
  ]);

  return {
    columns,
    indexes,
    tableStatus: (tableStatus as any[])[0], // Should be only one row
    foreignKeys
  };
}

export async function getTableStructure(id: string, database: string, table: string) {
  const { results } = await query(id, `SHOW FULL COLUMNS FROM \`${database}\`.\`${table}\``);
  return results;
}

export async function getDatabaseStatus(id: string, database: string) {
  const { results } = await query(id, `SHOW TABLE STATUS FROM \`${database}\``);
  return results;
}

export async function executeSqlFile(id: string, database: string, sqlContent: string) {
  // Simple implementation: Split by semicolon. 
  // NOTE: This is naive and will break on stored procedures or strings containing semicolons.
  // A robust implementation requires a proper SQL parser.
  // For MVP, we'll try to split by ";\n" or just execute chunks if possible.
  // mysql2 supports multiple statements if enabled, let's enable it in connection config or use it here.
  
  const connection = connections[id];
  if (!connection) {
    throw new Error('Connection not found');
  }

  // Ensure we are using the correct database for this connection session
  await connection.query(`USE \`${database}\``);
  
  // Better approach for MVP:
  // 1. Read file content (done in main process)
  // 2. Split by semicolon (naive)
  // 3. Execute one by one.
  
  const statements = sqlContent.split(/;\s*$/m);
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await connection.query(statement);
      } catch (err: any) {
         // Log error but maybe continue or throw?
         // For now throw to stop execution
         console.error("SQL Error:", err.message, "Statement:", statement);
         throw err;
      }
    }
  }
  return true;
}

export async function exportDatabase(id: string, database: string, includeData: boolean) {
  let dump = `-- Database: ${database}\n-- Exported: ${new Date().toLocaleString()}\n\n`;
  dump += `CREATE DATABASE IF NOT EXISTS \`${database}\`;\n`;
  dump += `USE \`${database}\`;\n\n`;

  // Get tables
  const tables = await listTables(id, database);

  for (const table of tables) {
    // Structure
    const { results: createRes } = await query(id, `SHOW CREATE TABLE \`${database}\`.\`${table}\``);
    const createTableSql = (createRes as any[])[0]['Create Table'];
    dump += `-- Table structure for ${table}\n`;
    dump += `DROP TABLE IF EXISTS \`${table}\`;\n`;
    dump += `${createTableSql};\n\n`;

    // Data
    if (includeData) {
      const { results: rows } = await query(id, `SELECT * FROM \`${database}\`.\`${table}\``);
      if ((rows as any[]).length > 0) {
        dump += `-- Dumping data for ${table}\n`;
        const values: string[] = [];
        
        for (const row of (rows as any[])) {
           const rowValues = Object.values(row).map(val => {
             if (val === null) return 'NULL';
             if (typeof val === 'number') return val;
             // Escape strings
             return `'${String(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
           });
           values.push(`(${rowValues.join(', ')})`);
        }
        
        // Batch insert? For now, one huge insert or split.
        // Let's do simple single statement if small, or split.
        // For MVP, simple join.
        dump += `INSERT INTO \`${table}\` VALUES ${values.join(',\n')};\n\n`;
      }
    }
  }

  return dump;
}

export async function updateRow(id: string, database: string, table: string, primaryKey: { col: string, val: any }, updates: Record<string, any>) {
  const connection = connections[id];
  if (!connection) {
    throw new Error('Connection not found');
  }

  // Construct UPDATE statement
  // UPDATE table SET col1=?, col2=? WHERE pk=?
  const setClauses: string[] = [];
  const params: any[] = [];
  
  for (const [col, val] of Object.entries(updates)) {
    setClauses.push(`\`${col}\` = ?`);
    params.push(val);
  }
  
  if (setClauses.length === 0) return true; // No changes
  
  const sql = `UPDATE \`${database}\`.\`${table}\` SET ${setClauses.join(', ')} WHERE \`${primaryKey.col}\` = ?`;
  params.push(primaryKey.val);
  
  await connection.execute(sql, params);
  return true;
}

export async function getDatabaseInfo(id: string, database: string) {
  const { results } = await query(id, `SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`, [database]);
  return (results as any[])[0];
}

export async function getTableData(id: string, database: string, table: string, limit: number, offset: number, filters: any[] = []) {
  let whereClause = '';
  const params: any[] = [];

  if (filters.length > 0) {
    const conditions = filters.map(filter => {
      const { column, operator, value } = filter;
      const safeCol = `\`${column}\``;
      
      switch (operator) {
        case 'IS NULL':
          return `${safeCol} IS NULL`;
        case 'IS NOT NULL':
          return `${safeCol} IS NOT NULL`;
        case 'Is Empty':
          return `${safeCol} = ''`;
        case 'Is Not Empty':
          return `${safeCol} != ''`;
        case 'LIKE': // Raw LIKE if needed
          params.push(value);
          return `${safeCol} LIKE ?`;
        case 'Contains':
          params.push(`%${value}%`);
          return `${safeCol} LIKE ?`;
        case 'Not Contains':
          params.push(`%${value}%`);
          return `${safeCol} NOT LIKE ?`;
        case 'Starts With':
          params.push(`${value}%`);
          return `${safeCol} LIKE ?`;
        case 'Not Starts With':
          params.push(`${value}%`);
          return `${safeCol} NOT LIKE ?`;
        case 'Ends With':
          params.push(`%${value}`);
          return `${safeCol} LIKE ?`;
        case 'Not Ends With':
          params.push(`%${value}`);
          return `${safeCol} NOT LIKE ?`;
        case 'IN':
        case 'NOT IN': {
          // value should be comma separated string "1, 2, 'a'"
          const inValues = String(value).split(',').map(v => v.trim());
          params.push(inValues);
          return `${safeCol} ${operator} (?)`;
        }
        case 'Between':
        case 'Not Between': {
          // Expect value "val1, val2"
          const parts = String(value).split(',').map(v => v.trim());
          if (parts.length >= 2) {
             params.push(parts[0]);
             params.push(parts[1]);
             return `${safeCol} ${operator.toUpperCase()} ? AND ?`;
          } else {
             // Fallback or ignore
             params.push(value);
             return `${safeCol} = ?`; 
          }
        }
        default:
          params.push(value);
          return `${safeCol} ${operator} ?`;
      }
    });
    whereClause = 'WHERE ' + conditions.join(' AND ');
  }

  // Combine query
  const sql = `SELECT * FROM \`${database}\`.\`${table}\` ${whereClause} LIMIT ? OFFSET ?`;
  // Add limit/offset to params
  const queryParams = [...params, limit, offset];
  
  // Use connection.query which handles IN (?) expansion correctly
  const { results: rows } = await query(id, sql, queryParams);
  
  // Count total with filters
  const countSql = `SELECT COUNT(*) as total FROM \`${database}\`.\`${table}\` ${whereClause}`;
  const { results: count } = await query(id, countSql, params);
  
  return { 
    results: rows, 
    total: (count as any[])[0].total 
  };
}

export async function getCharsets(id: string) {
  const { results } = await query(id, 'SHOW CHARACTER SET');
  return results;
}

export async function getCollations(id: string) {
  const { results } = await query(id, 'SHOW COLLATION');
  return results;
}

export async function alterDatabase(id: string, database: string, charset: string, collation: string) {
  const connection = connections[id];
  if (!connection) throw new Error('Connection not found');
  await connection.query(`ALTER DATABASE \`${database}\` CHARACTER SET ${charset} COLLATE ${collation}`);
  return true;
}

export async function truncateTable(id: string, database: string, table: string) {
  const connection = connections[id];
  if (!connection) throw new Error('Connection not found');
  await connection.query(`TRUNCATE TABLE \`${database}\`.\`${table}\``);
  return true;
}

export async function dropTable(id: string, database: string, table: string) {
  const connection = connections[id];
  if (!connection) throw new Error('Connection not found');
  await connection.query(`DROP TABLE \`${database}\`.\`${table}\``);
  return true;
}

export async function renameTable(id: string, database: string, oldName: string, newName: string) {
  const connection = connections[id];
  if (!connection) throw new Error('Connection not found');
  await connection.query(`RENAME TABLE \`${database}\`.\`${oldName}\` TO \`${database}\`.\`${newName}\``);
  return true;
}

export async function insertRow(id: string, database: string, table: string, data: Record<string, any>) {
  const connection = connections[id];
  if (!connection) throw new Error('Connection not found');
  
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = new Array(values.length).fill('?').join(', ');
  
  const sql = `INSERT INTO \`${database}\`.\`${table}\` (\`${columns.join('`, `')}\`) VALUES (${placeholders})`;
  await connection.execute(sql, values);
  return true;
}

export async function deleteRows(id: string, database: string, table: string, primaryKeyCol: string, keys: any[]) {
  const connection = connections[id];
  if (!connection) throw new Error('Connection not found');
  
  if (keys.length === 0) return true;

  // Use connection.query for IN clause expansion
  // mysql2 .query supports arrays for IN (?)
  const sql = `DELETE FROM \`${database}\`.\`${table}\` WHERE \`${primaryKeyCol}\` IN (?)`;
  await connection.query(sql, [keys]);
  return true;
}

export async function exportTable(id: string, database: string, table: string) {
  let dump = `-- Table: ${table}\n-- Exported: ${new Date().toLocaleString()}\n\n`;
  dump += `USE \`${database}\`;\n\n`;

  // Structure
  const { results: createRes } = await query(id, `SHOW CREATE TABLE \`${database}\`.\`${table}\``);
  const createTableSql = (createRes as any[])[0]['Create Table'];
  dump += `-- Table structure for ${table}\n`;
  dump += `DROP TABLE IF EXISTS \`${table}\`;\n`;
  dump += `${createTableSql};\n\n`;

  // Data
  const { results: rows } = await query(id, `SELECT * FROM \`${database}\`.\`${table}\``);
  if ((rows as any[]).length > 0) {
    dump += `-- Dumping data for ${table}\n`;
    const values: string[] = [];
    
    for (const row of (rows as any[])) {
       const rowValues = Object.values(row).map(val => {
         if (val === null) return 'NULL';
         if (typeof val === 'number') return val;
         return `'${String(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
       });
       values.push(`(${rowValues.join(', ')})`);
    }
    dump += `INSERT INTO \`${table}\` VALUES ${values.join(',\n')};\n\n`;
  }

  return dump;
}

export async function saveTableStructure(
  id: string,
  database: string,
  oldTableName: string,
  newTableName: string,
  columns: any[],
  indexes: any[],
  foreignKeys: any[],
  options: any,
  isNew: boolean
) {
  const connection = connections[id];
  if (!connection) throw new Error('Connection not found');
  
  await connection.query(`USE \`${database}\``);

  const buildColumnDef = (col: any) => {
    let def = `\`${col.Field}\` ${col.Type}`;
    
    if (col.Unsigned && !col.Type.toLowerCase().includes('unsigned')) def += ' UNSIGNED';
    if (col.Zerofill && !col.Type.toLowerCase().includes('zerofill')) def += ' ZEROFILL';

    if (col.Charset && col.Charset !== 'Default') {
        def += ` CHARACTER SET ${col.Charset}`;
    }
    if (col.Collation && col.Collation !== 'Default') {
        def += ` COLLATE ${col.Collation}`;
    }

    if (col.Null === 'NO') def += ' NOT NULL';
    else def += ' NULL';

    if (col.Default !== null && col.Default !== undefined && col.Default !== '') {
       if (col.Default === 'CURRENT_TIMESTAMP') def += ` DEFAULT CURRENT_TIMESTAMP`;
       else if (col.Default === 'NULL') def += ` DEFAULT NULL`;
       else def += ` DEFAULT '${col.Default}'`;
    } else if (col.Null === 'YES' && (col.Default === null || col.Default === 'NULL')) {
       def += ' DEFAULT NULL';
    }

    if (col.Extra) def += ` ${col.Extra}`;
    if (col.Comment) def += ` COMMENT '${col.Comment}'`;
    
    return def;
  };

  // Group indexes by Key_name to handle composite indexes (though MVP UI might only support single)
  const groupIndexes = (idxs: any[]) => {
     const groups: Record<string, any[]> = {};
     for (const idx of idxs) {
        if (!groups[idx.Key_name]) groups[idx.Key_name] = [];
        groups[idx.Key_name].push(idx);
     }
     return groups;
  };

  const buildIndexDef = (keyName: string, idxParts: any[]) => {
      // Sort by Seq_in_index just in case
      idxParts.sort((a, b) => a.Seq_in_index - b.Seq_in_index);
      const cols = idxParts.map(p => `\`${p.Column_name}\``).join(', ');
      const first = idxParts[0];
      
      if (keyName === 'PRIMARY') {
          return `PRIMARY KEY (${cols})`;
      } else if (first.IndexKind === 'UNIQUE') {
          return `UNIQUE KEY \`${keyName}\` (${cols})`;
      } else if (first.IndexKind === 'FULLTEXT') {
          return `FULLTEXT KEY \`${keyName}\` (${cols})`;
      } else {
          return `KEY \`${keyName}\` (${cols}) USING ${first.Index_type}`;
      }
  };

  if (isNew) {
    let sql = `CREATE TABLE \`${database}\`.\`${newTableName}\` (\n`;
    const lines: string[] = [];

    // Columns
    for (const col of columns) {
      lines.push('  ' + buildColumnDef(col));
    }

    // Indexes
    const idxGroups = groupIndexes(indexes);
    for (const [keyName, parts] of Object.entries(idxGroups)) {
        lines.push('  ' + buildIndexDef(keyName, parts));
    }

    sql += lines.join(',\n');
    sql += `\n) ENGINE=${options.Engine || 'InnoDB'} DEFAULT CHARSET=${options.Charset || 'utf8mb4'} COLLATE=${options.Collation || 'utf8mb4_general_ci'}`;
    
    if (options.Comment) sql += ` COMMENT='${options.Comment}'`;
    if (options.Auto_increment) sql += ` AUTO_INCREMENT=${options.Auto_increment}`;

    await connection.query(sql);

  } else {
    // ALTER TABLE Logic
    // 1. Rename if needed
    if (oldTableName !== newTableName) {
       await renameTable(id, database, oldTableName, newTableName);
       oldTableName = newTableName; // Update ref
    }
    
    // Fetch current info
     const currentInfo = await getTableExtendedInfo(id, database, oldTableName);
     const currentCols = currentInfo.columns as any[];
     const currentIndexes = currentInfo.indexes as any[];
     
     const alters: string[] = [];
    
    // Columns
    const processedCurrentCols = new Set<string>();
    
    for (const col of columns) {
       if (col.isNew) {
          alters.push(`ADD COLUMN ${buildColumnDef(col)}`);
       } else {
          // Find original column
          const originalName = col.originalField || col.Field;
          const current = currentCols.find((c: any) => c.Field === originalName);
          
          if (current) {
             processedCurrentCols.add(current.Field);
             // Check for changes. This is loose comparison.
             // Ideally we compare every field. 
             // For MVP, always MODIFY/CHANGE if not new? No, too slow/risky.
             // Let's compare simplified strings or key props.
             const nameChanged = col.Field !== current.Field;
             
             // Reconstruct basic current type string to compare? Hard.
             // Let's just assume if it's in the list and not new, we verify if "Dirty".
             // But logic is in backend.
             // Let's blindly MODIFY if name same, CHANGE if name different.
             // It's safer to ensure definition is correct.
             
             if (nameChanged) {
                 alters.push(`CHANGE COLUMN \`${current.Field}\` ${buildColumnDef(col)}`);
             } else {
                 // Always MODIFY to ensure properties match UI? 
                 // Or try to detect?
                 // Let's MODIFY. MySQL handles no-op modify gracefully usually (or just fast).
                 alters.push(`MODIFY COLUMN ${buildColumnDef(col)}`);
             }
          } else {
             // Fallback: treated as new if not found
             alters.push(`ADD COLUMN ${buildColumnDef(col)}`);
          }
       }
    }
    
    // Drop removed columns
    for (const c of currentCols) {
       if (!processedCurrentCols.has(c.Field)) {
          // Check if it was renamed (handled above via originalField).
          // If not in processedCurrentCols, it means it's not in the new `columns` list matching any originalField.
          // So it was deleted.
          alters.push(`DROP COLUMN \`${c.Field}\``);
       }
    }
    
    // Indexes
    // Simplified: Drop all old indexes (except PRIMARY if not changed? no, just drop/add) and Add new ones.
    // This is inefficient but robust for structure correctness.
    // Actually, DROP INDEX then ADD INDEX.
    
    const oldGroups = groupIndexes(currentIndexes);
    const newGroups = groupIndexes(indexes);
    
    // Drop removed or changed indexes
    for (const key of Object.keys(oldGroups)) {
        if (!newGroups[key]) {
            if (key === 'PRIMARY') alters.push(`DROP PRIMARY KEY`);
            else alters.push(`DROP INDEX \`${key}\``);
        } else {
            // Exists in both. Compare?
            // For MVP, Drop and Re-add is safest to ensure definition matches.
            // But dropping PRIMARY KEY is annoying if auto_increment exists.
            // MySQL Error: Incorrect table definition; there can be only one auto column and it must be defined as a key.
            // If we drop PK, we must ensure AI is removed or handled? 
            // Actually `MODIFY COLUMN` happens before `DROP KEY`? 
            // Order of operations in ALTER TABLE matters.
            
            // To be safe:
            // 1. If PK changed, we might have issues with AI.
            // Let's skip diffing PK for now if it looks same?
            // Or just hope MySQL accepts `DROP PRIMARY KEY, ADD PRIMARY KEY (...)` in one statement.
            
            if (key === 'PRIMARY') alters.push(`DROP PRIMARY KEY`);
            else alters.push(`DROP INDEX \`${key}\``);
        }
    }
    
    // Add new indexes
    for (const [key, parts] of Object.entries(newGroups)) {
         // If we dropped it above, we re-add it here.
         // If it's brand new, we add it.
         alters.push(`ADD ${buildIndexDef(key, parts)}`);
    }
    
    // Options
    // Always update options
    const optionSql = [];
    if (options.Engine) optionSql.push(`ENGINE=${options.Engine}`);
    if (options.Charset) optionSql.push(`DEFAULT CHARSET=${options.Charset}`);
    if (options.Collation) optionSql.push(`COLLATE=${options.Collation}`);
    if (options.Comment) optionSql.push(`COMMENT='${options.Comment}'`);
    if (options.Auto_increment) optionSql.push(`AUTO_INCREMENT=${options.Auto_increment}`);
    if (options.Row_format) optionSql.push(`ROW_FORMAT=${options.Row_format}`);
    
    if (optionSql.length > 0) {
        alters.push(optionSql.join(' '));
    }
    
    if (alters.length > 0) {
        const sql = `ALTER TABLE \`${database}\`.\`${oldTableName}\` ${alters.join(',\n')}`;
        // console.log("Executing ALTER:", sql);
        await connection.query(sql);
    }
  }
}

export async function close(id: string) {
  const connection = connections[id];
  if (connection) {
    await connection.end();
    delete connections[id];
  }
}

export function getConnection(id: string) {
  return connections[id];
}
