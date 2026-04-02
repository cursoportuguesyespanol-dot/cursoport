# DualS Proxy — Deploy en Railway

## Estructura
```
server.js          ← proxy Node.js (quita X-Frame-Options de WhatsApp)
package.json       ← dependencias
railway.toml       ← config de deploy
public/
  index.html       ← PWA (la app que usás en el celu)
  manifest.json    ← para instalar como app
  sw.js            ← service worker
  icons/           ← poné acá icon-192.png y icon-512.png
```

---

## PASO 1 — Subir a GitHub

1. Creá una cuenta en github.com (si no tenés)
2. Nuevo repositorio → nombre: `duals-proxy` → público
3. Subí TODOS los archivos de esta carpeta

---

## PASO 2 — Deploy en Railway (gratis)

1. Andá a **railway.app** → "Start a New Project"
2. Elegí **"Deploy from GitHub repo"**
3. Conectá tu cuenta de GitHub y elegí `duals-proxy`
4. Railway detecta el `package.json` y hace el deploy automático
5. Una vez deployado → **Settings → Networking → Generate Domain**
6. Te da una URL tipo: `duals-proxy-production.up.railway.app`

---

## PASO 3 — Configurar la URL en la PWA

1. Abrí `public/index.html`
2. Buscá esta línea (cerca del final, en el `<script>`):
   ```js
   const PROXY_BASE = '';   // <── COMPLETAR DESPUÉS DEL DEPLOY
   ```
3. Completala con tu URL de Railway:
   ```js
   const PROXY_BASE = 'https://duals-proxy-production.up.railway.app';
   ```
4. Guardá y volvé a subir el archivo a GitHub (Railway se redeploya solo)

---

## PASO 4 — Usar en el celu

1. Abrí la URL de Railway en Chrome Android
2. Menú ⋮ → **"Agregar a pantalla de inicio"**
3. Abrís la app → tocás "Línea secundaria"
4. Escaneás el QR con el otro celu
5. ¡Listo! La sesión queda guardada

---

## Alternativa: Render.com

Si preferís Render:
1. render.com → "New Web Service" → conectá GitHub
2. Build command: `npm install`
3. Start command: `node server.js`
4. Free plan → Deploy
5. Usá la URL que te da en `PROXY_BASE`

---

## Notas técnicas

- El proxy corre en Node.js con `http-proxy-middleware`
- Remueve `X-Frame-Options` y `Content-Security-Policy` de las respuestas de WhatsApp
- Modifica las cookies para `SameSite=None; Secure` (necesario para iframe)
- WebSockets habilitados (`ws: true`) para la conexión en tiempo real de WhatsApp
- El plan gratuito de Railway da 500hs/mes — más que suficiente
