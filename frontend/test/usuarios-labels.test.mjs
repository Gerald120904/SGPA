import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nombreVisibleRol } from '../src/pages/usuarios/UsuariosPage.js';

test('presenta los cuatro roles oficiales sin alterar sus identificadores', () => {
  assert.equal(nombreVisibleRol('ADMIN_GLOBAL'), 'Administrador global');
  assert.equal(nombreVisibleRol('COORDINADOR'), 'Coordinador');
  assert.equal(nombreVisibleRol('PROFESOR'), 'Profesor');
  assert.equal(nombreVisibleRol('ASISTENTE_ESTUDIANTIL'), 'Asistente estudiantil');
  assert.equal(nombreVisibleRol('ROL_DESCONOCIDO'), 'ROL_DESCONOCIDO');
});
