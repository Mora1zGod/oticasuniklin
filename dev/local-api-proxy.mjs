/**
 * Proxy de DESENVOLVIMENTO LOCAL — não usar em produção.
 *
 * O app fala com o Supabase em dois caminhos: /rest/v1 (PostgREST) e /auth/v1
 * (GoTrue). Para rodar o app inteiro na máquina sem um projeto Supabase, este
 * proxy serve /rest/v1 a partir de um PostgREST local e responde o mínimo de
 * /auth/v1 para o supabase-js considerar a sessão válida.
 *
 *   PGRST=http://localhost:3001 PORT=3002 node dev/local-api-proxy.mjs
 *
 * O token é o JWT local (mesmo segredo do PostgREST). Não há refresh nem
 * cadastro: isso é papel do GoTrue, que só existe no Supabase de verdade.
 */
import http from 'node:http'

const PGRST = process.env.PGRST ?? 'http://localhost:3001'
const PORT = Number(process.env.PORT ?? 3002)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Expose-Headers': 'content-range, content-location',
}

function decodeJwt(header) {
  const token = (header ?? '').replace(/^Bearer /, '')
  const part = token.split('.')[1]
  if (!part) return null
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    return res.end()
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)

  // --- /auth/v1: o mínimo para o supabase-js aceitar a sessão ---
  if (url.pathname.startsWith('/auth/v1')) {
    const claims = decodeJwt(req.headers.authorization)
    const body = {
      id: claims?.sub ?? null,
      aud: 'authenticated',
      role: claims?.role ?? 'authenticated',
      email: claims?.email ?? 'dev@local',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    }
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(url.pathname.endsWith('/user') ? body : { user: body }))
  }

  // --- /rest/v1 -> PostgREST ---
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const payload = chunks.length > 0 ? Buffer.concat(chunks) : undefined

  const target = PGRST + url.pathname.replace(/^\/rest\/v1/, '') + url.search
  const headers = { ...req.headers }
  delete headers.host
  delete headers.connection
  delete headers['content-length']
  delete headers.origin

  try {
    const upstream = await fetch(target, { method: req.method, headers, body: payload })
    const text = await upstream.text()
    const out = { ...CORS, 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' }
    const range = upstream.headers.get('content-range')
    if (range) out['content-range'] = range
    res.writeHead(upstream.status, out)
    res.end(text)
  } catch (error) {
    res.writeHead(502, { ...CORS, 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: String(error) }))
  }
})

server.listen(PORT, () => {
  console.log(`proxy local: http://localhost:${PORT}  ->  ${PGRST}`)
})
