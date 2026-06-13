# Menú semanal — recetas, validador, plan y adherencia

> 🇪🇸 Versión en español. · 🇬🇧 [English version](README.md)

App web para gestionar las comidas y que cumplan un plan nutricional basado en
el **método de los bloques**. Permite explorar recetas, validarlas contra el
patrón objetivo según el tipo de comida, autoajustar cantidades, planificar la
semana, generar la lista de la compra, registrar la adherencia y pedir a una IA
equivalencias por bloques y recetas completas.

> **Nota sobre el idioma:** el código (identificadores, funciones, nombres de
> fichero, rutas de la API) está en inglés. Los **datos persistidos** (claves
> JSON y valores enum como `nombre`, `tipo_comida`, `desayuno`,
> `carbohidratos`) y los **textos de la interfaz** se mantienen en español a
> propósito: modelan un dominio nutricional en español y no se tocan.

## Arranque rápido

```bash
npm install
npm start            # http://127.0.0.1:3000
# Las funciones de IA necesitan una clave de Anthropic:
export ANTHROPIC_API_KEY=sk-ant-...
```

El primer arranque siembra el login con **usuario `test` / contraseña `test`**
(cámbialo desde el botón **Cuenta**). Sin `ANTHROPIC_API_KEY` todo funciona
salvo las pestañas de IA, que devuelven un error claro.

## Arquitectura

Sin paso de build. Backend Node.js + Express con persistencia en ficheros JSON;
frontend HTML/CSS/JS vanilla servido estáticamente; SDK de Anthropic para la IA.

El backend está en capas (controlador → servicio → repositorio), en la línea de
una app Spring:

```
app/
├── server.js                     # Punto de entrada (solo arranca la app)
├── src/
│   ├── app.js                    # Factoría de la app Express (middleware + rutas)
│   ├── config.js                 # Configuración central (env, rutas, límites)
│   ├── errors.js                 # Errores de dominio con código HTTP
│   ├── validation.js             # Validación/saneo whitelist de la entrada
│   ├── middleware/
│   │   ├── security.js           # Helmet+CSP, check de Origin, rate limiters
│   │   ├── auth.js               # Parseo de cookies + guard requireAuth
│   │   └── errorHandler.js       # Respuestas de error sin fugas internas
│   ├── routes/                   # Endpoints HTTP
│   ├── services/                 # Lógica de negocio (recetas, alias, IA, auth…)
│   └── repositories/             # Acceso a datos JSON (atómico + lock por fichero)
├── datos/                        # Datos (los nombres de fichero siguen en español)
│   ├── recetas.json              # Recetas
│   ├── equivalencias.json        # Categorías, equivalencias por bloque, reglas
│   ├── alias.json                # Equivalencias aprobadas por el usuario (IA)
│   ├── plan.json                 # Plan semanal (día → comida → receta)
│   ├── registro.json             # Adherencia (fecha → comida → ok/fallo)
│   ├── auth.json                 # Credenciales (hash + secreto de sesión) — en gitignore
│   └── .versions/                # Copias previas de cada fichero (últimas 10)
└── public/
    ├── index.html                # Layout + 7 pestañas + login
    ├── manifest.webmanifest      # PWA instalable
    ├── sw.js                     # Service worker (offline, network-first)
    ├── icons/                    # Iconos PWA 192/512
    ├── css/styles.css
    └── js/
        ├── utils.js              # escapeHtml, toast, cap (compartidos)
        ├── auth-view.js          # Gate de login, logout, cambio de credenciales
        ├── blocks.js             # Motor: alias, bloques, validación, ajuste
        ├── data.js               # Cliente HTTP con cache en memoria
        ├── recipes-view.js       # Listado + filtros + editar/borrar
        ├── validator-view.js     # Formulario + validación + guardar/actualizar
        ├── adjust-view.js        # Calcula cantidades + sugerencia de receta IA
        ├── equivalences-view.js  # Listado de alias + consulta IA + borrado
        ├── plan-view.js          # Planificador semanal
        ├── shopping-view.js      # Lista de la compra agregada
        ├── log-view.js           # Registro de adherencia semanal
        └── app.js                # Bootstrap + pestañas + service worker
```

## Autenticación

Login de **un solo usuario** (no hay espacios separados; solo da acceso a la app).

- Credenciales iniciales: **usuario `test`, contraseña `test`**. Cámbialas desde
  el botón **Cuenta** de la cabecera.
- La contraseña se guarda **hasheada con scrypt** (sal por usuario) en
  `datos/auth.json`, junto a un secreto de sesión aleatorio. Ese fichero **no se
  incluye en la imagen Docker ni en git** y se crea al primer arranque.
- La sesión es un token firmado con HMAC-SHA256 en una cookie
  `HttpOnly; SameSite=Strict`. Cambiar las credenciales rota el secreto e
  **invalida las sesiones anteriores**.
- El login tiene rate limit (10 intentos / 15 min).

Si olvidas la contraseña, borra `datos/auth.json` y reinicia: se regenera como
`test`/`test`.

## Funcionalidades

1. **Recetas** — grid con filtros por tipo de comida, ingrediente y macros; editar y borrar.
2. **Plan** — 7 días × 4 comidas; asigna una receta a cada hueco.
3. **Compra** — agrega los ingredientes de las recetas planificadas, suma cantidades, agrupa por categoría; marca lo que ya tienes (se recuerda en el dispositivo).
4. **Registro** — semana navegable con ✓/✗ por comida planificada y % de adherencia semanal.
5. **Validador** — comprueba una receta contra el patrón de bloques del tipo de comida, lista incidencias, autocorrige cantidades y guarda/actualiza.
6. **Ajuste** — lista ingredientes y obtén las cantidades que encajan, o pide a la IA una receta completa.
7. **Equivalencias (IA)** — consulta a Claude la equivalencia por bloques de un alimento, revísala y apruébala; borra las aprobadas.
8. **Backup / PWA** — *Exportar datos* descarga todo en JSON; cada escritura guarda la versión anterior en `datos/.versions/`. PWA instalable, usable offline con los últimos datos vistos.

## API REST

Todos los endpoints devuelven JSON; los errores responden con
`{"error": "mensaje"}`. Salvo las rutas `/api/auth`, **todos exigen sesión**
(cookie `menu_sid`); sin ella responden `401`. Las claves de los payloads JSON
siguen en español.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/auth/me` | Estado de la sesión `{ authenticated, username }`. Nunca 401. |
| `POST` | `/api/auth/login` | Inicia sesión `{ username, password }`. Fija la cookie. 401 si falla. Rate limit 10/15 min. |
| `POST` | `/api/auth/logout` | Cierra la sesión (borra la cookie). |
| `POST` | `/api/auth/change` | Cambia usuario y/o contraseña `{ currentPassword, newUsername?, newPassword? }`. Rota el secreto. |
| `GET` | `/api/recipes` | Todas las recetas. |
| `POST` | `/api/recipes` | Crea una receta. 400 inválida; 409 nombre duplicado. |
| `PUT` | `/api/recipes/:name` | Actualiza (y renombra) una receta. 404 / 409. |
| `DELETE` | `/api/recipes/:name` | Borra una receta. 204 / 404. |
| `GET` | `/api/equivalences` | `datos/equivalencias.json` tal cual. |
| `GET` | `/api/aliases` | Alias aprobados. |
| `POST` | `/api/aliases` | Upsert de un alias por nombre normalizado. |
| `DELETE` | `/api/aliases/:name` | Borra un alias aprobado. 204 / 404. |
| `GET` | `/api/plan` | Plan semanal. |
| `PUT` | `/api/plan` | Reemplaza el plan completo. 400 si referencia recetas inexistentes. |
| `GET` | `/api/log` | Registro de adherencia `{ "YYYY-MM-DD": { desayuno: "ok"|"fallo" } }`. |
| `PUT` | `/api/log/:date` | Marca una comida `{ comida, estado: "ok"|"fallo"|null }`. |
| `GET` | `/api/backup` | Descarga todos los datos en un único JSON. |
| `POST` | `/api/ai/equivalence` | Pide a Claude la equivalencia por bloques `{ nombre, contexto? }` → `{ alias }`. 503 sin clave. Rate limit 20/h. |
| `POST` | `/api/ai/recipe` | Pide a Claude una receta completa `{ tipo_comida, ingredientes: [...] }` → `{ receta, justificacion }`. |

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `ANTHROPIC_API_KEY` | Solo IA | Clave de Anthropic. El SDK la lee automáticamente. |
| `PORT` | No | Puerto HTTP (por defecto 3000). |
| `HOST` | No | Interfaz de escucha (por defecto `127.0.0.1`; el contenedor usa `0.0.0.0`). |
| `COOKIE_SECURE` | No | `true` para marcar la cookie de sesión como `Secure` (tras HTTPS). |

## Almacenamiento

Los datos se guardan como ficheros JSON en `datos/` (escritura atómica, lock por
fichero, copias versionadas) — suficiente y robusto para un solo usuario. Si la
app crece (multiusuario, búsquedas en servidor, un registro de adherencia grande),
el siguiente paso natural es **SQLite**; el plan está en
[docs/sqlite-migration.md](docs/sqlite-migration.md) y se sigue en la rama
`feature/sqlite-migration`. Como el acceso a datos está aislado en la capa de
repositorios, solo cambiaría `src/repositories/*`.

## Tests

Tres capas, sin tocar los datos reales (se ejecutan contra un `DATA_DIR` temporal):

```bash
npm test               # unitarios + integración
npm run test:unit         # node:test — validación, motor de bloques, servicio de auth
npm run test:integration  # supertest — API completa con sesión
npx playwright install --with-deps chromium   # una vez: instala el navegador + librerías del sistema (requiere root / CI)
npm run test:e2e          # Playwright — flujos de navegador (login, recetas, plan)
```

- **Unitarios** (`tests/unit/`): `validation.js`, el motor de bloques (`public/js/blocks.js`, cargado en un VM de Node) y `authService` (hash scrypt, rotación de token).
- **Integración** (`tests/integration/`): la app Express vía `supertest` — gate de auth, CRUD de recetas, alias, plan, registro, backup, la ruta 503 de IA, la cabecera CSP y el 403 de origen cruzado.
- **E2E** (`tests/e2e/`): Playwright maneja un navegador real contra un servidor desechable (`tests/e2e/start-server.js`). El navegador necesita librerías del sistema; en una máquina nueva ejecuta antes `npx playwright install --with-deps chromium` (requiere root / CI). Configuración en `playwright.config.js`.

Los tests fijan `NODE_ENV=test` (rate limits relajados) y nunca usan una API key real de Anthropic.

## Notas de seguridad

La API key solo vive en el servidor; la entrada se valida/sanea con whitelist;
la salida se escapa en HTML (XSS); Helmet + CSP estricta; check de mismo origen
en mutaciones; rate limits en escrituras, IA y login; escrituras atómicas con
lock por fichero; 500 genéricos sin filtrar detalles internos. La app escucha en
localhost por defecto. Para exponerla en tu LAN, publica el puerto y añade HTTPS
(`COOKIE_SECURE=true`).

## Docker

```bash
cp .env.example .env        # ajusta ANTHROPIC_API_KEY / APP_PORT si quieres
docker compose up -d --build
```

Por defecto el puerto se publica en **todas las interfaces** (`0.0.0.0:3000`),
así que la app es accesible desde tu LAN y por VPN hacia tu LAN. `datos/` se
monta como volumen; el entrypoint siembra los ficheros de datos en el primer
arranque sin sobreescribir los existentes. `auth.json` se crea en tiempo de
ejecución dentro del volumen y nunca se hornea en la imagen. El contenedor tiene
un healthcheck en `/api/health`.

### Desplegar en un servidor Ubuntu (acceso LAN + VPN)

```bash
# En el servidor (con Docker + plugin Docker Compose instalados):
git clone <tu-repo> gimnasio && cd gimnasio/app   # o copia la carpeta
cp .env.example .env                               # edítalo si hace falta
docker compose up -d --build
```

Luego ábrela desde cualquier dispositivo de tu LAN (o conectado por VPN):

```
http://<IP-LAN-del-servidor>:3000      ej. http://192.168.1.50:3000
```

Entra con `test` / `test` y cambia las credenciales desde el botón **Cuenta**
cuanto antes.

Notas para este escenario:

- **Sin problemas de CORS/Origin.** El check de mismo origen compara el `Origin`
  del navegador con la cabecera `Host`, así que acceder a `http://192.168.1.50:3000`
  funciona tal cual. Las peticiones cross-site siguen bloqueadas.
- **Mantén `COOKIE_SECURE=false`** (el valor por defecto) mientras sirvas por HTTP
  plano. La cookie de sesión es `HttpOnly; SameSite=Strict`; marcarla `Secure`
  sobre HTTP impediría que se enviara. Ponla a `true` solo si añades HTTPS.
- **Firewall de Ubuntu (si usas UFW):** `sudo ufw allow 3000/tcp` (o restríngelo a
  la subred de tu VPN, p. ej. `sudo ufw allow from 10.0.0.0/24 to any port 3000`).
- **La instalación/uso offline de la PWA necesita HTTPS** con un certificado *de
  confianza*. Sobre LAN por HTTP la app funciona del todo pero no es instalable
  (el service worker exige contexto seguro). Mira la sección siguiente para
  habilitarlo.
- **Actualizar:** `git pull && docker compose up -d --build`. Tu volumen `datos/`
  (recetas, plan, registro, credenciales) se conserva entre reconstrucciones.

### HTTPS + PWA instalable (reverse proxy)

Un segundo fichero compose, `docker-compose.https.yml`, pone un reverse proxy
**Caddy** delante de la app. Caddy obtiene y renueva solo un certificado TLS de
confianza; ese certificado válido es lo que hace la PWA instalable y activa el
service worker. Además te pone `COOKIE_SECURE=true` y `TRUST_PROXY=1`, y la app
deja de estar expuesta directamente (solo Caddy escucha en 80/443).

```bash
cp .env.example .env
# pon DOMAIN=menu.midominio.com  (y TLS_EMAIL, ANTHROPIC_API_KEY)
docker compose -f docker-compose.https.yml up -d --build
```

Luego abre `https://menu.midominio.com`, inicia sesión y usa la opción
**Instalar aplicación** del navegador.

Elige el modo según tu red:

- **Dominio público (recomendado).** Apunta un dominio tuyo al servidor y haz que
  los puertos 80/443 sean accesibles desde internet (port-forward). Caddy obtiene
  un certificado gratuito de Let's Encrypt automáticamente, sin más. Puedes seguir
  restringiendo el acceso real a tu VPN/LAN en el firewall y dejar 80/443 abiertos
  solo para el reto ACME, o usar la opción DNS de abajo.
- **Solo interno (VPN/LAN, sin puertos públicos).** Usa un dominio cuyo DNS
  resuelva a la IP privada del servidor (tu router/Pi-hole o `/etc/hosts`), y:
  - descomenta `tls internal` en el `Caddyfile` e instala la CA raíz de Caddy en
    cada dispositivo (así el certificado local es de confianza y la PWA se
    instala), o
  - usa una imagen de Caddy con plugin de proveedor DNS y el reto ACME **DNS-01**
    para obtener un certificado real de Let's Encrypt sin abrir ningún puerto.
- **Firewall:** `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp` (o limítalos a
  la subred de tu VPN).

`caddy_data` (volumen con nombre) conserva los certificados entre reinicios.
