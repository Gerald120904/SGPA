import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarEspacioDuplicado } from '../src/pages/aulas/AulaFormDialog.js';

test('AulaFormDialog — buscarEspacioDuplicado detecta coincidencias por código o número dentro del mismo origen', () => {
  const listaAulas = [
    { id: 1, codigo: '1', nombre: 'Aula 1', origen: 'UNA', tipo: 'AULA' },
    { id: 2, codigo: '2', nombre: 'Aula 2', origen: 'UNA', tipo: 'AULA' },
    { id: 3, codigo: '1', nombre: 'Aula 1 UNED', origen: 'UNED', tipo: 'AULA' },
  ];

  // 1. Mismo origen y mismo número es duplicado
  const dup1 = buscarEspacioDuplicado(1, 'AULA', 'UNA', null, '', listaAulas);
  assert.ok(dup1);
  assert.equal(dup1.id, 1);

  // 2. Mismo número pero origen distinto NO es duplicado
  const noDup = buscarEspacioDuplicado(2, 'AULA', 'UNED', null, '', listaAulas);
  assert.equal(noDup, null);

  // 3. Excluyendo id de edición propia
  const edicionPropia = buscarEspacioDuplicado(1, 'AULA', 'UNA', 1, '', listaAulas);
  assert.equal(edicionPropia, null);
});
