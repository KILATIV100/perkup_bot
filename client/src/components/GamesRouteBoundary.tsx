import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

type GamesRouteBoundaryProps = {
  children: ReactNode
}

type GamesRouteBoundaryState = {
  hasError: boolean
}

class GamesRouteBoundaryInner extends Component<GamesRouteBoundaryProps, GamesRouteBoundaryState> {
  state: GamesRouteBoundaryState = { hasError: false }

  static getDerivedStateFromError(): GamesRouteBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GamesRouteBoundary] render error', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="m-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Не вдалося відкрити сторінку ігор. Спробуй оновити сторінку.
        </div>
      )
    }

    return this.props.children
  }
}

type GamesRouteDebugProps = {
  children: ReactNode
  user: unknown
  status: unknown
}

export function GamesRouteDebug({ children, user, status }: GamesRouteDebugProps) {
  const location = useLocation()
  console.log('[GamesRoute] render start')
  console.log('[GamesRoute] user/status/location', { user, status, location: location.pathname + location.search + location.hash })

  return <GamesRouteBoundaryInner>{children}</GamesRouteBoundaryInner>
}
