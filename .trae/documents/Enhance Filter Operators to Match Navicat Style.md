I will update the filter operators in the Data Viewer to match the user's provided screenshot, adding support for advanced text matching and range queries.

### 1. Update Frontend Operators (`DataViewer.tsx`)
*   **Expand `OPERATORS` list**: Update the constant to include:
    *   `=` (Equal)
    *   `!=` (Not Equal)
    *   `<`, `<=`, `>`, `>=`
    *   `Contains` (mapped to `LIKE %...%`)
    *   `Not Contains` (mapped to `NOT LIKE %...%`)
    *   `Starts With` (mapped to `LIKE ...%`)
    *   `Not Starts With` (mapped to `NOT LIKE ...%`)
    *   `Ends With` (mapped to `LIKE %...`)
    *   `Not Ends With` (mapped to `NOT LIKE %...`)
    *   `Is NULL`
    *   `Is Not NULL`
    *   `Is Empty` (mapped to `''`)
    *   `Is Not Empty` (mapped to `!=''`)
    *   `Between` (mapped to `BETWEEN ... AND ...`)
    *   `Not Between` (mapped to `NOT BETWEEN ... AND ...`)
    *   `In List` (mapped to `IN (...)`)
    *   `Not In List` (mapped to `NOT IN (...)`)

### 2. Update Backend Query Logic (`electron/db.ts`)
*   **Enhance `getTableData`**:
    *   Handle the new operator mappings.
    *   **Like Operations**: Construct `%` wildcards backend-side based on the operator type.
    *   **Empty Checks**: Handle `Is Empty` (`= ''`) and `Is Not Empty` (`!= ''` OR `IS NOT NULL` depending on strictness, usually just `!= ''`).
    *   **Between**: Expect the `value` to be two values (e.g., comma-separated or specific format) and split them for the `BETWEEN ? AND ?` clause.
    *   **In List**: Already partially handled, ensure `NOT IN` is also supported.

### 3. UI Adjustments
*   **Between Input**: If `Between` or `Not Between` is selected, show two input fields or a single field with a separator. For simplicity, we can parse a comma/space separated string first.

**Refined Plan**:
1.  **Frontend**: Update `OPERATORS` constant and labels.
2.  **Backend**: Refactor `getTableData` switch-case to handle the expanded logic (wildcards, between, empty checks).
