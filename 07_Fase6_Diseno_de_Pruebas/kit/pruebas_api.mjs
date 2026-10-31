// =====================================================================
// Kit de evidencias – Auditoría del Sistema de Gestión Parroquial
// Ejecuta los casos de prueba de API de los 5 módulos auditados y guarda
// una evidencia por caso (EV-F07-NNN.json) más un resumen (CSV y MD).
//
// Requisitos: Node.js 18 o superior (usa fetch nativo). Sin dependencias.
// Uso:        node pruebas_api.mjs
// IMPORTANTE: ejecutar SOLO contra la base de datos de pruebas (copia),
//             nunca contra la base de datos real: el script crea datos.
// =====================================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ------------------------- CONFIGURACIÓN -----------------------------
const CONFIG = {
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  CORREO_SACERDOTE: process.env.CORREO_SACERDOTE || 'adminpepe@gmail.com',
  CLAVE_PRUEBA: process.env.CLAVE_PRUEBA || 'Prueba.2026', // fijada por 01_preparar_bd_pruebas.sql
  VERSION_CODIGO: process.env.VERSION_CODIGO || 'ZIP SHA-256 d1cd257b1c7f461ace63e955fcc6d441536e6635604417bc56643e40a3602ba1',
  VERSION_BD: process.env.VERSION_BD || 'Dump SyS-Backup_2.0 SHA-256 5576dde00e2558984dda8966883244866f0e75f4a36c5a80c8f47083a552e4ae',
  EJECUTOR: process.env.EJECUTOR || '[Nombre del integrante]',
  REPETICIONES_RENDIMIENTO: Number(process.env.REPETICIONES || 30),
};
// ---------------------------------------------------------------------

const inicio = new Date();
const sello = inicio.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SALIDA = path.join(process.cwd(), 'evidencias', `F07_ejecucion_${sello}`);
fs.mkdirSync(SALIDA, { recursive: true });

const resultados = [];
let consecutivo = 0;
const hoy = new Date();
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); // fecha local
const masDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

async function api(metodo, ruta, { token, body, crudo } = {}) {
  const t0 = performance.now();
  const r = await fetch(CONFIG.BASE_URL + ruta, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ms = performance.now() - t0;
  let datos = null;
  const texto = await r.text();
  try { datos = JSON.parse(texto); } catch { datos = texto; }
  return { status: r.status, datos, ms, metodo, ruta, body: crudo ? '[omitido]' : body };
}
const lista = (res) => (res.datos && typeof res.datos === 'object') ? (Object.values(res.datos).find(Array.isArray) || []) : [];
const objeto = (res, clave) => res.datos?.[clave];

// Recorta campos pesados (archivos base64) para que la evidencia sea legible
function limpio(v) {
  return JSON.parse(JSON.stringify(v ?? null, (k, x) => (typeof x === 'string' && x.length > 300 ? x.slice(0, 80) + `…[${x.length} caracteres]` : x)));
}

/**
 * Registra un caso de prueba.
 * @param c  { id, req, tecnica, enfoque, precondicion, datos, esperado, criterio }
 * @param ejecutar  async () => ({ obtenido, pasa, peticiones })
 */
async function caso(c, ejecutar) {
  consecutivo += 1;
  const ev = c.ev || `EV-F07-${String(consecutivo).padStart(3, '0')}`;
  let r;
  try { r = await ejecutar(); } catch (e) { r = { obtenido: `ERROR al ejecutar: ${e.message}`, pasa: null, peticiones: [] }; }
  const estado = r.pasa === true ? 'PASA' : r.pasa === false ? 'FALLA' : 'BLOQUEADO';
  const registro = {
    evidencia: ev, caso: c.id, requisito_o_riesgo: c.req, tecnica: c.tecnica, enfoque: c.enfoque,
    precondicion: c.precondicion, datos: c.datos, resultado_esperado: c.esperado, criterio_aceptacion: c.criterio,
    resultado_obtenido: r.obtenido, estado,
    fecha_hora: new Date().toISOString(), version_codigo: CONFIG.VERSION_CODIGO, version_bd: CONFIG.VERSION_BD,
    ejecutor: CONFIG.EJECUTOR, entorno: { node: process.version, so: `${os.type()} ${os.release()}`, base_url: CONFIG.BASE_URL },
    peticiones: limpio((r.peticiones || []).map(p => ({ metodo: p.metodo, ruta: p.ruta, cuerpo: p.body, status: p.status, ms: Math.round(p.ms), respuesta: p.datos }))),
  };
  fs.writeFileSync(path.join(SALIDA, `${ev}_${c.id}.json`), JSON.stringify(registro, null, 2));
  resultados.push(registro);
  console.log(`${ev}  ${c.id.padEnd(11)} ${estado.padEnd(9)} ${r.obtenido}`);
}

// ------------------------- DESCUBRIMIENTO ----------------------------
async function login(correo) {
  const r = await api('POST', '/api/auth/login', { body: { correo, contrasena: CONFIG.CLAVE_PRUEBA } });
  if (r.status !== 200) throw new Error(`No se pudo iniciar sesión con ${correo} (HTTP ${r.status}). ¿Ejecutaron 01_preparar_bd_pruebas.sql?`);
  return r.datos.token;
}
function cedulaValidaNueva(semilla) {
  // Genera una cédula ecuatoriana válida (módulo 10), provincia 07 (El Oro)
  for (let n = semilla; ; n++) {
    const base = ('07' + '1' + String(n).padStart(6, '0')).slice(0, 9);
    const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let s = 0;
    for (let i = 0; i < 9; i++) { let v = Number(base[i]) * coef[i]; if (v > 9) v -= 9; s += v; }
    const dv = (Math.ceil(s / 10) * 10 - s) % 10;
    return base + dv;
  }
}

async function main() {
  console.log(`\nKit de evidencias – ${CONFIG.BASE_URL}\nSalida: ${SALIDA}\n`);
  const tSac = await login(CONFIG.CORREO_SACERDOTE);
  const usuarios = lista(await api('GET', '/api/usuarios', { token: tSac })).filter(u => u.activo);
  const uno = (rol, capilla) => usuarios.find(u => u.rol === rol && (u.id_capilla ?? null) === capilla);
  const U = {
    tesoreroGeneral: uno('Tesorero', null), tesorero1: uno('Tesorero', 1), coordinador1: uno('Coordinador', 1),
    catequista1: uno('Catequista', 1), catequista2: uno('Catequista', 2),
  };
  const laicos1 = usuarios.filter(u => u.rol === 'Laico' && u.id_capilla === 1);
  for (const [k, u] of Object.entries(U)) if (!u) throw new Error(`No se encontró un usuario activo para ${k}`);
  if (laicos1.length < 3) throw new Error('Se necesitan al menos 3 laicos de la capilla 1');
  const T = {};
  for (const [k, u] of Object.entries(U)) T[k] = await login(u.correo);
  const fondos = lista(await api('GET', '/api/fondos', { token: tSac }));
  const fondoCap = (c) => fondos.find(f => (f.id_capilla ?? null) === c);
  const certs = lista(await api('GET', '/api/certificados', { token: tSac }));
  const tieneCert = (idPersona, tipo) => certs.some(c => c.id_persona === idPersona && c.tipo === tipo && c.estado === 'Emitido');
  const inscs = lista(await api('GET', '/api/inscripciones-catequesis', { token: tSac }));
  const sols = lista(await api('GET', '/api/solicitudes-sacramento', { token: tSac }));

  // Laico A: sin certificado ni inscripción aprobada de Confirmación (para Catequesis)
  const laicoA = laicos1.find(u => !tieneCert(u.id_persona, 'Confirmacion') &&
    !inscs.some(i => i.id_laico === u.id_usuario && i.nivel === 'Confirmacion' && i.estado === 'Aprobada'));
  const laicoB = laicos1.find(u => u !== laicoA);
  // Laico C: con Bautismo emitido, sin Primera Comunión emitida ni solicitud pendiente de PC
  const laicosTodos = usuarios.filter(u => u.rol === 'Laico');
  const laicoC = laicosTodos.find(u => u !== laicoA && u !== laicoB && tieneCert(u.id_persona, 'Bautismo') && !tieneCert(u.id_persona, 'Primera Comunion') &&
    !sols.some(s => s.id_usuario === u.id_usuario && s.sacramento === 'Primera Comunion' && s.estado === 'Pendiente'));
  // Laico D: sin certificado de Bautismo
  const laicoD = laicos1.find(u => !tieneCert(u.id_persona, 'Bautismo') && u !== laicoA);
  T.laicoA = await login(laicoA.correo); T.laicoB = await login(laicoB.correo);
  if (laicoC) T.laicoC = await login(laicoC.correo);
  if (laicoD) T.laicoD = await login(laicoD.correo);
  console.log('Usuarios de prueba:', { laicoA: laicoA.correo, laicoB: laicoB.correo, laicoC: laicoC?.correo, laicoD: laicoD?.correo, ...Object.fromEntries(Object.entries(U).map(([k, u]) => [k, u.correo])) }, '\n');

  const subirComprobante = async (token) => {
    const r = await api('POST', '/api/documentos', { token, crudo: true, body: {
      tipo: 'Comprobante', archivo_nombre: 'comprobante-prueba.png', mime_type: 'image/png',
      archivo_url: 'data:image/png;base64,' + 'iVBORw0KGgo'.padEnd(200, 'A') } });
    return objeto(r, 'documento')?.id_documento;
  };
  const docA = await subirComprobante(T.laicoA);
  const docB = await subirComprobante(T.laicoB);

  // =================== USUARIOS Y AUTENTICACIÓN ======================
  await caso({ id: 'CP-AUT-01', req: 'RF-AUT-01', tecnica: 'Partición de equivalencia (clase válida)', enfoque: 'Verificación',
    precondicion: 'Usuario Laico activo', datos: 'Correo válido + contraseña correcta', esperado: 'HTTP 200 con token JWT', criterio: 'Se recibe un token' },
  async () => { const r = await api('POST', '/api/auth/login', { body: { correo: laicoA.correo, contrasena: CONFIG.CLAVE_PRUEBA } });
    return { obtenido: `HTTP ${r.status}${r.datos?.token ? ' con token' : ' sin token'}`, pasa: r.status === 200 && !!r.datos?.token, peticiones: [{ ...r, body: { correo: laicoA.correo, contrasena: '***' }, datos: { ...r.datos, token: r.datos?.token ? '[token]' : undefined } }] }; });

  await caso({ id: 'CP-AUT-02', req: 'RF-AUT-01', tecnica: 'Partición de equivalencia (clase inválida)', enfoque: 'Verificación',
    precondicion: 'Usuario Laico activo', datos: 'Contraseña incorrecta', esperado: 'HTTP 401, sin token', criterio: 'Acceso denegado' },
  async () => { const r = await api('POST', '/api/auth/login', { body: { correo: laicoA.correo, contrasena: 'Incorrecta.1' } });
    return { obtenido: `HTTP ${r.status}`, pasa: r.status === 401, peticiones: [{ ...r, body: { correo: laicoA.correo, contrasena: '***' } }] }; });

  const cedNueva = cedulaValidaNueva(Number(String(Date.now()).slice(-6)));
  await caso({ id: 'CP-AUT-03', req: 'RF-AUT-07', tecnica: 'Valores límite (7 caracteres, bajo el mínimo de 8)', enfoque: 'Verificación',
    precondicion: 'Cédula válida no registrada', datos: 'Contraseña "Ab1.xyz" (7)', esperado: 'HTTP 400 con mensaje de contraseña débil', criterio: 'Rechazo controlado (código 4xx)' },
  async () => { const r = await api('POST', '/api/auth/registro', { body: { cedula: cedNueva, nombres: 'Prueba', apellidos: 'Limite Siete', correo: `limite7.${cedNueva}@prueba.test`, contrasena: 'Ab1.xyz', id_capilla: 1 } });
    return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 400, peticiones: [r] }; });

  await caso({ id: 'CP-AUT-04', req: 'RF-AUT-07', tecnica: 'Valores límite (8 caracteres, mínimo válido)', enfoque: 'Verificación',
    precondicion: 'Cédula válida no registrada', datos: 'Contraseña "Ab1.xyzw" (8)', esperado: 'HTTP 201, cuenta creada', criterio: 'Cuenta creada con rol Laico' },
  async () => { const r = await api('POST', '/api/auth/registro', { body: { cedula: cedNueva, nombres: 'Prueba', apellidos: 'Limite Ocho', correo: `limite8.${cedNueva}@prueba.test`, contrasena: 'Ab1.xyzw', id_capilla: 1 } });
    return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 201, peticiones: [r] }; });

  await caso({ id: 'CP-AUT-05', req: 'RF-AUT-07', tecnica: 'Partición de equivalencia (cédula inválida)', enfoque: 'Verificación',
    precondicion: 'Ninguna', datos: 'Cédula 0700000000 (dígito verificador incorrecto)', esperado: 'HTTP 400', criterio: 'Cédula rechazada' },
  async () => { const r = await api('POST', '/api/auth/registro', { body: { cedula: '0700000000', nombres: 'Prueba', apellidos: 'Cedula Mala', correo: `cedmala.${Date.now()}@prueba.test`, contrasena: 'Ab1.xyzw', id_capilla: 1 } });
    return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 400, peticiones: [r] }; });

  const nuevoUsuario = (sufijo) => ({ cedula: cedulaValidaNueva(Number(String(Date.now()).slice(-6)) + sufijo), nombres: 'Prueba', apellidos: 'Usuario ' + sufijo, correo: `usuario${sufijo}.${Date.now()}@prueba.test`, contrasena: 'Ab1.xyzw', rol: 'Catequista', id_capilla: 1 });
  for (const [id, rol, tok] of [['CP-AUT-06', 'Laico', T.laicoA], ['CP-AUT-07', 'Coordinador', T.coordinador1]]) {
    await caso({ id, req: 'RF-AUT-05; RNF-AUT-02', tecnica: 'Tabla de decisión (rol × acción: crear usuario)', enfoque: 'Verificación (seguridad)',
      precondicion: `Sesión de ${rol}`, datos: 'POST /api/usuarios con un usuario nuevo', esperado: 'HTTP 403', criterio: 'Solo el Sacerdote crea usuarios' },
    async () => { const r = await api('POST', '/api/usuarios', { token: tok, body: nuevoUsuario(id === 'CP-AUT-06' ? 11 : 12) });
      return { obtenido: `HTTP ${r.status}`, pasa: r.status === 403, peticiones: [r] }; });
  }
  await caso({ id: 'CP-AUT-08', req: 'RF-AUT-03; RF-AUT-04', tecnica: 'Tabla de decisión (rol × acción: crear usuario)', enfoque: 'Validación',
    precondicion: 'Sesión de Sacerdote', datos: 'Usuario nuevo, rol Catequista, capilla 1', esperado: 'HTTP 201 con rol y capilla asignados', criterio: 'Usuario creado con rol y capilla' },
  async () => { const r = await api('POST', '/api/usuarios', { token: tSac, body: nuevoUsuario(13) });
    const u = objeto(r, 'usuario'); return { obtenido: `HTTP ${r.status}; rol=${u?.rol}; capilla=${u?.id_capilla}`, pasa: r.status === 201 && u?.rol === 'Catequista', peticiones: [r] }; });

  await caso({ id: 'CP-AUT-09', req: 'RNF-AUT-02', tecnica: 'Partición de equivalencia (sin credencial)', enfoque: 'Verificación (seguridad)',
    precondicion: 'Ninguna', datos: 'GET /api/usuarios sin token', esperado: 'HTTP 401', criterio: 'Acceso denegado sin autenticación' },
  async () => { const r = await api('GET', '/api/usuarios'); return { obtenido: `HTTP ${r.status}`, pasa: r.status === 401, peticiones: [r] }; });

  await caso({ id: 'CP-AUT-10', req: 'RNF-AUT-02', tecnica: 'Partición de equivalencia (token alterado)', enfoque: 'Verificación (seguridad)',
    precondicion: 'Token válido de Laico', datos: 'Token con la firma modificada', esperado: 'HTTP 401', criterio: 'Token rechazado' },
  async () => { const malo = T.laicoA.slice(0, -4) + (T.laicoA.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    const r = await api('GET', '/api/inscripciones-catequesis', { token: malo }); return { obtenido: `HTTP ${r.status}`, pasa: r.status === 401, peticiones: [r] }; });

  await caso({ id: 'CP-AUT-11', req: 'RF-AUT-02; RNF-AUT-02', tecnica: 'Tabla de decisión (dueño × acción)', enfoque: 'Verificación (seguridad)',
    precondicion: 'Sesión de Laico A', datos: `PUT /api/usuarios/${laicoB.id_usuario}/perfil (perfil de otro laico)`, esperado: 'HTTP 403', criterio: 'Solo se edita el perfil propio' },
  async () => { const r = await api('PUT', `/api/usuarios/${laicoB.id_usuario}/perfil`, { token: T.laicoA, body: { nombres: 'X', apellidos: 'Y', correo: laicoB.correo } });
    return { obtenido: `HTTP ${r.status}`, pasa: r.status === 403, peticiones: [r] }; });

  await caso({ id: 'CP-AUT-12', req: 'RF-AUT-08; RSK-03', tecnica: 'Valores límite (intentos fallidos de código)', enfoque: 'Verificación (seguridad)',
    precondicion: 'Código de recuperación solicitado para Laico B', datos: '10 códigos incorrectos seguidos', esperado: 'Bloqueo o HTTP 429 antes del 10.º intento (criterio propuesto)', criterio: 'Existe límite de intentos (P)' },
  async () => { const pet = [await api('POST', '/api/auth/olvide-contrasena', { body: { correo: laicoB.correo } })];
    for (let i = 0; i < 10; i++) pet.push(await api('POST', '/api/auth/restablecer-contrasena', { body: { correo: laicoB.correo, codigo: String(100000 + i), contrasena: 'Ab1.xyzw' } }));
    const bloqueo = pet.slice(1).some(p => p.status === 429 || p.status === 423);
    return { obtenido: `Estados: ${pet.slice(1).map(p => p.status).join(',')}`, pasa: bloqueo, peticiones: pet }; });

  const docLaico1 = docA;
  await caso({ id: 'CP-AUT-13', req: 'RNF-AUT-03; RSK-05', tecnica: 'Tabla de decisión (rol × capilla × recurso)', enfoque: 'Verificación (seguridad)',
    precondicion: 'Comprobante subido por Laico A (capilla 1)', datos: 'Catequista de la capilla 2 abre ese comprobante', esperado: 'HTTP 403', criterio: 'Datos personales visibles solo dentro del alcance' },
  async () => { const r = await api('GET', `/api/documentos/${docLaico1}`, { token: T.catequista2 }); return { obtenido: `HTTP ${r.status}`, pasa: r.status === 403, peticiones: [r] }; });

  await caso({ id: 'CP-AUT-14', req: 'RNF-AUT-03', tecnica: 'Tabla de decisión (dueño × recurso)', enfoque: 'Verificación (seguridad)',
    precondicion: 'Comprobante subido por Laico A', datos: 'Laico B abre ese comprobante', esperado: 'HTTP 403', criterio: 'Un laico no ve documentos ajenos' },
  async () => { const r = await api('GET', `/api/documentos/${docLaico1}`, { token: T.laicoB }); return { obtenido: `HTTP ${r.status}`, pasa: r.status === 403, peticiones: [r] }; });

  // ============================ CATEQUESIS ============================
  const inscribir = (tok, monto, extra = {}) => api('POST', '/api/inscripciones-catequesis', { token: tok, body: { nivel: 'Confirmacion', id_capilla: 1, monto, id_documento: docA, ...extra } });
  let insc500, insc499, insc501;
  await caso({ id: 'CP-CAT-01', req: 'RF-CAT-01', tecnica: 'Valores límite (monto exacto $5,00)', enfoque: 'Validación',
    precondicion: 'Laico A sin Confirmación aprobada; comprobante subido', datos: 'Confirmación, capilla 1, monto 5.00', esperado: 'HTTP 201, estado Pendiente', criterio: 'Solicitud registrada pendiente de validación' },
  async () => { const r = await inscribir(T.laicoA, 5.00); insc500 = objeto(r, 'inscripcion');
    return { obtenido: `HTTP ${r.status}; estado=${insc500?.estado}; monto=${insc500?.monto}`, pasa: r.status === 201 && insc500?.estado === 'Pendiente', peticiones: [r] }; });

  await caso({ id: 'CP-CAT-02', req: 'RF-CAT-01; RSK-01', tecnica: 'Valores límite (monto $4,99, bajo el valor fijo)', enfoque: 'Verificación',
    precondicion: 'Igual que CP-CAT-01', datos: 'monto 4.99', esperado: 'HTTP 400 (el pago de catequesis es de $5)', criterio: 'Solo se acepta $5,00' },
  async () => { const r = await inscribir(T.laicoA, 4.99); insc499 = objeto(r, 'inscripcion');
    return { obtenido: `HTTP ${r.status}; monto guardado=${insc499?.monto ?? '-'}`, pasa: r.status === 400, peticiones: [r] }; });

  await caso({ id: 'CP-CAT-03', req: 'RF-CAT-01; RSK-01', tecnica: 'Valores límite (monto $5,01, sobre el valor fijo)', enfoque: 'Verificación',
    precondicion: 'Igual que CP-CAT-01', datos: 'monto 5.01', esperado: 'HTTP 400', criterio: 'Solo se acepta $5,00' },
  async () => { const r = await inscribir(T.laicoA, 5.01); insc501 = objeto(r, 'inscripcion');
    return { obtenido: `HTTP ${r.status}; monto guardado=${insc501?.monto ?? '-'}`, pasa: r.status === 400, peticiones: [r] }; });

  await caso({ id: 'CP-CAT-04', req: 'RF-CAT-01', tecnica: 'Partición de equivalencia (sin comprobante)', enfoque: 'Verificación',
    precondicion: 'Sesión de Laico A', datos: 'Sin id_documento', esperado: 'HTTP 400', criterio: 'El comprobante es obligatorio' },
  async () => { const r = await inscribir(T.laicoA, 5, { id_documento: null }); return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 400, peticiones: [r] }; });

  await caso({ id: 'CP-CAT-05', req: 'RF-CAT-01', tecnica: 'Partición de equivalencia (nivel inválido)', enfoque: 'Verificación',
    precondicion: 'Sesión de Laico A', datos: 'nivel "Bautizo"', esperado: 'HTTP 400', criterio: 'Solo Primera Comunión o Confirmación' },
  async () => { const r = await inscribir(T.laicoA, 5, { nivel: 'Bautizo' }); return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 400, peticiones: [r] }; });

  const objetivo = insc499 || insc500;
  const movCat = async () => lista(await api('GET', '/api/movimientos-financieros', { token: tSac })).filter(m => m.categoria === 'Catequesis');
  const idsAntes = new Set((await movCat()).map(m => m.id_movimiento));
  await caso({ id: 'CP-CAT-06', req: 'RF-CAT-03; RNF-AUT-02', tecnica: 'Tabla de decisión (rol × capilla × estado)', enfoque: 'Verificación (seguridad)',
    precondicion: `Inscripción pendiente de la capilla 1 (id ${objetivo?.id_inscripcion})`, datos: 'Catequista de la capilla 2 la aprueba', esperado: 'HTTP 403', criterio: 'El catequista valida solo su capilla (HU-03)' },
  async () => { const r = await api('PUT', `/api/inscripciones-catequesis/${objetivo.id_inscripcion}/aprobar`, { token: T.catequista2 });
    return { obtenido: `HTTP ${r.status}; estado=${objeto(r, 'inscripcion')?.estado ?? '-'}`, pasa: r.status === 403, peticiones: [r] }; });

  await caso({ id: 'CP-CAT-07', req: 'RF-CAT-01; RNF-FIN-02', tecnica: 'Integración (trigger inscripción → inscrito → movimiento)', enfoque: 'Verificación',
    precondicion: 'Inscripción de $4,99 aprobada en CP-CAT-06', datos: 'Movimientos de catequesis creados por esa aprobación', esperado: 'No se genera un ingreso distinto de $5,00', criterio: 'El ingreso de una inscripción es siempre $5,00' },
  async () => { const nuevos = (await movCat()).filter(m => !idsAntes.has(m.id_movimiento));
    const raros = nuevos.filter(m => Number(m.monto) !== 5);
    return { obtenido: nuevos.length ? `Ingresos generados: ${nuevos.map(m => '$' + m.monto).join(', ')}` : 'No se generó ningún ingreso', pasa: raros.length === 0, peticiones: [{ metodo: 'GET', ruta: '/api/movimientos-financieros', status: 200, ms: 0, datos: nuevos }] }; });

  await caso({ id: 'CP-CAT-08', req: 'RF-CAT-03', tecnica: 'Transición de estados (Rechazada → Aprobada)', enfoque: 'Verificación',
    precondicion: `Inscripción ${insc501?.id_inscripcion ?? insc500?.id_inscripcion}`, datos: 'Catequista capilla 1: rechazar y luego aprobar', esperado: 'El segundo cambio se rechaza (HTTP 400/409)', criterio: 'Una solicitud resuelta no cambia de estado' },
  async () => { const id = (insc501 || insc500).id_inscripcion;
    const r1 = await api('PUT', `/api/inscripciones-catequesis/${id}/rechazar`, { token: T.catequista1 });
    const r2 = await api('PUT', `/api/inscripciones-catequesis/${id}/aprobar`, { token: T.catequista1 });
    return { obtenido: `Rechazar: HTTP ${r1.status}; aprobar después: HTTP ${r2.status}`, pasa: r1.status === 200 && (r2.status === 400 || r2.status === 409), peticiones: [r1, r2] }; });

  await caso({ id: 'CP-CAT-09', req: 'RF-CAT-04; RNF-AUT-02', tecnica: 'Tabla de decisión (rol × acción: editar inscrito)', enfoque: 'Verificación (seguridad)',
    precondicion: 'Existe al menos un inscrito', datos: 'Tesorero general edita el estado de un inscrito', esperado: 'HTTP 403', criterio: 'El Tesorero solo consulta catequesis' },
  async () => { const ins = lista(await api('GET', '/api/inscritos-catequesis', { token: tSac }));
    const r = await api('PUT', `/api/inscritos-catequesis/${ins[0].id_inscrito}`, { token: T.tesoreroGeneral, body: { estado: ins[0].estado, id_catequista: ins[0].id_catequista, nota: 'Prueba CP-CAT-09' } });
    return { obtenido: `HTTP ${r.status}`, pasa: r.status === 403, peticiones: [r] }; });

  await caso({ id: 'CP-CAT-10', req: 'RF-CAT-05', tecnica: 'Partición de equivalencia (duplicado)', enfoque: 'Validación',
    precondicion: 'Laico A ya tiene una Confirmación aprobada (CP-CAT-06)', datos: 'Nueva solicitud de Confirmación', esperado: 'HTTP 400', criterio: 'No se duplica la inscripción en el mismo nivel' },
  async () => { const r = await inscribir(T.laicoA, 5); return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 400, peticiones: [r] }; });

  await caso({ id: 'CP-CAT-11', req: 'RNF-AUT-03; RSK-05', tecnica: 'Tabla de decisión (dueño × recurso)', enfoque: 'Verificación (seguridad)',
    precondicion: `Inscripción ${insc500?.id_inscripcion} de Laico A`, datos: 'Laico B la consulta por id', esperado: 'HTTP 403', criterio: 'Un laico no ve solicitudes ajenas' },
  async () => { const r = await api('GET', `/api/inscripciones-catequesis/${insc500.id_inscripcion}`, { token: T.laicoB });
    return { obtenido: `HTTP ${r.status}`, pasa: r.status === 403, peticiones: [r] }; });


  const nuevoInscrito = (capilla, extra = {}) => ({ cedula: cedulaValidaNueva(Number(String(Date.now()).slice(-6)) + capilla * 7 + 3), nombres: 'Participante De Prueba', nivel: 'Primera Comunion', id_capilla: capilla, fecha_inscripcion: iso(hoy), monto: 5, comprobante: 'comprobante-prueba.png', ...extra });
  let inscritoCap1;
  await caso({ id: 'CP-CAT-12', req: 'RF-CAT-04', tecnica: 'Partición de equivalencia (capilla propia)', enfoque: 'Validación',
    precondicion: 'Sesión de Catequista de la capilla 1', datos: 'Nuevo inscrito, Primera Comunión, capilla 1', esperado: 'HTTP 201', criterio: 'El catequista registra inscritos de su capilla' },
  async () => { const r = await api('POST', '/api/inscritos-catequesis', { token: T.catequista1, body: nuevoInscrito(1) }); inscritoCap1 = objeto(r, 'inscrito');
    return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 201, peticiones: [r] }; });

  await caso({ id: 'CP-CAT-13', req: 'RF-CAT-04; RNF-AUT-02', tecnica: 'Tabla de decisión (rol × capilla)', enfoque: 'Verificación (seguridad)',
    precondicion: 'Sesión de Catequista de la capilla 1', datos: 'Nuevo inscrito en la capilla 2', esperado: 'HTTP 403', criterio: 'El catequista accede solo a su capilla (HU-03)' },
  async () => { const r = await api('POST', '/api/inscritos-catequesis', { token: T.catequista1, body: nuevoInscrito(2) });
    return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 403, peticiones: [r] }; });

  await caso({ id: 'CP-CAT-14', req: 'RF-CAT-06; RF-CAT-04', tecnica: 'Partición de equivalencia (alcance de la consulta)', enfoque: 'Validación',
    precondicion: 'Sesión de Catequista de la capilla 1', datos: 'GET /api/inscritos-catequesis', esperado: 'HTTP 200; solo inscritos de la capilla 1, con nombre y estado', criterio: 'Listado por nombre y estado de su capilla' },
  async () => { const r = await api('GET', '/api/inscritos-catequesis', { token: T.catequista1 }); const l = lista(r);
    const ajenos = l.filter(x => x.id_capilla !== 1).length, sinDatos = l.filter(x => !x.nombres || !x.estado).length;
    return { obtenido: `HTTP ${r.status}; ${l.length} inscritos; de otra capilla: ${ajenos}; sin nombre o estado: ${sinDatos}`, pasa: r.status === 200 && ajenos === 0 && sinDatos === 0, peticiones: [{ ...r, datos: `[${l.length} registros]` }] }; });

  await caso({ id: 'CP-CAT-15', req: 'RF-CAT-07', tecnica: 'Partición de equivalencia (aprobación por Coordinador de la capilla)', enfoque: 'Validación',
    precondicion: `Inscripción pendiente ${insc500?.id_inscripcion} de la capilla 1`, datos: 'Coordinador de la capilla 1 la acepta', esperado: 'HTTP 200, estado Aprobada', criterio: 'El Coordinador acepta la catequesis de su capilla' },
  async () => { const r = await api('PUT', `/api/inscripciones-catequesis/${insc500.id_inscripcion}/aprobar`, { token: T.coordinador1 });
    return { obtenido: `HTTP ${r.status}; estado=${objeto(r, 'inscripcion')?.estado ?? '-'}`, pasa: r.status === 200 && objeto(r, 'inscripcion')?.estado === 'Aprobada', peticiones: [r] }; });

  const laicoE = laicos1.find(u => u !== laicoA && !tieneCert(u.id_persona, 'Primera Comunion') &&
    !inscs.some(i => i.id_laico === u.id_usuario && i.nivel === 'Primera Comunion' && i.estado === 'Aprobada')) || laicoB;
  await caso({ id: 'CP-CAT-16', req: 'RF-CAT-08', tecnica: 'Partición de equivalencia (registro por el personal)', enfoque: 'Validación',
    precondicion: 'Sesión de Coordinador de la capilla 1; comprobante existente', datos: `Inscripción a nombre del laico ${laicoE.id_usuario}, Primera Comunión`, esperado: 'HTTP 201, estado Pendiente', criterio: 'El Coordinador registra nuevas inscripciones' },
  async () => { const r = await api('POST', '/api/inscripciones-catequesis', { token: T.coordinador1, body: { nivel: 'Primera Comunion', id_capilla: 1, monto: 5, id_documento: docB, id_laico: laicoE.id_usuario } });
    return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 201, peticiones: [r] }; });

  await caso({ id: 'CP-CAT-17', req: 'RF-CAT-09', tecnica: 'Tabla de decisión R1 (catequista de la misma capilla)', enfoque: 'Validación',
    precondicion: `Inscrito ${inscritoCap1?.id_inscrito} de la capilla 1`, datos: `Sacerdote asigna al catequista ${U.catequista1.id_usuario} (capilla 1)`, esperado: 'HTTP 200 con el catequista asignado', criterio: 'El Sacerdote asigna catequista a cada inscrito' },
  async () => { const r = await api('PUT', `/api/inscritos-catequesis/${inscritoCap1?.id_inscrito}`, { token: tSac, body: { estado: 'Activo', id_catequista: U.catequista1.id_usuario, nota: 'Asignación CP-CAT-17' } });
    return { obtenido: `HTTP ${r.status}; id_catequista=${objeto(r, 'inscrito')?.id_catequista ?? '-'}`, pasa: r.status === 200 && objeto(r, 'inscrito')?.id_catequista === U.catequista1.id_usuario, peticiones: [r] }; });

  await caso({ id: 'CP-CAT-18', req: 'RF-CAT-09', tecnica: 'Tabla de decisión R2 (catequista de otra capilla)', enfoque: 'Verificación',
    precondicion: `Inscrito ${inscritoCap1?.id_inscrito} de la capilla 1`, datos: `Sacerdote asigna al catequista ${U.catequista2.id_usuario} (capilla 2)`, esperado: 'HTTP 400', criterio: 'El catequista asignado pertenece a la capilla del inscrito' },
  async () => { const r = await api('PUT', `/api/inscritos-catequesis/${inscritoCap1?.id_inscrito}`, { token: tSac, body: { estado: 'Activo', id_catequista: U.catequista2.id_usuario, nota: 'Asignación CP-CAT-18' } });
    return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 400, peticiones: [r] }; });

  // ============================= FINANZAS =============================
  const f1 = fondoCap(1), fPar = fondoCap(null), f2 = fondoCap(2);
  const saldo = async (idf) => Number(objeto(await api('GET', `/api/fondos/${idf}`, { token: tSac }), 'fondo')?.saldo_actual);
  const donar = (monto) => api('POST', '/api/donaciones', { token: T.laicoB, body: { id_capilla: 1, fecha: iso(hoy), monto, id_documento: docB, id_fondo: f1.id_fondo } });
  let don1, don2;
  await caso({ id: 'CP-FIN-01', req: 'RF-FIN-01', tecnica: 'Valores límite (mínimo $5,00)', enfoque: 'Validación',
    precondicion: 'Comprobante subido por Laico B', datos: 'Donación de $5,00 al fondo de la capilla 1', esperado: 'HTTP 201, estado Pendiente', criterio: 'Donación registrada pendiente' },
  async () => { const r = await donar(5); don1 = objeto(r, 'donacion'); return { obtenido: `HTTP ${r.status}; estado=${don1?.estado}`, pasa: r.status === 201 && don1?.estado === 'Pendiente', peticiones: [r] }; });

  await caso({ id: 'CP-FIN-02', req: 'RF-FIN-01', tecnica: 'Valores límite ($4,99)', enfoque: 'Verificación',
    precondicion: 'Igual que CP-FIN-01', datos: 'Donación de $4,99', esperado: 'HTTP 400', criterio: 'Monto mínimo aplicado' },
  async () => { const r = await donar(4.99); return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 400, peticiones: [r] }; });

  await caso({ id: 'CP-FIN-03', req: 'RF-FIN-02; RNF-FIN-02', tecnica: 'Integración (aprobación → trigger → saldo)', enfoque: 'Validación',
    precondicion: `Donación ${don1?.id_donacion} pendiente`, datos: 'Tesorero de la capilla 1 aprueba', esperado: 'Saldo del fondo +$5,00', criterio: 'El saldo sube exactamente el monto donado' },
  async () => { const s0 = await saldo(f1.id_fondo); const r = await api('PUT', `/api/donaciones/${don1.id_donacion}/aprobar`, { token: T.tesorero1 }); const s1 = await saldo(f1.id_fondo);
    return { obtenido: `HTTP ${r.status}; saldo ${s0} → ${s1} (Δ ${(s1 - s0).toFixed(2)})`, pasa: r.status === 200 && Math.abs(s1 - s0 - 5) < 0.001, peticiones: [r] }; });

  await caso({ id: 'CP-FIN-04', req: 'RF-FIN-02; RNF-FIN-02; RSK-04', tecnica: 'Transición de estados (Aprobado → Rechazado → Aprobado)', enfoque: 'Verificación',
    precondicion: 'Donación nueva de $50 pendiente', datos: 'Aprobar, rechazar y volver a aprobar', esperado: 'Saldo final = saldo inicial + $50 (una sola vez)', criterio: 'Una donación suma al fondo una sola vez' },
  async () => { const r0 = await donar(50); don2 = objeto(r0, 'donacion'); const s0 = await saldo(f1.id_fondo);
    const a = await api('PUT', `/api/donaciones/${don2.id_donacion}/aprobar`, { token: T.tesorero1 });
    const b = await api('PUT', `/api/donaciones/${don2.id_donacion}/rechazar`, { token: T.tesorero1 });
    const c = await api('PUT', `/api/donaciones/${don2.id_donacion}/aprobar`, { token: T.tesorero1 }); const s1 = await saldo(f1.id_fondo);
    return { obtenido: `HTTP ${a.status}/${b.status}/${c.status}; saldo ${s0} → ${s1} (Δ ${(s1 - s0).toFixed(2)})`, pasa: Math.abs(s1 - s0 - 50) < 0.001, peticiones: [r0, a, b, c] }; });

  const mov = (tok, idf, monto, fecha = iso(hoy), tipo = 'Ingreso') => api('POST', '/api/movimientos-financieros', { token: tok, body: { tipo, categoria: 'Prueba', descripcion: 'Caso de prueba', id_fondo: idf, monto, fecha, justificacion: 'Kit de evidencias' } });
  await caso({ id: 'CP-FIN-05', req: 'RNF-FIN-02', tecnica: 'Valores límite (monto negativo)', enfoque: 'Verificación',
    precondicion: 'Sesión de Tesorero de la capilla 1', datos: 'Ingreso de −$100', esperado: 'HTTP 400', criterio: 'Montos positivos' },
  async () => { const r = await mov(T.tesorero1, f1.id_fondo, -100); return { obtenido: `HTTP ${r.status}`, pasa: r.status === 400, peticiones: [r] }; });

  await caso({ id: 'CP-FIN-06', req: 'RNF-FIN-02', tecnica: 'Valores límite (monto $0,00)', enfoque: 'Verificación',
    precondicion: 'Sesión de Tesorero de la capilla 1', datos: 'Ingreso de $0,00', esperado: 'HTTP 400', criterio: 'Montos positivos' },
  async () => { const r = await mov(T.tesorero1, f1.id_fondo, 0); return { obtenido: `HTTP ${r.status}`, pasa: r.status === 400, peticiones: [r] }; });

  await caso({ id: 'CP-FIN-07', req: 'RF-FIN-04; RNF-AUT-02', tecnica: 'Tabla de decisión (rol × fondo)', enfoque: 'Verificación (seguridad)',
    precondicion: 'Sesión de Coordinador de la capilla 1', datos: 'Ingreso de $1 en el fondo parroquial', esperado: 'HTTP 403', criterio: 'El Coordinador gestiona solo el fondo de su capilla (HU-05)' },
  async () => { const r = await mov(T.coordinador1, fPar.id_fondo, 1); return { obtenido: `HTTP ${r.status}`, pasa: r.status === 403, peticiones: [r] }; });

  await caso({ id: 'CP-FIN-08', req: 'RF-FIN-03; RNF-AUT-02', tecnica: 'Tabla de decisión (rol × fondo)', enfoque: 'Verificación (seguridad)',
    precondicion: 'Sesión de Tesorero de la capilla 1', datos: 'Ingreso de $1 en el fondo de la capilla 2', esperado: 'HTTP 403', criterio: 'El Tesorero de capilla no opera otros fondos' },
  async () => { const r = await mov(T.tesorero1, f2.id_fondo, 1); return { obtenido: `HTTP ${r.status}`, pasa: r.status === 403, peticiones: [r] }; });

  await caso({ id: 'CP-FIN-09', req: 'RF-FIN-06', tecnica: 'Valores límite (mes en curso)', enfoque: 'Verificación',
    precondicion: 'Sesión de Tesorero general', datos: `Cierre de ${hoy.getMonth() + 1}/${hoy.getFullYear()}`, esperado: 'HTTP 400 o 409', criterio: 'No se cierra un mes en curso' },
  async () => { const r = await api('POST', '/api/cierres-mes', { token: T.tesoreroGeneral, body: { mes: hoy.getMonth() + 1, anio: hoy.getFullYear() } });
    return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? r.datos?.error ?? ''}`, pasa: r.status === 400 || r.status === 409, peticiones: [r] }; });

  const cierres = lista(await api('GET', '/api/cierres-mes', { token: T.tesoreroGeneral }));
  let mesC = 1, anioC = 2025;
  while (cierres.some(c => c.mes === mesC && c.anio === anioC && (c.id_capilla ?? null) === null)) { mesC++; if (mesC > 12) { mesC = 1; anioC--; } }
  let cierreNuevo;
  await caso({ id: 'CP-FIN-10', req: 'RF-FIN-06', tecnica: 'Partición de equivalencia (mes cerrado válido y repetido)', enfoque: 'Validación',
    precondicion: `Sin cierre parroquial de ${mesC}/${anioC}`, datos: `Cerrar ${mesC}/${anioC} dos veces`, esperado: '1.º HTTP 201; 2.º HTTP 409', criterio: 'Un solo cierre por mes y alcance' },
  async () => { const a = await api('POST', '/api/cierres-mes', { token: T.tesoreroGeneral, body: { mes: mesC, anio: anioC } }); cierreNuevo = objeto(a, 'cierre');
    const b = await api('POST', '/api/cierres-mes', { token: T.tesoreroGeneral, body: { mes: mesC, anio: anioC } });
    return { obtenido: `HTTP ${a.status} y luego HTTP ${b.status}`, pasa: a.status === 201 && (b.status === 409 || b.status === 400), peticiones: [a, b] }; });

  await caso({ id: 'CP-FIN-11', req: 'RF-FIN-06; RSK-04', tecnica: 'Partición de equivalencia (fecha dentro de un mes cerrado)', enfoque: 'Verificación',
    precondicion: `Mes ${mesC}/${anioC} cerrado (CP-FIN-10)`, datos: `Ingreso de $1 con fecha ${anioC}-${String(mesC).padStart(2, '0')}-15`, esperado: 'HTTP 400/409 (criterio propuesto)', criterio: 'El historial de cierres no se altera (HU-16) (P)' },
  async () => { const r = await mov(T.tesoreroGeneral, fPar.id_fondo, 1, `${anioC}-${String(mesC).padStart(2, '0')}-15`);
    return { obtenido: `HTTP ${r.status}`, pasa: r.status === 400 || r.status === 409, peticiones: [r] }; });

  await caso({ id: 'CP-FIN-12', req: 'RF-FIN-06', tecnica: 'Tabla de decisión (rol × acción: eliminar cierre)', enfoque: 'Verificación (seguridad)',
    precondicion: 'Cierre de CP-FIN-10', datos: 'Tesorero general elimina el cierre', esperado: 'HTTP 403', criterio: 'Solo el Sacerdote elimina cierres (HU-16)' },
  async () => { const r = await api('DELETE', `/api/cierres-mes/${cierreNuevo?.id_cierre}`, { token: T.tesoreroGeneral }); return { obtenido: `HTTP ${r.status}`, pasa: r.status === 403, peticiones: [r] }; });

  await caso({ id: 'CP-FIN-13', req: 'RNF-AUT-02', tecnica: 'Tabla de decisión (rol × recurso)', enfoque: 'Verificación (seguridad)',
    precondicion: 'Sesión de Laico', datos: 'GET /api/movimientos-financieros', esperado: 'HTTP 403', criterio: 'Un laico no ve las finanzas internas' },
  async () => { const r = await api('GET', '/api/movimientos-financieros', { token: T.laicoA }); return { obtenido: `HTTP ${r.status}`, pasa: r.status === 403, peticiones: [r] }; });


  await caso({ id: 'CP-FIN-14', req: 'RF-FIN-03; RNF-FIN-02', tecnica: 'Partición de equivalencia (movimiento válido en fondo propio)', enfoque: 'Validación',
    precondicion: 'Sesión de Tesorero de la capilla 1', datos: 'Ingreso de $10 en el fondo de la capilla 1', esperado: 'HTTP 201 y saldo +$10', criterio: 'El movimiento actualiza el saldo' },
  async () => { const s0 = await saldo(f1.id_fondo); const r = await mov(T.tesorero1, f1.id_fondo, 10); const s1 = await saldo(f1.id_fondo);
    return { obtenido: `HTTP ${r.status}; saldo ${s0} → ${s1}`, pasa: r.status === 201 && Math.abs(s1 - s0 - 10) < 0.001, peticiones: [r] }; });

  await caso({ id: 'CP-FIN-15', req: 'RF-FIN-05', tecnica: 'Partición de equivalencia (filtros de fecha y tipo)', enfoque: 'Validación',
    precondicion: 'Sesión de Tesorero general', datos: `tipo=Ingreso, desde ${iso(masDias(-30))} hasta ${iso(hoy)}`, esperado: 'Solo ingresos dentro del rango', criterio: 'El reporte filtra por fecha y tipo (HU-14)' },
  async () => { const d = iso(masDias(-30)), h = iso(hoy); const r = await api('GET', `/api/movimientos-financieros?tipo=Ingreso&fecha_desde=${d}&fecha_hasta=${h}`, { token: T.tesoreroGeneral });
    const l = lista(r); const fuera = l.filter(m => m.tipo !== 'Ingreso' || String(m.fecha).slice(0, 10) < d || String(m.fecha).slice(0, 10) > h);
    return { obtenido: `HTTP ${r.status}; ${l.length} movimientos; fuera del filtro: ${fuera.length}`, pasa: r.status === 200 && fuera.length === 0, peticiones: [{ ...r, datos: `[${l.length} registros]` }] }; });

  await caso({ id: 'CP-FIN-16', req: 'RF-FIN-08', tecnica: 'Partición de equivalencia (Sacerdote, cualquier fondo)', enfoque: 'Validación',
    precondicion: 'Sesión de Sacerdote', datos: 'Egreso de $1 en el fondo parroquial', esperado: 'HTTP 201', criterio: 'El Sacerdote gestiona todos los fondos' },
  async () => { const r = await mov(tSac, fPar.id_fondo, 1, iso(hoy), 'Egreso'); return { obtenido: `HTTP ${r.status}`, pasa: r.status === 201, peticiones: [r] }; });

  // ===================== SOLICITUDES DE SACRAMENTO ====================
  const solicitar = (tok, body) => api('POST', '/api/solicitudes-sacramento', { token: tok, body: { id_capilla: 1, id_documento: docA, ...body } });
  await caso({ id: 'CP-SOL-01', req: 'RF-SOL-03', tecnica: 'Tabla de decisión R1 (Primera Comunión sin Bautismo)', enfoque: 'Validación',
    precondicion: `Laico sin certificado de Bautismo (${laicoD?.correo ?? 'no encontrado'})`, datos: 'Primera Comunión, modalidad Propia', esperado: 'HTTP 400 que nombra el certificado faltante', criterio: 'Se rechaza indicando el certificado faltante (HU-17)' },
  async () => { if (!T.laicoD) return { obtenido: 'No hay laico sin Bautismo en los datos', pasa: null };
    const r = await solicitar(T.laicoD, { sacramento: 'Primera Comunion', modalidad: 'Propia' });
    return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 400 && /Bautismo/i.test(r.datos?.mensaje ?? ''), peticiones: [r] }; });

  let solC, solB;
  await caso({ id: 'CP-SOL-02', req: 'RF-SOL-03', tecnica: 'Tabla de decisión R2 (Primera Comunión con Bautismo)', enfoque: 'Validación',
    precondicion: `Laico con Bautismo emitido (${laicoC?.correo ?? 'no encontrado'})`, datos: 'Primera Comunión, modalidad Propia', esperado: 'HTTP 201, estado Pendiente', criterio: 'Se acepta si cumple el prerrequisito' },
  async () => { if (!T.laicoC) return { obtenido: 'No hay laico con Bautismo y sin Primera Comunión', pasa: null };
    const r = await solicitar(T.laicoC, { sacramento: 'Primera Comunion', modalidad: 'Propia' }); solC = objeto(r, 'solicitud');
    return { obtenido: `HTTP ${r.status}; estado=${solC?.estado ?? '-'}`, pasa: r.status === 201, peticiones: [r] }; });

  await caso({ id: 'CP-SOL-03', req: 'RF-SOL-03', tecnica: 'Tabla de decisión R3 (Confirmación sin Primera Comunión)', enfoque: 'Validación',
    precondicion: 'Mismo laico de CP-SOL-02 (sin Primera Comunión emitida)', datos: 'Confirmación, modalidad Propia', esperado: 'HTTP 400 que nombra Primera Comunión', criterio: 'Se respeta el orden sacramental' },
  async () => { if (!T.laicoC) return { obtenido: 'Sin datos', pasa: null };
    const r = await solicitar(T.laicoC, { sacramento: 'Confirmacion', modalidad: 'Propia' });
    return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 400 && /Primera Comuni/i.test(r.datos?.mensaje ?? ''), peticiones: [r] }; });

  await caso({ id: 'CP-SOL-04', req: 'RF-SOL-03', tecnica: 'Tabla de decisión R4 (tercero sin Bautismo)', enfoque: 'Verificación',
    precondicion: 'Beneficiario nuevo, sin certificados', datos: 'Primera Comunión, modalidad Terceros, beneficiario sin Bautismo', esperado: 'HTTP 400 (prerrequisito del beneficiario)', criterio: 'El prerrequisito se valida por beneficiario (HU-17)' },
  async () => { const ced = cedulaValidaNueva(Number(String(Date.now()).slice(-6)) + 31);
    const r = await solicitar(T.laicoB, { sacramento: 'Primera Comunion', modalidad: 'Terceros', beneficiarios: [{ rol_beneficiario: 'Tercero', nombres: 'Tercero', apellidos: 'Sin Bautismo', cedula: ced }] });
    return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 400, peticiones: [r] }; });

  await caso({ id: 'CP-SOL-05', req: 'RF-SOL-01', tecnica: 'Partición de equivalencia (solicitud válida de Bautizo)', enfoque: 'Validación',
    precondicion: 'Sesión de Laico B', datos: 'Bautizo, modalidad Terceros, bautizando nuevo', esperado: 'HTTP 201, estado Pendiente', criterio: 'Queda pendiente de asignación de fecha' },
  async () => { const ced = cedulaValidaNueva(Number(String(Date.now()).slice(-6)) + 47);
    const r = await solicitar(T.laicoB, { sacramento: 'Bautizo', modalidad: 'Terceros', beneficiarios: [{ rol_beneficiario: 'Bautizando', nombres: 'Bebé', apellidos: 'De Prueba', cedula: ced }] });
    solB = objeto(r, 'solicitud');
    return { obtenido: `HTTP ${r.status}; estado=${solB?.estado ?? '-'}`, pasa: r.status === 201 && solB?.estado === 'Pendiente', peticiones: [r] }; });

    const asignar = (body) => api('PUT', `/api/solicitudes-sacramento/${solB?.id_solicitud}/asignar`, { token: tSac, body: { id_capilla: 1, ...body } });
  await caso({ id: 'CP-SOL-06', req: 'RF-SOL-02', tecnica: 'Valores límite (fecha de ayer)', enfoque: 'Verificación',
    precondicion: 'Solicitud de CP-SOL-05', datos: `fecha ${iso(masDias(-1))}, 10:00–11:00`, esperado: 'HTTP 400', criterio: 'No se asignan fechas pasadas' },
  async () => { const r = await asignar({ fecha_asignada: iso(masDias(-1)), hora_inicio: '10:00', hora_fin: '11:00' }); return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 400, peticiones: [r] }; });

  await caso({ id: 'CP-SOL-07', req: 'RF-SOL-02', tecnica: 'Valores límite (hora inicio = hora fin)', enfoque: 'Verificación',
    precondicion: 'Solicitud de CP-SOL-05', datos: `fecha ${iso(masDias(40))}, 10:00–10:00`, esperado: 'HTTP 400', criterio: 'Inicio anterior al fin' },
  async () => { const r = await asignar({ fecha_asignada: iso(masDias(40)), hora_inicio: '10:00', hora_fin: '10:00' }); return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 400, peticiones: [r] }; });

  await caso({ id: 'CP-SOL-08', req: 'RF-SOL-02; HU-09', tecnica: 'Integración (asignación → trigger → eucaristía)', enfoque: 'Validación',
    precondicion: 'Solicitud de CP-SOL-05', datos: `fecha ${iso(masDias(41))}, 09:00–10:00`, esperado: 'HTTP 200 y la eucaristía aparece en el calendario', criterio: 'La fecha asignada se publica' },
  async () => { const fecha = iso(masDias(41)); const r = await asignar({ fecha_asignada: fecha, hora_inicio: '09:00', hora_fin: '10:00' });
    const e = lista(await api('GET', '/api/eucaristias')).filter(x => String(x.fecha).slice(0, 10) === fecha && x.id_solicitud === solB?.id_solicitud);
    return { obtenido: `HTTP ${r.status}; eucaristías creadas: ${e.length}`, pasa: r.status === 200 && e.length === 1, peticiones: [r] }; });

  await caso({ id: 'CP-SOL-09', req: 'RF-SOL-05; RNF-AUT-03', tecnica: 'Tabla de decisión (dueño × recurso)', enfoque: 'Verificación (seguridad)',
    precondicion: 'Solicitud de Laico B (CP-SOL-05)', datos: 'Laico A la consulta por id', esperado: 'HTTP 403', criterio: 'Un laico no ve solicitudes ajenas' },
  async () => { const r = await api('GET', `/api/solicitudes-sacramento/${solB?.id_solicitud}`, { token: T.laicoA }); return { obtenido: `HTTP ${r.status}`, pasa: r.status === 403, peticiones: [r] }; });

  await caso({ id: 'CP-SOL-10', req: 'RF-SOL-01', tecnica: 'Partición de equivalencia (duplicado pendiente)', enfoque: 'Verificación',
    precondicion: 'Solicitud pendiente de CP-SOL-02', datos: 'Misma solicitud otra vez', esperado: 'HTTP 400', criterio: 'Sin solicitudes propias duplicadas' },
  async () => { if (!T.laicoC) return { obtenido: 'Sin datos', pasa: null };
    const r = await solicitar(T.laicoC, { sacramento: 'Primera Comunion', modalidad: 'Propia' }); return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 400, peticiones: [r] }; });


  await caso({ id: 'CP-SOL-11', req: 'RF-SOL-04 (depende de DR-10)', tecnica: 'Tabla de decisión (rol × acción: aprobar)', enfoque: 'Validación',
    precondicion: 'Solicitud de Primera Comunión pendiente (CP-SOL-02)', datos: 'El Sacerdote la aprueba', esperado: 'HTTP 200 según HU-17', criterio: 'El Sacerdote aprueba o rechaza cada solicitud (HU-17)' },
  async () => { if (!solC) return { obtenido: 'Sin solicitud pendiente', pasa: null };
    const r = await api('PUT', `/api/solicitudes-sacramento/${solC.id_solicitud}/aprobar`, { token: tSac });
    return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 200, peticiones: [r] }; });

  // ========================= HORARIOS DE MISA =========================
  await caso({ id: 'CP-HOR-01', req: 'RF-HOR-01', tecnica: 'Partición de equivalencia (sin sesión)', enfoque: 'Validación',
    precondicion: 'Ninguna', datos: 'GET /api/eucaristias sin token', esperado: 'HTTP 200 con lista', criterio: 'Consulta pública (HU-02)' },
  async () => { const r = await api('GET', '/api/eucaristias'); return { obtenido: `HTTP ${r.status}; ${lista(r).length} horarios`, pasa: r.status === 200, peticiones: [{ ...r, datos: `[${lista(r).length} registros]` }] }; });

  const fH = masDias(50); const nuevoH = { id_capilla: 2, dia_semana: DIAS[fH.getDay()], fecha: iso(fH), hora_inicio: '06:17', hora_fin: '07:00', estado: 'Programada' };
  await caso({ id: 'CP-HOR-02', req: 'RF-HOR-02; RNF-AUT-02', tecnica: 'Tabla de decisión (rol × acción)', enfoque: 'Verificación (seguridad)',
    precondicion: 'Sesión de Laico', datos: 'POST /api/eucaristias', esperado: 'HTTP 403', criterio: 'Solo el Sacerdote gestiona horarios' },
  async () => { const r = await api('POST', '/api/eucaristias', { token: T.laicoA, body: nuevoH }); return { obtenido: `HTTP ${r.status}`, pasa: r.status === 403, peticiones: [r] }; });

  await caso({ id: 'CP-HOR-03', req: 'RF-HOR-02', tecnica: 'Partición de equivalencia (horario válido)', enfoque: 'Validación',
    precondicion: 'Sesión de Sacerdote', datos: `${nuevoH.dia_semana} ${nuevoH.fecha} 06:17–07:00, capilla 2`, esperado: 'HTTP 201', criterio: 'Horario registrado' },
  async () => { const r = await api('POST', '/api/eucaristias', { token: tSac, body: nuevoH }); return { obtenido: `HTTP ${r.status}`, pasa: r.status === 201, peticiones: [r] }; });

  await caso({ id: 'CP-HOR-04', req: 'RF-HOR-03', tecnica: 'Tabla de decisión (capilla, día y hora iguales)', enfoque: 'Verificación',
    precondicion: 'Horario de CP-HOR-03', datos: 'El mismo horario otra vez', esperado: 'HTTP 400', criterio: 'Se rechazan duplicados (HU-01)' },
  async () => { const r = await api('POST', '/api/eucaristias', { token: tSac, body: nuevoH }); return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? r.datos?.error ?? ''}`, pasa: r.status === 400 || r.status === 409, peticiones: [r] }; });

  await caso({ id: 'CP-HOR-05', req: 'RF-HOR-02', tecnica: 'Valores límite (hora fin anterior a inicio)', enfoque: 'Verificación',
    precondicion: 'Sesión de Sacerdote', datos: '08:00–07:59', esperado: 'HTTP 400', criterio: 'Inicio anterior al fin' },
  async () => { const r = await api('POST', '/api/eucaristias', { token: tSac, body: { ...nuevoH, hora_inicio: '08:00', hora_fin: '07:59' } }); return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 400, peticiones: [r] }; });

  // ========================= RENDIMIENTO (GEN) ========================
  const medir = async (ruta, token) => { const t = []; for (let i = 0; i < CONFIG.REPETICIONES_RENDIMIENTO; i++) t.push((await api('GET', ruta, { token })).ms); t.sort((a, b) => a - b);
    return { prom: t.reduce((a, b) => a + b, 0) / t.length, p95: t[Math.ceil(0.95 * t.length) - 1], max: t[t.length - 1] }; };
  for (const [id, ruta, tok, rf] of [['CP-GEN-01', '/api/eucaristias', null, 'RF-HOR-01'], ['CP-GEN-02', '/api/movimientos-financieros', T.tesoreroGeneral, 'RF-FIN-05'], ['CP-GEN-03', '/api/inscripciones-catequesis', T.catequista1, 'RF-CAT-06'], ['CP-GEN-04', '/api/donaciones', T.tesoreroGeneral, 'RF-FIN-02']]) {
    await caso({ id, req: `RNF-GEN-01; ${rf}`, tecnica: 'Medición de tiempo de respuesta', enfoque: 'Verificación (rendimiento)',
      precondicion: 'Servidor y BD en el mismo equipo de pruebas', datos: `${CONFIG.REPETICIONES_RENDIMIENTO} peticiones secuenciales a ${ruta}`, esperado: 'Promedio < 500 ms; percentil 95 < 1000 ms (P)', criterio: 'RNF-GEN-01' },
    async () => { const m = await medir(ruta, tok); return { obtenido: `promedio ${m.prom.toFixed(0)} ms; p95 ${m.p95.toFixed(0)} ms; máximo ${m.max.toFixed(0)} ms`, pasa: m.prom < 500 && m.p95 < 1000, peticiones: [] }; });
  }


  // ============ USUARIOS Y AUTENTICACIÓN: pruebas pedidas en clase ============
  // Numeración fija EV-F07-080 a 083 para no alterar las evidencias anteriores.
  const registrarCon = (correo, contrasena, extra = 0) => api('POST', '/api/auth/registro', { body: { cedula: cedulaValidaNueva(Number(String(Date.now()).slice(-6)) + 61 + extra), nombres: 'Prueba', apellidos: 'Correo', correo, contrasena, id_capilla: 1 } });
  await caso({ id: 'CP-AUT-20', ev: 'EV-F07-080', req: 'RF-AUT-07; RNF-AUT-02', tecnica: 'Partición de equivalencia (correo sin usuario)', enfoque: 'Verificación',
    precondicion: 'Ninguna', datos: 'Correo "@hola.com" enviado directo a la API', esperado: 'HTTP 400', criterio: 'Solo se aceptan correos con formato válido (P)' },
  async () => { const r = await registrarCon('@hola.com', 'Ab1.xyzw', 1); return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 400, peticiones: [r] }; });

  await caso({ id: 'CP-AUT-21', ev: 'EV-F07-081', req: 'RF-AUT-07; RNF-AUT-02', tecnica: 'Partición de equivalencia (dominio sin extensión)', enfoque: 'Verificación',
    precondicion: 'Ninguna', datos: 'Correo "prueba@hola" (dominio sin .com, .ec, etc.)', esperado: 'HTTP 400', criterio: 'El dominio debe tener una extensión válida (P)' },
  async () => { const r = await registrarCon(`prueba${Date.now()}@hola`, 'Ab1.xyzw', 2); return { obtenido: `HTTP ${r.status}: ${r.datos?.mensaje ?? ''}`, pasa: r.status === 400, peticiones: [r] }; });

  await caso({ id: 'CP-AUT-22', ev: 'EV-F07-082', req: 'RF-AUT-07; RNF-AUT-01', tecnica: 'Partición de equivalencia (contraseñas débiles)', enfoque: 'Verificación',
    precondicion: 'Correo y cédula válidos', datos: 'Contraseñas "ABC123" y "1111"', esperado: 'HTTP 400 en ambas', criterio: 'Política: 8 caracteres, mayúscula, minúscula, número y símbolo' },
  async () => { const a = await registrarCon(`debil1.${Date.now()}@prueba.test`, 'ABC123', 3); const b = await registrarCon(`debil2.${Date.now()}@prueba.test`, '1111', 4);
    return { obtenido: `"ABC123": HTTP ${a.status}; "1111": HTTP ${b.status}`, pasa: a.status === 400 && b.status === 400, peticiones: [a, b] }; });

  await caso({ id: 'CP-AUT-23', ev: 'EV-F07-083', req: 'RF-AUT-01; RSK-03', tecnica: 'Valores límite (5 intentos fallidos)', enfoque: 'Verificación (seguridad)',
    precondicion: 'Cuenta activa de Laico B', datos: '5 inicios de sesión con contraseña incorrecta y luego la correcta', esperado: 'Cuenta bloqueada o HTTP 429/423 tras el 5.º intento (P)', criterio: 'Se limita la adivinación de contraseñas' },
  async () => { const pet = []; for (let i = 0; i < 5; i++) pet.push(await api('POST', '/api/auth/login', { body: { correo: laicoB.correo, contrasena: 'Incorrecta.' + i } }));
    const ok = await api('POST', '/api/auth/login', { body: { correo: laicoB.correo, contrasena: CONFIG.CLAVE_PRUEBA } }); pet.push({ ...ok, datos: { mensaje: ok.datos?.mensaje } });
    return { obtenido: `Intentos fallidos: ${pet.slice(0, 5).map(p => p.status).join(',')}; 6.º con clave correcta: HTTP ${ok.status}`, pasa: ok.status === 429 || ok.status === 423 || pet.slice(0, 5).some(p => p.status === 429 || p.status === 423),
      peticiones: pet.map(p => ({ ...p, body: { correo: laicoB.correo, contrasena: '***' } })) }; });

  // ----------------------------- RESUMEN ------------------------------
  const csv = ['evidencia;caso;requisito_o_riesgo;tecnica;resultado_esperado;resultado_obtenido;estado;fecha_hora']
    .concat(resultados.map(r => [r.evidencia, r.caso, r.requisito_o_riesgo, r.tecnica, r.resultado_esperado, r.resultado_obtenido, r.estado, r.fecha_hora].map(x => `"${String(x).replace(/"/g, "'")}"`).join(';')));
  fs.writeFileSync(path.join(SALIDA, 'resumen.csv'), '﻿' + csv.join('\n'));
  const cuenta = (e) => resultados.filter(r => r.estado === e).length;
  const md = [`# Resumen de ejecución`, ``, `- Fecha: ${inicio.toISOString()}`, `- Ejecutor: ${CONFIG.EJECUTOR}`, `- Versión del código: ${CONFIG.VERSION_CODIGO}`, `- Versión de la BD: ${CONFIG.VERSION_BD}`,
    `- Entorno: Node ${process.version}, ${os.type()} ${os.release()}, ${CONFIG.BASE_URL}`, `- Casos: ${resultados.length} | PASA ${cuenta('PASA')} | FALLA ${cuenta('FALLA')} | BLOQUEADO ${cuenta('BLOQUEADO')}`, ``,
    `| Evidencia | Caso | Requisito | Esperado | Obtenido | Estado |`, `|---|---|---|---|---|---|`,
    ...resultados.map(r => `| ${r.evidencia} | ${r.caso} | ${r.requisito_o_riesgo} | ${r.resultado_esperado} | ${r.resultado_obtenido} | ${r.estado} |`)];
  fs.writeFileSync(path.join(SALIDA, 'resumen.md'), md.join('\n'));
  console.log(`\nTotal ${resultados.length}: PASA ${cuenta('PASA')}, FALLA ${cuenta('FALLA')}, BLOQUEADO ${cuenta('BLOQUEADO')}\nEvidencias en ${SALIDA}`);
}

main().catch(e => { console.error('\nERROR:', e.message); process.exit(1); });
