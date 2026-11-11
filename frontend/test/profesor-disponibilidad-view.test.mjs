import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validarBloquesDisponibilidad,
  obtenerPeriodoAnteriorDisponibilidad,
} from '../src/pages/profesores/profesores.helpers.js';
import {
  setPeriodosDisponibilidad,
  setDisponibilidadActual,
  getDisponibilidadActual,
  renderizarMiDisponibilidad,
} from '../src/pages/profesores/ProfesorDisponibilidadView.js';

test('ProfesorDisponibilidadView / helpers — validarBloquesDisponibilidad detecta inconsistencias horarias', () => {
  // Fin menor o igual a inicio
  const invertido = [
    { dia: 'LUNES', horaInicio: '10:00', horaFin: '09:00' },
  ];
  assert.match(validarBloquesDisponibilidad(invertido), /debe terminar después/);

  // Superposición en mismo día
  const superpuestos = [
    { dia: 'MARTES', horaInicio: '08:00', horaFin: '11:00' },
    { dia: 'MARTES', horaInicio: '10:30', horaFin: '12:00' },
  ];
  assert.match(validarBloquesDisponibilidad(superpuestos), /superpuestos el Martes/);

  // Bloques contiguos o en diferentes días válidos
  const validos = [
    { dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00' },
    { dia: 'LUNES', horaInicio: '10:00', horaFin: '12:00' },
    { dia: 'MIERCOLES', horaInicio: '08:00', horaFin: '10:00' },
  ];
  assert.equal(validarBloquesDisponibilidad(validos), null);
});

test('ProfesorDisponibilidadView / helpers — obtenerPeriodoAnteriorDisponibilidad calcula el ciclo anterior según reglas académicas', () => {
  const periodos = [
    { id: 1, codigo: '2025-I', anio: 2025, ciclo: 1 },
    { id: 2, codigo: '2025-II', anio: 2025, ciclo: 2 },
    { id: 3, codigo: '2025-III', anio: 2025, ciclo: 3 },
    { id: 4, codigo: '2026-I', anio: 2026, ciclo: 1 },
  ];

  // Ciclo 2 -> Ciclo 1 mismo año
  assert.equal(obtenerPeriodoAnteriorDisponibilidad({ anio: 2025, ciclo: 2 }, periodos)?.codigo, '2025-I');

  // Ciclo 3 -> Ciclo 2 mismo año
  assert.equal(obtenerPeriodoAnteriorDisponibilidad({ anio: 2025, ciclo: 3 }, periodos)?.codigo, '2025-II');

  // Ciclo 1 -> Ciclo 3 año anterior
  assert.equal(obtenerPeriodoAnteriorDisponibilidad({ anio: 2026, ciclo: 1 }, periodos)?.codigo, '2025-III');

  // Ciclo desconocido o no encontrado
  assert.equal(obtenerPeriodoAnteriorDisponibilidad(null, periodos), null);
  assert.equal(obtenerPeriodoAnteriorDisponibilidad({ anio: 2020, ciclo: 1 }, periodos), null);
});

test('ProfesorDisponibilidadView — renderizarMiDisponibilidad monta resumen y bloques en DOM simulado', () => {
  const contenedor = { innerHTML: '' };
  global.document = {
    getElementById: (id) => (id === 'miDisponibilidadContent' ? contenedor : null),
    querySelectorAll: () => [],
  };

  const mockDisponibilidad = {
    estado: 'REGISTRADA',
    puedeEditar: true,
    registrada: true,
    periodo: { id: 10, codigo: '2026-I', fechaLimiteDisponibilidad: '2026-02-15' },
    bloques: [
      { dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00' },
      { dia: 'MIERCOLES', horaInicio: '13:00', horaFin: '15:00' },
    ],
    observaciones: 'Preferencia mañanas',
  };

  setDisponibilidadActual(mockDisponibilidad);
  renderizarMiDisponibilidad();

  assert.match(contenedor.innerHTML, /Registrada/);
  assert.match(contenedor.innerHTML, /2026-02-15/);
  assert.match(contenedor.innerHTML, /Lunes/);
  assert.match(contenedor.innerHTML, /08:00/);
  assert.match(contenedor.innerHTML, /Preferencia mañanas/);
  assert.match(contenedor.innerHTML, /editarMiDisponibilidadButton/);
});
