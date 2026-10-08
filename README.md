# elTOQUE Rates API

Servicio Express + TypeScript que consume la **API oficial de Tasas de elTOQUE** y mantiene una caché histórica en SQLite. Ya no realiza scraping de la web.

La API oficial está documentada con OpenAPI 3.0 y expone `GET /v1/trmi` con autenticación Bearer. La consulta admite `date_from` y `date_to`; los intervalos de 24 horas o mayores son rechazados.

## Comportamiento

### Actualización diaria

Todos los días a las **09:00**, en la zona horaria configurada (`America/Havana` por defecto), el scheduler consulta la tasa vigente usando el mismo endpoint que la API oficial, sin parámetros de fecha:

```text
GET https://tasas.eltoque.com/v1/trmi
Authorization: Bearer <ELTOQUE_API_KEY>
```

Las consultas de fechas históricas sí usan `date_from` y `date_to`; para hoy no se envía un intervalo, de modo que el wrapper solicite los mismos datos actuales que la consulta directa a la API oficial.

El resultado se guarda en SQLite y las consultas normales **no vuelven a llamar a elTOQUE**.

### Fecha específica

```http
GET /api/rates/date/2026-09-30
```

Primero se busca `2026-09-30` en SQLite. Si existe, se devuelve directamente. Si no existe, se consulta la API oficial usando `00:00:00`–`23:59:59`, se guarda y se devuelve. Las siguientes consultas para esa fecha utilizan la BD.

## Configuración

```bash
cp .env.example .env
```

Configura tu clave: 

```env
ELTOQUE_API_KEY=TU_CLAVE_REAL
RATE_UPDATE_CRON=0 9 * * *
TIMEZONE=America/Havana
```

`RATE_UPDATE_CRON` define la expresión cron para actualizar las tasas automáticamente.

Para permitir solicitudes desde tu frontend, configura los orígenes separados por comas:

```env
CORS_ORIGINS=http://localhost:5173,https://tu-frontend.com
```

Por defecto se permite `http://localhost:5173`.

## API local

### Última captura almacenada

```http
GET /api/rates
```

Nunca hace una petición externa.

### Todas las tasas de una fecha

```http
GET /api/rates/date/2026-09-30
```

Respuesta de ejemplo:

```json
{
  "rateDate": "2026-09-30",
  "fetchedAt": "2026-10-01T13:00:00.000Z",
  "source": "elTOQUE",
  "sourceUrl": "https://tasas.eltoque.com/v1/trmi",
  "cached": false,
  "rates": [
    { "currency": "ECU", "cup": 860 },
    { "currency": "MLC", "cup": 492.45 },
    { "currency": "USD", "cup": 760 }
  ]
}
```

`cached: false` significa que esa consulta acaba de obtener la fecha desde la API oficial. Una segunda consulta devolverá `cached: true`.

### Una moneda de la última fecha

```http
GET /api/rates/USD
```

### Una moneda de una fecha

```http
GET /api/rates/USD/2026-09-30
```

### Forzar actualización de hoy

```http
POST /api/rates/refresh
```

Siempre consulta la API oficial, aunque ya exista una captura de hoy, y reemplaza los valores almacenados. La respuesta incluye `cached: false` cuando la consulta se realiza correctamente.

### Health

```http
GET /health
```

## Base de datos

`daily_rates` guarda una captura por fecha y `rates` guarda cada moneda de esa captura. La combinación `(rate_date, currency)` es única.

La fecha es la fecha de negocio en `TIMEZONE`, no la fecha UTC del servidor.

## API oficial y límites

La documentación proporcionada indica que la API requiere Bearer JWT, que los límites se aplican por clave API y que el límite por defecto es 60 peticiones por minuto y 10 por segundo. Las respuestas 429 pueden incluir `Retry-After`, que el cliente conserva en el error.

La aplicación nunca imprime la API key en logs ni la devuelve por la API local.

## Tests

```bash
pnpm install
pnpm test
pnpm run typecheck
pnpm run build
```

Los tests no llaman a Internet: mockean la respuesta oficial y verifican autenticación, parseo, manejo de 429 y comportamiento de caché.

Para probar una consulta real después de configurar `.env`:

```bash
pnpm run scrape
```

Aunque el script conserva ese nombre para compatibilidad, ahora realiza una consulta a la **API oficial**, no scraping.

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

## Fuente

Las tasas se almacenan tal como las entrega la API de elTOQUE; el servicio no recalcula ni convierte los valores.
