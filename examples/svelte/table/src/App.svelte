<script lang="ts">
  import {
    createSvelteTable,
    getCoreRowModel,
    getSortedRowModel,
    type ColumnDef,
    type SortingState,
    type Updater,
    flexRender,
    type TableOptions,
  } from '@tanstack/svelte-table'
  import { createVirtualizer } from '@tanstack/svelte-virtual'
  import { makeData, type Person } from './makeData'
  import { writable } from 'svelte/store'

  let virtualListEl: HTMLDivElement
  let sorting: SortingState = []

  function setSorting(updater: Updater<SortingState>) {
    if (updater instanceof Function) sorting = updater(sorting)
    else sorting = updater

    tableOptions.update((opts) => ({
      ...opts,
      state: {
        ...opts.state,
        sorting,
      },
    }))
  }

  const columns: ColumnDef<Person>[] = [
    {
      accessorKey: 'id',
      header: 'ID',
      size: 60,
    },
    {
      accessorKey: 'firstName',
      header: 'First Name',
      cell: (info) => info.getValue(),
    },
    {
      accessorFn: (row) => row.lastName,
      id: 'lastName',
      header: 'Last Name',
      cell: (info) => info.getValue(),
    },
    {
      accessorKey: 'age',
      header: 'Age',
      size: 50,
    },
    {
      accessorKey: 'visits',
      header: 'Visits',
      size: 50,
    },
    {
      accessorKey: 'status',
      header: 'Status',
    },
    {
      accessorKey: 'progress',
      header: 'Profile Progress',
      size: 80,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created At',
      cell: (info) => info.getValue<Date>().toLocaleString(),
    },
  ]

  const tableOptions = writable<TableOptions<Person>>({
    data: makeData(50_000),
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: true,
  })

  const table = createSvelteTable(tableOptions)

  $: rows = $table.getRowModel().rows

  $: virtualizer = createVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rows.length,
    getScrollElement: () => virtualListEl,
    estimateSize: () => 34,
    overscan: 20,
  })

  $: virtualRows = $virtualizer.getVirtualItems()

  // Height of the spacer rows rendered above and below the visible rows
  $: paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  $: paddingBottom =
    virtualRows.length > 0
      ? $virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0

  $: columnCount = $table.getVisibleLeafColumns().length
</script>

<main>
  <p>
    Table rows can't be absolutely positioned, so only the visible rows are
    rendered, with a spacer row above and below them. The spacers keep the table
    as tall as all of its rows, so the sticky header stays in place while
    scrolling.
  </p>

  <div class="list scroll-container" bind:this={virtualListEl}>
    <table>
      <thead>
        {#each $table.getHeaderGroups() as headerGroup (headerGroup.id)}
          <tr>
            {#each headerGroup.headers as header (header.id)}
              <th colspan={header.colSpan} style="width: {header.getSize()}px;">
                {#if !header.isPlaceholder}
                  <button
                    class:sortable-header={header.column.getCanSort()}
                    disabled={!header.column.getCanSort()}
                    on:click={header.column.getToggleSortingHandler()}
                  >
                    <svelte:component
                      this={flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    />
                    {#if header.column.getIsSorted()}
                      {header.column.getIsSorted() === 'desc' ? ' 🔽' : ' 🔼'}
                    {/if}
                  </button>
                {/if}
              </th>
            {/each}
          </tr>
        {/each}
      </thead>
      <tbody>
        {#if paddingTop > 0}
          <tr>
            <td
              colspan={columnCount}
              style="height: {paddingTop}px; padding: 0;"
            ></td>
          </tr>
        {/if}
        {#each virtualRows as row (row.index)}
          <tr style="height: {row.size}px;">
            {#each rows[row.index].getVisibleCells() as cell (cell.id)}
              <td>
                <svelte:component
                  this={flexRender(
                    cell.column.columnDef.cell,
                    cell.getContext(),
                  )}
                />
              </td>
            {/each}
          </tr>
        {/each}
        {#if paddingBottom > 0}
          <tr>
            <td
              colspan={columnCount}
              style="height: {paddingBottom}px; padding: 0;"
            ></td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</main>

<style>
  button {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    outline: inherit;
  }

  .scroll-container {
    height: 600px;
    width: 100%;
    overflow: auto;
    overflow-anchor: none;
  }
  table {
    border-collapse: collapse;
  }
  thead {
    position: sticky;
    top: 0;
    background: white;
  }
  .sortable-header {
    cursor: pointer;
    user-select: none;
  }
</style>
