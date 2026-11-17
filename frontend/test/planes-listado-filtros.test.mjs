import test from "node:test";
import assert from "node:assert/strict";

import { obtenerPlanesFiltrados } from "../src/pages/planes-estudio/PlanesListadoView.js";

test("los filtros de planes conservan estado explícito y respaldo del campo activo", () => {
  const planes = [
    { id: 1, estado: "BORRADOR", activo: true },
    { id: 2, estado: "EN_TRANSICION", activo: true },
    { id: 3, estado: null, activo: true },
    { id: 4, estado: null, activo: false },
  ];
  let estadoSeleccionado = "TODOS";

  global.document = {
    getElementById(id) {
      if (id === "planesBuscar") return { value: "" };
      if (id === "planesCarrera") return { value: "" };
      if (id === "planesEstado") return { value: estadoSeleccionado };
      return null;
    },
  };

  const contexto = { estado: { planes } };

  assert.deepEqual(
    obtenerPlanesFiltrados(contexto).map((plan) => plan.id),
    [1, 2, 3, 4],
  );

  estadoSeleccionado = "ACTIVOS";
  assert.deepEqual(
    obtenerPlanesFiltrados(contexto).map((plan) => plan.id),
    [3],
  );

  estadoSeleccionado = "INACTIVOS";
  assert.deepEqual(
    obtenerPlanesFiltrados(contexto).map((plan) => plan.id),
    [1, 2, 4],
  );
});
