import test from "node:test";
import assert from "node:assert/strict";
import {
  obtenerContextoItemRevision,
  renderizarItemRevision,
} from "../src/pages/planes-estudio/PlanesEstudioPage.js";

test("el diagnóstico de requisito identifica la asignatura y explica qué revisar", () => {
  const item = {
    codigo: "REQUISITO_POSTERIOR",
    asignaturaId: 12,
    mensaje: "EIF220 - Programación II requiere EIF210 - Programación I, pero el requisito está ubicado en un ciclo posterior.",
  };
  const asignaturas = [
    { id: 12, codigoReferencia: "EIF220", nombreReferencia: "Programación II" },
  ];
  const contexto = obtenerContextoItemRevision(item, asignaturas, []);
  const html = renderizarItemRevision(item, "ADVERTENCIA", contexto);

  assert.match(html, /Requisito posterior/);
  assert.match(html, /Elemento relacionado: Programación II/);
  assert.match(html, /ubicado en un ciclo posterior/);
  assert.match(html, /Revise la ubicación por nivel y ciclo del requisito/);
});

test("el diagnóstico de salida conserva el mensaje real y propone revisar sus materias", () => {
  const item = {
    codigo: "SALIDA_SIN_ASIGNATURAS",
    salidaId: 4,
    mensaje: 'La salida académica "Diplomado" no tiene asignaturas asociadas.',
  };
  const contexto = obtenerContextoItemRevision(item, [], [{ id: 4, nombre: "Diplomado" }]);
  const html = renderizarItemRevision(item, "ADVERTENCIA", contexto);

  assert.match(html, /Elemento relacionado: Diplomado/);
  assert.match(html, /no tiene asignaturas asociadas/);
  assert.match(html, /materias activas asociadas a esta salida académica/);
});
