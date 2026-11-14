import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { construirDialogoJerarquiaUsuario } from '../src/pages/usuarios/UsuarioJerarquiaDialog.js';

const usuarios = readFileSync(new URL('../src/pages/usuarios/UsuariosPage.js', import.meta.url), 'utf8');
const estudiantesCatalogo = readFileSync(new URL('../src/pages/estudiantes/EstudiantesCatalogo.js', import.meta.url), 'utf8');
const estudiantesOperaciones = readFileSync(new URL('../src/pages/estudiantes/EstudiantesOperaciones.js', import.meta.url), 'utf8');

test('el diálogo jerárquico ofrece todos los módulos integrados por carrera', () => {
  const dialogo = construirDialogoJerarquiaUsuario({
    usuario: { id: 9 },
    configuracion: { carreras: [], delegables: [] },
    carreras: [{ id: 2, nombre: 'Carrera', codigo: 'CAR' }],
    permisosCatalogo: [
      'ESTUDIANTES_VER', 'ESTUDIANTES_GESTIONAR',
      'CURSOS_VER', 'CURSOS_GESTIONAR',
      'PLANES_ESTUDIO_VER', 'PLANES_ESTUDIO_GESTIONAR',
      'OPTATIVAS_VER', 'OPTATIVAS_GESTIONAR',
    ],
    obtenerNombreCompleto: () => 'Usuario de prueba',
  }).body;
  for (const permiso of [
    'ESTUDIANTES_VER', 'ESTUDIANTES_GESTIONAR',
    'CURSOS_VER', 'CURSOS_GESTIONAR',
    'PLANES_ESTUDIO_VER', 'PLANES_ESTUDIO_GESTIONAR',
    'OPTATIVAS_VER', 'OPTATIVAS_GESTIONAR',
  ]) assert.match(dialogo, new RegExp(`value="${permiso}"`));
});

test('el selector general conserva el contrato de guardado por carrera', () => {
  const dialogo = construirDialogoJerarquiaUsuario({
    usuario: { id: 9 },
    configuracion: { carreras: [], delegables: [] },
    carreras: [{ id: 2, nombre: 'Carrera', codigo: 'CAR' }],
    permisosCatalogo: [],
    obtenerNombreCompleto: () => 'Usuario de prueba',
  }).body;
  assert.match(dialogo, /Seleccionar todos los permisos de esta carrera/);
  assert.match(dialogo, /name="jerarquia-todos-permisos"/);
  assert.match(usuarios, /carreraId: Number\(campo\.dataset\.carreraId\)/);
  assert.match(usuarios, /\[name="jerarquia-permiso"\]:checked/);
  assert.match(usuarios, /previsualizarCoordinadorJerarquia\(usuarioId, carreras\)/);
  assert.match(usuarios, /configurarCoordinadorJerarquia\(usuarioId, carreras, impacto\.firma\)/);
});

test('los formularios de estudiantes jerárquicos usan el catálogo de períodos autorizado', () => {
  assert.match(estudiantesCatalogo, /async function listarPeriodosParaEstudiantes\(\)/);
  assert.match(estudiantesOperaciones, /async function abrirNuevoEstudiante[\s\S]*?await acciones\.listarPeriodosParaEstudiantes\(\)/);
  assert.equal(estudiantesCatalogo.match(/dependencias\.listarPeriodosAcademicos\(\)/g)?.length, 1);
});
