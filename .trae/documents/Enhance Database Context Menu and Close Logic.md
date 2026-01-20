I will modify the database context menu and closing logic as requested.

### 1. Update `Sidebar.tsx`
*   **Props**: Add `onCloseDatabase` callback prop.
*   **Context Menu**:
    *   Reorder items: Place "Close Database" at the very top.
    *   Conditional "New Table": Only show "New Table" if the database is currently open (checking `openDatabases` state).
*   **Logic**: In `handleCloseDatabase`, call the new `onCloseDatabase` prop to notify the parent component.

### 2. Update `App.tsx`
*   **Implement `handleCloseDatabase`**: Create a function that closes all tabs associated with the specific connection ID and database name.
*   **Pass Prop**: Pass this function to the `Sidebar` component.

### 3. Verify
*   Ensure that closing a database removes it from the sidebar's open state AND closes relevant tabs in the main area.
*   Ensure "New Table" is hidden for closed databases.
