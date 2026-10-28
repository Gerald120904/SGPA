import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const codigo = readFileSync(new URL('../src/pages/usuarios/MisAsistentesPage.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/mis-asistentes.css', import.meta.url), 'utf8');

// Se prueban las funciones puras reales sin levantar Electron ni cargar Lucide.
const inicio = codigo.indexOf('const LIMITES_ASISTENTE =');
const fin = codigo.indexOf('\nfunction verificar(', inicio);
assert.ok(inicio >= 0 && fin > inicio, 'Deben existir las validaciones del alta.');
const fuente = codigo.slice(inicio, fin).replace(/export function /g, 'function ');
const { validarDatosAsistente, normalizarEntradaAsistente } = runInNewContext(
  `${fuente}\n({ validarDatosAsistente, normalizarEntradaAsistente })`,
);

const valido = {
  cedula: '123456789',
  nombres: 'María José',
  apellido1: "O'Neill",
  apellido2: '',
  correo: 'maria.jose@una.ac.cr',
};
const errores = (datos) => validarDatosAsistente({ ...valido, ...datos }).errores;

test('alta: admite cédula numérica, nombres con tildes y segundo apellido opcional', () => {
  assert.equal(validarDatosAsistente(valido).valido, true);
  assert.equal(validarDatosAsistente({ ...valido, apellido2: 'Muñoz-Ruiz' }).valido, true);
});

test('alta: rechaza cédula vacía, con letras o guiones y mayor a 9 dígitos', () => {
  assert.ok(errores({ cedula: '' }).cedula);
  assert.ok(errores({ cedula: '12A34' }).cedula);
  assert.ok(errores({ cedula: '123-456' }).cedula);
  assert.ok(errores({ cedula: '1234567890' }).cedula);
  assert.ok(!errores({ cedula: '7' }).cedula);
});

test('alta: impide ingresar otros caracteres y limita cédula al pegar', () => {
  assert.equal(normalizarEntradaAsistente('cedula', '1a2-3 4567890'), '123456789');
  assert.equal(normalizarEntradaAsistente('nombres', 'Ana123 #María'), 'Ana María');
});

test('alta: nombres y primer apellido obligatorios, sin números y con límites', () => {
  assert.ok(errores({ nombres: '   ' }).nombres);
  assert.ok(errores({ apellido1: '' }).apellido1);
  assert.ok(errores({ nombres: 'Ana3' }).nombres);
  assert.ok(errores({ apellido1: 'Pérez2' }).apellido1);
  assert.ok(errores({ nombres: 'A'.repeat(61) }).nombres);
  assert.ok(errores({ apellido1: 'A'.repeat(51) }).apellido1);
  assert.ok(errores({ apellido2: 'B'.repeat(51) }).apellido2);
});

test('alta: valida correo obligatorio, con formato y longitud', () => {
  assert.ok(errores({ correo: '' }).correo);
  assert.ok(errores({ correo: 'ana@' }).correo);
  assert.ok(errores({ correo: 'ana @una.ac.cr' }).correo);
  assert.ok(errores({ correo: 'x'.repeat(148) + '@a.co' }).correo);
  assert.ok(!errores({ correo: 'ANA@UNA.AC.CR' }).correo);
});

test('alta: mantiene la creación por servicio y la delegación existentes', () => {
  for (const llamada of ['crearAsistenteJerarquia(', 'configurarAsistenteJerarquia(',
    'aprobarSolicitudCambio(', 'rechazarSolicitudCambio(']) {
    assert.ok(codigo.includes(llamada));
  }
  assert.match(codigo, /\.filter\(\(campo\) => campo\.querySelector\('\[name="carrera"\]'\)\?\.checked\)/);
  assert.match(codigo, /if \(!id && !carreras\.length\)/);
  assert.match(codigo, /if \(!id && !carreras\.some/);
  assert.match(codigo, /form\.dataset\.id && !validarFormularioAltaAsistente/);
  assert.match(codigo, /pagina\.addEventListener\('submit'/);
});

test('alta: la presentación de errores queda limitada a su FormDialog', () => {
  assert.match(codigo, /asistenteError-cedula/);
  assert.match(codigo, /asistenteError-correo/);
  assert.match(codigo, /aria-invalid/);
  assert.match(css, /\.mis-asistentes-dialog \.mis-asistentes-cuenta input\[aria-invalid="true"\]/);
  assert.match(css, /\.mis-asistentes-campo-error\[hidden\]/);
});
