import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Make server-side env vars available to api/db.js during dev
  process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL
  process.env.VITE_SUPABASE_SERVICE_KEY = env.VITE_SUPABASE_SERVICE_KEY

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-dev-server',
        configureServer(server) {
          server.middlewares.use('/api/db', (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }
            const chunks = []
            req.on('data', chunk => chunks.push(chunk))
            req.on('end', async () => {
              try {
                req.body = JSON.parse(Buffer.concat(chunks).toString())
                const mockRes = {
                  _code: 200,
                  status(code) { this._code = code; return this },
                  json(data) {
                    res.statusCode = this._code
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify(data))
                  },
                }
                const { default: handler } = await import('./api/db.js')
                await handler(req, mockRes)
              } catch (e) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: e.message }))
              }
            })
          })
        },
      },
    ],
  }
})
