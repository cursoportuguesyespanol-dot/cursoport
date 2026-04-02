const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));

// ── Health check ─────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── Archivos estáticos desde la RAÍZ ─────────────────
app.use(express.static(path.join(__dirname)));

// ── Ruta raíz explícita ───────────────────────────────
app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Proxy hacia WhatsApp Web (SOLO /wa/*) ─────────────
const waProxy = createProxyMiddleware({
  target: 'https://web.whatsapp.com',
  changeOrigin: true,
  secure: true,
  ws: true,
  pathRewrite: { '^/wa': '' },
  selfHandleResponse: false,
  on: {
    proxyReq: (proxyReq) => {
      proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      proxyReq.setHeader('Accept-Language', 'es-AR,es;q=0.9');
      proxyReq.setHeader('Host', 'web.whatsapp.com');
      proxyReq.removeHeader('x-forwarded-for');
    },
    proxyRes: (proxyRes) => {
      delete proxyRes.headers['x-frame-options'];
      delete proxyRes.headers['content-security-policy'];
      delete proxyRes.headers['content-security-policy-report-only'];
      delete proxyRes.headers['x-content-type-options'];

      const cookies = proxyRes.headers['set-cookie'];
      if (cookies) {
        proxyRes.headers['set-cookie'] = cookies.map(cookie =>
          cookie
            .replace(/SameSite=Strict/gi, 'SameSite=None')
            .replace(/SameSite=Lax/gi, 'SameSite=None')
            + (cookie.toLowerCase().includes('samesite') ? '' : '; SameSite=None')
            + (cookie.toLowerCase().includes('secure') ? '' : '; Secure')
        );
      }
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

// ── SPA fallback ──────────────────────────────────────
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ DualS corriendo en puerto ${PORT}`);
});
