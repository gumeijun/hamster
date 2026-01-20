I will implement a filtering feature in the Data Viewer.

### 1. Update `DataViewer.tsx` State
*   Add state `filterConditions`: Array of `{ column, operator, value }`.
*   Add state `isFilterVisible`: Boolean to toggle the filter panel.

### 2. Implement Filter UI
*   Add a **"Filter"** button next to the "Add Record" button.
*   When clicked, show a panel below the toolbar.
*   **Filter Panel**:
    *   List of current conditions.
    *   Each condition:
        *   **Checkbox**: Enable/Disable.
        *   **Column Dropdown**: Select from `columns`.
        *   **Operator Dropdown**: `=`, `!=`, `>`, `<`, `>=`, `<=`, `LIKE`, `IN`, `IS NULL`, `IS NOT NULL`.
        *   **Value Input**: Text input (hidden for `IS NULL`/`IS NOT NULL`).
        *   **Remove Button**: Remove this condition.
    *   **Add Condition Button**: Add a new empty condition.
    *   **Apply Filter Button**: Trigger data fetch with filters.

### 3. Backend Integration (`db.ts` & `main.ts`)
*   Update `getTableData` (and `db:get-table-data` handler) to accept a `filters` parameter.
*   In `db.ts`, construct the `WHERE` clause dynamically based on the filters.
    *   Use parameterized queries to prevent SQL injection.
    *   Handle `LIKE` with wildcards if needed (or let user type them).
    *   Handle `IN` by splitting comma-separated values.

### 4. Refine Data Fetching in `DataViewer.tsx`
*   Pass the active `filterConditions` to `window.ipcRenderer.invoke('db:get-table-data', ...)` inside `fetchData`.

**Refined Plan**:
1.  **Backend**: Update `db.ts` `getTableData` to support `filters`.
2.  **Backend**: Update `main.ts` handler.
3.  **Frontend**: Update `DataViewer.tsx` with Filter UI and logic.
