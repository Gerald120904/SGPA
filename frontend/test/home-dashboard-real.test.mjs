import test from 'node:test';
import assert from 'node:assert/strict';
import { guardarSesion, limpiarSesion } from '../src/app/session.js';
import { HomePage, iniciarHomePage } from '../src/pages/home/HomePage.js';

function preparar() {
  guardarSesion({ usuario: { id: 1, rolActivo: 'ADMIN_GLOBAL', roles: ['ADMIN_GLOBAL'] } });
  const valor = { textContent: '', isConnected: true };
  const detalle = { textContent: '', isConnected: true };
  globalThis.document = { getElementById: (id) => id === 'dashboard-estudiantes-activos' ? valor
    : id === 'dashboard-estudiantes-activos-detalle' ? detalle : null };
  return { valor, detalle };
}

test('Inicio consulta solo estudiantes activos y muestra el conteo real', async () => {
  const { valor, detalle } = preparar();
  assert.match(HomePage(), /dashboard-estudiantes-activos/);
  assert.doesNotMatch(HomePage(), /1,248|54|27 \/ 31/);
  let filtros;
  globalThis.window = { sgpa: { listarEstudiantes: async (parametros) => {
    filtros = parametros;
    return { ok: true, estudiantes: [{ id: 1 }, { id: 2 }] };
  } } };
  await iniciarHomePage();
  assert.deepEqual(filtros, { estado: 'ACTIVO' });
  assert.equal(valor.textContent, '2');
  assert.match(detalle.textContent, /registros autorizados/);
  limpiarSesion();
});

test('Inicio distingue ausencia de datos y error de consulta', async () => {
  const { valor, detalle } = preparar();
  globalThis.window = { sgpa: { listarEstudiantes: async () => ({ ok: true, estudiantes: [] }) } };
  await iniciarHomePage();
  assert.equal(valor.textContent, '0');
  assert.equal(detalle.textContent, 'Sin registros activos');
  globalThis.window.sgpa.listarEstudiantes = async () => ({ ok: false, message: 'Sin acceso' });
  await iniciarHomePage();
  assert.equal(valor.textContent, 'No disponible');
  limpiarSesion();
});
