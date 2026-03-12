import {
  useVirtualizer,
  useExperimentalDOMVirtualizer,
} from '@tanstack/react-virtual'

const isExperimental =
  new URLSearchParams(window.location.search).get('hook') === 'experimental'

export const useHook = (
  isExperimental ? useExperimentalDOMVirtualizer : useVirtualizer
) as typeof useVirtualizer
