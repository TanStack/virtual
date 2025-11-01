<script lang="ts">
  import { faker } from '@faker-js/faker'
  import { createVirtualizer } from '@tanstack/svelte-virtual'

  let virtualListEl = $state<HTMLDivElement | null>(null)
  let virtualItemEls = $state<HTMLDivElement[]>([])

  function randomNumber(min: number, max: number) {
    return faker.number.int({ min, max })
  }

  const sentences = new Array(10000)
    .fill(true)
    .map(() => faker.lorem.sentence(randomNumber(20, 70)))

  const count = sentences.length

  let makeGetScrollElement = (scrollElement: HTMLDivElement | null) => () =>
    scrollElement
  let virtualizer = $derived(
    createVirtualizer<HTMLDivElement, HTMLDivElement>({
      count,
      getScrollElement: makeGetScrollElement(virtualListEl),
      estimateSize: () => 45,
    }),
  )

  let items = $derived($virtualizer.getVirtualItems())

  $effect(() => {
    if (virtualItemEls.length)
      virtualItemEls.forEach((el) => $virtualizer.measureElement(el))
  })
</script>

<div>
  <button
    onclick={() => {
      $virtualizer.scrollToIndex(0)
    }}
  >
    scroll to the top
  </button>
  <span style="padding: 0 4px;"></span>
  <button
    onclick={() => {
      $virtualizer.scrollToIndex(count / 2)
    }}
  >
    scroll to the middle
  </button>
  <span style="padding: 0 4px;"></span>
  <button
    onclick={() => {
      $virtualizer.scrollToIndex(count - 1)
    }}
  >
    scroll to the end
  </button>
  <hr />
  <div class="list scroll-container" bind:this={virtualListEl}>
    <div
      style="position: relative; height: {$virtualizer.getTotalSize()}px; width: 100%;"
    >
      <div
        style="position: absolute; top: 0; left: 0; width: 100%; transform: translateY({items[0]
          ? items[0].start
          : 0}px);"
      >
        {#each items as row, idx (row.index)}
          <div
            bind:this={virtualItemEls[idx]}
            data-index={row.index}
            class:list-item-even={row.index % 2 === 0}
            class:list-item-odd={row.index % 2 === 1}
          >
            <div style="padding: 10px 0;">
              <div>Row {row.index}</div>
              <div>{sentences[row.index]}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .scroll-container {
    height: 400px;
    width: 400px;
    overflow-y: auto;
    contain: 'strict';
  }
</style>
