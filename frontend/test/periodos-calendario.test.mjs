import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pagina = readFileSync(
  new URL("../src/pages/periodos/PeriodosPage.js", import.meta.url),
  "utf8",
);
const estilos = readFileSync(
  new URL("../src/styles/periodos.css", import.meta.url),
  "utf8",
);

test("los tres campos conservan el selector nativo de fecha", () => {
  for (const id of [
    "periodoFechaInicio",
    "periodoFechaFin",
    "periodoFechaLimite",
  ]) {
    const field = pagina.split(`id="${id}"`)[1]?.split(">", 1)[0] || "";
    assert.match(field, /type="date"/);
    assert.doesNotMatch(field, /readonly/i);
    assert.match(field, /required/);
    assert.doesNotMatch(pagina, new RegExp(`${id}PickerBtn`));
  }

  assert.doesNotMatch(pagina, /periodo-cal-popover|configurarSelectorFechaSGPA/);
  assert.doesNotMatch(
    estilos,
    /::-webkit-calendar-picker-indicator\s*\{[^}]*display:\s*none/s,
  );
});

test("el límite docente permanece antes de la fecha de inicio", () => {
  assert.match(pagina, /inputFechaLimite\.max = fechaMaxima/);
  assert.match(
    pagina,
    /inputFechaInicio\.addEventListener\("change", actualizarLimiteDisponibilidad\)/,
  );
});
