-- ==========================================
-- 0) Extensión para SHA-256 (pgcrypto)
-- ==========================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================
-- 1) Tablas
-- ==========================================

-- Tabla principal de pasos del proceso
CREATE TABLE IF NOT EXISTS process_steps (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(180) NOT NULL,
  description  VARCHAR(400),
  step_order   INT DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP NOT NULL DEFAULT now()
);

-- Índices/únicos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_step_name'
  ) THEN
    CREATE UNIQUE INDEX uq_step_name ON process_steps (name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_step_name'
  ) THEN
    CREATE INDEX idx_step_name ON process_steps (name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_step_order'
  ) THEN
    CREATE INDEX idx_step_order ON process_steps (step_order);
  END IF;
END$$;

-- Historial/eventos (blockchain simulado)
CREATE TABLE IF NOT EXISTS process_events (
  id             SERIAL PRIMARY KEY,
  step_id        INT NOT NULL REFERENCES process_steps(id) ON DELETE CASCADE,
  action         VARCHAR(20) NOT NULL,     -- CREATE | UPDATE
  hash           VARCHAR(64) NOT NULL,     -- SHA-256 hex
  previous_hash  VARCHAR(64),
  payload        JSONB NOT NULL,           -- snapshot de los campos firmados
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);

-- Índices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_event_step'
  ) THEN
    CREATE INDEX idx_event_step ON process_events (step_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_event_hash'
  ) THEN
    CREATE INDEX idx_event_hash ON process_events (hash);
  END IF;

  -- útil si consultas por step_id + created_at
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_event_step_created'
  ) THEN
    CREATE INDEX idx_event_step_created ON process_events (step_id, created_at DESC);
  END IF;
END$$;

-- ==========================================
-- 2) Helpers para hashing (opcional, pero cómodo)
--    Encapsulan el cálculo del bloque y su SHA-256.
-- ==========================================
-- Nota: encode(digest(...,'sha256'),'hex') -> hash hex de 64 chars

CREATE OR REPLACE FUNCTION zeyo_build_block(
  p_previous_hash TEXT,
  p_action        TEXT,
  p_step_id       INT,
  p_payload       JSONB,
  p_timestamp     TEXT
) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT
    (COALESCE(p_previous_hash, 'GENESIS') || '|' ||
     p_action || '|' ||
     p_step_id::text || '|' ||
     p_payload::text || '|' ||
     p_timestamp)
$$;

CREATE OR REPLACE FUNCTION zeyo_sha256_hex(p_text TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(digest(p_text, 'sha256'), 'hex')
$$;

-- ==========================================
-- 3) Inserts de ejemplo en process_steps
-- ==========================================
INSERT INTO process_steps (name, description, step_order)
VALUES
  ('Solicitud de Cotización', NULL, 0),
  ('Orden de Compra',         NULL, 1),
  ('Solicitud de Compra',     NULL, 2),
  ('Recepción de Compra',     NULL, 3),
  ('Registro de Factura',     NULL, 4)
ON CONFLICT (name) DO NOTHING;

-- ==========================================
-- 4) Inserts en process_events
--    - Creamos un evento CREATE por cada step (bloque génesis).
--    - Luego un UPDATE de ejemplo para el primer step (encadenado).
-- ==========================================

-- 4.1) Evento CREATE para todos los steps (si no existen eventos previos)
WITH s AS (
  SELECT id, name, description, step_order FROM process_steps
),
to_insert AS (
  SELECT
    s.id             AS step_id,
    'CREATE'         AS action,
    jsonb_build_object(
      'name', s.name,
      'description', s.description,
      'stepOrder', s.step_order,
      'timestamp', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )                AS payload
  FROM s
  WHERE NOT EXISTS (SELECT 1 FROM process_events e WHERE e.step_id = s.id)
),
hashed AS (
  SELECT
    step_id,
    action,
    NULL::TEXT AS previous_hash,
    payload,
    zeyo_sha256_hex(
      zeyo_build_block(NULL, action, step_id, payload, payload->>'timestamp')
    ) AS hash
  FROM to_insert
)
INSERT INTO process_events (step_id, action, hash, previous_hash, payload)
SELECT step_id, action, hash, previous_hash, payload
FROM hashed;

-- 4.2) Evento UPDATE de ejemplo SOLO para el primer step (encadenado)
--     Actualizamos la descripción del primer paso y generamos un nuevo evento.
DO $$
DECLARE
  v_step_id       INT;
  v_prev_hash     TEXT;
  v_payload       JSONB;
  v_timestamp     TEXT;
  v_block         TEXT;
  v_hash          TEXT;
BEGIN
  SELECT id INTO v_step_id
  FROM process_steps
  WHERE name = 'Solicitud de Cotización'
  LIMIT 1;

  IF v_step_id IS NULL THEN
    RAISE NOTICE 'No existe el step "Solicitud de Cotización", se omite UPDATE.';
    RETURN;
  END IF;

  -- Simulamos una actualización del paso
  UPDATE process_steps
  SET description = 'Paso inicial para solicitar cotizaciones',
      updated_at  = now()
  WHERE id = v_step_id;

  -- Último hash previo (para encadenar)
  SELECT e.hash
    INTO v_prev_hash
  FROM process_events e
  WHERE e.step_id = v_step_id
  ORDER BY e.id DESC
  LIMIT 1;

  -- Construimos el payload (snapshot actual)
  v_timestamp := to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  SELECT jsonb_build_object(
           'name', s.name,
           'description', s.description,
           'stepOrder', s.step_order,
           'timestamp', v_timestamp
         )
    INTO v_payload
  FROM process_steps s
  WHERE s.id = v_step_id;

  -- Bloque y hash encadenado
  v_block := zeyo_build_block(v_prev_hash, 'UPDATE', v_step_id, v_payload, v_timestamp);
  v_hash  := zeyo_sha256_hex(v_block);

  INSERT INTO process_events (step_id, action, hash, previous_hash, payload)
  VALUES (v_step_id, 'UPDATE', v_hash, v_prev_hash, v_payload);
END$$;

-- ==========================================
-- 5) Consultas de verificación
-- ==========================================

-- 5.1) Ver historial por cada step (orden cronológico)
-- SELECT step_id, action, previous_hash, hash, payload, created_at
-- FROM process_events
-- ORDER BY step_id, id;

-- 5.2) Verificar cadena de un step (recomputa y compara)
--     Esto muestra el primer evento inconsistente (si lo hubiera).
WITH ev AS (
  SELECT
    e.*,
    LAG(e.hash) OVER (PARTITION BY e.step_id ORDER BY e.id) AS prev
  FROM process_events e
  WHERE e.step_id = (SELECT id FROM process_steps WHERE name = 'Solicitud de Cotización' LIMIT 1)
),
recomputed AS (
  SELECT
    e.id,
    e.step_id,
    e.action,
    e.previous_hash,
    e.hash,
    e.payload,
    e.prev,
    zeyo_sha256_hex(
      zeyo_build_block(e.prev, e.action, e.step_id, e.payload, e.payload->>'timestamp')
    ) AS recomputed
  FROM ev e
)
SELECT *
FROM recomputed
WHERE previous_hash IS DISTINCT FROM prev
   OR hash          IS DISTINCT FROM recomputed;
-- Si no devuelve filas, la cadena está íntegra ✅
