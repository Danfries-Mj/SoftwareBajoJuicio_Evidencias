// =====================================================================
// Pruebas del cambio inesperado (CAM-01) – Auditoría del Sistema de Gestión Parroquial
// Cambio: «el sistema deberá soportar cinco veces la carga inicialmente prevista
// y una funcionalidad crítica será modificada antes de producción».
//   CP-FIN-23  Aprobación concurrente de la misma donación (funcionalidad crítica modificada)
//   CP-GEN-10  Consultas autenticadas de Tesorería con la carga nueva (100 usuarios)
// Las consultas públicas con 100 y 500 usuarios (CP-GEN-08 y 09) usan pruebas_carga.mjs.
// Uso:  node pruebas_cambio.mjs > EV-F07-09X_cambio.txt   (SOLO contra sys_pruebas)
// =====================================================================
import os from 'node:os';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CORREO_SACERDOTE = process.env.CORREO_SACERDOTE || 'adminpepe@gmail.com';
const CLAVE = process.env.CLAVE_PRUEBA || 'Prueba.2026';
const PARALELAS = Number(process.env.PARALELAS || 20);
const CONCURRENCIA = Number(process.env.CONCURRENCIA || 100);
const DURACION = Number(process.env.DURACION || 30);
const VERSION = process.env.VERSION_CODIGO || '[indicar v1.0 o v1.1]';

async function api(metodo, ruta, token, body) {
  const t0 = performance.now();
  const r = await fetch(BASE_URL + ruta, { method: metodo, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text(); let datos; try { datos = JSON.parse(txt); } catch { datos = txt; }
  return { status: r.status, datos, ms: performance.now() - t0 };
}
const lista = (r) => (r.datos && typeof r.datos === 'object') ? (Object.values(r.datos).find(Array.isArray) || []) : [];
const login = async (correo) => { const r = await api('POST', '/api/auth/login', null, { correo, contrasena: CLAVE }); if (r.status !== 200) throw new Error(`login ${r.status}`); return r.datos.token; };
const hoy = new Date(); const iso = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

console.log(`PRUEBAS DEL CAMBIO CAM-01 | ${new Date().toISOString()} | ${BASE_URL} | versión: ${VERSION}`);
console.log(`Entorno: Node ${process.version}, ${os.type()} ${os.release()}, CPU ${os.cpus()[0]?.model} x${os.cpus().length}, RAM ${(os.totalmem() / 2 ** 30).toFixed(1)} GB\n`);

const tSac = await login(CORREO_SACERDOTE);
const usuarios = lista(await api('GET', '/api/usuarios', tSac)).filter(u => u.activo);
const tes1 = usuarios.find(u => u.rol === 'Tesorero' && u.id_capilla === 1);
const tesG = usuarios.find(u => u.rol === 'Tesorero' && u.id_capilla == null);
const laico = usuarios.find(u => u.rol === 'Laico' && u.id_capilla === 1);
const [tT1, tTG, tL] = [await login(tes1.correo), await login(tesG.correo), await login(laico.correo)];
const fondo = lista(await api('GET', '/api/fondos', tSac)).find(f => f.id_capilla === 1);
const saldo = async () => Number((await api('GET', `/api/fondos/${fondo.id_fondo}`, tSac)).datos?.fondo?.saldo_actual);

// ---------------- CP-FIN-23 ----------------
const doc = await api('POST', '/api/documentos', tL, { tipo: 'Comprobante', archivo_nombre: 'comprobante-cambio.png', mime_type: 'image/png', archivo_url: 'data:image/png;base64,' + 'iVBORw0KGgo'.padEnd(200, 'A') });
const don = (await api('POST', '/api/donaciones', tL, { id_capilla: 1, fecha: iso, monto: 50, id_documento: doc.datos?.documento?.id_documento, id_fondo: fondo.id_fondo })).datos?.donacion;
const s0 = await saldo();
const rs = await Promise.all(Array.from({ length: PARALELAS }, () => api('PUT', `/api/donaciones/${don.id_donacion}/aprobar`, tT1)));
const s1 = await saldo();
const cuenta = {}; for (const r of rs) cuenta[r.status] = (cuenta[r.status] || 0) + 1;
const pasa23 = Math.abs(s1 - s0 - 50) < 0.001;
console.log('=== CP-FIN-23 | RF-FIN-02, RNF-FIN-02, RSK-04 | Aprobación concurrente de la misma donación ===');
console.log(`Datos: donación ${don.id_donacion} de $50 pendiente; ${PARALELAS} aprobaciones simultáneas del Tesorero de la capilla 1`);
console.log(`Respuestas: ${Object.entries(cuenta).map(([s, n]) => `${n} × HTTP ${s}`).join(', ')}`);
console.log(`Saldo del fondo ${fondo.id_fondo}: ${s0} → ${s1} (Δ ${(s1 - s0).toFixed(2)})`);
console.log(`Criterio: el saldo sube exactamente $50 (una sola aprobación efectiva) → ${pasa23 ? 'PASA' : 'FALLA'}\n`);

// ---------------- CP-GEN-10 ----------------
const RUTAS = ['/api/movimientos-financieros', '/api/donaciones', '/api/fondos'];
const tiempos = []; let errores = 0, total = 0; const fin = Date.now() + DURACION * 1000;
await Promise.all(Array.from({ length: CONCURRENCIA }, async (_, i) => { let k = i;
  while (Date.now() < fin) { const t0 = performance.now();
    try { const r = await fetch(BASE_URL + RUTAS[k++ % RUTAS.length], { headers: { authorization: `Bearer ${tTG}` } }); await r.arrayBuffer(); if (r.status >= 400) errores++; } catch { errores++; }
    tiempos.push(performance.now() - t0); total++; } }));
tiempos.sort((a, b) => a - b);
const pc = (q) => tiempos[Math.min(tiempos.length - 1, Math.ceil(q * tiempos.length) - 1)];
const prom = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
const pasa10 = prom < 500 && pc(0.95) < 1000 && errores === 0;
console.log('=== CP-GEN-10 | RNF-GEN-01, RF-FIN-05 | Consultas de Tesorería con la carga nueva ===');
console.log(`${CONCURRENCIA} usuarios simultáneos autenticados durante ${DURACION} s sobre ${RUTAS.join(', ')}`);
console.log(`Peticiones ${total} (${(total / DURACION).toFixed(1)}/s); promedio ${prom.toFixed(1)} ms; p95 ${pc(0.95).toFixed(1)} ms; p99 ${pc(0.99).toFixed(1)} ms; máximo ${tiempos.at(-1).toFixed(1)} ms; errores ${errores}`);
console.log(`Criterio (P): promedio < 500 ms, p95 < 1000 ms, 0 errores → ${pasa10 ? 'PASA' : 'FALLA'}`);
