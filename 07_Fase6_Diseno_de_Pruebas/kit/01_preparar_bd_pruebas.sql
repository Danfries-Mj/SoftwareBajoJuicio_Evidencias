-- =====================================================================
-- 01_preparar_bd_pruebas.sql – Prepara la COPIA de pruebas (sys_pruebas)
-- Fija la contraseña Prueba.2026 para todos los usuarios, para que el
-- script de API pueda iniciar sesión con cada rol.
-- NUNCA ejecutar sobre la base de datos real ni sobre sys_original.
-- =====================================================================
\set ON_ERROR_STOP on
DO $$
BEGIN
  IF current_database() NOT LIKE '%prueba%' THEN
    RAISE EXCEPTION 'Este script solo se ejecuta en una base cuyo nombre contenga "prueba" (actual: %)', current_database();
  END IF;
END $$;

UPDATE usuarios SET contrasena_hash = '$2a$10$0HLgkgfREnR/M9HglTX0luyceWVdZquFvgHEMY5lQDCrr1/6M1fzS';  -- bcrypt de "Prueba.2026"

SELECT rol, id_capilla, correo FROM usuarios WHERE activo ORDER BY rol, id_capilla;
