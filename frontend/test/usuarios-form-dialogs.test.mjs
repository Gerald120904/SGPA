import test from 'node:test';
import assert from 'node:assert/strict';
import {
  construirDialogoCreacionUsuario,
  construirDialogoEdicionUsuario,
} from '../src/pages/usuarios/UsuarioFormDialog.js';

test('el formulario de creación conserva roles, invitación, carreras y permisos iniciales', () => {
  const dialogo = construirDialogoCreacionUsuario({
    roles: [{ nombre: 'PROFESOR', descripcion: 'Docencia' }],
    limites: { cedula: 9, correo: 150, nombres: 60, apellido1: 50, apellido2: 50 },
    carreras: [{ id: 4, codigo: 'INF', nombre: 'Informática' }],
    permisosCatalogo: ['CURSOS_VER'],
  });
  assert.equal(dialogo.formId, 'usuarioForm');
  assert.match(dialogo.body, /Invitación por correo electrónico/);
  assert.match(dialogo.body, /value="PROFESOR"/);
  assert.match(dialogo.body, /Informática/);
  assert.match(dialogo.body, /value="CURSOS_VER"/);
});

test('la edición mantiene el alcance institucional por rol y carreras seleccionadas', () => {
  const coordinador = construirDialogoEdicionUsuario({
    usuario: { id: 11, nombres: 'Ana', roles: ['COORDINADOR'], carreras: [{ id: 4 }] },
    rolesDisponiblesCatalogo: [{ nombre: 'PROFESOR' }],
    carreras: [{ id: 4, codigo: 'INF', nombre: 'Informática' }],
    permisosCatalogo: ['CURSOS_VER'],
    limites: { cedula: 9, correo: 150, nombres: 60, apellido1: 50, apellido2: 50 },
  });
  assert.equal(coordinador.userId, 11);
  assert.match(coordinador.body, /Coordinador/);
  assert.match(coordinador.body, /Permisos por carrera/);
  assert.doesNotMatch(coordinador.body, /data-action="guardar-permisos"/);

  const profesor = construirDialogoEdicionUsuario({
    usuario: { id: 12, nombres: 'Luis', roles: ['PROFESOR'], carreras: [{ id: 4 }] },
    rolesDisponiblesCatalogo: [],
    carreras: [{ id: 4, codigo: 'INF', nombre: 'Informática' }],
    permisosCatalogo: [],
    limites: { cedula: 9, correo: 150, nombres: 60, apellido1: 50, apellido2: 50 },
  });
  assert.match(profesor.body, /name="carreras"[\s\S]*?checked/);
  assert.match(profesor.body, /data-action="guardar-permisos"/);
});
