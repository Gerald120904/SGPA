import test from 'node:test';
import assert from 'node:assert/strict';
import {
  establecerSeleccionPermisosCarrera,
  obtenerEstadoSeleccionPermisosCarrera,
} from '../src/pages/usuarios/UsuariosPage.js';

const permisos = (...seleccionados) => [0, 1, 2, 3].map((indice) => ({
  checked: seleccionados.includes(indice),
  disabled: false,
  value: `PERMISO_${indice}`,
}));

test('selecciona y deselecciona todos los permisos editables de una carrera', () => {
  const carrera = permisos();

  establecerSeleccionPermisosCarrera(carrera, true);
  assert.deepEqual(carrera.map((permiso) => permiso.checked), [true, true, true, true]);
  assert.deepEqual(obtenerEstadoSeleccionPermisosCarrera(carrera), {
    checked: true,
    indeterminate: false,
    disabled: false,
  });

  establecerSeleccionPermisosCarrera(carrera, false);
  assert.deepEqual(carrera.map((permiso) => permiso.checked), [false, false, false, false]);
});

test('representa la selección parcial sin alterar los otros permisos', () => {
  const carrera = permisos(0, 1, 2, 3);
  carrera[3].checked = false;

  assert.deepEqual(carrera.map((permiso) => permiso.checked), [true, true, true, false]);
  assert.deepEqual(obtenerEstadoSeleccionPermisosCarrera(carrera), {
    checked: false,
    indeterminate: true,
    disabled: false,
  });
});

test('cada operación queda aislada a la carrera indicada', () => {
  const sistemas = permisos();
  const administracion = permisos(1);

  establecerSeleccionPermisosCarrera(sistemas, true);

  assert.ok(sistemas.every((permiso) => permiso.checked));
  assert.deepEqual(
    administracion.map((permiso) => permiso.checked),
    [false, true, false, false],
  );
});

test('conserva controles bloqueados y reconoce permisos existentes al reabrir', () => {
  const carrera = permisos(0, 2);
  carrera[3].disabled = true;
  carrera[3].checked = false;

  establecerSeleccionPermisosCarrera(carrera, true);
  assert.equal(carrera[3].checked, false);

  establecerSeleccionPermisosCarrera(carrera, false);
  assert.deepEqual(
    carrera.map((permiso) => permiso.checked),
    [false, false, false, false],
  );

  const antesDeGuardar = permisos(0, 1, 2, 3);
  const guardados = antesDeGuardar
    .filter((permiso) => permiso.checked)
    .map((permiso) => permiso.value);
  const reabierta = permisos().map((permiso) => ({
    ...permiso,
    checked: guardados.includes(permiso.value),
  }));

  assert.equal(obtenerEstadoSeleccionPermisosCarrera(reabierta).checked, true);
});
