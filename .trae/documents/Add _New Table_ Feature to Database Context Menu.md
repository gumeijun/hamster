I will add a "New Table" option to the database context menu in the Sidebar, which will open the Table Designer for a new table.

### 1. Update Database Context Menu (`src/components/Sidebar.tsx`)
*   Add a new menu item **"New Table"** to the `dbContextMenu`.
*   This option will trigger a `handleNewTable` function.

### 2. Implement `handleNewTable`
*   This function will call `onDesignTable` with the current connection ID, database name, and a temporary/placeholder table name (e.g., `new_table` or simply empty string/null to indicate creation mode).
*   **Note**: The current `TableDesigner` takes a `table` prop. We may need to support an "empty" table name to indicate creating a new table, or pass a specific flag. For simplicity, passing a placeholder like `Untitled` or handling `table={undefined}` in `App.tsx` and `TableDesigner` is the way to go.
    *   Let's check `App.tsx` and `TableDesigner` logic. `TableDesigner` fetches structure on load. If table is new, it should start empty.

### 3. Update `TableDesigner` (`src/components/TableDesigner.tsx`)
*   Update `fetchStructure` to handle the case where the table doesn't exist yet (creation mode).
    *   If `table` prop implies a new table (e.g., passed as empty or via a new `isCreate` prop), skip fetching `getTableExtendedInfo` and start with a default empty column list.
*   Update `handleSave` to support `CREATE TABLE` instead of `ALTER TABLE` (though user input for save logic is `alert` currently, we should prepare the state for it).

### 4. Update `App.tsx`
*   Ensure `handleDesignTable` can accept a "new table" indicator. The current `handleDesignTable` sets `currentTable` state. If we pass a special value or add a flag, `TableDesigner` needs to know.
*   We can reuse the existing routing: `onDesignTable(connId, db, "")` (empty string for table name).

**Refined Plan**:
1.  **Sidebar**: Add "New Table" button to DB context menu. Calls `onDesignTable(connId, db, "")`.
2.  **App**: Handle empty table name in `handleDesignTable` -> opens `TableDesigner`.
3.  **TableDesigner**:
    *   Check if `table` is empty string.
    *   If empty, skip `fetchStructure` and initialize with one default column.
    *   Update UI title to "New Table".
