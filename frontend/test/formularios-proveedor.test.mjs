import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  asignaturasElegiblesParaFormulario,
  construirDatosCrearFormulario,
} from '../src/pages/formularios-estudiantes/FormulariosEstudiantesPage.js';

const base = {
  titulo: 'QA institucional', descripcion: 'Datos sintéticos',
  carreraId: 9, planEstudioId: 11,
};

test('la modalidad institucional se envía explícita, aun sin Google conectado', () => {
  assert.deepEqual(construirDatosCrearFormulario({ ...base, proveedor: 'INTERNO' }), {
    ...base, proveedor: 'INTERNO',
  });
  assert.throws(() => construirDatosCrearFormulario(base), /modalidad/);
});

test('Google Forms conserva proveedor explícito y requiere materias con Curso en la vista previa', () => {
  assert.deepEqual(construirDatosCrearFormulario({ ...base, proveedor: 'GOOGLE_FORMS' }), {
    ...base, proveedor: 'GOOGLE_FORMS',
  });
  const asignaturas = [
    { id: 1, activo: true, cursoId: 20, curso: { codigo: 'QA-1' } },
    { id: 2, activo: true, cursoId: null, curso: null, codigoReferencia: 'OPT-1' },
  ];
  assert.deepEqual(asignaturasElegiblesParaFormulario(asignaturas, 'INTERNO'), asignaturas);
  assert.deepEqual(asignaturasElegiblesParaFormulario(asignaturas, 'GOOGLE_FORMS'), [asignaturas[0]]);
});

test('el diálogo presenta ambas modalidades y el IPC entrega el payload al endpoint administrativo', () => {
  const page = readFileSync(new URL('../src/pages/formularios-estudiantes/FormulariosEstudiantesPage.js', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const pageCode = readFileSync(
  new URL('../src/pages/formularios-estudiantes/FormulariosEstudiantesPage.js', import.meta.url),
  'utf8'
);

  assert.match(pageCode, /value="INTERNO"/);
  assert.doesNotMatch(pageCode, /value="INTERNO" selected/);
  assert.match(pageCode, /value="GOOGLE_FORMS"/);
  assert.match(pageCode, /crearFormularioEstudiantes\(construirDatosCrearFormulario/);
  assert.match(main, /ipcMain\.handle\(\s*'formularios-estudiantes:crear',[\s\S]*?ejecutarPeticionAutenticada\('\/formularios-estudiantes', \{\s*method: 'POST',\s*body: datos/);
});
