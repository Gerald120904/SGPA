import assert from 'node:assert/strict';
import test from 'node:test';
import { crearEstadoSesionAutenticada, invalidarSesionPor401, registrarCambiosContextoAutenticado } from '../src/electron/ipc/auth-session-state.js';

function diferida() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function crearArnes() {
  const estado = crearEstadoSesionAutenticada();
  const handlers = new Map();
  const respuestas = [];
  registrarCambiosContextoAutenticado({ handle: (canal, handler) => handlers.set(canal, handler) }, estado,
    (ruta, opciones) => respuestas.shift()(ruta, opciones));
  return { estado, handlers, respuestas };
}

function login(estado, credential = 'credential-in-test') {
  const contexto = estado.iniciarLogin();
  assert.equal(estado.confirmarLogin(contexto, credential), true);
}

test('un cambio de rol tardío después de logout no restaura la credencial', async () => {
  const { estado, handlers, respuestas } = crearArnes();
  login(estado);
  const backend = diferida();
  respuestas.push(() => backend.promise);
  const pending = handlers.get('auth:cambiar-rol-activo')(null, 'COORDINADOR');
  estado.cerrarSesion();
  backend.resolve({ ok: true, data: { accessToken: 'stale-role', usuario: { id: 1 } } });
  assert.equal((await pending).ok, false);
  assert.equal(estado.obtenerToken(), null);
});

test('un login nuevo mientras el cambio de rol está pendiente conserva la sesión nueva', async () => {
  const { estado, handlers, respuestas } = crearArnes();
  login(estado, 'old-role-session');
  const backend = diferida();
  respuestas.push(() => backend.promise);
  const pending = handlers.get('auth:cambiar-rol-activo')(null, 'COORDINADOR');
  login(estado, 'new-login-session');
  backend.resolve({ ok: true, data: { accessToken: 'late-role-token', usuario: { id: 7 } } });
  assert.equal((await pending).status, 409);
  assert.equal(estado.obtenerToken(), 'new-login-session');
});

test('un cambio de carrera tardío después de un login nuevo conserva la sesión nueva', async () => {
  const { estado, handlers, respuestas } = crearArnes();
  login(estado, 'old-account-session');
  const backend = diferida();
  respuestas.push(() => backend.promise);
  const pending = handlers.get('auth:cambiar-carrera-activa')(null, 3);
  login(estado, 'new-account-session');
  backend.resolve({ ok: true, data: { accessToken: 'stale-career', usuario: { id: 2 } } });
  assert.equal((await pending).ok, false);
  assert.equal(estado.obtenerToken(), 'new-account-session');
});

test('un cambio de carrera tardío después de logout no restaura la credencial', async () => {
  const { estado, handlers, respuestas } = crearArnes();
  login(estado);
  const backend = diferida();
  respuestas.push(() => backend.promise);
  const pending = handlers.get('auth:cambiar-carrera-activa')(null, 3);
  estado.cerrarSesion();
  backend.resolve({ ok: true, data: { accessToken: 'stale-career-token', usuario: { id: 1 } } });
  assert.equal((await pending).ok, false);
  assert.equal(estado.obtenerToken(), null);
});

test('un login nuevo mientras el cambio de carrera está pendiente conserva la sesión nueva', async () => {
  const { estado, handlers, respuestas } = crearArnes();
  login(estado, 'old-career-session');
  const backend = diferida();
  respuestas.push(() => backend.promise);
  const pending = handlers.get('auth:cambiar-carrera-activa')(null, 3);
  login(estado, 'new-login-session');
  backend.resolve({ ok: true, data: { accessToken: 'late-career-token', usuario: { id: 7 } } });
  assert.equal((await pending).status, 409);
  assert.equal(estado.obtenerToken(), 'new-login-session');
});

test('dos cambios de rol resueltos en orden inverso solo conservan el más reciente', async () => {
  const { estado, handlers, respuestas } = crearArnes();
  login(estado);
  const first = diferida();
  const second = diferida();
  respuestas.push(() => first.promise, () => second.promise);
  const request1 = handlers.get('auth:cambiar-rol-activo')(null, 'ASISTENTE');
  const request2 = handlers.get('auth:cambiar-rol-activo')(null, 'COORDINADOR');
  second.resolve({ ok: true, data: { accessToken: 'newer-role', usuario: { id: 1 } } });
  assert.equal((await request2).ok, true);
  first.resolve({ ok: true, data: { accessToken: 'older-role', usuario: { id: 1 } } });
  assert.equal((await request1).ok, false);
  assert.equal(estado.obtenerToken(), 'newer-role');
});

test('dos cambios de carrera resueltos en orden inverso solo conservan el más reciente', async () => {
  const { estado, handlers, respuestas } = crearArnes();
  login(estado);
  const first = diferida();
  const second = diferida();
  respuestas.push(() => first.promise, () => second.promise);
  const request1 = handlers.get('auth:cambiar-carrera-activa')(null, 1);
  const request2 = handlers.get('auth:cambiar-carrera-activa')(null, 2);
  second.resolve({ ok: true, data: { accessToken: 'newer-career', usuario: { id: 1 } } });
  assert.equal((await request2).ok, true);
  first.resolve({ ok: true, data: { accessToken: 'older-career', usuario: { id: 1 } } });
  assert.equal((await request1).ok, false);
  assert.equal(estado.obtenerToken(), 'newer-career');
});

test('cambios de rol y carrera concurrentes se ordenan en una secuencia compartida', async () => {
  const { estado, handlers, respuestas } = crearArnes();
  login(estado);
  const role = diferida();
  const career = diferida();
  respuestas.push(() => role.promise, () => career.promise);
  const request1 = handlers.get('auth:cambiar-rol-activo')(null, 'COORDINADOR');
  const request2 = handlers.get('auth:cambiar-carrera-activa')(null, 4);
  career.resolve({ ok: true, data: { accessToken: 'career-wins', usuario: { id: 1 } } });
  assert.equal((await request2).ok, true);
  role.resolve({ ok: true, data: { accessToken: 'role-stale', usuario: { id: 1 } } });
  assert.equal((await request1).ok, false);
  assert.equal(estado.obtenerToken(), 'career-wins');
});

test('cerrar y volver a iniciar sesión con el mismo usuario invalida operaciones antiguas', async () => {
  const { estado, handlers, respuestas } = crearArnes();
  login(estado, 'session-one');
  const backend = diferida();
  respuestas.push(() => backend.promise);
  const pending = handlers.get('auth:cambiar-rol-activo')(null, 'COORDINADOR');
  estado.cerrarSesion();
  login(estado, 'session-two-same-user');
  backend.resolve({ ok: true, data: { accessToken: 'old-session-token', usuario: { id: 7 } } });
  assert.equal((await pending).ok, false);
  assert.equal(estado.obtenerToken(), 'session-two-same-user');
});

test('un error tardío después de reemplazar la sesión no altera la sesión nueva', async () => {
  const { estado, handlers, respuestas } = crearArnes();
  login(estado, 'session-old');
  const backend = diferida();
  respuestas.push(() => backend.promise);
  const pending = handlers.get('auth:cambiar-carrera-activa')(null, 8);
  login(estado, 'session-new');
  backend.resolve({ ok: false, status: 401, message: 'error antiguo' });
  assert.equal((await pending).status, 409);
  assert.equal(estado.obtenerToken(), 'session-new');
});

test('un error de red tardío no altera ni invalida la sesión nueva', async () => {
  const { estado, handlers, respuestas } = crearArnes();
  login(estado, 'old-network-session');
  const backend = diferida();
  respuestas.push(() => backend.promise);
  const pending = handlers.get('auth:cambiar-rol-activo')(null, 'COORDINADOR');
  login(estado, 'new-network-session');
  backend.reject(new Error('fallo de red simulado'));
  assert.equal((await pending).status, 409);
  assert.equal(estado.obtenerToken(), 'new-network-session');
});

test('una respuesta 401 general tardía no invalida la sesión que reemplazó su contexto', () => {
  const estado = crearEstadoSesionAutenticada();
  login(estado, 'old-protected-request');
  const snapshotAntiguo = estado.capturarSesion();
  login(estado, 'new-protected-session');
  assert.equal(invalidarSesionPor401(estado, snapshotAntiguo, 401), false);
  assert.equal(estado.obtenerToken(), 'new-protected-session');
});

test('un cambio de contexto fallido mantiene la sesión vigente', async () => {
  const { estado, handlers, respuestas } = crearArnes();
  login(estado, 'still-valid-session');
  respuestas.push(async () => ({ ok: false, status: 403, message: 'Cambio no autorizado.' }));
  const result = await handlers.get('auth:cambiar-rol-activo')(null, 'COORDINADOR');
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(estado.obtenerToken(), 'still-valid-session');
});

test('un cambio de rol exitoso sin credencial nueva falla de forma segura', async () => {
  const { estado, handlers, respuestas } = crearArnes();
  login(estado, 'previous-session-token');
  respuestas.push(async () => ({ ok: true, data: { usuario: { id: 1, rolActivo: 'COORDINADOR' } } }));
  const result = await handlers.get('auth:cambiar-rol-activo')(null, 'COORDINADOR');
  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
  assert.equal(estado.obtenerToken(), 'previous-session-token');
});

test('un 401 vigente invalida la sesión y un error distinto no la invalida', () => {
  const estado = crearEstadoSesionAutenticada();
  login(estado, 'valid-session');
  const snapshot = estado.capturarSesion();
  assert.equal(invalidarSesionPor401(estado, snapshot, 500), false);
  assert.equal(estado.obtenerToken(), 'valid-session');
  assert.equal(invalidarSesionPor401(estado, snapshot, 401), true);
  assert.equal(estado.obtenerToken(), null);
});

test('sesión invalidada durante una operación no puede ser reactivada', async () => {
  const { estado, handlers, respuestas } = crearArnes();
  login(estado);
  const backend = diferida();
  respuestas.push(() => backend.promise);
  const pending = handlers.get('auth:cambiar-carrera-activa')(null, 9);
  const snapshot = estado.capturarSesion();
  assert.equal(estado.invalidarSiVigente(snapshot), true);
  backend.resolve({ ok: true, data: { accessToken: 'late-token', usuario: { id: 1 } } });
  assert.equal((await pending).ok, false);
  assert.equal(estado.obtenerToken(), null);
});

test('una operación vigente actualiza la credencial efectiva del proceso principal', async () => {
  const { estado, handlers, respuestas } = crearArnes();
  login(estado, 'current-session');
  respuestas.push(async () => ({ ok: true, data: { accessToken: 'rotated-token', usuario: { id: 1 } } }));
  const result = await handlers.get('auth:cambiar-carrera-activa')(null, 2);
  assert.equal(result.ok, true);
  assert.equal(estado.obtenerToken(), 'rotated-token');
});

test('cerrar y reabrir la interfaz invalida la operación pendiente del renderer anterior', async () => {
  const { estado, handlers, respuestas } = crearArnes();
  login(estado, 'active-window-session');
  const backend = diferida();
  let destroyed = false;
  respuestas.push(() => backend.promise);
  const pending = handlers.get('auth:cambiar-rol-activo')({ sender: { isDestroyed: () => destroyed } }, 'COORDINADOR');
  destroyed = true;
  login(estado, 'reopened-interface-session');
  backend.resolve({ ok: true, data: { accessToken: 'rotated-for-live-session', usuario: { id: 1 } } });
  assert.equal((await pending).ok, false);
  assert.equal(estado.obtenerToken(), 'reopened-interface-session');
});
