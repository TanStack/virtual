![React Virtual Header](https://github.com/tannerlinsley/react-virtual/raw/master/media/header.png)

<img src='https://github.com/tannerlinsley/react-virtual/raw/master/media/logo.png' width='300'/>

Hooks for virtualizing scrollable elements in React

<a href="https://twitter.com/intent/tweet?button_hashtag=TanStack" target="\_parent">
  <img alt="#TanStack" src="https://img.shields.io/twitter/url?color=%2308a0e9&label=%23TanStack&style=social&url=https%3A%2F%2Ftwitter.com%2Fintent%2Ftweet%3Fbutton_hashtag%3DTanStack">
</a><a href="https://github.com/tannerlinsley/react-virtual/actions?query=workflow%3A%22react-virtual+tests%22">
<img src="https://github.com/tannerlinsley/react-virtual/workflows/react-virtual%20tests/badge.svg" />
</a><a href="https://npmjs.com/package/react-virtual" target="\_parent">
  <img alt="" src="https://img.shields.io/npm/dm/react-virtual.svg" />
</a><a href="https://bundlephobia.com/result?p=react-virtual@latest" target="\_parent">
  <img alt="" src="https://badgen.net/bundlephobia/minzip/react-virtual@latest" />
</a><a href="#badge">
    <img alt="semantic-release" src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg">
  </a><a href="https://github.com/tannerlinsley/react-virtual/discussions">
  <img alt="Join the discussion on Github" src="https://img.shields.io/badge/Github%20Discussions%20%26%20Support-Chat%20now!-blue" />
</a><a href="https://github.com/tannerlinsley/react-virtual" target="\_parent">
  <img alt="" src="https://img.shields.io/github/stars/tannerlinsley/react-virtual.svg?style=social&label=Star" />
</a><a href="https://twitter.com/tannerlinsley" target="\_parent">
  <img alt="" src="https://img.shields.io/twitter/follow/tannerlinsley.svg?style=social&label=Follow" />
</a>

Enjoy this library? Try them all! [React Table](https://github.com/tannerlinsley/react-table), [React Virtual](https://github.com/tannerlinsley/react-query), [React Form](https://github.com/tannerlinsley/react-form),
[React Charts](https://github.com/tannerlinsley/react-charts)

## Quick Features

- 4kb - 6kb (depending on features imported) <a href="https://bundlephobia.com/result?p=react-virtual@latest" target="\_parent">
  <img alt="" src="https://badgen.net/bundlephobia/minzip/react-virtual@latest" />
  </a>

<details>
<summary>Core Issues and Solution</summary>

## The Challenge

Tools for managing "global state" are plentiful these days, but most of these tools:

- Mistake **server cache state** for **global state**
- Force you to manage async data in a synchronous way
- Duplicate unnecessary network operations
- Use naive or over-engineered caching strategies
- Are too basic to handle large-scale apps or
- Are too complex or built for highly-opinionated systems like Redux, GraphQL, [insert proprietary tools], etc.
- Do not provide tools for server mutations
- Either do not provide easy access to the cache or do, but expose overpowered foot-gun APIs to the developer

## The Solution

React Virtual exports a set of hooks that address these issues. Out of the box, React Virtual:

- Separates your **server cache state** from your **global state**
- Provides async aware APIs for reading and updating server state/cache
- Dedupes both async and sync requests to async resources
- Automatically caches data, invalidates and refetches stale data, and manages garbage collection of unused data
- Scales easily as your application grows
- Is based solely on Promises, making it highly unopinionated and interoperable with any data fetching strategy including REST, GraphQL and other transactional APIs
- Provides an integrated promise-based mutation API
- Opt-in Manual or Advance cache management

</details>

<details>
<summary>Inspiration & Hat-Tipping</summary>
<br />
A big thanks to both [Draqula](https://github.com/vadimdemedes/draqula) for inspiring a lot of React Virtual's original API and documentation and also [Zeit's SWR](https://github.com/zeit/swr) and its creators for inspiring even further customizations and examples. You all rock!

</details>

<details>
<summary>How is this different from Zeit's SWR?</summary>
<br />

[Zeit's SWR](https://github.com/zeit/swr) is a great library, and is very similar in spirit and implementation to React Virtual with a few notable differences:

- Automatic Cache Garbage Collection - React Virtual handles automatic cache purging for inactive queries and garbage collection. This can mean a much smaller memory footprint for apps that consume a lot of data or data that is changing often in a single session
- No Default Data Fetcher Function - React Virtual does not ship with a default fetcher (but can easily be wrapped inside of a custom hook to achieve the same functionality)
- `useMutation` - A dedicated hook for handling generic lifecycles around triggering mutations and handling their side-effects in applications. SWR does not ship with anything similar, and you may find yourself reimplementing most if not all of `useMutation`'s functionality in user-land. With this hook, you can extend the lifecycle of your mutations to reliably handle successful refetching strategies, failure rollbacks and error handling.
- Prefetching - React Virtual ships with 1st class prefetching utilities which not only come in handy with non-suspenseful apps but also make fetch-as-you-render patterns possible with React Virtual. SWR does not come with similar utilities and relies on `<link rel='preload'>` and/or manually fetching and updating the query cache
- Query cancellation integration is baked into React Virtual. You can easily use this to wire up request cancellation in most popular fetching libraries, including but not limited to fetch and axios.
- Query Key Generation - React Virtual uses query key generation, query variables, and implicit query grouping. The query key and variables that are passed to a query are less URL/Query-based by nature and much more flexible. All items supplied to the query key array are used to compute the unique key for a query (using a stable and deterministic sorting/hashing implementation). This means you can spend less time thinking about precise key matching, but more importantly, allows you to use partial query-key matching when refetching, updating, or removing queries in mass eg. you can refetch every query that starts with a `todos` in its key, regardless of variables, or you can target specific queries with (or without) variables, and even use functional filtering to select queries in most places. This architecture is much more robust and forgiving especially for larger apps.

</details>

<!-- ## Used By

> _These analytics are made available via the awesome [Scarf](https://www.npmjs.com/package/@scarf/scarf) package analytics library_ -->

## Examples

- Sandbox - [CodeSandbox](https://codesandbox.io/s/github/tannerlinsley/react-virtual/tree/master/examples/sandbox) - [Source](./examples/sandbox)
  - Shows examples of Row, Column, and Grid layouts
  - Shows examples of fixed, variable, and dynamic sizing

## Sponsors

This library is being built and maintained by me, @tannerlinsley and I am always in need of more support to keep projects like this afloat. If you would like to get premium support, add your logo or name on this README, or simply just contribute to my open source Sponsorship goal, [visit my Github Sponsors page!](https://github.com/sponsors/tannerlinsley/)

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://github.com/sponsors/tannerlinsley" target="_blank">
          <img width='150' src="https://raw.githubusercontent.com/tannerlinsley/files/master/images/patreon/diamond.png">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://github.com/sponsors/tannerlinsley" target="_blank">
          Become a Sponsor!
        </a>
      </td>
    </tr>
  </tbody>
</table>

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://github.com/sponsors/tannerlinsley/" target="_blank">
          <img width='150' src="https://raw.githubusercontent.com/tannerlinsley/files/master/images/patreon/platinum.png">
        </a>
      </td>
      <td align="center" valign="middle">
       <a href="https://github.com/sponsors/tannerlinsley" target="_blank">
          Become a Sponsor!
        </a>
      </td>
    </tr>
  </tbody>
</table>

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://github.com/sponsors/tannerlinsley/" target="_blank">
          <img width='150' src="https://raw.githubusercontent.com/tannerlinsley/files/master/images/patreon/gold.png">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://nozzle.io" target="_blank">
          <img width='225' src="https://nozzle.io/img/logo-blue.png">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://github.com/sponsors/tannerlinsley" target="_blank">
          Become a Sponsor!
        </a>
      </td>
    </tr>
  </tbody>
</table>

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://github.com/sponsors/tannerlinsley/" target="_blank">
          <img width='150' src="https://raw.githubusercontent.com/tannerlinsley/files/master/images/patreon/silver.png">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://github.com/sponsors/tannerlinsley" target="_blank">
          Become a Sponsor!
        </a>
      </td>
    </tr>
  </tbody>
</table>

<table>
  <tbody>
    <tr>
      <td valign="top">
        <a href="https://github.com/sponsors/tannerlinsley/">
          <img width='150' src="https://raw.githubusercontent.com/tannerlinsley/files/master/images/patreon/supporters.png" />
        </a>
      </td>
      <!-- <td>
        <ul>
          <li><a href="https://github.com/bgazzera">@bgazzera<a></li>
          <li><a href="https://kentcdodds.com/"> Kent C. Dodds (kentcdodds.com)</a></li>
        </ul>
      </td> -->
      <td>
        <a href="https://github.com/sponsors/tannerlinsley" target="_blank">
          Become a Supporter!
        </a>
      </td>
    </tr>
  </tbody>
</table>

<table>
  <tbody>
    <tr>
      <td valign="top">
        <a href="https://github.com/sponsors/tannerlinsley/">
          <img width='150' src="https://raw.githubusercontent.com/tannerlinsley/files/master/images/patreon/fans.png" />
        </a>
      </td>
      <!-- <td>
        <ul>
        <li></li>
        </ul>
      </td> -->
      <td>
        <a href="https://github.com/sponsors/tannerlinsley" target="_blank">
          Become a Fan!
        </a>
      </td>
    </tr>
  </tbody>
</table>

# Documentation

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Installation](#installation)
- [API](#api)
- [Contributors ✨](#contributors-)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Installation

```bash
$ npm i --save react-virtual
# or
$ yarn add react-virtual
```

> React Virtual uses [Scarf](https://www.npmjs.com/package/@scarf/scarf) to collect anonymized installation analytics. These analytics help support the maintainers of this library. However, if you'd like to opt out, you can do so by setting `scarfSettings.enabled = false` in your project's `package.json`. Alternatively, you can set the environment variable `SCARF_ANALYTICS=false` before you install.

# Sample

This is just a quick sample of what it looks like to use React Virtual. Please refer to the examples for more usage patterns.

```js
function RowVirtualizerFixed() {
  const parentRef = React.useRef()

  const rowVirtualizer = useVirtual({
    size: 10000,
    parentRef,
    estimateSize: React.useCallback(() => 35, []),
  })

  return (
    <>
      <div
        ref={parentRef}
        className="List"
        style={{
          height: `150px`,
          width: `300px`,
          overflow: 'auto',
        }}
      >
        <div
          className="ListInner"
          style={{
            height: `${rowVirtualizer.totalSize}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.items.map(virtualRow => (
            <div
              key={virtualRow.index}
              className={virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              Row {virtualRow.index}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
```

# API

## `useVirtual`

```js
const {
  items: [
    { index, start, size, end, measureRef },
    /* ... */
  ],
  totalSize,
} = useVirtual({
  size,
  parentRef,
  estimateSize,
  overscan,
  horiztonal,
})
```

### Options

- `size: Integer`
  - **Required**
  - The size of the virtualizer
- `parentRef: React.useRef(DOMElement)`
  - **Required**
  - The parent element whose inner-content is scrollable
- `estimateSize: Function(index) => Integer`
  - **Required**
  - **Must be memoized using `React.useCallback()`**
  - This function recieves the index of each item and should return either:
    - A fixed size
    - A variable size per-item
    - A best-guess size (when using dynamic measurement rendering)
  - When this function's memoization changes, the entire list is recalculated
- `overscan: Integer`
  - The amount of items to load both behind and ahead of the current window range
  - Defaults to `1`
- `horizontal: Boolean`
  - When `true`, this virtualizer will use `width` and `scrollLeft` instead of `height` and `scrollTop` to determine size and offset of virtualized items.

### Returns

- `items: Array<item>`
  - `item: Object`
    - `index: Integer`
      - The index of the item
    - `start: Integer`
      - The starting measurement of the item
      - Most commonly used for positioning elements
    - `size: Integer`
      - The static/variable or, if dynamically rendered, the measured size of the item
    - `end: Integer`
      - The ending measurement of the item
    - `measureRef: React.useRef | Function(el) => void 0`
      - The ref/function to place on the rendered element to enable dynamic measurement rendering
- `totalSize: Integer`
  - The total size of the entire virtualizer
  - When using dynamic measurement refs, this number may change as items are measured after they are rendered.

# Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://tannerlinsley.com"><img src="https://avatars0.githubusercontent.com/u/5580297?v=4" width="100px;" alt=""/><br /><sub><b>Tanner Linsley</b></sub></a><br /><a href="https://github.com/tannerlinsley/react-virtual/commits?author=tannerlinsley" title="Code">💻</a> <a href="#ideas-tannerlinsley" title="Ideas, Planning, & Feedback">🤔</a> <a href="#example-tannerlinsley" title="Examples">💡</a> <a href="#maintenance-tannerlinsley" title="Maintenance">🚧</a> <a href="https://github.com/tannerlinsley/react-virtual/pulls?q=is%3Apr+reviewed-by%3Atannerlinsley" title="Reviewed Pull Requests">👀</a></td>
  </tr>
</table>

<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

<!-- Force -->
