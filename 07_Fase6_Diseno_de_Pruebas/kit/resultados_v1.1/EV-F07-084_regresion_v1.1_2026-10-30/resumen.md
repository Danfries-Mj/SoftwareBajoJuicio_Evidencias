# Resumen de ejecución

- Fecha: 2026-10-30T22:39:20.773Z
- Ejecutor: Roberto Loayza
- Versión del código: v1.1 (parche 657d4354)
- Versión de la BD: Dump SyS-Backup_2.0 SHA-256 5576dde00e2558984dda8966883244866f0e75f4a36c5a80c8f47083a552e4ae
- Entorno: Node v24.14.1, Windows_NT 10.0.19045, http://localhost:3000
- Casos: 72 | PASA 57 | FALLA 15 | BLOQUEADO 0

| Evidencia | Caso | Requisito | Esperado | Obtenido | Estado |
|---|---|---|---|---|---|
| EV-F07-001 | CP-AUT-01 | RF-AUT-01 | HTTP 200 con token JWT | HTTP 200 con token | PASA |
| EV-F07-002 | CP-AUT-02 | RF-AUT-01 | HTTP 401, sin token | HTTP 401 | PASA |
| EV-F07-003 | CP-AUT-03 | RF-AUT-07 | HTTP 400 con mensaje de contraseña débil | HTTP 400: Error al registrar el usuario | PASA |
| EV-F07-004 | CP-AUT-04 | RF-AUT-07 | HTTP 201, cuenta creada | HTTP 201: Registro exitoso, ya puede iniciar sesión | PASA |
| EV-F07-005 | CP-AUT-05 | RF-AUT-07 | HTTP 400 | HTTP 400: La cédula ingresada no es válida | PASA |
| EV-F07-006 | CP-AUT-06 | RF-AUT-05; RNF-AUT-02 | HTTP 403 | HTTP 403 | PASA |
| EV-F07-007 | CP-AUT-07 | RF-AUT-05; RNF-AUT-02 | HTTP 403 | HTTP 403 | PASA |
| EV-F07-008 | CP-AUT-08 | RF-AUT-03; RF-AUT-04 | HTTP 201 con rol y capilla asignados | HTTP 201; rol=Catequista; capilla=1 | PASA |
| EV-F07-009 | CP-AUT-09 | RNF-AUT-02 | HTTP 401 | HTTP 401 | PASA |
| EV-F07-010 | CP-AUT-10 | RNF-AUT-02 | HTTP 401 | HTTP 401 | PASA |
| EV-F07-011 | CP-AUT-11 | RF-AUT-02; RNF-AUT-02 | HTTP 403 | HTTP 403 | PASA |
| EV-F07-012 | CP-AUT-12 | RF-AUT-08; RSK-03 | Bloqueo o HTTP 429 antes del 10.º intento (criterio propuesto) | Estados: 400,400,400,400,400,400,400,400,400,400 | FALLA |
| EV-F07-013 | CP-AUT-13 | RNF-AUT-03; RSK-05 | HTTP 403 | HTTP 200 | FALLA |
| EV-F07-014 | CP-AUT-14 | RNF-AUT-03 | HTTP 403 | HTTP 403 | PASA |
| EV-F07-015 | CP-CAT-01 | RF-CAT-01 | HTTP 201, estado Pendiente | HTTP 201; estado=Pendiente; monto=5.00 | PASA |
| EV-F07-016 | CP-CAT-02 | RF-CAT-01; RSK-01 | HTTP 400 (el pago de catequesis es de $5) | HTTP 400; monto guardado=- | PASA |
| EV-F07-017 | CP-CAT-03 | RF-CAT-01; RSK-01 | HTTP 400 | HTTP 400; monto guardado=- | PASA |
| EV-F07-018 | CP-CAT-04 | RF-CAT-01 | HTTP 400 | HTTP 400: La foto del comprobante es obligatoria | PASA |
| EV-F07-019 | CP-CAT-05 | RF-CAT-01 | HTTP 400 | HTTP 400: Nivel inválido. Niveles permitidos: Primera Comunion, Confirmacion | PASA |
| EV-F07-020 | CP-CAT-06 | RF-CAT-03; RNF-AUT-02 | HTTP 403 | HTTP 200; estado=Aprobada | FALLA |
| EV-F07-021 | CP-CAT-07 | RF-CAT-01; RNF-FIN-02 | No se genera un ingreso distinto de $5,00 | Ingresos generados: $5.00 | PASA |
| EV-F07-022 | CP-CAT-08 | RF-CAT-03 | El segundo cambio se rechaza (HTTP 400/409) | Rechazar: HTTP 200; aprobar después: HTTP 200 | FALLA |
| EV-F07-023 | CP-CAT-09 | RF-CAT-04; RNF-AUT-02 | HTTP 403 | HTTP 200 | FALLA |
| EV-F07-024 | CP-CAT-10 | RF-CAT-05 | HTTP 400 | HTTP 400: Ya tienes una inscripción de Confirmacion aprobada. No puedes registrar otra mientras siga vigente. | PASA |
| EV-F07-025 | CP-CAT-11 | RNF-AUT-03; RSK-05 | HTTP 403 | HTTP 200 | FALLA |
| EV-F07-026 | CP-CAT-12 | RF-CAT-04 | HTTP 201 | HTTP 201: Inscrito registrado correctamente | PASA |
| EV-F07-027 | CP-CAT-13 | RF-CAT-04; RNF-AUT-02 | HTTP 403 | HTTP 201: Inscrito registrado correctamente | FALLA |
| EV-F07-028 | CP-CAT-14 | RF-CAT-06; RF-CAT-04 | HTTP 200; solo inscritos de la capilla 1, con nombre y estado | HTTP 200; 13 inscritos; de otra capilla: 0; sin nombre o estado: 0 | PASA |
| EV-F07-029 | CP-CAT-15 | RF-CAT-07 | HTTP 200, estado Aprobada | HTTP 200; estado=Aprobada | PASA |
| EV-F07-030 | CP-CAT-16 | RF-CAT-08 | HTTP 201, estado Pendiente | HTTP 201: Solicitud de inscripción enviada correctamente, queda pendiente de validación | PASA |
| EV-F07-031 | CP-CAT-17 | RF-CAT-09 | HTTP 200 con el catequista asignado | HTTP 200; id_catequista=20 | PASA |
| EV-F07-032 | CP-CAT-18 | RF-CAT-09 | HTTP 400 | HTTP 400: El catequista no pertenece a la capilla de este inscrito | PASA |
| EV-F07-033 | CP-FIN-01 | RF-FIN-01 | HTTP 201, estado Pendiente | HTTP 201; estado=Pendiente | PASA |
| EV-F07-034 | CP-FIN-02 | RF-FIN-01 | HTTP 400 | HTTP 400: El monto mínimo de donación es $5.00 | PASA |
| EV-F07-035 | CP-FIN-03 | RF-FIN-02; RNF-FIN-02 | Saldo del fondo +$5,00 | HTTP 200; saldo -140 → -135 (Δ 5.00) | PASA |
| EV-F07-036 | CP-FIN-04 | RF-FIN-02; RNF-FIN-02; RSK-04 | Saldo final = saldo inicial + $50 (una sola vez) | HTTP 200/409/409; saldo -135 → -85 (Δ 50.00) | PASA |
| EV-F07-037 | CP-FIN-05 | RNF-FIN-02 | HTTP 400 | HTTP 400 | PASA |
| EV-F07-038 | CP-FIN-06 | RNF-FIN-02 | HTTP 400 | HTTP 400 | PASA |
| EV-F07-039 | CP-FIN-07 | RF-FIN-04; RNF-AUT-02 | HTTP 403 | HTTP 201 | FALLA |
| EV-F07-040 | CP-FIN-08 | RF-FIN-03; RNF-AUT-02 | HTTP 403 | HTTP 403 | PASA |
| EV-F07-041 | CP-FIN-09 | RF-FIN-06 | HTTP 400 o 409 | HTTP 409: Error al generar cierre mensual | PASA |
| EV-F07-042 | CP-FIN-10 | RF-FIN-06 | 1.º HTTP 201; 2.º HTTP 409 | HTTP 201 y luego HTTP 409 | PASA |
| EV-F07-043 | CP-FIN-11 | RF-FIN-06; RSK-04 | HTTP 400/409 (criterio propuesto) | HTTP 201 | FALLA |
| EV-F07-044 | CP-FIN-12 | RF-FIN-06 | HTTP 403 | HTTP 403 | PASA |
| EV-F07-045 | CP-FIN-13 | RNF-AUT-02 | HTTP 403 | HTTP 403 | PASA |
| EV-F07-046 | CP-FIN-14 | RF-FIN-03; RNF-FIN-02 | HTTP 201 y saldo +$10 | HTTP 201; saldo -85 → -75 | PASA |
| EV-F07-047 | CP-FIN-15 | RF-FIN-05 | Solo ingresos dentro del rango | HTTP 200; 1 movimientos; fuera del filtro: 0 | PASA |
| EV-F07-048 | CP-FIN-16 | RF-FIN-08 | HTTP 201 | HTTP 201 | PASA |
| EV-F07-049 | CP-SOL-01 | RF-SOL-03 | HTTP 400 que nombra el certificado faltante | HTTP 400: No cumple con el prerrequisito. Necesita el certificado de Bautismo emitido. | PASA |
| EV-F07-050 | CP-SOL-02 | RF-SOL-03 | HTTP 201, estado Pendiente | HTTP 201; estado=Pendiente | PASA |
| EV-F07-051 | CP-SOL-03 | RF-SOL-03 | HTTP 400 que nombra Primera Comunión | HTTP 400: No cumple con el prerrequisito. Necesita el certificado de Primera Comunion emitido. | PASA |
| EV-F07-052 | CP-SOL-04 | RF-SOL-03 | HTTP 400 (prerrequisito del beneficiario) | HTTP 201: Solicitud enviada correctamente, queda pendiente de asignación | FALLA |
| EV-F07-053 | CP-SOL-05 | RF-SOL-01 | HTTP 201, estado Pendiente | HTTP 201; estado=Pendiente | PASA |
| EV-F07-054 | CP-SOL-06 | RF-SOL-02 | HTTP 400 | HTTP 400: La fecha asignada no puede ser anterior a la fecha actual | PASA |
| EV-F07-055 | CP-SOL-07 | RF-SOL-02 | HTTP 400 | HTTP 400: La hora de inicio debe ser anterior a la hora de fin | PASA |
| EV-F07-056 | CP-SOL-08 | RF-SOL-02; HU-09 | HTTP 200 y la eucaristía aparece en el calendario | HTTP 200; eucaristías creadas: 1 | PASA |
| EV-F07-057 | CP-SOL-09 | RF-SOL-05; RNF-AUT-03 | HTTP 403 | HTTP 200 | FALLA |
| EV-F07-058 | CP-SOL-10 | RF-SOL-01 | HTTP 400 | HTTP 400: Ya existe una solicitud de Primera Comunion pendiente para este usuario en esta capilla | PASA |
| EV-F07-059 | CP-SOL-11 | RF-SOL-04 (depende de DR-10) | HTTP 200 según HU-17 | HTTP 403: No tiene permisos para realizar esta acción | FALLA |
| EV-F07-060 | CP-HOR-01 | RF-HOR-01 | HTTP 200 con lista | HTTP 200; 14 horarios | PASA |
| EV-F07-061 | CP-HOR-02 | RF-HOR-02; RNF-AUT-02 | HTTP 403 | HTTP 403 | PASA |
| EV-F07-062 | CP-HOR-03 | RF-HOR-02 | HTTP 201 | HTTP 201 | PASA |
| EV-F07-063 | CP-HOR-04 | RF-HOR-03 | HTTP 400 | HTTP 409: Error al crear horario de eucaristía | PASA |
| EV-F07-064 | CP-HOR-05 | RF-HOR-02 | HTTP 400 | HTTP 400: La hora de inicio debe ser anterior a la hora de fin | PASA |
| EV-F07-065 | CP-GEN-01 | RNF-GEN-01; RF-HOR-01 | Promedio < 500 ms; percentil 95 < 1000 ms (P) | promedio 3 ms; p95 3 ms; máximo 4 ms | PASA |
| EV-F07-066 | CP-GEN-02 | RNF-GEN-01; RF-FIN-05 | Promedio < 500 ms; percentil 95 < 1000 ms (P) | promedio 3 ms; p95 4 ms; máximo 5 ms | PASA |
| EV-F07-067 | CP-GEN-03 | RNF-GEN-01; RF-CAT-06 | Promedio < 500 ms; percentil 95 < 1000 ms (P) | promedio 3 ms; p95 4 ms; máximo 4 ms | PASA |
| EV-F07-068 | CP-GEN-04 | RNF-GEN-01; RF-FIN-02 | Promedio < 500 ms; percentil 95 < 1000 ms (P) | promedio 3 ms; p95 4 ms; máximo 5 ms | PASA |
| EV-F07-080 | CP-AUT-20 | RF-AUT-07; RNF-AUT-02 | HTTP 400 | HTTP 201: Registro exitoso, ya puede iniciar sesión | FALLA |
| EV-F07-081 | CP-AUT-21 | RF-AUT-07; RNF-AUT-02 | HTTP 400 | HTTP 201: Registro exitoso, ya puede iniciar sesión | FALLA |
| EV-F07-082 | CP-AUT-22 | RF-AUT-07; RNF-AUT-01 | HTTP 400 en ambas | "ABC123": HTTP 400; "1111": HTTP 400 | PASA |
| EV-F07-083 | CP-AUT-23 | RF-AUT-01; RSK-03 | Cuenta bloqueada o HTTP 429/423 tras el 5.º intento (P) | Intentos fallidos: 401,401,401,401,401; 6.º con clave correcta: HTTP 200 | FALLA |