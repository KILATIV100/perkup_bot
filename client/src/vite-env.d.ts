/// <reference types="vite/client" />

interface Window {
  Telegram?: {
    WebApp: {
      initData: string
      initDataUnsafe: any
      ready: () => void
      expand: () => void
      close: () => void
      setHeaderColor: (color: string) => void
      setBackgroundColor: (color: string) => void
      enableClosingConfirmation: () => void
      disableClosingConfirmation: () => void
      HapticFeedback?: {
        selectionChanged: () => void
        notificationOccurred: (type: string) => void
        impactOccurred: (style: string) => void
      }
      BackButton?: {
        show: () => void
        hide: () => void
        onClick: (cb: () => void) => void
      }
      MainButton?: any
      colorScheme?: string
      themeParams?: any
      [key: string]: any
    }
  }
  __hideSplash?: () => void
}
