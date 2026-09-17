import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from '@/auth/SessionProvider'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { BrandingProvider } from '@/branding/BrandingProvider'
import { registerServiceWorker } from '@/pwa/register'
import { App } from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Aplicativo instalável: registra cedo, fora do React, para valer também na
// tela de login — é de lá que a maioria instala.
registerServiceWorker()

const root = document.getElementById('root')
if (!root) throw new Error('#root não encontrado')

/**
 * Erro de configuração (variável de ambiente errada ou ausente) acontece antes
 * do React montar. Sem isto a tela fica branca e o motivo só aparece no console.
 */
window.addEventListener('error', (event) => {
  const message = event.error instanceof Error ? event.error.message : String(event.message)
  if (!/VITE_SUPABASE/.test(message)) return
  root.innerHTML = ''
  const box = document.createElement('div')
  box.setAttribute(
    'style',
    'max-width:40rem;margin:4rem auto;padding:1.5rem;border:1px solid #fecaca;' +
      'border-radius:.5rem;background:#fef2f2;color:#7f1d1d;font:14px/1.6 system-ui',
  )
  box.innerHTML =
    '<strong style="display:block;margin-bottom:.5rem">Erro de configuração</strong>' +
    message.replace(/</g, '&lt;')
  root.appendChild(box)
})

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <SessionProvider>
            <BrandingProvider>
              <App />
            </BrandingProvider>
          </SessionProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
