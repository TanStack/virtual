<template>
  <div>
    <p>
      Table rows can't be absolutely positioned, so only the visible rows are
      rendered, with a spacer row above and below them. The spacers keep the
      table as tall as all of its rows, so the sticky header stays in place
      while scrolling.
    </p>

    <div ref="parentRef" class="container">
      <table>
        <thead>
          <tr
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
          >
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              :colspan="header.colSpan"
              :style="{ width: `${header.getSize()}px` }"
            >
              <div
                v-if="!header.isPlaceholder"
                :class="[
                  'text-left',
                  header.column.getCanSort()
                    ? 'cursor-pointer select-none'
                    : '',
                ]"
                @click="
                  getSortingHandler(
                    $event,
                    header.column.getToggleSortingHandler(),
                  )
                "
              >
                <FlexRender
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
                <span v-if="header.column.getIsSorted() === 'asc'"> 🔼</span>
                <span v-if="header.column.getIsSorted() === 'desc'"> 🔽</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="paddingTop > 0">
            <td :colspan="columnCount" :style="{ height: `${paddingTop}px` }" />
          </tr>
          <tr
            v-for="virtualRow in virtualRows"
            :key="virtualRow.key"
            :style="{ height: `${virtualRow.size}px` }"
          >
            <td
              v-for="cell in rows[virtualRow.index].getVisibleCells()"
              :key="cell.id"
            >
              <FlexRender
                :render="cell.column.columnDef.cell"
                :props="cell.getContext()"
              />
            </td>
          </tr>
          <tr v-if="paddingBottom > 0">
            <td
              :colspan="columnCount"
              :style="{ height: `${paddingBottom}px` }"
            />
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import {
  FlexRender,
  ColumnDef,
  SortingState,
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/vue-table'
import { makeData, Person } from './makeData'

const data = ref(makeData(50_000))

const sorting = ref<SortingState>([])

const getSortingHandler = (e: Event, fn: any) => {
  return fn(e)
}

const setSorting = (sortingUpdater: any) => {
  const newSortVal = sortingUpdater(sorting.value)

  sorting.value = newSortVal
}

const columns = computed<ColumnDef<Person>[]>(() => {
  return [
    {
      accessorKey: 'id',
      header: 'ID',
      size: 60,
    },
    {
      accessorKey: 'firstName',
      cell: (info) => info.getValue(),
    },
    {
      accessorFn: (row) => row.lastName,
      id: 'lastName',
      cell: (info) => info.getValue(),
      header: () => 'Last Name',
    },
    {
      accessorKey: 'age',
      header: () => 'Age',
      size: 50,
    },
    {
      accessorKey: 'visits',
      header: () => 'Visits',
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
})

const table = useVueTable({
  get data() {
    return data.value
  },
  columns: columns.value,
  state: {
    get sorting() {
      return sorting.value
    },
  },
  onSortingChange: setSorting,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  debugTable: true,
})

const rows = computed(() => {
  return table.getRowModel().rows
})

const parentRef = ref<HTMLElement | null>(null)

const rowVirtualizerOptions = computed(() => {
  return {
    count: rows.value.length,
    getScrollElement: () => parentRef.value,
    estimateSize: () => 34,
    overscan: 5,
  }
})

const rowVirtualizer = useVirtualizer(rowVirtualizerOptions)

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())

const totalSize = computed(() => rowVirtualizer.value.getTotalSize())

// Height of the spacer rows rendered above and below the visible rows
const paddingTop = computed(() =>
  virtualRows.value.length > 0 ? virtualRows.value[0].start : 0,
)

const paddingBottom = computed(() =>
  virtualRows.value.length > 0
    ? totalSize.value - virtualRows.value[virtualRows.value.length - 1].end
    : 0,
)

const columnCount = computed(() => table.getVisibleLeafColumns().length)
</script>
