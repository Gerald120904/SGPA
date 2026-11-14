import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { construirFilasPeriodosHtml } from "../src/pages/periodos/PeriodosCatalogo.js";
const css = readFileSync(
  new URL("../src/styles/periodos.css", import.meta.url),
  "utf8",
);

test("cada dato de periodos conserva su etiqueta y acción al apilar la tabla", () => {
  const filas = construirFilasPeriodosHtml([{
    id: 7,
    codigo: "P-2026-1",
    nombre: "I Ciclo 2026",
    anio: 2026,
    ciclo: 1,
    fechaInicio: "2026-03-01",
    fechaFin: "2026-06-30",
    fechaLimiteDisponibilidad: "2026-02-28",
    estado: "BORRADOR",
    transicionesEstado: [],
  }], true);
  for (const etiqueta of ["Código", "Periodo", "Fechas", "Estado", "Acciones"]) {
    assert.match(filas, new RegExp(`<td data-label="${etiqueta}">`));
  }
  assert.match(filas, /data-action="editar"[\s\S]*?data-id="7"/);
  assert.match(css, /@container \(max-width: 760px\)/);
  assert.match(css, /content: attr\(data-label\)/);
  assert.match(css, /\.periodos-content \.sgpa-data-table td:last-child\s*\{\s*display: block !important/);
});

test("las acciones y el texto no se comprimen en la vista de escritorio", () => {
  assert.match(css, /\.periodos-content \.sgpa-data-table\s*\{[^}]*min-width: 980px/);
  assert.match(css, /\.periodos-actions\s*\{[^}]*justify-content: center/);
  assert.match(css, /\.periodos-transition-reason\s*\{[^}]*white-space: normal/);
});
