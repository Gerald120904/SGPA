import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderizarSlotPlanoRegistrable,
  renderizarFichaPlanoAula,
  renderizarPlanoAulas,
} from '../src/pages/aulas/AulasPlanosView.js';

test('AulasPlanosView — renderizarSlotPlanoRegistrable genera markup esperado para slot vacío y registrado', () => {
  const slot = {
    key: 'principal-p2-aula-1',
    numero: 1,
    area: 'aula-1',
    ubicacion: 'Edificio principal, piso 2',
    tipo: 'AULA',
    tipoMobiliario: 'PUPITRE',
    origen: 'UNA',
  };

  // 1. Slot no registrado (disponible)
  const htmlDisponible = renderizarSlotPlanoRegistrable({
    slot,
    idsFiltradas: new Set(),
    incluirArea: true,
    aula: null,
  });

  assert.ok(htmlDisponible.includes('data-plano-slot-key="principal-p2-aula-1"'));
  assert.ok(htmlDisponible.includes('is-pending'));
  assert.ok(htmlDisponible.includes('style="grid-area: aula-1;"'));
  assert.ok(htmlDisponible.includes('Aula 1'));

  // 2. Slot con aula registrada
  const aulaMock = {
    id: 10,
    codigo: '1',
    nombre: 'Aula 1',
    tipo: 'AULA',
    capacidad: 35,
    activo: true,
    origen: 'UNA',
  };

  const htmlRegistrado = renderizarSlotPlanoRegistrable({
    slot,
    idsFiltradas: new Set([10]),
    incluirArea: true,
    aula: aulaMock,
    aulaPlanoSeleccionadaId: 10,
  });

  assert.ok(htmlRegistrado.includes('data-plano-aula-id="10"'));
  assert.ok(htmlRegistrado.includes('is-registered'));
  assert.ok(htmlRegistrado.includes('is-selected'));
});

test('AulasPlanosView — renderizarFichaPlanoAula genera vista vacía o detalle con botones según permisos', () => {
  // 1. Sin aula
  const htmlVacio = renderizarFichaPlanoAula(null);
  assert.ok(htmlVacio.includes('Seleccione un aula'));
  assert.ok(htmlVacio.includes('aulas-plan-empty-detail'));

  // 2. Con aula y permiso de gestión
  const aulaMock = {
    id: 20,
    codigo: '18',
    nombre: 'Aula 18 · S.T.E.M.',
    tipo: 'LABORATORIO',
    capacidad: 25,
    tipoMobiliario: 'MESA_COMPUTADORA',
    origen: 'UNA',
    activo: true,
    ubicacion: 'Edificio 2, piso 2',
  };

  const htmlDetalle = renderizarFichaPlanoAula(aulaMock, true);
  assert.ok(htmlDetalle.includes('Aula 18 · S.T.E.M.'));
  assert.ok(htmlDetalle.includes('Editar aula'));
  assert.ok(htmlDetalle.includes('Ver detalle'));
  assert.ok(htmlDetalle.includes('data-aula-id="20"'));

  // 3. Con aula pero sin permiso de gestión
  const htmlSoloLectura = renderizarFichaPlanoAula(aulaMock, false);
  assert.ok(htmlSoloLectura.includes('Ver detalle'));
  assert.ok(!htmlSoloLectura.includes('Editar aula'));
});

test('AulasPlanosView — renderizarPlanoAulas monta sectores y mapas en el contenedor', () => {
  const contenedorMock = { innerHTML: '' };
  const mockAulas = [
    { id: 1, codigo: '1', nombre: 'Aula 1', tipo: 'AULA', origen: 'UNA', activo: true },
  ];

  renderizarPlanoAulas({
    contenido: contenedorMock,
    filtradas: mockAulas,
    pisoEdificio2Actual: 3,
    selectorPisoEdificio2Abierto: false,
    aulaPlanoSeleccionadaId: 1,
    obtenerAulaParaSlot: (slot) => (slot.numero === 1 ? mockAulas[0] : null),
  });

  assert.ok(contenedorMock.innerHTML.includes('Selector visual de aulas'));
  assert.ok(contenedorMock.innerHTML.includes('Edificio 2'));
  assert.ok(contenedorMock.innerHTML.includes('Biblioteca y salas'));
  assert.ok(contenedorMock.innerHTML.includes('Sector Colegio Humanístico'));
  assert.ok(contenedorMock.innerHTML.includes('Edificio principal · Piso 2'));
  assert.ok(contenedorMock.innerHTML.includes('data-plano-aula-id="1"'));
});
