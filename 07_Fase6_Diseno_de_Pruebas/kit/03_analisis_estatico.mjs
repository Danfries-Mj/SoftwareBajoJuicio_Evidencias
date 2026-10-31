// =====================================================================
// Análisis estático – Auditoría del Sistema de Gestión Parroquial
// Genera la evidencia de: tamaño del código (KLOC), organización por capas
// (RNF-GEN-04), capillas fijas en el código (RNF-GEN-03), credenciales
// incluidas en el paquete (DEF-18) y pruebas automatizadas existentes.
// Uso:  node 03_analisis_estatico.mjs "<ruta a la carpeta SyS>" > EV-F03-001_analisis_estatico.txt
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RAIZ = path.resolve(process.argv[2] || '../SyS');
const IGNORAR = new Set(['node_modules', '.angular', '.git', 'dist']);
function archivos(dir, ext) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...archivos(p, ext)); else if (!ext || ext.some(x => e.name.endsWith(x))) out.push(p);
  }
  return out;
}
const lineas = (f) => fs.readFileSync(f, 'utf8').split('\n').length;
const rel = (f) => path.relative(RAIZ, f).replaceAll('\\', '/');

console.log(`ANÁLISIS ESTÁTICO | ${new Date().toISOString()} | carpeta: ${RAIZ}\n`);

// 1. Tamaño
const back = archivos(path.join(RAIZ, 'backend', 'src'), ['.js']);
const front = archivos(path.join(RAIZ, 'frontend', 'src'), ['.ts', '.html', '.css']).filter(f => !f.endsWith('.spec.ts'));
const lb = back.reduce((a, f) => a + lineas(f), 0), lf = front.reduce((a, f) => a + lineas(f), 0);
console.log('1. TAMAÑO (líneas físicas, sin node_modules)');
console.log(`   Backend : ${back.length} archivos .js, ${lb} líneas (${(lb / 1000).toFixed(2)} KLOC)`);
console.log(`   Frontend: ${front.length} archivos .ts/.html/.css, ${lf} líneas (${(lf / 1000).toFixed(2)} KLOC)\n`);

// 2. Capas del backend (RNF-GEN-04)
const capas = {};
for (const f of back) { const c = rel(f).split('/')[2] ?? 'raíz'; const k = c.endsWith('.js') ? 'raíz (' + c + ')' : c; capas[k] = (capas[k] || 0) + 1; }
console.log('2. ORGANIZACIÓN POR CAPAS DEL BACKEND (RNF-GEN-04)');
for (const [c, n] of Object.entries(capas)) console.log(`   ${c.padEnd(22)} ${n}`);
const sqlFuera = back.filter(f => /\b(pool|client)\.query\(/.test(fs.readFileSync(f, 'utf8')) && !rel(f).includes('/repositories/'));
console.log(`   Archivos con consultas SQL fuera de repositories: ${sqlFuera.length} ${sqlFuera.map(rel).join(', ')}\n`);

// 3. Capillas fijas en el código (RNF-GEN-03)
const nombres = /Virgen del Rosario|Virgen de F[aá]tima|Cristo Liberador/;
console.log('3. NOMBRES DE CAPILLAS ESCRITOS EN EL CÓDIGO (RNF-GEN-03)');
let n3 = 0;
for (const f of [...back, ...front]) fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
  if (nombres.test(l) && !/^\s*(\*|\/\/)/.test(l)) { n3++; console.log(`   ${rel(f)}:${i + 1}  ${l.trim().slice(0, 90)}`); }
});
console.log(`   Total de líneas (sin contar comentarios): ${n3}\n`);

// 4. Credenciales en el paquete (DEF-18) – solo nombres de variables, nunca valores
console.log('4. ARCHIVOS .env INCLUIDOS EN EL PAQUETE (DEF-18)');
for (const f of archivos(RAIZ).filter(f => path.basename(f).startsWith('.env'))) {
  const claves = fs.readFileSync(f, 'utf8').split('\n').filter(l => /^\s*[A-Z_]+=.+/.test(l)).map(l => l.split('=')[0].trim());
  const sensibles = claves.filter(k => /PASS|SECRET|KEY|TOKEN/i.test(k));
  console.log(`   ${rel(f)}: ${claves.length} variables; con valor sensible: ${sensibles.join(', ') || 'ninguna'} (valores no mostrados)`);
}
console.log('');

// 5. Pruebas automatizadas existentes
const specs = archivos(RAIZ, ['.spec.ts', '.test.js', '.test.ts', '.spec.js']);
console.log('5. PRUEBAS AUTOMATIZADAS DEL PROYECTO');
for (const f of specs) console.log(`   ${rel(f)} (${lineas(f)} líneas)`);
console.log(`   Total: ${specs.length}\n`);

// 6. Huella de los archivos analizados
const h = crypto.createHash('sha256'); for (const f of [...back, ...front].sort()) h.update(fs.readFileSync(f));
console.log(`6. HUELLA SHA-256 DEL CÓDIGO ANALIZADO: ${h.digest('hex')}`);
