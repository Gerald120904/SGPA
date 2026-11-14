import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { construirMensajeRevocacionRol } from '../src/pages/usuarios/UsuariosPage.js';
import { Topbar } from '../src/components/Topbar.js';
import { pantallaSinPermisos } from '../src/app/App.js';
import { guardarSesion, cambiarCarreraActiva, obtenerUsuario, limpiarSesion } from '../src/app/session.js';

test('la advertencia identifica asistentes, delegaciones, sesiones y solicitudes antes de confirmar', () => {
  const mensaje = construirMensajeRevocacionRol({
    rol: 'COORDINADOR', usuario: 'Carlos Coordinador',
    permisosRevocados: [{ carreraId: 1, permiso: 'ESTUDIANTES_GESTIONAR' }],
    asistentesAfectados: [{ id: 20, nombre: 'Ana Asistente', cuentaActiva: true,
      delegaciones: [{ carreraId: 1, permiso: 'ESTUDIANTES_GESTIONAR' }] }],
    totalAsistentes: 1, totalAsistentesActivos: 1,
    sesionesInvalidadas: [20], totalSolicitudes: 2,
  }, [{ id: 1, nombre: 'Ingeniería' }]);
  for (const dato of ['Carlos Coordinador', 'Ana Asistente', 'Ingeniería: ESTUDIANTES_GESTIONAR',
    '1 dependencia(s)', '2 solicitud(es)', 'cuentas activas seguirán activas', 'sesiones del coordinador']) {
    assert.ok(mensaje.includes(dato), dato);
  }
  const fuente = readFileSync(new URL('../src/pages/usuarios/UsuariosPage.js', import.meta.url), 'utf8');
  const confirmar = fuente.indexOf('mensaje: construirMensajeRevocacionRol(impacto, estado.carreras)');
  const cancelar = fuente.indexOf('if (!confirmado || !sigueActiva()) return;', confirmar);
  const ejecutar = fuente.indexOf('await revocarRolUsuario(id, rolId, impacto.firma)', confirmar);
  assert.ok(confirmar >= 0 && cancelar > confirmar && ejecutar > cancelar);
});

test('el asistente cambia entre dos carreras y la barra refleja la selección', async () => {
  const carrerasDisponibles = [
    { id: 1, nombre: 'Carrera Uno', permisos: ['ESTUDIANTES_GESTIONAR'] },
    { id: 2, nombre: 'Carrera Dos', permisos: ['PLANES_ESTUDIO_GESTIONAR'] },
  ];
  guardarSesion({ usuario: { rolActivo: 'ASISTENTE_ESTUDIANTIL', nombres: 'Ana',
    carreraActiva: 1, carrerasDisponibles, permisos: carrerasDisponibles[0].permisos } });
  assert.match(Topbar({ usuario: obtenerUsuario() }), /<select id="carreraActivaSelector"/);
  globalThis.window = { sgpa: { cambiarCarreraActiva: async (id) => ({ ok: true,
    usuario: { rolActivo: 'ASISTENTE_ESTUDIANTIL', nombres: 'Ana', carreraActiva: id,
      carrerasDisponibles, permisos: carrerasDisponibles.find((c) => c.id === id).permisos } }) } };
  await cambiarCarreraActiva(2);
  assert.deepEqual(obtenerUsuario().permisos, ['PLANES_ESTUDIO_GESTIONAR']);
  assert.match(Topbar({ usuario: obtenerUsuario() }), /value="2" selected/);
  assert.doesNotMatch(Topbar({ usuario: { rolActivo: 'COORDINADOR', nombres: 'Carlos',
    carrerasDisponibles } }), /carreraActivaSelector/);
  limpiarSesion();
  delete globalThis.window;
});

test('la pantalla sin permisos no ofrece navegación restringida', () => {
  const html = pantallaSinPermisos();
  assert.match(html, /No tenés permisos asignados/);
  assert.match(html, /Cerrar sesión/);
  assert.doesNotMatch(html, /data-route|sidebar|carreraActivaSelector/);
});
