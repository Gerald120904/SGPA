import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIAS_OPTATIVA,
  obtenerEtiquetaCategoria,
  obtenerPresentacionEstadoOptativa,
  puedeEditarOptativa,
  filtrarOptativas,
  validarYConstruirDatosOptativa,
} from '../src/pages/optativas/optativas.helpers.js';
import {
  renderizarFiltrosOptativas,
  renderizarTablaOptativas,
} from '../src/pages/optativas/OptativasCatalogo.js';
import { ROLES } from '../src/config/permissions.js';

test('optativas.helpers — etiquetas de categorías', () => {
  assert.equal(obtenerEtiquetaCategoria('DISCIPLINARIA'), 'Disciplinaria');
  assert.equal(obtenerEtiquetaCategoria('ABIERTA'), 'Abierta');
  assert.equal(obtenerEtiquetaCategoria('SEDE'), 'Sede');
  assert.equal(obtenerEtiquetaCategoria('OTRA'), 'OTRA');
  assert.equal(obtenerEtiquetaCategoria(null), '—');
});

test('optativas.helpers — filtrado por búsqueda, categoría y estado', () => {
  const lista = [
    { id: 1, curso: { codigo: 'OPT-101', nombre: 'Inteligencia Artificial' }, tipo: 'DISCIPLINARIA', activo: true },
    { id: 2, curso: { codigo: 'OPT-202', nombre: 'Fotografía Digital' }, tipo: 'ABIERTA', activo: false },
    { id: 3, curso: { codigo: 'OPT-303', nombre: 'Ecología Aplicada' }, tipo: 'SEDE', activo: true },
  ];

  assert.equal(filtrarOptativas(lista, {}).length, 3);
  assert.equal(filtrarOptativas(lista, { busqueda: 'artificial' }).length, 1);
  assert.equal(filtrarOptativas(lista, { tipo: 'ABIERTA' }).length, 1);
  assert.equal(filtrarOptativas(lista, { estado: 'ACTIVA' }).length, 2);
  assert.equal(filtrarOptativas(lista, { estado: 'INACTIVA' }).length, 1);
  assert.equal(filtrarOptativas(lista, { busqueda: 'OPT-101', tipo: 'DISCIPLINARIA', estado: 'ACTIVA' }).length, 1);
});

test('optativas.helpers — estados, autorización de edición y validaciones académicas', () => {
  assert.deepEqual(obtenerPresentacionEstadoOptativa(true), {
    label: 'Activa',
    tone: 'success',
  });
  assert.deepEqual(obtenerPresentacionEstadoOptativa(false), {
    label: 'Inactiva',
    tone: 'neutral',
  });

  assert.equal(puedeEditarOptativa({ tipo: 'ABIERTA' }, ROLES.ADMIN_GLOBAL), true);
  assert.equal(puedeEditarOptativa({ tipo: 'ABIERTA' }, ROLES.COORDINADOR), false);
  assert.equal(puedeEditarOptativa({ tipo: 'DISCIPLINARIA' }, ROLES.COORDINADOR), true);

  const faltaCarrera = validarYConstruirDatosOptativa({
    codigo: 'opt-10',
    nombre: 'Taller',
    tipo: 'DISCIPLINARIA',
    carreraOrigenId: '',
    rolActivo: ROLES.COORDINADOR,
  });
  assert.equal(faltaCarrera.ok, false);
  assert.equal(faltaCarrera.titulo, 'Dato requerido');

  const noAdminInstitucional = validarYConstruirDatosOptativa({
    codigo: 'opt-20',
    nombre: 'Arte',
    tipo: 'ABIERTA',
    rolActivo: ROLES.COORDINADOR,
  });
  assert.equal(noAdminInstitucional.ok, false);
  assert.equal(noAdminInstitucional.titulo, 'Rol no autorizado');

  const creacionValida = validarYConstruirDatosOptativa({
    codigo: ' opt-99 ',
    nombre: ' Robótica ',
    tipo: 'DISCIPLINARIA',
    carreraOrigenId: 3,
    descripcion: '  Desc  ',
    rolActivo: ROLES.COORDINADOR,
  });
  assert.deepEqual(creacionValida, {
    ok: true,
    datos: {
      codigo: 'OPT-99',
      nombre: 'Robótica',
      tipo: 'DISCIPLINARIA',
      carreraOrigenId: 3,
      descripcion: 'Desc',
    },
  });

  const edicionValida = validarYConstruirDatosOptativa({
    id: 12,
    tipo: 'SEDE',
    carreraOrigenId: '',
    descripcion: 'Editada',
    rolActivo: ROLES.ADMIN_GLOBAL,
  });
  assert.deepEqual(edicionValida, {
    ok: true,
    datos: {
      tipo: 'SEDE',
      carreraOrigenId: null,
      descripcion: 'Editada',
    },
  });
});

test('OptativasCatalogo — renderiza filtros y restringe botones de edición institucional según rol', () => {
  assert.match(renderizarFiltrosOptativas(), /id="buscarOptativa"/);
  const lista = [
    { id: 1, curso: { codigo: 'OPT-1', nombre: 'Disciplinaria 1' }, tipo: 'DISCIPLINARIA', activo: true },
    { id: 2, curso: { codigo: 'OPT-2', nombre: 'Abierta 2' }, tipo: 'ABIERTA', activo: false },
  ];

  const htmlCoord = renderizarTablaOptativas({
    optativas: lista,
    gestionar: true,
    rolActivo: ROLES.COORDINADOR,
  });
  assert.match(htmlCoord, /data-editar-optativa="1"/);
  assert.doesNotMatch(htmlCoord, /data-editar-optativa="2"/);

  const htmlAdmin = renderizarTablaOptativas({
    optativas: lista,
    gestionar: true,
    rolActivo: ROLES.ADMIN_GLOBAL,
  });
  assert.match(htmlAdmin, /data-editar-optativa="1"/);
  assert.match(htmlAdmin, /data-editar-optativa="2"/);
});
