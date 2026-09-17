/* =============================================================================
 * Service worker do Uniklin.
 *
 * O sistema é de balcão: o operador não pode ficar olhando tela branca porque a
 * internet da loja oscilou. Mas ele TAMBÉM não pode ver dado velho de cliente,
 * estoque ou financeiro. Por isso a divisão é rígida:
 *
 *   - Casca do app (HTML e arquivos do build): pode vir do cache.
 *   - Dado (Supabase, /rest/v1, /auth/v1): NUNCA passa por aqui. Vai direto à
 *     rede, sempre. Um saldo de estoque servido do cache seria um erro de
 *     operação, não uma otimização.
 * ========================================================================== */

const VERSION = 'v1'
const SHELL = `uniklin-shell-${VERSION}`
const ASSETS = `uniklin-assets-${VERSION}`

/** O mínimo para a tela abrir offline. Os arquivos com hash entram sozinhos. */
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // Um arquivo ausente não pode impedir a instalação inteira.
      .then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('uniklin-') && key !== SHELL && key !== ASSETS)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/** Permite que a aplicação peça a troca imediata quando avisa "nova versão". */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Dado da ótica: fora do alcance do cache, sem exceção.
  if (url.origin !== self.location.origin) return
  if (/^\/(rest|auth|storage|realtime|functions)\//.test(url.pathname)) return

  // Navegação: rede primeiro, para o deploy novo valer na hora. Sem rede,
  // devolve a casca guardada — o app abre e mostra o próprio aviso de conexão.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/', { ignoreSearch: true })),
    )
    return
  }

  // Arquivos do build: o nome carrega hash, então o conteúdo nunca muda.
  // Cache primeiro é seguro e é o que faz a abertura ser instantânea.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(ASSETS).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
  }
})
