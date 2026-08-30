import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = dirname(fileURLToPath(import.meta.url))

createServer((req, res) => {
  const head = () => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  }
  if (req.method === 'OPTIONS') {
    head()
    res.writeHead(204)
    return res.end()
  }
  let body = ''
  req.on('data', (c) => {
    body += c
  })
  req.on('end', () => {
    try {
      const { name, dataUrl } = JSON.parse(body)
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(name)) throw new Error('bad name')
      const b64 = dataUrl.replace(/^data:image\/png;base64,/, '')
      writeFileSync(join(out, name + '.png'), Buffer.from(b64, 'base64'))
      head()
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok ' + name)
    } catch (e) {
      head()
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('err ' + e.message)
    }
  })
}).listen(8899, '127.0.0.1', () => console.log('shot server on 8899 -> ' + out))
