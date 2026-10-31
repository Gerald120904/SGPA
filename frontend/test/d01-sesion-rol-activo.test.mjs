import test from 'node:test';
import assert from 'node:assert/strict';
import { guardarSesion, limpiarSesion, obtenerRolActivo, usuarioTienePermiso } from '../src/app/session.js';

test('D-01: el espacio Profesor no hereda permisos de Admin en la sesión Electron', () => {
  guardarSesion({ usuario: { roles: ['ADMIN_GLOBAL', 'COORDINADOR', 'PROFESOR'],
    rolActivo: 'PROFESOR', permisos: ['AULAS_VER'] } });
  assert.equal(obtenerRolActivo(), 'PROFESOR');
  assert.equal(usuarioTienePermiso('CARRERAS_GESTIONAR'), false);
  assert.equal(usuarioTienePermiso('AULAS_VER'), true);
  limpiarSesion();
});

test('D-01: una respuesta antigua sin rolActivo no selecciona Admin automáticamente', () => {
  guardarSesion({ usuario: { roles: ['ADMIN_GLOBAL', 'PROFESOR'], permisos: ['CARRERAS_GESTIONAR'] } });
  assert.equal(obtenerRolActivo(), null);
  assert.equal(usuarioTienePermiso('CARRERAS_GESTIONAR'), false);
  limpiarSesion();
});
