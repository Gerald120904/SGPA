import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  construirDatosCrearFormulario,
  validarDatosNuevoFormulario,
  FormulariosEstudiantesPage
} from '../src/pages/formularios-estudiantes/FormulariosEstudiantesPage.js';

const codigo = readFileSync(new URL('../src/pages/formularios-estudiantes/FormulariosEstudiantesPage.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/formularios-estudiantes.css', import.meta.url), 'utf8');
const valido = {
  proveedor: 'INTERNO',
  titulo: 'Matrícula 2027',
  descripcion: 'Formulario académico',
  carreraId: 1,
  planEstudioId: 2
};

test('PBI-90: las dos modalidades aceptadas conservan el contrato existente', () => {
  assert.equal(validarDatosNuevoFormulario(valido).valido, true);
  assert.equal(validarDatosNuevoFormulario({ ...valido, proveedor: 'GOOGLE_FORMS' }).valido, true);
  assert.equal(construirDatosCrearFormulario(valido).proveedor, 'INTERNO');
  assert.equal(construirDatosCrearFormulario({ ...valido, proveedor: 'GOOGLE_FORMS' }).proveedor, 'GOOGLE_FORMS');
});

test('PBI-90: modalidad sin elegir o desconocida se rechaza', () => {
  assert.match(validarDatosNuevoFormulario({ ...valido, proveedor: '' }).errores.proveedor, /Seleccione/);
  assert.match(validarDatosNuevoFormulario({ ...valido, proveedor: 'DESCONOCIDO' }).errores.proveedor, /válida/);
});

test('PBI-90: título requerido, espacios en blanco y límites del backend (255)', () => {
  assert.ok(validarDatosNuevoFormulario({ ...valido, titulo: '' }).errores.titulo);
  assert.ok(validarDatosNuevoFormulario({ ...valido, titulo: '   ' }).errores.titulo);
  assert.equal(validarDatosNuevoFormulario({ ...valido, titulo: 'A'.repeat(255) }).valido, true);
  assert.ok(validarDatosNuevoFormulario({ ...valido, titulo: 'A'.repeat(256) }).errores.titulo);
});

test('PBI-90: descripción se mantiene obligatoria hasta que Gerald cambie el DTO (1000)', () => {
  assert.ok(validarDatosNuevoFormulario({ ...valido, descripcion: '   ' }).errores.descripcion);
  assert.equal(validarDatosNuevoFormulario({ ...valido, descripcion: 'D'.repeat(1000) }).valido, true);
  assert.ok(validarDatosNuevoFormulario({ ...valido, descripcion: 'D'.repeat(1001) }).errores.descripcion);
});

test('PBI-90: carrera y plan requieren identificadores positivos enteros', () => {
  for (const campo of ['carreraId', 'planEstudioId']) {
    for (const valor of ['', '0', '-1', '1.5', 'no-numero']) {
      assert.ok(validarDatosNuevoFormulario({ ...valido, [campo]: valor }).errores[campo], `${campo}: ${valor}`);
    }
  }
});

test('PBI-90: los campos del formulario muestran asterisco y errores por campo', () => {
  for (const id of ['formularioProveedor', 'formularioTitulo', 'formularioDescripcion', 'formularioCarrera', 'formularioPlan']) {
    assert.match(codigo, new RegExp(`id="${id}"`));
    assert.match(codigo, new RegExp(`id="${id}Error"`));
    assert.match(codigo, new RegExp(`aria-describedby="[^"]*${id}Error`));
  }
  assert.match(codigo, /formularios-required/);
  assert.match(codigo, /formulario\.noValidate = true/);
  assert.match(codigo, /mostrarErroresCamposFormulario\(validacion\.errores\)/);
  assert.match(css, /\[aria-invalid="true"\]/);
});

test('PBI-90: límites de entrada definidos en inputs', () => {
  assert.match(codigo, /id="formularioTitulo"[\s\S]{0,110}maxlength="255"/);
  assert.match(codigo, /id="formularioDescripcion"[\s\S]{0,130}maxlength="1000"/);
});

test('PBI-90: encabezado mantiene estilos de Planes de estudio', () => {
  assert.match(FormulariosEstudiantesPage(), /<h2>Formularios de estudiantes<\/h2>/);
  assert.match(css, /\.formularios-toolbar-heading h2\s*\{[^}]*font-size:\s*24px;[^}]*font-weight:\s*700;[^}]*line-height:\s*1\.3;/s);
});

test('PBI-90: el enlace utiliza solamente el icono sin cambiar la acción', () => {
  assert.match(codigo, /class="formularios-icon-button formularios-copy-button"/);
  assert.match(codigo, /data-action="copiar-enlace"/);
  assert.match(codigo, /data-lucide="copy"/);
  assert.match(codigo, /aria-label="Copiar enlace para responder"/);
  assert.doesNotMatch(codigo, /\n\s*Copiar enlace\s*\n\s*<\/button>/);
});

test('PBI-90: conservados los servicios y el ciclo de creación', () => {
  for (const patron of [
    /listarCarreras\(\)/,
    /listarPlanesEstudio\(\)/,
    /listarPlanAsignaturas\(/,
    /crearFormularioEstudiantes\(construirDatosCrearFormulario\(/,
    /usuarioTienePermiso\(/,
    /habilitarCierreExterior\(dialog\)/,
    /planSeleccionadoValido/,
    /estadoGoogle\.conectado/,
    /formulariosCreandoNotice/,
    /estaCreando/,
    /data-action="ver-respuestas"/,
    /data-action="publicar"/,
    /data-action="sincronizar"/,
    /data-action="cerrar"/
  ]) assert.match(codigo, patron);
});
