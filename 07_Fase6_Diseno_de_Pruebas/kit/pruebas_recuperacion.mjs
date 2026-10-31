// =====================================================================
// Prueba de recuperación – Auditoría del Sistema de Gestión Parroquial
// CP-GEN-07 (RSK-10): el backend debe seguir vivo mientras PostgreSQL está
// detenido y volver a responder solo cuando la base de datos regresa.
//   v1.0 -> EV-F07-073   |   v1.1 -> EV-F07-085
//
// El script consulta /api/eucaristias cada segundo y registra la respuesta.
// Detiene e inicia PostgreSQL de forma automática si se indica SERVICIO
// (requiere PowerShell abierto como administrador); si no, avisa en pantalla
// cuándo detenerlo e iniciarlo a mano.
//
// Uso (PowerShell, desde la carpeta del kit, con el backend ya levantado):
//   Get-Service *postgres*            (para ver el nombre exacto del servicio)
//   $env:SERVICIO="postgresql-x64-18"; $env:VERSION_CODIGO="v1.1 (parche 657d4354)"; $env:EV="EV-F07-085"
//   node pruebas_recuperacion.mjs | Out-File -Encoding utf8 EV-F07-085_CP-GEN-07_v1.1.txt
// Variables opcionales: BASE_URL, RUTA, CAIDA_EN (s, por defecto 10),
//   CAIDA_SEG (s que PostgreSQL queda detenido, por defecto 30), DURACION (s totales, por defecto 75)
// =====================================================================
import os from 'node:os';
import { execSync } from 'node:child_process';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const RUTA = process.env.RUTA || '/api/eucaristias';
const SERVICIO = process.env.SERVICIO || '';
const CAIDA_EN = Number(process.env.CAIDA_EN || 10);
const CAIDA_SEG = Number(process.env.CAIDA_SEG || 30);
const DURACION = Number(process.env.DURACION || 75);
const VERSION = process.env.VERSION_CODIGO || '[indicar v1.0 o v1.1]';
const EV = process.env.EV || '[EV-F07-073 para v1.0 o EV-F07-085 para v1.1]';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const hora = () => new Date().toLocaleTimeString('es-EC', { hour12: false });

function servicio(accion) {
  const cmd = `net ${accion} "${SERVICIO}"`;
  try { execSync(cmd, { stdio: 'pipe' }); return `${cmd} -> correcto`; }
  catch (e) { return `${cmd} -> ERROR: ${String(e.stderr || e.message).trim().split('\n')[0]}`; }
}

console.log(`CP-GEN-07 | ${EV} | ${new Date().toISOString()} | ${BASE_URL}${RUTA} | versión: ${VERSION}`);
console.log(`Entorno: Node ${process.version}, ${os.type()} ${os.release()}, CPU ${os.cpus()[0]?.model} x${os.cpus().length}`);
console.log(`Plan: PostgreSQL se detiene en t=${CAIDA_EN} s y se inicia en t=${CAIDA_EN + CAIDA_SEG} s; observación total ${DURACION} s.`);
console.log(SERVICIO ? `Servicio controlado por el script: ${SERVICIO}\n` : 'Sin SERVICIO: detenga e inicie PostgreSQL a mano cuando el script lo indique.\n');

const t0 = Date.now();
const registro = []; // { t, fase, resultado }
let detenido = false, iniciado = false;

while ((Date.now() - t0) / 1000 < DURACION) {
  const t = Math.round((Date.now() - t0) / 1000);
  if (!detenido && t >= CAIDA_EN) {
    detenido = true;
    console.log(`[${hora()}] t=${t}s  >>> ${SERVICIO ? servicio('stop') : 'DETENGA AHORA el servicio de PostgreSQL'}`);
  }
  if (detenido && !iniciado && t >= CAIDA_EN + CAIDA_SEG) {
    iniciado = true;
    console.log(`[${hora()}] t=${t}s  >>> ${SERVICIO ? servicio('start') : 'INICIE AHORA el servicio de PostgreSQL'}`);
  }
  const fase = !detenido ? 'antes' : !iniciado ? 'caida' : 'despues';
  let resultado;
  try {
    const r = await fetch(BASE_URL + RUTA, { signal: AbortSignal.timeout(3000) });
    await r.arrayBuffer();
    resultado = `HTTP ${r.status}`;
  } catch (e) {
    resultado = e.cause?.code || e.name || 'ERROR';
  }
  registro.push({ t, fase, resultado });
  console.log(`[${hora()}] t=${String(t).padStart(3)}s  ${fase.padEnd(7)}  ${resultado}`);
  await espera(1000);
}

const de = (f) => registro.filter((x) => x.fase === f);
const procesoCaido = registro.some((x) => x.resultado === 'ECONNREFUSED');
const errorControlado = de('caida').some((x) => /^HTTP [45]\d\d$/.test(x.resultado));
const ultimos = de('despues').slice(-5);
const recuperado = ultimos.length > 0 && ultimos.every((x) => x.resultado === 'HTTP 200');
const resumen = {
  respuestas_antes_200: `${de('antes').filter((x) => x.resultado === 'HTTP 200').length} de ${de('antes').length}`,
  durante_la_caida: [...new Set(de('caida').map((x) => x.resultado))].join(', '),
  proceso_del_backend_termino: procesoCaido ? 'SÍ (conexión rechazada: el backend dejó de escuchar)' : 'NO',
  error_controlado_durante_la_caida: errorControlado ? 'SÍ' : 'NO',
  ultimas_5_respuestas: ultimos.map((x) => x.resultado).join(', '),
};
console.log('');
console.table(resumen);
const pasa = !procesoCaido && recuperado;
console.log(`Criterio: error controlado durante la caída y servicio restablecido sin reiniciar el backend → ${pasa ? 'PASA' : 'FALLA'}`);
if (procesoCaido) console.log('Nota: si el backend terminó, la recuperación solo es posible reiniciándolo a mano (comportamiento de DEF-19).');
