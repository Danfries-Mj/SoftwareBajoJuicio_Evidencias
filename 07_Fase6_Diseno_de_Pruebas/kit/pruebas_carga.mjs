// =====================================================================
// Pruebas de carga y estrés – Auditoría del Sistema de Gestión Parroquial
// CP-GEN-05 (carga) y CP-GEN-06 (estrés). Sin dependencias, Node 18+.
// Uso:  node pruebas_carga.mjs                 (usa los valores por defecto)
//       CONCURRENCIA=100 DURACION=30 CASO=CP-GEN-06 node pruebas_carga.mjs
// Guardar la salida:  node pruebas_carga.mjs > EV-F07-CARGA.txt
// =====================================================================
import os from 'node:os';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CONCURRENCIA = Number(process.env.CONCURRENCIA || 20);   // usuarios simultáneos
const DURACION = Number(process.env.DURACION || 30);           // segundos
const CASO = process.env.CASO || 'CP-GEN-05';
const RUTAS = ['/api/eucaristias', '/api/eventos', '/api/capillas', '/api/comunicados']; // consultas públicas habituales

const tiempos = []; let errores = 0, total = 0; const fin = Date.now() + DURACION * 1000;
async function usuario(i) {
  let k = i;
  while (Date.now() < fin) {
    const ruta = RUTAS[k++ % RUTAS.length]; const t0 = performance.now();
    try { const r = await fetch(BASE_URL + ruta); await r.arrayBuffer(); if (r.status >= 500) errores++; }
    catch { errores++; }
    tiempos.push(performance.now() - t0); total++;
  }
}
console.log(`${CASO} | ${new Date().toISOString()} | ${BASE_URL} | ${CONCURRENCIA} usuarios simultáneos durante ${DURACION} s`);
console.log(`Entorno: Node ${process.version}, ${os.type()} ${os.release()}, CPU ${os.cpus()[0]?.model} x${os.cpus().length}, RAM ${(os.totalmem() / 2 ** 30).toFixed(1)} GB`);
await Promise.all(Array.from({ length: CONCURRENCIA }, (_, i) => usuario(i)));
tiempos.sort((a, b) => a - b);
const p = (q) => tiempos[Math.min(tiempos.length - 1, Math.ceil(q * tiempos.length) - 1)];
const prom = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
const r = { peticiones: total, por_segundo: +(total / DURACION).toFixed(1), promedio_ms: +prom.toFixed(1), p95_ms: +p(0.95).toFixed(1), p99_ms: +p(0.99).toFixed(1), maximo_ms: +tiempos.at(-1).toFixed(1), errores, porcentaje_errores: +(100 * errores / total).toFixed(2) };
console.table(r);
const ESTRES = ['CP-GEN-06', 'CP-GEN-09'].includes(CASO);
const pasa = ESTRES ? r.porcentaje_errores < 5 : (r.promedio_ms < 500 && r.p95_ms < 1000 && r.errores === 0);
console.log(`Criterio (P): ${ESTRES ? 'errores < 5 % y el servidor sigue respondiendo' : 'promedio < 500 ms, p95 < 1000 ms, 0 errores'} → ${pasa ? 'PASA' : 'FALLA'}`);
