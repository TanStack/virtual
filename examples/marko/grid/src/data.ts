export const ROW_COUNT = 1000
export const COL_COUNT = 1000
export const rowSizes = Array.from({ length: ROW_COUNT }, (_, i) => 30 + ((i * 7 + 13) % 20))
export const colSizes = Array.from({ length: COL_COUNT }, (_, i) => 80 + ((i * 11 + 17) % 80))