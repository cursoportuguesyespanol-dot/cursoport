const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS: permite que la PWA llame al proxy ──────────
app.use(cors({ origin: '*' }));

// ── Sirve la PWA estática desde /public ─────────────
app.use(express.static('public'));

// ── Proxy hacia WhatsApp Web ─────────────────────────
const waProxy = createProxyMiddleware({
  target: 'https://web.whatsapp.com',
  changeOrigin: true,
  secure: true,
  ws: true,            // WebSockets (necesario para WA Web)
  selfHandleResponse: false,

  on: {
    proxyReq: (proxyReq, req) => {
      // Hacerse pasar por un browser real
      proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
      proxyReq.setHeader('Accept-Language', 'es-AR,es;q=0.9');
      proxyReq.setHeader('Host', 'web.whatsapp.com');
      proxyReq.removeHeader('x-forwarded-for');
    },

    proxyRes: (proxyRes) => {
      // ── Quitar headers que bloquean el iframe ──────
      delete proxyRes.headers['x-frame-options'];
      delete proxyRes.headers['content-security-policy'];
      delete proxyRes.headers['content-security-policy-report-only'];
      delete proxyRes.headers['x-content-type-options'];

      // ── Forzar cookies como SameSite=None para que funcionen en iframe ──
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

// Rutas que van al proxy de WhatsApp
app.use('/wa', waProxy);

// Health check para Railway/Render
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Todo lo demás sirve la PWA
app.get('*', (_, res) => {
  res.sendFile('index.html', { root: './public' });
});

app.listen(PORT, () => {
  console.log(`✅ DualS proxy corriendo en puerto ${PORT}`);
});
