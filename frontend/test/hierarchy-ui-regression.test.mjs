import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const usuarios = readFileSync(new URL('../src/pages/usuarios/UsuariosPage.js', import.meta.url), 'utf8');
const estudiantes = readFileSync(new URL('../src/pages/estudiantes/EstudiantesPage.js', import.meta.url), 'utf8');

test('el diálogo jerárquico ofrece todos los módulos integrados por carrera', () => {
  const inicio = usuarios.indexOf('function renderizarDialogoJerarquia');
  const fin = usuarios.indexOf('function renderizarDialogoEdicion', inicio);
  const dialogo = usuarios.slice(inicio, fin);
  for (const permiso of [
    'ESTUDIANTES_VER', 'ESTUDIANTES_GESTIONAR',
    'CURSOS_VER', 'CURSOS_GESTIONAR',
    'PLANES_ESTUDIO_VER', 'PLANES_ESTUDIO_GESTIONAR',
    'OPTATIVAS_VER', 'OPTATIVAS_GESTIONAR',
  ]) assert.match(dialogo, new RegExp(`'${permiso}'`));
});

test('los formularios de estudiantes jerárquicos usan el catálogo de períodos autorizado', () => {
  assert.match(estudiantes, /async function listarPeriodosParaEstudiantes\(\)/);
  assert.match(estudiantes, /async function abrirNuevoEstudiante[\s\S]*?await listarPeriodosParaEstudiantes\(\)/);
  assert.equal(estudiantes.match(/listarPeriodosAcademicos\(\)/g)?.length, 1);
});