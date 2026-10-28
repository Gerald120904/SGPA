import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vista = readFileSync(new URL('../src/pages/usuarios/MisAsistentesPage.js', import.meta.url), 'utf8');
const estilos = readFileSync(new URL('../src/styles/mis-asistentes.css', import.meta.url), 'utf8');

// Pruebas de contrato estático. No hacen peticiones ni necesitan una base de datos.
test('asistentes: se conserva la pantalla, los identificadores y la inicialización', () => {
  for (const id of ['misAsistentesPage', 'crearAsistenteButton', 'misAsistentesFeedback',
    'misAsistentesContenido', 'misAsistentesDialog', 'misAsistentesDialogContenido']) {
    assert.match(vista, new RegExp(id));
  }
  assert.match(vista, /export function MisAsistentesPage\(/);
  assert.match(vista, /export async function iniciarMisAsistentesPage\(/);
});

test('asistentes: formularios usan FormDialog sin cambiar identificadores', () => {
  assert.match(vista, /import \{ FormDialog \}/);
  assert.match(vista, /formId: 'formAsistente'/);
  assert.match(vista, /formId: 'formRechazo'/);
  assert.match(vista, /id="resumenDelegacionAsistente"/);
  assert.match(vista, /formulario\.dataset\.id = String\(id \|\| ''\)/);
  assert.match(vista, /querySelector\('#formRechazo'\)\.dataset\.id/);
});

test('asistentes: se mantienen nombres de campos y nuevos limites de entrada', () => {
  for (const name of ['cedula', 'nombres', 'apellido1', 'apellido2', 'correo',
    'carrera', 'seleccionar-todos-permisos', 'permiso', 'motivo']) {
    assert.match(vista, new RegExp(`name="${name}"`));
  }
  assert.match(vista, /maxlength="9"/);
  assert.match(vista, /maxlength="60"/);
  assert.match(vista, /maxlength="50"/);
  assert.match(vista, /maxlength="150"/);
  assert.match(vista, /minlength="3" maxlength="500"/);
});

test('asistentes: las acciones y atributos de delegación se conservan', () => {
  for (const accion of ['editar-asistente', 'aprobar', 'rechazar', 'cerrar']) {
    assert.match(vista, new RegExp(`data-action="${accion}"`));
  }
  assert.match(vista, /data-carrera-id="\$\{c\.id\}"/);
  assert.match(vista, /data-carrera-nombre="\$\{escapeHtml\(c\.nombre\)\}"/);
});

test('asistentes: todas las consultas y escrituras siguen usando los servicios de Gerald', () => {
  for (const llamada of ['listarMisAlcancesJerarquia', 'listarMisAsistentes',
    'listarSolicitudesPendientesCambio', 'listarMisSolicitudesCambio',
    'obtenerConfiguracionAsistentesJerarquia', 'obtenerAsistenteJerarquia',
    'crearAsistenteJerarquia', 'configurarAsistenteJerarquia',
    'aprobarSolicitudCambio', 'rechazarSolicitudCambio']) {
    assert.match(vista, new RegExp(`${llamada}\\(`));
  }
  assert.match(vista, /await confirmarAccion\(/);
});

test('asistentes: roles y autorizaciones existentes siguen decidiendo la vista', () => {
  assert.match(vista, /obtenerRolesUsuario\(\)\.includes\(ROLES\.ASISTENTE_ESTUDIANTIL\)/);
  assert.match(vista, /crearAsistenteButton\.hidden = esAsistente/);
  assert.match(vista, /!esAsistente && s\.estado === 'PENDIENTE'/);
  assert.match(vista, /boton\.disabled = true/);
  assert.match(vista, /boton\.disabled = false/);
});

test('asistentes: los manejadores siguen delegados en la misma página', () => {
  assert.match(vista, /pagina\.addEventListener\('click'/);
  assert.match(vista, /pagina\.addEventListener\('change'/);
  assert.match(vista, /pagina\.addEventListener\('submit'/);
  assert.match(vista, /dialogo\.addEventListener\('click'/);
  assert.match(vista, /event\.target === dialogo/);
});

test('asistentes: reutiliza componentes institucionales de diseño', () => {
  assert.match(vista, /StatCard\(\{/);
  assert.match(vista, /StatusBadge\(\{/);
  assert.match(vista, /FormDialog\(\{/);
  assert.match(vista, /renderizarIconos\(\)/);
  assert.match(vista, /sgpa-form-dialog-lg/);
});

test('asistentes: estilos se limitan a la página y su diálogo', () => {
  assert.match(estilos, /\.mis-asistentes-page/);
  assert.match(estilos, /\.mis-asistentes-dialog/);
  assert.doesNotMatch(estilos, /^\.usuarios-page\b/m);
  assert.doesNotMatch(estilos, /^\.sgpa-form-dialog\s*\{/m);
});
