export const items = Array.from({ length: 1000 }, (_, i) => ({
  id: i,
  text: 'Item ' + i + ' — ' + 'lorem ipsum '.repeat(1 + (i % 5)),
}))
