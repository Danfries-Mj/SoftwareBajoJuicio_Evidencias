-- =====================================================================
-- 02_pruebas_bd.sql – Evidencias directas sobre la base de datos
-- Auditoría del Sistema de Gestión Parroquial
--
-- Ejecutar sobre la base RESTAURADA SIN MODIFICAR (sys_original), ANTES de
-- 01_preparar_bd_pruebas.sql, porque CP-AUT-15 mide las contraseñas reales.
-- Las pruebas de escritura van dentro de BEGIN ... ROLLBACK: no dejan cambios.
--
-- Uso (guarda la salida completa como evidencia):
--   psql -U postgres -d sys_original -f 02_pruebas_bd.sql -o EV-F07-BD.txt
-- =====================================================================
\pset pager off
\pset footer off
\echo '=== IDENTIFICACIÓN DE LA EJECUCIÓN ==='
SELECT now() AS fecha_hora, current_database() AS base, version() AS motor;

-- ---------------------------------------------------------------------
\echo ''
\echo '=== CP-AUT-15 | RNF-AUT-01 | Contraseñas almacenadas como hash bcrypt ==='
\echo 'Esperado: 100 % de usuarios con hash bcrypt de coste >= 10'
SELECT count(*) AS total_usuarios,
       count(*) FILTER (WHERE contrasena_hash ~ '^\$2[aby]\$(1[0-9]|[2-9][0-9])\$') AS con_bcrypt_coste_10_o_mas,
       round(100.0 * count(*) FILTER (WHERE contrasena_hash ~ '^\$2[aby]\$(1[0-9]|[2-9][0-9])\$') / count(*), 1) AS porcentaje,
       CASE WHEN count(*) = count(*) FILTER (WHERE contrasena_hash ~ '^\$2[aby]\$(1[0-9]|[2-9][0-9])\$') THEN 'PASA' ELSE 'FALLA' END AS estado
FROM usuarios;

-- ---------------------------------------------------------------------
\echo ''
\echo '=== CP-AUT-16 | RF-AUT-01 (bitácora) y RNF-AUT-01 | Autor y datos sensibles en la auditoría ==='
\echo 'Esperado (P): 100 % de registros con autor y 0 registros con hash de contraseña'
SELECT tabla_afectada,
       count(*) AS registros,
       count(*) FILTER (WHERE id_usuario IS NOT NULL) AS con_autor,
       count(*) FILTER (WHERE detalle ? 'contrasena_hash') AS con_hash_de_contrasena
FROM auditoria GROUP BY tabla_afectada ORDER BY tabla_afectada;
SELECT count(*) AS total,
       round(100.0 * count(*) FILTER (WHERE id_usuario IS NOT NULL) / count(*), 1) AS porcentaje_con_autor,
       count(*) FILTER (WHERE detalle ? 'contrasena_hash') AS con_hash,
       CASE WHEN count(*) FILTER (WHERE id_usuario IS NULL) = 0 AND count(*) FILTER (WHERE detalle ? 'contrasena_hash') = 0
            THEN 'PASA' ELSE 'FALLA' END AS estado
FROM auditoria;

-- ---------------------------------------------------------------------
\echo ''
\echo '=== CP-FIN-17 | RNF-FIN-02 | Conciliación: saldo de cada fondo = suma de sus movimientos ==='
SELECT f.id_fondo, f.nombre, f.saldo_actual,
       COALESCE(sum(CASE WHEN m.tipo = 'Ingreso' THEN m.monto ELSE -m.monto END), 0) AS suma_movimientos,
       f.saldo_actual - COALESCE(sum(CASE WHEN m.tipo = 'Ingreso' THEN m.monto ELSE -m.monto END), 0) AS diferencia,
       CASE WHEN f.saldo_actual = COALESCE(sum(CASE WHEN m.tipo = 'Ingreso' THEN m.monto ELSE -m.monto END), 0) THEN 'PASA' ELSE 'FALLA' END AS estado
FROM fondos f LEFT JOIN movimientos_financieros m ON m.id_fondo = f.id_fondo
GROUP BY f.id_fondo ORDER BY f.id_fondo;

-- ---------------------------------------------------------------------
\echo ''
\echo '=== CP-FIN-18 | RNF-FIN-02 | El motor rechaza montos negativos o cero ==='
\echo 'Esperado: ERROR de restricción al insertar. Si aparece INSERT 0 1, el motor lo aceptó (FALLA).'
BEGIN;
INSERT INTO movimientos_financieros (tipo, id_fondo, monto, fecha, registrado_por)
VALUES ('Ingreso', (SELECT min(id_fondo) FROM fondos), -100, CURRENT_DATE, (SELECT min(id_usuario) FROM usuarios));
SELECT CASE WHEN count(*) > 0 THEN 'FALLA: el motor aceptó un monto negativo' ELSE 'PASA' END AS estado
FROM movimientos_financieros WHERE monto <= 0;
ROLLBACK;

-- ---------------------------------------------------------------------
\echo ''
\echo '=== CP-FIN-19 | RF-FIN-06 | El motor impide dos cierres parroquiales del mismo mes ==='
\echo 'Esperado: ERROR de unicidad en el segundo INSERT.'
BEGIN;
INSERT INTO cierres_mes (mes, anio, total_ingresos, total_egresos, generado_por, id_capilla)
VALUES (1, 2030, 0, 0, (SELECT id_usuario FROM usuarios WHERE rol = 'Sacerdote' LIMIT 1), NULL);
INSERT INTO cierres_mes (mes, anio, total_ingresos, total_egresos, generado_por, id_capilla)
VALUES (1, 2030, 0, 0, (SELECT id_usuario FROM usuarios WHERE rol = 'Sacerdote' LIMIT 1), NULL);
SELECT count(*) AS cierres_parroquiales_enero_2030,
       CASE WHEN count(*) > 1 THEN 'FALLA: el motor aceptó el duplicado' ELSE 'PASA' END AS estado
FROM cierres_mes WHERE mes = 1 AND anio = 2030 AND id_capilla IS NULL;
ROLLBACK;

-- ---------------------------------------------------------------------
\echo ''
\echo '=== CP-HOR-06 | RNF-HOR-01 | El motor impide horarios duplicados (capilla, día, hora) ==='
\echo 'Esperado: ERROR de unicidad en el INSERT.'
BEGIN;
INSERT INTO eucaristias (id_capilla, dia_semana, fecha, hora_inicio, estado)
VALUES (1, 'Domingo', '2030-01-06', '08:00', 'Programada'),
       (1, 'Domingo', '2030-01-06', '08:00', 'Programada');
SELECT count(*) AS horarios_iguales,
       CASE WHEN count(*) > 1 THEN 'FALLA: el motor aceptó el duplicado' ELSE 'PASA' END AS estado
FROM eucaristias WHERE id_capilla = 1 AND fecha = '2030-01-06' AND hora_inicio = '08:00';
ROLLBACK;

-- ---------------------------------------------------------------------
\echo ''
\echo '=== Inventario del esquema (contexto para la Fase 2 y la Fase 3) ==='
SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tablas,
       (SELECT count(*) FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY') AS llaves_foraneas,
       (SELECT count(*) FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_type = 'UNIQUE') AS restricciones_unique,
       (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal) AS triggers,
       (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname NOT LIKE '%pkey' AND indexname NOT LIKE '%key') AS indices_adicionales;
\echo ''
\echo '=== FIN ==='
