import React from 'react'

export default typeof window !== 'undefined'
  ? React.useLayoutEffect
  : React.useEffect
