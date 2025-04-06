export type NoInfer<A extends any> = [A][A extends any ? 0 : never]

export type PartialKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
/**
 * checks whether the dependencies array has changed by comparing it with the previous one.
 *
 * @param newDeps new array of dependencies
 * @param deps previous array of dependencies
 * @returns  `true` if the length of the arrays differ or if at least one dependency has changed; otherwise, `false`
 */
const isDepsChanged = <TDeps extends ReadonlyArray<any>>(
  newDeps: Array<TDeps>,
  deps: TDeps,
): boolean =>
  newDeps.length !== deps.length ||
  newDeps.some((dep, index: number) => deps[index] !== dep)

export function memo<TDeps extends ReadonlyArray<any>, TResult>(
  getDeps: () => [...TDeps],
  fn: (...args: NoInfer<[...TDeps]>) => TResult,
  opts: {
    key: false | string
    debug?: () => boolean
    onChange?: (result: TResult) => void
    initialDeps?: TDeps
  },
) {
  let deps = opts.initialDeps ?? []
  let result: TResult | undefined

  const enabledDebug = Boolean(opts.key && opts.debug?.())

  function memoizedFunction(): TResult {
    let depTime: number

    if (enabledDebug) {
      depTime = Date.now()
    }

    const newDeps = getDeps()

    if (!isDepsChanged(newDeps, deps)) {
      return result!
    }

    deps = newDeps

    let resultTime: number

    if (enabledDebug) {
      resultTime = Date.now()
    }

    result = fn(...newDeps)

    if (opts.key && opts.debug?.()) {
      const depEndTime = Math.round((Date.now() - depTime!) * 100) / 100
      const resultEndTime = Math.round((Date.now() - resultTime!) * 100) / 100
      const resultFpsPercentage = resultEndTime / 16

      console.info(
        `%c⏱ ${String(resultEndTime).padStart(5, ' ')}/${String(depEndTime).padStart(5, ' ')} ms`,
        `
            font-size: .6rem;
            font-weight: bold;
            color: hsl(${Math.max(
              0,
              Math.min(120 - 120 * resultFpsPercentage, 120),
            )}deg 100% 31%);`,
        opts?.key,
      )
    }

    opts?.onChange?.(result)

    return result
  }

  // Attach updateDeps to the function itself
  memoizedFunction.updateDeps = (newDeps: [...TDeps]) => {
    deps = newDeps
  }

  return memoizedFunction
}

export function notUndefined<T>(value: T | undefined, msg?: string): T {
  if (value === undefined) {
    throw new Error(`Unexpected undefined${msg ? `: ${msg}` : ''}`)
  } else {
    return value
  }
}

export const approxEqual = (a: number, b: number) => Math.abs(a - b) < 1

export const debounce = (
  targetWindow: Window & typeof globalThis,
  fn: Function,
  ms: number,
) => {
  let timeoutId: number
  return function (this: any, ...args: Array<any>) {
    targetWindow.clearTimeout(timeoutId)
    timeoutId = targetWindow.setTimeout(() => fn.apply(this, args), ms)
  }
}
