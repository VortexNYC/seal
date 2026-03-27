---
name: tanstack-table
description: Headless UI for building powerful tables & datagrids for TS/JS, React, Vue, Solid, Svelte, Qwik, Angular, and Lit.
---

<<<<<<< HEAD
=======

>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
## Overview

TanStack Table is a headless UI library for building data tables and datagrids. It provides logic for sorting, filtering, pagination, grouping, expanding, column pinning/ordering/visibility/resizing, and row selection - without rendering any markup or styles.

**Package:** `@tanstack/react-table`
**Utilities:** `@tanstack/match-sorter-utils` (fuzzy filtering)
**Current Version:** v8

## Installation

```bash
npm install @tanstack/react-table
```

## Core Architecture

### Building Blocks

1. **Column Definitions** - describe columns (data access, rendering, features)
2. **Table Instance** - central coordinator with state and APIs
3. **Row Models** - data processing pipeline (filter -> sort -> group -> paginate)
4. **Headers, Rows, Cells** - renderable units

### Critical: Data & Column Stability

```typescript
// WRONG - new references every render, causes infinite loops
const table = useReactTable({
  data: fetchedData.results,     // new ref!
  columns: [{ accessorKey: 'name' }], // new ref!
})

// CORRECT - stable references
const columns = useMemo(() => [...], [])
const data = useMemo(() => fetchedData?.results ?? [], [fetchedData])

const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })
```

## Column Definitions

### Using createColumnHelper (Recommended)

```typescript
import { createColumnHelper } from '@tanstack/react-table'

type Person = {
  firstName: string
  lastName: string
  age: number
  status: 'active' | 'inactive'
}

const columnHelper = createColumnHelper<Person>()

const columns = [
  // Accessor column (data column)
  columnHelper.accessor('firstName', {
    header: 'First Name',
    cell: info => info.getValue(),
    footer: info => info.column.id,
  }),

  // Accessor with function
  columnHelper.accessor(row => row.lastName, {
    id: 'lastName', // required with accessorFn
    header: () => <span>Last Name</span>,
    cell: info => <i>{info.getValue()}</i>,
  }),

  // Display column (no data, custom rendering)
  columnHelper.display({
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <button onClick={() => deleteRow(row.original)}>Delete</button>
    ),
  }),

  // Group column (nested headers)
  columnHelper.group({
    id: 'info',
    header: 'Info',
    columns: [
      columnHelper.accessor('age', { header: 'Age' }),
      columnHelper.accessor('status', { header: 'Status' }),
    ],
  }),
]
```

### Column Options

<<<<<<< HEAD
| Option            | Type                               | Description                                       |
| ----------------- | ---------------------------------- | ------------------------------------------------- |
| `id`              | `string`                           | Unique identifier (auto-derived from accessorKey) |
| `accessorKey`     | `string`                           | Dot-notation path to row data                     |
| `accessorFn`      | `(row) => any`                     | Custom accessor function                          |
| `header`          | `string \| (context) => ReactNode` | Header renderer                                   |
| `cell`            | `(context) => ReactNode`           | Cell renderer                                     |
| `footer`          | `(context) => ReactNode`           | Footer renderer                                   |
| `size`            | `number`                           | Default width (default: 150)                      |
| `minSize`         | `number`                           | Min width (default: 20)                           |
| `maxSize`         | `number`                           | Max width                                         |
| `enableSorting`   | `boolean`                          | Enable sorting                                    |
| `sortingFn`       | `string \| SortingFn`              | Sort function                                     |
| `enableFiltering` | `boolean`                          | Enable filtering                                  |
| `filterFn`        | `string \| FilterFn`               | Filter function                                   |
| `enableGrouping`  | `boolean`                          | Enable grouping                                   |
| `aggregationFn`   | `string \| AggregationFn`          | Aggregation function                              |
| `enableHiding`    | `boolean`                          | Enable visibility toggle                          |
| `enableResizing`  | `boolean`                          | Enable resizing                                   |
| `enablePinning`   | `boolean`                          | Enable pinning                                    |
| `meta`            | `any`                              | Custom metadata                                   |
=======
| Option | Type | Description |
|--------|------|-------------|
| `id` | `string` | Unique identifier (auto-derived from accessorKey) |
| `accessorKey` | `string` | Dot-notation path to row data |
| `accessorFn` | `(row) => any` | Custom accessor function |
| `header` | `string \| (context) => ReactNode` | Header renderer |
| `cell` | `(context) => ReactNode` | Cell renderer |
| `footer` | `(context) => ReactNode` | Footer renderer |
| `size` | `number` | Default width (default: 150) |
| `minSize` | `number` | Min width (default: 20) |
| `maxSize` | `number` | Max width |
| `enableSorting` | `boolean` | Enable sorting |
| `sortingFn` | `string \| SortingFn` | Sort function |
| `enableFiltering` | `boolean` | Enable filtering |
| `filterFn` | `string \| FilterFn` | Filter function |
| `enableGrouping` | `boolean` | Enable grouping |
| `aggregationFn` | `string \| AggregationFn` | Aggregation function |
| `enableHiding` | `boolean` | Enable visibility toggle |
| `enableResizing` | `boolean` | Enable resizing |
| `enablePinning` | `boolean` | Enable pinning |
| `meta` | `any` | Custom metadata |
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

## Table Instance

### Creating a Table

```typescript
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'

function MyTable() {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map(headerGroup => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <th key={header.id} onClick={header.column.getToggleSortingHandler()}>
                {header.isPlaceholder ? null :
                  flexRender(header.column.columnDef.header, header.getContext())}
                {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? null}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map(row => (
          <tr key={row.id}>
            {row.getVisibleCells().map(cell => (
              <td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

## Sorting

```typescript
const table = useReactTable({
  state: { sorting },
  onSortingChange: setSorting,
  getSortedRowModel: getSortedRowModel(),
  enableSorting: true,
  enableMultiSort: true,
  // manualSorting: true,  // For server-side sorting
<<<<<<< HEAD
});
=======
})
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

// Built-in sort functions: 'alphanumeric', 'text', 'datetime', 'basic'
// Column-level: sortingFn: 'alphanumeric'
```

## Filtering

### Column Filtering

```typescript
const table = useReactTable({
  state: { columnFilters },
  onColumnFiltersChange: setColumnFilters,
  getFilteredRowModel: getFilteredRowModel(),
  getFacetedRowModel: getFacetedRowModel(),
  getFacetedUniqueValues: getFacetedUniqueValues(),
  getFacetedMinMaxValues: getFacetedMinMaxValues(),
})

// Built-in: 'includesString', 'equalsString', 'arrIncludes', 'inNumberRange', etc.

// Filter UI
function Filter({ column }) {
  return (
    <input
      value={(column.getFilterValue() ?? '') as string}
      onChange={e => column.setFilterValue(e.target.value)}
      placeholder={`Filter... (${column.getFacetedUniqueValues()?.size})`}
    />
  )
}
```

### Global Filtering

```typescript
<<<<<<< HEAD
const [globalFilter, setGlobalFilter] = useState("");
=======
const [globalFilter, setGlobalFilter] = useState('')
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

const table = useReactTable({
  state: { globalFilter },
  onGlobalFilterChange: setGlobalFilter,
<<<<<<< HEAD
  globalFilterFn: "includesString",
  getFilteredRowModel: getFilteredRowModel(),
});
=======
  globalFilterFn: 'includesString',
  getFilteredRowModel: getFilteredRowModel(),
})
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
```

### Fuzzy Filtering

```typescript
<<<<<<< HEAD
import { rankItem } from "@tanstack/match-sorter-utils";

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value);
  addMeta({ itemRank });
  return itemRank.passed;
};

const table = useReactTable({
  filterFns: { fuzzy: fuzzyFilter },
  globalFilterFn: "fuzzy",
});
=======
import { rankItem } from '@tanstack/match-sorter-utils'

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank })
  return itemRank.passed
}

const table = useReactTable({
  filterFns: { fuzzy: fuzzyFilter },
  globalFilterFn: 'fuzzy',
})
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
```

## Pagination

```typescript
const table = useReactTable({
  state: { pagination },
  onPaginationChange: setPagination,
  getPaginationRowModel: getPaginationRowModel(),
  // For server-side:
  // manualPagination: true,
  // pageCount: serverPageCount,
<<<<<<< HEAD
});

// Navigation
table.nextPage();
table.previousPage();
table.firstPage();
table.lastPage();
table.setPageSize(20);
table.getCanNextPage(); // boolean
table.getCanPreviousPage(); // boolean
table.getPageCount(); // total pages
=======
})

// Navigation
table.nextPage()
table.previousPage()
table.firstPage()
table.lastPage()
table.setPageSize(20)
table.getCanNextPage()     // boolean
table.getCanPreviousPage() // boolean
table.getPageCount()       // total pages
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
```

## Row Selection

```typescript
const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

const table = useReactTable({
  state: { rowSelection },
  onRowSelectionChange: setRowSelection,
  enableRowSelection: true,
  enableMultiRowSelection: true,
})

// Checkbox column
columnHelper.display({
  id: 'select',
  header: ({ table }) => (
    <input
      type="checkbox"
      checked={table.getIsAllRowsSelected()}
      onChange={table.getToggleAllRowsSelectedHandler()}
    />
  ),
  cell: ({ row }) => (
    <input
      type="checkbox"
      checked={row.getIsSelected()}
      disabled={!row.getCanSelect()}
      onChange={row.getToggleSelectedHandler()}
    />
  ),
})

// Get selected rows
table.getSelectedRowModel().rows
```

## Column Visibility

```typescript
const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

const table = useReactTable({
  state: { columnVisibility },
  onColumnVisibilityChange: setColumnVisibility,
})

// Toggle UI
{table.getAllLeafColumns().map(column => (
  <label key={column.id}>
    <input
      type="checkbox"
      checked={column.getIsVisible()}
      onChange={column.getToggleVisibilityHandler()}
    />
    {column.id}
  </label>
))}
```

## Column Pinning

```typescript
const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
<<<<<<< HEAD
  left: ["select", "name"],
  right: ["actions"],
});
=======
  left: ['select', 'name'],
  right: ['actions'],
})
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

const table = useReactTable({
  state: { columnPinning },
  onColumnPinningChange: setColumnPinning,
  enableColumnPinning: true,
<<<<<<< HEAD
});

// Render pinned sections separately
row.getLeftVisibleCells(); // Left-pinned
row.getCenterVisibleCells(); // Unpinned
row.getRightVisibleCells(); // Right-pinned
=======
})

// Render pinned sections separately
row.getLeftVisibleCells()   // Left-pinned
row.getCenterVisibleCells() // Unpinned
row.getRightVisibleCells()  // Right-pinned
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
```

## Column Resizing

```typescript
const table = useReactTable({
  enableColumnResizing: true,
  columnResizeMode: 'onChange', // 'onChange' | 'onEnd'
  defaultColumn: { size: 150, minSize: 50, maxSize: 500 },
})

// Resize handle in header
<div
  onMouseDown={header.getResizeHandler()}
  onTouchStart={header.getResizeHandler()}
  className={`resizer ${header.column.getIsResizing() ? 'isResizing' : ''}`}
/>
```

## Grouping & Aggregation

```typescript
<<<<<<< HEAD
const [grouping, setGrouping] = useState<GroupingState>([]);
=======
const [grouping, setGrouping] = useState<GroupingState>([])
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

const table = useReactTable({
  state: { grouping },
  onGroupingChange: setGrouping,
  getGroupedRowModel: getGroupedRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
<<<<<<< HEAD
});

// Built-in aggregation: 'sum', 'min', 'max', 'mean', 'median', 'count', 'unique', 'uniqueCount'
columnHelper.accessor("amount", {
  aggregationFn: "sum",
  aggregatedCell: ({ getValue }) => `Total: ${getValue()}`,
});
=======
})

// Built-in aggregation: 'sum', 'min', 'max', 'mean', 'median', 'count', 'unique', 'uniqueCount'
columnHelper.accessor('amount', {
  aggregationFn: 'sum',
  aggregatedCell: ({ getValue }) => `Total: ${getValue()}`,
})
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
```

## Row Expanding

```typescript
const [expanded, setExpanded] = useState<ExpandedState>({})

const table = useReactTable({
  state: { expanded },
  onExpandedChange: setExpanded,
  getExpandedRowModel: getExpandedRowModel(),
  getSubRows: (row) => row.subRows, // For hierarchical data
})

// Expand toggle
<button onClick={row.getToggleExpandedHandler()}>
  {row.getIsExpanded() ? '−' : '+'}
</button>

// Detail row pattern
{row.getIsExpanded() && (
  <tr>
    <td colSpan={columns.length}>
      <DetailComponent data={row.original} />
    </td>
  </tr>
)}
```

## Virtualization Integration

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualizedTable() {
  const table = useReactTable({ /* ... */ })
  const { rows } = table.getRowModel()
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 10,
  })

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <table>
        <tbody style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map(virtualRow => {
            const row = rows[virtualRow.index]
            return (
              <tr
                key={row.id}
                style={{
                  position: 'absolute',
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${virtualRow.size}px`,
                }}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

## Server-Side Operations

```typescript
const table = useReactTable({
  data: serverData,
  columns,
  manualSorting: true,
  manualFiltering: true,
  manualPagination: true,
  pageCount: serverPageCount,
  state: { sorting, columnFilters, pagination },
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  onPaginationChange: setPagination,
  getCoreRowModel: getCoreRowModel(),
  // Do NOT include getSortedRowModel, getFilteredRowModel, getPaginationRowModel
<<<<<<< HEAD
});

// Fetch data based on state
useEffect(() => {
  fetchData({ sorting, filters: columnFilters, pagination });
}, [sorting, columnFilters, pagination]);
=======
})

// Fetch data based on state
useEffect(() => {
  fetchData({ sorting, filters: columnFilters, pagination })
}, [sorting, columnFilters, pagination])
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
```

## TypeScript Patterns

### Extending Column Meta

```typescript
<<<<<<< HEAD
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    filterVariant?: "text" | "range" | "select";
    align?: "left" | "center" | "right";
=======
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    filterVariant?: 'text' | 'range' | 'select'
    align?: 'left' | 'center' | 'right'
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
  }
}
```

### Custom Filter/Sort Function Registration

```typescript
<<<<<<< HEAD
declare module "@tanstack/react-table" {
  interface FilterFns {
    fuzzy: FilterFn<unknown>;
  }
  interface SortingFns {
    myCustomSort: SortingFn<unknown>;
=======
declare module '@tanstack/react-table' {
  interface FilterFns {
    fuzzy: FilterFn<unknown>
  }
  interface SortingFns {
    myCustomSort: SortingFn<unknown>
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
  }
}
```

### Editable Cells via Table Meta

```typescript
<<<<<<< HEAD
declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
=======
declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
  }
}

const table = useReactTable({
  meta: {
    updateData: (rowIndex, columnId, value) => {
<<<<<<< HEAD
      setData((old) => old.map((row, i) => (i === rowIndex ? { ...row, [columnId]: value } : row)));
    },
  },
});
=======
      setData(old => old.map((row, i) =>
        i === rowIndex ? { ...row, [columnId]: value } : row
      ))
    },
  },
})
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
```

## Key Imports

```typescript
import {
<<<<<<< HEAD
  createColumnHelper,
  flexRender,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
} from "@tanstack/react-table";

import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  PaginationState,
  ExpandedState,
  RowSelectionState,
  GroupingState,
  ColumnOrderState,
  ColumnPinningState,
  FilterFn,
  SortingFn,
} from "@tanstack/react-table";
=======
  createColumnHelper, flexRender, useReactTable,
  getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  getPaginationRowModel, getGroupedRowModel, getExpandedRowModel,
  getFacetedRowModel, getFacetedUniqueValues, getFacetedMinMaxValues,
} from '@tanstack/react-table'

import type {
  ColumnDef, SortingState, ColumnFiltersState, VisibilityState,
  PaginationState, ExpandedState, RowSelectionState, GroupingState,
  ColumnOrderState, ColumnPinningState, FilterFn, SortingFn,
} from '@tanstack/react-table'
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
```

## Best Practices

1. **Always memoize `data` and `columns`** to prevent infinite re-renders
2. **Use `flexRender`** for all header/cell/footer rendering
3. **Use `table.getRowModel().rows`** for final rendered rows (not getCoreRowModel)
4. **Import only needed row models** - each adds processing to the pipeline
5. **Use `getRowId`** for stable row keys when data has unique IDs
6. **Use `manualX` options** for server-side operations
7. **Pair controlled state** with both `state.X` and `onXChange`
8. **Use module augmentation** for custom meta, filter fns, sort fns
9. **Use column helper** for type-safe column definitions
10. **Set `autoResetPageIndex: true`** when filtering should reset pagination

## Common Pitfalls

- Defining columns inline (creates new ref each render)
- Forgetting `getCoreRowModel()` (required for all tables)
- Using row models without importing them
- Not providing `id` when using `accessorFn`
- Mixing `manualPagination` with client-side `getPaginationRowModel`
- Forgetting `colSpan` for grouped headers
- Not handling `header.isPlaceholder` for group column spacers
