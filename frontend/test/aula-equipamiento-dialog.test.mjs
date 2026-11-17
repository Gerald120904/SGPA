import test from 'node:test';
import assert from 'node:assert/strict';
import { renderizarEquipamientoDelAula } from '../src/pages/aulas/AulaEquipamientoDialog.js';

test('AulaEquipamientoDialog — renderizarEquipamientoDelAula genera markup con botones condicionados a permisos', () => {
  // 1. Sin equipamiento
  const htmlVacio = renderizarEquipamientoDelAula([], true);
  assert.ok(htmlVacio.includes('Esta aula no tiene equipamiento asignado actualmente'));

  // 2. Con equipamiento y permiso de gestión
  const relaciones = [
    {
      equipamientoId: 1,
      cantidadAsignada: 5,
      asignadoEn: '2026-03-01T10:00:00.000Z',
      observaciones: 'En perfecto estado',
      equipamiento: { id: 1, nombre: 'Proyector Láser', descripcion: 'Proyector 4K' },
    },
  ];

  const htmlGestion = renderizarEquipamientoDelAula(relaciones, true);
  assert.ok(htmlGestion.includes('Proyector Láser'));
  assert.ok(htmlGestion.includes('Proyector 4K'));
  assert.ok(htmlGestion.includes('Editar asignación'));
  assert.ok(htmlGestion.includes('Quitar del aula'));
  assert.ok(htmlGestion.includes('data-equipamiento-id="1"'));

  // 3. Con equipamiento en modo solo lectura
  const htmlLectura = renderizarEquipamientoDelAula(relaciones, false);
  assert.ok(htmlLectura.includes('Proyector Láser'));
  assert.ok(!htmlLectura.includes('Editar asignación'));
  assert.ok(!htmlLectura.includes('Quitar del aula'));
});
