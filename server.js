const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');
const zlib = require('zlib');

const app = express();
const PORT = process.env.PORT || 3000;

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

app.use(cors({ origin: '*' }));
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use(express.static(path.join(__dirname), { index: false }));
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'index.html')));

const waProxy = createProxyMiddleware({
  target: 'https://web.whatsapp.com',
  changeOrigin: true,
  secure: true,
  ws: true,
  pathRewrite: { '^/wa': '' },
  selfHandleResponse: true,   // manejamos la respuesta para poder modificarla

  on: {
    proxyReq: (proxyReq) => {
      proxyReq.setHeader('User-Agent', DESKTOP_UA);
      proxyReq.setHeader('Accept-Language', 'es-AR,es;q=0.9,en;q=0.8');
      proxyReq.setHeader('Host', 'web.whatsapp.com');
      proxyReq.setHeader('Origin', 'https://web.whatsapp.com');
      proxyReq.setHeader('Referer', 'https://web.whatsapp.com/');
      proxyReq.removeHeader('x-forwarded-for');
      proxyReq.removeHeader('x-real-ip');
    },

    proxyRes: (proxyRes, req, res) => {
      // Copiar headers, quitando los que bloquean
      const headers = { ...proxyRes.headers };
      delete headers['x-frame-options'];
      delete headers['content-security-policy'];
      delete headers['content-security-policy-report-only'];
      delete headers['x-content-type-options'];
      delete headers['content-encoding']; // lo manejamos nosotros

      // Forzar cookies cross-site
      if (headers['set-cookie']) {
        headers['set-cookie'] = headers['set-cookie'].map(cookie =>
          cookie
            .replace(/SameSite=Strict/gi, 'SameSite=None')
            .replace(/SameSite=Lax/gi, 'SameSite=None')
            + (cookie.toLowerCase().includes('samesite') ? '' : '; SameSite=None')
            + (cookie.toLowerCase().includes('secure') ? '' : '; Secure')
        );
      }

      const contentType = proxyRes.headers['content-type'] || '';
      const isHTML = contentType.includes('text/html');

      if (!isHTML) {
        // No es HTML → pasarlo directo
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);
        return;
      }

      // Es HTML → descomprimir, inyectar meta viewport desktop, reenviar
      const encoding = proxyRes.headers['content-encoding'];
      let stream = proxyRes;

      if (encoding === 'gzip') stream = proxyRes.pipe(zlib.createGunzip());
      else if (encoding === 'br') stream = proxyRes.pipe(zlib.createBrotliDecompress());
      else if (encoding === 'deflate') stream = proxyRes.pipe(zlib.createInflate());

      let body = '';
      stream.on('data', chunk => body += chunk.toString());
      stream.on('end', () => {
        // Reemplazar meta viewport para forzar modo desktop
        body = body.replace(
          /<meta[^>]*name=["']viewport["'][^>]*>/gi,
          '<meta name="viewport" content="width=1280">'
        );
        // Si no había viewport, agregarlo
        if (!body.includes('name="viewport"') && !body.includes("name='viewport'")) {
          body = body.replace('<head>', '<head><meta name="viewport" content="width=1280">');
        }

        headers['content-length'] = Buffer.byteLength(body);
        res.writeHead(proxyRes.statusCode, headers);
        res.end(body);
      });
      stream.on('error', (err) => {
        console.error('Stream error:', err);
        res.status(500).end('Error procesando respuesta');
      });
    },

    error: (err, req, res) => {
      console.error('Proxy error:', err.message);
      if (res && !res.headersSent) {
        res.status(502).json({ error: 'Proxy error', detail: err.message });
      }
    }
  }
});

app.use('/wa', waProxy);
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`✅ DualS corriendo en puerto ${PORT}`));
