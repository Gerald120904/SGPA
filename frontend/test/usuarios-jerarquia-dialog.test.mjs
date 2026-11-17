import test from 'node:test';
import assert from 'node:assert/strict';
import { construirDialogoJerarquiaUsuario } from '../src/pages/usuarios/UsuarioJerarquiaDialog.js';

const base = {
  usuario: { id: 8, nombres: 'Ana', apellido1: 'Mora' },
  configuracion: {
    carreras: [{ carreraId: 1, permisos: ['CURSOS_VER'] }],
    delegables: [{ id: 1, permisos: ['CURSOS_VER'] }],
  },
  carreras: [
    { id: 1, nombre: 'Informática', codigo: 'INF' },
    { id: 2, nombre: 'Historia', codigo: 'HIS' },
  ],
  permisosCatalogo: ['CURSOS_VER', 'CURSOS_GESTIONAR', 'ADMIN_GLOBAL'],
  obtenerNombreCompleto: (usuario) => `${usuario.nombres} ${usuario.apellido1}`,
};

test('el diálogo de asistente limita carreras y permisos a la delegación recibida', () => {
  const dialogo = construirDialogoJerarquiaUsuario({ ...base, esAsistente: true });
  assert.equal(dialogo.formId, 'jerarquiaForm');
  assert.equal(dialogo.userId, 8);
  assert.equal(dialogo.esAsistente, true);
  assert.match(dialogo.body, /Informática/);
  assert.doesNotMatch(dialogo.body, /Historia \(HIS\)/);
  assert.match(dialogo.body, /value="CURSOS_VER"/);
  assert.doesNotMatch(dialogo.body, /CURSOS_GESTIONAR|ADMIN_GLOBAL/);
});

test('el diálogo administrativo conserva alcance configurado y escapa nombres', () => {
  const dialogo = construirDialogoJerarquiaUsuario({
    ...base,
    carreras: [{ id: 1, nombre: '<script>', codigo: 'INF' }],
    esAsistente: false,
  });
  assert.match(dialogo.body, /&lt;script&gt; \(INF\)/);
  assert.match(dialogo.body, /CURSOS_GESTIONAR/);
});
