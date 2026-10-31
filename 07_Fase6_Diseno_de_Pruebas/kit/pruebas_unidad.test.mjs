// =====================================================================
// Pruebas de unidad y caja blanca – Auditoría del Sistema de Gestión Parroquial
// Ejecuta funciones puras del backend sin servidor ni base de datos.
//
// Uso (desde la carpeta del kit, con la ruta a la carpeta backend del proyecto):
//   Windows PowerShell:  $env:BACKEND="..\SyS\backend"; node --test --experimental-test-coverage pruebas_unidad.test.mjs > EV-F07-UNIDAD.txt
//   Linux / macOS:       BACKEND=../SyS/backend node --test --experimental-test-coverage pruebas_unidad.test.mjs > EV-F07-UNIDAD.txt
// =====================================================================
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

process.env.JWT_SECRET ||= 'clave_solo_para_pruebas_de_unidad';
const BACKEND = path.resolve(process.env.BACKEND || '../backend');
const cargar = (rel) => import(pathToFileURL(path.join(BACKEND, rel)).href);

const { cedulaValida } = await cargar('src/utils/validators.js');
const { validarFortalezaContrasena } = await cargar('src/services/auth.service.js');
const { puedeEditarFondo, puedeEditarMovimientoDeFondo } = await cargar('src/services/fondos.service.js');

// ---------------------------------------------------------------------
// CP-AUT-18 | RF-AUT-07 | cedulaValida(): partición de equivalencia, valores límite y caja blanca
// ---------------------------------------------------------------------
describe('CP-AUT-18 cedulaValida (RF-AUT-07)', () => {
  const datos = [
    ['válida real (provincia 07)', '0750625857', true],
    ['límite inferior de provincia válido (01)', '0100000017', true],
    ['límite superior de provincia válido (24)', '2400000010', true],
    ['tercer dígito 6 (límite válido)', '0761234566', true],
    ['9 dígitos (longitud bajo el límite)', '075062585', false],
    ['11 dígitos (longitud sobre el límite)', '07506258570', false],
    ['contiene una letra', '07506258a7', false],
    ['no es texto (número)', 750625857, false],
    ['provincia 00 (bajo el límite)', '0000000000', false],
    ['provincia 25 (sobre el límite)', '2500000000', false],
    ['tercer dígito 7 (sobre el límite)', '0770000000', false],
    ['dígito verificador incorrecto', '0750625858', false],
  ];
  for (const [nombre, entrada, esperado] of datos) {
    test(`${nombre}: ${JSON.stringify(entrada)} → ${esperado}`, () => assert.equal(cedulaValida(entrada), esperado));
  }
});

// ---------------------------------------------------------------------
// CP-AUT-19 | RF-AUT-07, RNF-AUT-01 | validarFortalezaContrasena(): valores límite y condiciones
// ---------------------------------------------------------------------
describe('CP-AUT-19 validarFortalezaContrasena (RF-AUT-07)', () => {
  const datos = [
    ['8 caracteres con todas las clases (límite válido)', 'Ab1.xyzw', true],
    ['7 caracteres (bajo el límite)', 'Ab1.xyz', false],
    ['sin mayúscula', 'ab1.xyzw', false],
    ['sin minúscula', 'AB1.XYZW', false],
    ['sin número', 'Abc.xyzw', false],
    ['sin carácter especial', 'Ab1xyzwq', false],
  ];
  for (const [nombre, entrada, valida] of datos) {
    test(`${nombre}: "${entrada}" → ${valida ? 'aceptada' : 'rechazada'}`, () => {
      if (valida) assert.doesNotThrow(() => validarFortalezaContrasena(entrada));
      else assert.throws(() => validarFortalezaContrasena(entrada));
    });
  }
});

// ---------------------------------------------------------------------
// CP-FIN-22 | RF-FIN-03, RF-FIN-04 (HU-05), RNF-AUT-02 | Tabla de decisión rol × fondo
// ---------------------------------------------------------------------
describe('CP-FIN-22 puedeEditarFondo / puedeEditarMovimientoDeFondo (tabla de decisión)', () => {
  const fondoCap1 = { id_fondo: 1, id_capilla: 1 };
  const fondoCap2 = { id_fondo: 2, id_capilla: 2 };
  const fondoParroquial = { id_fondo: 3, id_capilla: null };
  const reglas = [
    // [regla, función, usuario, fondo, esperado según requisitos, fuente]
    ['R1 Tesorero de capilla 1 → fondo capilla 1', puedeEditarFondo, { rol: 'Tesorero', id_capilla: 1 }, fondoCap1, true, 'RF-FIN-03'],
    ['R2 Tesorero de capilla 1 → fondo capilla 2', puedeEditarFondo, { rol: 'Tesorero', id_capilla: 1 }, fondoCap2, false, 'RF-FIN-03'],
    ['R3 Tesorero general → fondo parroquial', puedeEditarFondo, { rol: 'Tesorero', id_capilla: null }, fondoParroquial, true, 'RF-FIN-03'],
    ['R4 Coordinador de capilla 1 → fondo capilla 1', puedeEditarFondo, { rol: 'Coordinador', id_capilla: 1 }, fondoCap1, true, 'HU-05'],
    ['R5 Coordinador de capilla 1 → fondo capilla 2', puedeEditarFondo, { rol: 'Coordinador', id_capilla: 1 }, fondoCap2, false, 'HU-05'],
    ['R6 Coordinador de capilla 1 → fondo parroquial', puedeEditarFondo, { rol: 'Coordinador', id_capilla: 1 }, fondoParroquial, false, 'HU-05'],
    ['R7 Sacerdote → fondo capilla 2', puedeEditarFondo, { rol: 'Sacerdote', id_capilla: null }, fondoCap2, true, 'RF-FIN-08'],
    ['R8 Cualquier rol → fondo inexistente', puedeEditarFondo, { rol: 'Sacerdote', id_capilla: null }, null, false, 'RNF-AUT-02'],
    ['R9 Tesorero general edita movimiento de capilla 1', puedeEditarMovimientoDeFondo, { rol: 'Tesorero', id_capilla: null }, fondoCap1, true, 'RF-FIN-03'],
    ['R10 Tesorero de capilla 2 edita movimiento de capilla 1', puedeEditarMovimientoDeFondo, { rol: 'Tesorero', id_capilla: 2 }, fondoCap1, false, 'RF-FIN-03'],
    ['R11 Tesorero general edita movimiento de fondo inexistente', puedeEditarMovimientoDeFondo, { rol: 'Tesorero', id_capilla: null }, null, false, 'RNF-AUT-02'],
  ];
  for (const [regla, fn, usuario, fondo, esperado, fuente] of reglas) {
    test(`${regla} → ${esperado ? 'permitido' : 'denegado'} (${fuente})`, () => assert.equal(fn(usuario, fondo), esperado));
  }
});
