I will implement a mechanism to force refresh the data view when a table is truncated.

### 1. Update `Sidebar.tsx`
*   Update `SidebarProps` interface for `onSelectTable` to accept an optional `forceRefresh` boolean.
*   In `handleTruncateTable`, call `onSelectTable(..., true)` upon success.

### 2. Update `App.tsx`
*   Update `handleSelectTable` to accept the `forceRefresh` argument.
*   If the tab exists and `forceRefresh` is true, update the tab's data with a new `refreshKey` (timestamp).
*   Pass `refreshKey` from `tab.data` to the `DataViewer` component props.

### 3. Update `DataViewer.tsx`
*   Add `refreshKey` to `DataViewerProps`.
*   Add `refreshKey` to the `useEffect` dependencies list that triggers `fetchData`.

This ensures that when a truncate operation completes, the DataViewer receives a new prop value, triggering a data reload.
