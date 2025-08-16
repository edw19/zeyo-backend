
# ZEYO — Backend (Express + TypeORM + PostgreSQL)

API REST para gestionar un **catálogo de pasos** de procesos de negocio con **historial encadenado (hash tipo blockchain)**. Incluye validación, manejo centralizado de errores, migraciones TypeORM y un endpoint para verificar la integridad de la cadena por paso.

> Node.js 20+, TypeScript, Express 5, TypeORM 0.3.x, PostgreSQL 14+

---

## ✨ Features

- CRUD de **Steps** con **historial** en `process_events`.
- **Hash encadenado (SHA‑256)** por step (`previous_hash` → `hash`).
- **Validación** con Zod.
- **Errores** centralizados con middleware.
- **Migraciones** con TypeORM (sin `synchronize` en prod).
- Seed opcional con pasos base.
- Docker para PostgreSQL (opcional).

---

## 🗂️ Estructura del proyecto

```
src/
  app.ts
  server.ts
  config/
    data-source.ts
  domain/
    entities/
      ProcessStep.ts
      ProcessEvent.ts
    dtos/
      step.dto.ts
  routes/
    index.ts
    steps.routes.ts
  services/
    steps.service.ts
  middlewares/
    error.middleware.ts
    zod.middleware.ts
  utils/
    hashing.ts
    pagination.ts (opcional)
```

---

## ⚙️ Requisitos

- Node.js **v20+**
- PostgreSQL **14+** (o Docker)
- npm **v9+**

---

## 🔐 Variables de entorno (`.env`)

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=zeyo
NODE_ENV=development
```

---

## 📦 Instalación

```bash
npm install
```

### (Opcional) PostgreSQL con Docker
```yaml
# docker-compose.yml
version: "3.9"
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: zeyo
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - dbdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d zeyo"]
      interval: 5s
      timeout: 5s
      retries: 10
volumes:
  dbdata:
```
```bash
docker compose up -d
```

---

## 🛠️ Compilación y migraciones

**Compilar** y **correr migraciones** (usa DataSource compilado en `dist/`):
```bash
npm run build
npm run typeorm:run
```

Scripts recomendados en `package.json`:
```jsonc
{
  "scripts": {
    "dev": "nodemon --watch src --exec \"node --loader ts-node/esm src/server.ts\"",
    "build": "tsc",
    "start": "node dist/server.js",

    "typeorm": "node ./node_modules/typeorm/cli.js",
    "typeorm:run": "npm run build && node ./node_modules/typeorm/cli.js migration:run -d dist/config/data-source.js",
    "typeorm:revert": "npm run build && node ./node_modules/typeorm/cli.js migration:revert -d dist/config/data-source.js",
    "typeorm:show": "npm run build && node ./node_modules/typeorm/cli.js migration:show -d dist/config/data-source.js",

    "migration:create": "node --loader ts-node/esm ./node_modules/typeorm/cli.js migration:create src/migrations/NamedMigration",
    "migration:generate": "npm run build && node ./node_modules/typeorm/cli.js migration:generate src/migrations/auto -d dist/config/data-source.js",

    "seed": "node --loader ts-node/esm src/seed.ts"
  }
}
```

> Si prefieres CommonJS en lugar de ESM, quita `"type":"module"`, usa `"module":"CommonJS"` en `tsconfig.json` y cambia imports relativos sin la extensión `.js`. El script `dev` puede ser `nodemon --exec ts-node src/server.ts`.

---

## 🚀 Levantar el servidor

### Desarrollo
```bash
npm run dev
# ⇒ 📦 DB connected
# ⇒ 🚀 Server running on http://localhost:3000
```

### Producción
```bash
npm run build
npm start
```

---

## 🧱 Modelo de datos

**process_steps**
- `id` (PK), `name` (unique), `description`, `step_order`
- `created_at`, `updated_at`

**process_events**
- `id` (PK), `step_id` (FK → steps, on delete cascade)
- `action` (`CREATE` | `UPDATE`)
- `hash` (SHA‑256 hex), `previous_hash` (nullable)
- `payload` (JSONB con snapshot), `created_at`

**Índices**: 
- `uq_step_name` en `process_steps(name)`
- `idx_event_step` en `process_events(step_id)`
- (opcional) `idx_event_step_created` en `(step_id, created_at DESC)`

---

## 🔗 Hash encadenado (blockchain-like)

- Al **crear** un step, se registra un evento `CREATE` con `previous_hash = null` (bloque génesis del step).
- En cada **update** se vuelve a firmar el snapshot:
  ```text
  block = previous_hash|action|stepId|JSON(payload)|timestampISO
  hash  = sha256(block)
  ```
- `GET /api/steps/:id/verify` recomputa y confirma integridad.

---

## 🧪 Endpoints

`GET /api/health`  
Ping.

`GET /api/steps`  
Lista de pasos ordenados por `stepOrder`.

`POST /api/steps`
```json
{
  "name": "Solicitud de Cotización",
  "description": null,
  "stepOrder": 0
}
```
Crea el step y genera evento `CREATE` (hash génesis).

`GET /api/steps/:id`  
Detalle de un step.

`PUT /api/steps/:id`
```json
{
  "name": "Solicitud de Cotización",
  "description": "Paso inicial",
  "stepOrder": 0
}
```
Actualiza el step y agrega evento `UPDATE` encadenado.

`GET /api/steps/:id/history`  
Historial de eventos del step.

`GET /api/steps/:id/verify`  
Verifica integridad de la cadena del step.

---

## ✅ Validación y errores

### Validación (Zod)
- `validate(schema)` en rutas `POST/PUT` → `400` con detalles si falla.

### Errores comunes
- `404 Not Found` → step inexistente.
- `409 Conflict` → `name` duplicado (`23505`).
- `500` → cualquier no mapeado, manejado por `errorHandler`.

**Respuesta estándar de error:**
```json
{ "error": true, "message": "..." }
```

---

## 🌱 Seed (opcional)

Inserta los 5 pasos base:
```bash
npm run seed
```

---

## 🔍 Troubleshooting

- **Missing required argument: dataSource**  
  Usa `-d dist/config/data-source.js` en comandos del CLI de TypeORM.

- **Cannot access 'ProcessStep' before initialization**  
  Evita ciclos de import: pon `emitDecoratorMetadata=false` en `tsconfig.json` **o** usa `import type` en entidades.

- **Unknown file extension ".ts"**  
  En ESM, ejecuta con loader: `node --loader ts-node/esm src/server.ts` (el script `dev` ya lo hace).

- **no existe la columna ProcessEvent.stepId**  
  La columna real es `step_id`. Anota la relación con `@JoinColumn({ name: 'step_id' })` en `ProcessEvent` **o** configura una naming strategy snake_case.

---

## 🔒 Seguridad y buenas prácticas

- Desactivar `synchronize` en prod (usar migraciones).
- Validar y sanear input (Zod).
- Manejo de errores uniforme y sin stacks en prod.
- Logs estructurados y `requestId` (p.ej., con pino).
- Backups de BD y pruebas en staging antes de prod.



## 👤 Autor
Edwin Narváez
