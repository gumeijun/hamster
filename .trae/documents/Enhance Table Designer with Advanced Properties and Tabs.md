I will enhance the **Table Designer** to support comprehensive table design features, including detailed field properties, indexes, foreign keys, and table options.

### Backend Updates (`electron/db.ts` & `main.ts`)
1.  **Extended Table Info**: Create a new function `getTableExtendedInfo` (and corresponding IPC handler `db:get-table-extended-info`) to fetch all table metadata in parallel:
    *   **Columns**: `SHOW FULL COLUMNS` (Existing)
    *   **Indexes**: `SHOW INDEX`
    *   **Foreign Keys**: Query `information_schema.KEY_COLUMN_USAGE`
    *   **Table Options**: `SHOW TABLE STATUS` (Engine, Auto Increment, Charset, Collation, Row Format, Comment)
2.  **Helpers**: Ensure `getCharsets` and `getCollations` are available for the frontend dropdowns.

### Frontend Updates (`src/components/TableDesigner.tsx`)
1.  **Layout Restructuring**:
    *   Introduce a **Tabbed Interface** at the top: `Fields`, `Indexes`, `Foreign Keys`, `Triggers`, `Options`, `Comments`, `SQL Preview`.
2.  **Fields Tab (Enhanced)**:
    *   Add a **Properties Panel** at the bottom of the column list.
    *   **Numeric Types** (`int`, `bigint`, etc.): Show controls for `Unsigned`, `Zerofill`, `Auto Increment`, and `Default Value`.
    *   **String Types** (`varchar`, `text`, etc.): Show controls for `Charset`, `Collation`, and `Default Value`.
3.  **New Tabs Implementation**:
    *   **Indexes**: UI to list, add, and remove indexes (Primary, Unique, Normal, Fulltext).
    *   **Foreign Keys**: UI to list and manage foreign key constraints.
    *   **Triggers**: A placeholder list view for triggers (as "options" were requested).
    *   **Options**: Form to configure table-level settings: `Engine`, `Tablespace` (placeholder), `Auto Increment`, `Default Charset`, `Default Collation`, `Row Format`.
    *   **Comments**: Text area for the table comment.
    *   **SQL Preview**: Real-time generation of the `CREATE TABLE` or `ALTER TABLE` SQL based on current design state.

This plan focuses on enabling the **UI configuration** and **data retrieval** for these advanced settings.
