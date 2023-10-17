<template>
  <div
    ref="parentRef"
    class="List"
    style="width: 400px; height: 400px; overflow-y: auto"
  >
    <div
      :style="{
        width: `${totalSize}px`,
        height: '100%',
        position: 'relative',
      }"
    >
      <div
        v-for="virtualColumn in virtualColumns"
        :key="virtualColumn.key"
        :data-index="virtualColumn.index"
        :ref="measureElement"
        :class="virtualColumn.index % 2 ? 'ListItemOdd' : 'ListItemEven'"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          transform: `translateX(${virtualColumn.start}px)`,
        }"
      >
        <div :style="{ width: `${sentences[virtualColumn.index].length}px` }">
          <div>Column {{ virtualColumn.index }}</div>
          <div>{{ sentences[virtualColumn.index] }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type VNodeRef } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { generateSentences } from './utils'

const sentences = generateSentences()

const parentRef = ref<HTMLElement | null>(null)

const columnVirtualizer = useVirtualizer({
  horizontal: true,
  count: sentences.length,
  getScrollElement: () => parentRef.value,
  estimateSize: () => 45,
})

const virtualColumns = computed(() => columnVirtualizer.value.getVirtualItems())

const totalSize = computed(() => columnVirtualizer.value.getTotalSize())

const measureElement = (el) => {
  if (!el) {
    return
  }

  columnVirtualizer.value.measureElement(el)

  return undefined
}
</script>
