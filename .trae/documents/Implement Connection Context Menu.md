I will implement the context menu for connection items in the sidebar.

### 1. Update `Sidebar.tsx`
*   **State**: Add state for `connectionContextMenu` (visible, x, y, connectionId).
*   **Event Handler**: Add `handleConnectionContextMenu` to capture right-click events on connection items.
*   **Actions**:
    *   **Edit Connection**: Open `ConnectionModal` with the selected connection's data pre-filled.
    *   **Delete Connection**: Prompt for confirmation and call `removeConnection` from the store.
*   **UI**: Render the context menu when `connectionContextMenu` is visible.

### 2. Update `ConnectionModal.tsx` (if needed)
*   Ensure it can handle editing mode (receiving an existing config to populate fields).
*   *Self-correction*: I should check `ConnectionModal` implementation. It likely needs an `initialConfig` prop or similar.

### 3. Verify
*   Right-click a connection -> Menu appears.
*   "Edit Connection" -> Opens modal with data -> Save updates the store.
*   "Delete Connection" -> Confirms -> Removes from list.
