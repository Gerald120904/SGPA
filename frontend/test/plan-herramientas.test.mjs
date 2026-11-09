import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VerPlanPage } from '../src/pages/planes-estudio/VerPlanPage.js';

test('el detalle conserva herramientas académicas y retira Importar y Plantilla', () => {
  const html = VerPlanPage({
    plan: { id: 1, nombre: 'Plan de prueba', codigo: 'PLAN-1', activo: true },
    resumenPlan: {},
    puedeGestionar: true,
  });
  assert.match(html, /salidasAcademicasButton/);
  assert.match(html, /revisarPlanButton/);
  assert.doesNotMatch(html, /importarExcelPlanButton|plantillaExcelPlanButton/);
});

test('el detalle distingue un plan EN_TRANSICION de uno vigente', () => {
  const html = VerPlanPage({
    plan: { id: 2, nombre: 'Plan en transición', codigo: 'PLAN-2', activo: true, estado: 'EN_TRANSICION' },
    resumenPlan: {},
  });
  assert.match(html, /Cerrado a nuevos ingresos/);
  assert.doesNotMatch(html, />\s*Activo\s*</);
});
