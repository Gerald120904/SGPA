import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AulasPage,
  iniciarAulasPage,
  compararAulasPorEstadoYNumero as compararAulasPorEstadoYNumeroPagina,
} from '../src/pages/aulas/AulasPage.js';
import {
  renderizarSlotPlanoRegistrable,
} from '../src/pages/aulas/AulasPlanosView.js';
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

test('aulas.helpers — prefijoVisibleEspacio: valores normales y casos límite', () => {
  assert.equal(prefijoVisibleEspacio('SALA'), 'Sala');
  assert.equal(prefijoVisibleEspacio('AULA'), 'Aula');
  assert.equal(prefijoVisibleEspacio('LABORATORIO'), 'Aula');
  assert.equal(prefijoVisibleEspacio('AUDITORIO'), 'Aula');
  assert.equal(prefijoVisibleEspacio(null), 'Aula');
  assert.equal(prefijoVisibleEspacio(undefined), 'Aula');
  assert.equal(prefijoVisibleEspacio(''), 'Aula');
  assert.equal(prefijoVisibleEspacio(123), 'Aula');
});

test('aulas.helpers — claseTipoPlano: valores normales y casos límite', () => {
  assert.equal(claseTipoPlano('AUDITORIO'), 'is-auditorio');
  assert.equal(claseTipoPlano('LABORATORIO'), 'is-laboratorio');
  assert.equal(claseTipoPlano('SALA'), 'is-sala');
  assert.equal(claseTipoPlano('AULA'), 'is-aula');
  assert.equal(claseTipoPlano('VIRTUAL'), 'is-aula');
  assert.equal(claseTipoPlano(null), 'is-aula');
  assert.equal(claseTipoPlano(undefined), 'is-aula');
  assert.equal(claseTipoPlano(''), 'is-aula');
  assert.equal(claseTipoPlano(99), 'is-aula');
});

test('aulas.helpers — etiquetaPrincipalSlot: valores normales y casos límite', () => {
  assert.equal(
    etiquetaPrincipalSlot({ numero: 1, tipo: 'AULA' }),
    'Aula 1',
  );
  assert.equal(
    etiquetaPrincipalSlot({ numero: 4, tipo: 'SALA' }),
    'Sala 4',
  );
  assert.equal(
    etiquetaPrincipalSlot({ numero: 4, tipo: 'AULA' }, { codigo: 'SALA-4', tipo: 'SALA' }),
    'Sala 4',
  );
  assert.equal(
    etiquetaPrincipalSlot({ numero: 9, tipo: 'AUDITORIO', etiquetaPlano: 'Auditorio Principal' }),
    'Auditorio Principal',
  );
  assert.equal(
    etiquetaPrincipalSlot({ numero: 0, tipo: 'SALA' }),
    'Sala',
  );
  assert.equal(etiquetaPrincipalSlot(null, null), 'Aula');
  assert.equal(etiquetaPrincipalSlot(undefined, undefined), 'Aula');
  assert.equal(etiquetaPrincipalSlot({}, {}), 'Aula');
});

test('AulasPage y aulas.helpers — equivalencia de compararAulasPorEstadoYNumero y casos límite', () => {
  assert.equal(compararAulasPorEstadoYNumeroPagina, compararAulasPorEstadoYNumero);

  const casos = [
    { codigo: '10', nombre: 'Aula 10', activo: false },
    { codigo: '2', nombre: 'Aula 2', activo: true },
    { codigo: 'SALA-4', nombre: 'Sala 4 · Sámara', tipo: 'SALA', activo: true },
    { codigo: 'BETA', nombre: 'Espacio Beta', activo: false },
    { codigo: 'ALFA', nombre: 'Espacio Alfa', activo: false },
  ];

  const ordenadoHelper = [...casos].sort(compararAulasPorEstadoYNumero);
  const ordenadoPagina = [...casos].sort(compararAulasPorEstadoYNumeroPagina);
  assert.deepEqual(ordenadoPagina, ordenadoHelper);
  assert.deepEqual(
    ordenadoPagina.map((a) => `${a.activo}:${a.codigo}`),
    [
      'true:2',
      'true:SALA-4',
      'false:10',
      'false:ALFA',
      'false:BETA',
    ],
  );

  assert.equal(
    compararAulasPorEstadoYNumeroPagina({ codigo: '1' }, { codigo: '2' }),
    compararAulasPorEstadoYNumero({ codigo: '1' }, { codigo: '2' }),
  );
  assert.equal(
    compararAulasPorEstadoYNumeroPagina({ codigo: '1', activo: true }, { codigo: '2' }),
    -1,
  );
  assert.equal(
    compararAulasPorEstadoYNumeroPagina({ codigo: '1', activo: false }, { codigo: '2' }),
    1,
  );
  assert.throws(() => compararAulasPorEstadoYNumeroPagina(null, { codigo: '1', activo: true }), TypeError);
  assert.throws(() => compararAulasPorEstadoYNumeroPagina({ codigo: '1', activo: true }, undefined), TypeError);
});

test('AulasPage — conservación de exports, imports sin duplicados y presentación de consumidores', () => {
  assert.equal(typeof AulasPage, 'function');
  assert.equal(typeof iniciarAulasPage, 'function');
  assert.equal(typeof compararAulasPorEstadoYNumeroPagina, 'function');

  const fuenteAulasPage = readFileSync(
    new URL('../src/pages/aulas/AulasPage.js', import.meta.url),
    'utf8',
  );
  assert.match(fuenteAulasPage, /prefijoVisibleEspacio[\s\S]*from '\.\/aulas\.helpers\.js'/);
  assert.match(fuenteAulasPage, /compararAulasPorEstadoYNumero[\s\S]*from '\.\/aulas\.helpers\.js'/);
  assert.match(fuenteAulasPage, /export\s*\{\s*compararAulasPorEstadoYNumero\s*\};/);
  assert.doesNotMatch(fuenteAulasPage, /function\s+prefijoVisibleEspacio\s*\(/);
  assert.doesNotMatch(fuenteAulasPage, /function\s+claseTipoPlano\s*\(/);
  assert.doesNotMatch(fuenteAulasPage, /function\s+etiquetaPrincipalSlot\s*\(/);
  assert.doesNotMatch(fuenteAulasPage, /function\s+compararAulasPorEstadoYNumero\s*\(/);

  const htmlSala = renderizarSlotPlanoRegistrable({
    slot: {
      key: 'bib-sala-4',
      numero: 4,
      area: 'sala-4',
      tipo: 'SALA',
      origen: 'UNA',
      nombreEspecial: 'Sámara',
    },
    idsFiltradas: new Set([44]),
    aula: {
      id: 44,
      codigo: 'SALA-4',
      nombre: 'Sala 4 · Sámara',
      tipo: 'SALA',
      activo: true,
      origen: 'UNA',
    },
  });
  assert.ok(htmlSala.includes('is-sala'));
  assert.ok(htmlSala.includes('Sala 4'));
  assert.ok(htmlSala.includes('Sámara'));
});
