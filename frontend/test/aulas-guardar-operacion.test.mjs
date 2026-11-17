import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutarGuardadoAula } from '../src/pages/aulas/aulas.operaciones.js';

test('ejecutarGuardadoAula conserva el ciclo exitoso y espera la actualización posterior', async () => {
  const eventos = [];
  const boton = { disabled: false };
  const dialog = { close: () => eventos.push('cerrar') };

  await ejecutarGuardadoAula({
    boton,
    dialog,
    guardar: async () => {
      assert.equal(boton.disabled, true);
      eventos.push('guardar');
      return { ok: true, data: { id: 24 } };
    },
    mensajeResultadoInvalido: 'No se pudo guardar.',
    tituloError: 'Error',
    mensajeError: 'Error genérico.',
    tituloExito: 'Guardado',
    mensajeExito: 'Se completó.',
    notificarExito: (mensaje) => eventos.push(['éxito', mensaje]),
    notificarError: (mensaje) => eventos.push(['error', mensaje]),
    despuesDeGuardar: async (resultado) => {
      eventos.push(['actualizar', resultado.data.id]);
    },
  });

  assert.deepEqual(eventos, [
    'guardar',
    'cerrar',
    ['éxito', { titulo: 'Guardado', mensaje: 'Se completó.' }],
    ['actualizar', 24],
  ]);
  assert.equal(boton.disabled, false);
});

test('ejecutarGuardadoAula conserva el formulario ante respuesta fallida y recupera el botón', async () => {
  const eventos = [];
  const boton = { disabled: false };
  const dialog = { close: () => eventos.push('cerrar') };

  await ejecutarGuardadoAula({
    boton,
    dialog,
    guardar: async () => ({ ok: false, message: 'Conflicto de disponibilidad.' }),
    mensajeResultadoInvalido: 'No se pudo guardar.',
    tituloError: 'No se pudo reservar',
    mensajeError: 'Error genérico.',
    tituloExito: 'Guardado',
    mensajeExito: 'Se completó.',
    notificarExito: () => eventos.push('éxito'),
    notificarError: (mensaje) => eventos.push(['error', mensaje]),
    despuesDeGuardar: () => eventos.push('actualizar'),
  });

  assert.deepEqual(eventos, [
    ['error', { titulo: 'No se pudo reservar', mensaje: 'Conflicto de disponibilidad.' }],
  ]);
  assert.equal(boton.disabled, false);
});
