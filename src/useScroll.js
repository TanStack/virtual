import React from 'react'

export default function useScroll(ref, onChange) {
  const onChangeRef = React.useRef()
  onChangeRef.current = onChange

  React.useEffect(() => {
    const el = ref.current

    const handler = e => {
      onChangeRef.current({
        scrollLeft: e.target.scrollLeft,
        scrollTop: e.target.scrollTop,
      })
    }

    if (el) {
      el.addEventListener('scroll', handler, {
        capture: false,
        passive: true,
      })

      return () => {
        el.removeEventListener('scroll', handler)
      }
    }
  }, [ref])
}
