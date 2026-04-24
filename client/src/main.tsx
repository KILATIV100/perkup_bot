import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
})

const tg = window.Telegram?.WebApp
if (tg) {
  if (typeof tg.ready === 'function') tg.ready()
  if (typeof tg.expand === 'function') tg.expand()
  if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor('#3d1c02')
  if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor('#fdf6ed')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <HashRouter>
      <App />
    </HashRouter>
  </QueryClientProvider>
)
