I will enhance the **Indexes** and **Options** tabs in the Table Designer with better interactive controls and a properties panel.

### 1. Indexes Tab Enhancements
*   **Interactive Controls**:
    *   Add an **"Add Index"** button to the toolbar when the Indexes tab is active.
    *   Change the **Index Type** column to a dropdown (Primary, Unique, Normal, Fulltext).
    *   Change the **Index Method** column to a dropdown (BTREE, HASH, etc.).
*   **Properties Panel**:
    *   Implement a bottom properties panel for indexes (similar to the Fields tab).
    *   When an index is selected from the list, allow editing its **Name**, **Columns**, **Index Type**, **Index Method**, and **Comment**.

### 2. Options Tab Enhancements
*   **Dropdown Selection**:
    *   Convert static inputs to dropdowns for:
        *   **Engine** (InnoDB, MyISAM, etc.).
        *   **Tablespace** (if applicable).
        *   **Default Charset** (integrated with existing charset data).
        *   **Default Collation** (integrated with existing collation data).
        *   **Row Format** (Default, Dynamic, Fixed, Compressed, Redundant, Compact).

### 3. State Management
*   Update `IndexDefinition` and `TableOptions` state handling to allow local modifications (setting `isDirty` to true).
*   Ensure the selected index index is tracked to populate the bottom panel.
