import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pagina = readFileSync(
  new URL("../src/pages/periodos/PeriodosPage.js", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../src/styles/periodos.css", import.meta.url),
  "utf8",
);

test("cada dato de periodos conserva su etiqueta al apilar la tabla", () => {
  for (const etiqueta of ["Código", "Periodo", "Fechas", "Estado", "Acciones"]) {
    assert.match(pagina, new RegExp(`<td data-label="${etiqueta}">`));
  }
  assert.match(css, /@container \(max-width: 760px\)/);
  assert.match(css, /content: attr\(data-label\)/);
  assert.match(css, /\.periodos-content \.sgpa-data-table td:last-child\s*\{\s*display: block !important/);
});

test("las acciones y el texto no se comprimen en la vista de escritorio", () => {
  assert.match(css, /\.periodos-content \.sgpa-data-table\s*\{[^}]*min-width: 980px/);
  assert.match(css, /\.periodos-actions\s*\{[^}]*justify-content: center/);
  assert.match(css, /\.periodos-transition-reason\s*\{[^}]*white-space: normal/);
});
