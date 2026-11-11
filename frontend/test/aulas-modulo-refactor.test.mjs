import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPOS_AULA,
  TIPOS_MOBILIARIO,
  ORIGENES_AULA,
  LIMITES_AULAS_POR_ORIGEN,
  DIAS_SEMANA_AULA,
  nombreTipoAula,
  nombreMobiliario,
  nombreOrigen,
  nombreTipoIndisponibilidad,
  obtenerNumeroAula,
  obtenerNombreEspecialAula,
  prefijoVisibleEspacio,
  construirNombreAula,
  construirCodigoEspacio,
  nombreVisibleAula,
  compararAulasPorNumero,
  compararAulasPorEstadoYNumero,
  claseTipoPlano,
  etiquetaPrincipalSlot,
  aulaCoincideConSlot,
  origenTieneCupo,
} from '../src/pages/aulas/aulas.helpers.js';
import {
  PLANO_SECTOR_PRINCIPAL_P2,
  PLANO_SECTOR_HUMANISTICO,
  PLANO_SECTOR_BIBLIOTECA,
  PLANO_EDIFICIO2_PISO3,
  PLANO_EDIFICIO2_PISO2,
  TODAS_LAS_AREAS_REGISTRABLES,
} from '../src/pages/aulas/aulas.planos.js';

test('aulas.planos — verificación estructural de sectores', () => {
  assert.equal(PLANO_SECTOR_PRINCIPAL_P2.length, 8);
  assert.equal(PLANO_SECTOR_HUMANISTICO.length, 2);
  assert.equal(PLANO_SECTOR_BIBLIOTECA.length, 5);
  assert.equal(PLANO_EDIFICIO2_PISO3.length, 7);
  assert.equal(PLANO_EDIFICIO2_PISO2.length, 8);
  assert.equal(
    TODAS_LAS_AREAS_REGISTRABLES.length,
    8 + 2 + 5 + 7 + 8,
  );
  assert.ok(TODAS_LAS_AREAS_REGISTRABLES.every((s) => s.key && s.area));
});

test('aulas.helpers — formateadores de tipo, mobiliario y origen', () => {
  assert.equal(nombreTipoAula('AULA'), 'Aula');
  assert.equal(nombreTipoAula('LABORATORIO'), 'Laboratorio');
  assert.equal(nombreTipoAula('DESCONOCIDO'), 'DESCONOCIDO');

  assert.equal(nombreMobiliario('PUPITRE'), 'Pupitre');
  assert.equal(nombreMobiliario('MESA_INDIVIDUAL'), 'Mesa individual');

  assert.equal(nombreOrigen('UNA'), 'UNA');
  assert.equal(nombreOrigen('UNED'), 'UNED');

  assert.equal(nombreTipoIndisponibilidad('MANTENIMIENTO'), 'Mantenimiento');
  assert.equal(nombreTipoIndisponibilidad('BLOQUEO'), 'Bloqueo');
});

test('aulas.helpers — extracción de número y nombre especial', () => {
  assert.equal(obtenerNumeroAula({ codigo: '10' }), 10);
  assert.equal(obtenerNumeroAula({ codigo: 'SALA-4-SAMARA' }), 4);
  assert.equal(obtenerNumeroAula('AULA-15'), 15);
  assert.equal(obtenerNumeroAula(null), null);

  assert.equal(
    obtenerNombreEspecialAula({ codigo: 'SALA-4', nombre: 'Sala 4 · Sámara' }),
    'Sámara',
  );
  assert.equal(
    obtenerNombreEspecialAula({ codigo: '1', nombre: 'Aula 1' }),
    '',
  );
  assert.equal(
    obtenerNombreEspecialAula({ codigo: '18', nombre: 'Aula 18 - S.T.E.M.' }),
    'S.T.E.M.',
  );
});

test('aulas.helpers — construcción de nombres y códigos de espacio', () => {
  assert.equal(prefijoVisibleEspacio('AULA'), 'Aula');
  assert.equal(prefijoVisibleEspacio('SALA'), 'Sala');

  assert.equal(construirNombreAula(5, '', 'AULA'), 'Aula 5');
  assert.equal(construirNombreAula(4, 'Sámara', 'SALA'), 'Sala 4 · Sámara');

  assert.equal(construirCodigoEspacio(1, 'AULA'), '1');
  assert.equal(construirCodigoEspacio(3, 'SALA'), 'SALA-3');
  assert.equal(construirCodigoEspacio(4, 'SALA', 'SALA-4-SAMARA'), 'SALA-4-SAMARA');
});

test('aulas.helpers — ordenamiento natural y por estado', () => {
  const lista = [
    { codigo: '10', activo: false },
    { codigo: '2', activo: true },
    { codigo: '1', activo: true },
    { codigo: '5', activo: false },
  ];

  const ordenada = [...lista].sort(compararAulasPorEstadoYNumero);
  assert.deepEqual(
    ordenada.map((a) => `${a.activo}:${a.codigo}`),
    ['true:1', 'true:2', 'false:5', 'false:10'],
  );
});

test('aulas.helpers — límites y cupos por origen', () => {
  assert.equal(LIMITES_AULAS_POR_ORIGEN.UNA, 27);
  assert.equal(LIMITES_AULAS_POR_ORIGEN.UNED, 3);
  assert.equal(LIMITES_AULAS_POR_ORIGEN.OTRO, 15);

  const aulas = Array.from({ length: 3 }, (_, i) => ({ id: i + 1, origen: 'UNED' }));
  assert.equal(origenTieneCupo('UNED', aulas), false);
  assert.equal(origenTieneCupo('UNED', aulas, aulas[0]), true);
  assert.equal(origenTieneCupo('UNA', aulas), true);
});
