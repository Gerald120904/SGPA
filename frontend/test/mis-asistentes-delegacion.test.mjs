import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  establecerSeleccionPermisosDisponibles,
  obtenerEstadoSeleccionPermisosDisponibles,
} from '../src/pages/usuarios/MisAsistentesPage.js';

const pagina = readFileSync(
  new URL('../src/pages/usuarios/MisAsistentesPage.js', import.meta.url),
  'utf8',
);

const permisos = (...seleccionados) => [0, 1, 2, 3].map((indice) => ({
  value: `PERMISO_${indice}`,
  checked: seleccionados.includes(indice),
  disabled: false,
}));

test('seleccionar todos queda aislado a una carrera y permite selección parcial', () => {
  const primera = permisos();
  const segunda = permisos(1);

  establecerSeleccionPermisosDisponibles(primera, true);
  primera[3].checked = false;

  assert.deepEqual(obtenerEstadoSeleccionPermisosDisponibles(primera), {
    checked: false,
    indeterminate: true,
    disabled: false,
  });
  assert.deepEqual(
    segunda.map((permiso) => permiso.checked),
    [false, true, false, false],
  );
});

test('no modifica permisos bloqueados', () => {
  const carrera = permisos();
  carrera[2].disabled = true;
  establecerSeleccionPermisosDisponibles(carrera, true);
  assert.equal(carrera[2].checked, false);
});

test('distingue carga, ausencia de carreras y carrera sin permisos', () => {
  assert.match(pagina, /Cargando\.\.\./);
  assert.match(pagina, /No tenés carreras asignadas para delegar/);
  assert.match(pagina, /Esta carrera no tiene permisos disponibles para delegar/);
  assert.match(pagina, /No fue posible cargar las carreras, permisos y solicitudes/);
});

test('agrupa solo los permisos jerárquicos reales y exige una delegación efectiva', () => {
  for (const permiso of [
    'ESTUDIANTES_VER', 'ESTUDIANTES_GESTIONAR',
    'CURSOS_VER', 'CURSOS_GESTIONAR',
    'PLANES_ESTUDIO_VER', 'PLANES_ESTUDIO_GESTIONAR',
    'OPTATIVAS_VER', 'OPTATIVAS_GESTIONAR',
  ]) assert.match(pagina, new RegExp(`'${permiso}'`));
  assert.match(pagina, /Seleccione al menos un permiso delegable/);
  assert.match(pagina, /configurarAsistenteJerarquia\(id, carreras\)/);
});

test('muestra el estado real de invitación devuelto por el backend', () => {
  assert.match(pagina, /envioInvitacionHabilitado/);
  assert.match(pagina, /resultadoCreacion\?\.invitacion\?\.estado/);
  assert.match(pagina, /La invitación quedó pendiente de envío/);
  assert.match(pagina, /La invitación fue enviada/);
});
