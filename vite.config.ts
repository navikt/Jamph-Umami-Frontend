import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

const parseBasicAuth = (raw?: string) => {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    const username = parsed?.username || parsed?.user
    const password = parsed?.password || parsed?.pass
    if (username && password) return { username, password }
  } catch {
    // Not JSON, continue.
  }

  const separatorIndex = raw.indexOf(':')
  if (separatorIndex !== -1) {
    return {
      username: raw.slice(0, separatorIndex),
      password: raw.slice(separatorIndex + 1),
    }
  }

  // Support password-only basic-auth values.
  return { username: 'jamph', password: raw }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const basicAuth = parseBasicAuth(env['basic-auth'] || env.BASIC_AUTH)

  return {
    plugins: [
      react(),
      {
        name: 'dev-basic-auth',
        configureServer(server) {
          if (!basicAuth) return

          server.middlewares.use((req, res, next) => {
            const request = req as any
            const url = request.url || ''
            if (url === '/isalive' || url === '/isready') return next()

            const authHeader = request.headers?.authorization as string | undefined
            if (!authHeader || !authHeader.startsWith('Basic ')) {
              res.setHeader('WWW-Authenticate', 'Basic realm="Restricted", charset="UTF-8"')
              res.statusCode = 401
              res.end('Authentication required')
              return
            }

            const encoded = authHeader.split(' ')[1]
            const decoded = typeof (globalThis as any).atob === 'function' ? (globalThis as any).atob(encoded) : ''
            const idx = decoded.indexOf(':')
            const username = idx === -1 ? decoded : decoded.slice(0, idx)
            const password = idx === -1 ? '' : decoded.slice(idx + 1)

            if (username === basicAuth.username && password === basicAuth.password) {
              return next()
            }

            res.setHeader('WWW-Authenticate', 'Basic realm="Restricted", charset="UTF-8"')
            res.statusCode = 401
            res.end('Authentication required')
          })
        },
      },
    ],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  }
})
