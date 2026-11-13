import test from "node:test";
import assert from "node:assert/strict";

import { abrirDetallePlan } from "../src/pages/planes-estudio/PlanDetalleView.js";
import { crearContextoPlanesEstudio } from "../src/pages/planes-estudio/planes-estudio.context.js";

const nombresConsultas = [
  "listarPlanAsignaturas",
  "listarPlanRequisitos",
  "listarSalidasAcademicas",
  "obtenerResumenPlan",
  "obtenerReglaOptativasPlan",
];

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function crearConsultasControladas() {
  const pendientes = new Map();
  const consultas = Object.fromEntries(
    nombresConsultas.map((nombre) => [
      nombre,
      (planId) => {
        const clave = `${planId}:${nombre}`;
        const solicitud = deferred();
        pendientes.set(clave, solicitud);
        return solicitud.promise;
      },
    ]),
  );
  return {
    consultas,
    completar(planId, valores = {}) {
      for (const nombre of nombresConsultas) {
        pendientes.get(`${planId}:${nombre}`).resolve({ ok: true, ...valores });
      }
    },
    fallar(planId, nombre, error) {
      pendientes.get(`${planId}:${nombre}`).reject(error);
    },
  };
}

async function conDocumentoTemporal(callback) {
  const anterior = globalThis.document;
  const contenedor = {
    innerHTML: "",
    addEventListener() {},
  };
  globalThis.document = {
    getElementById(id) {
      return id === "planesEstudioPage" ? contenedor : null;
    },
    querySelectorAll() {
      return [];
    },
  };
  try {
    await callback(contenedor);
  } finally {
    globalThis.document = anterior;
  }
}

function valoresPlan(etiqueta) {
  return {
    asignaturas: [{ id: etiqueta, nombre: `Asignatura ${etiqueta}` }],
    requisitos: [{ id: etiqueta, nombre: `Requisito ${etiqueta}` }],
    salidas: [{ id: etiqueta, nombre: `Salida ${etiqueta}` }],
    resumen: { nombre: `Resumen ${etiqueta}` },
    regla: { nombre: `Regla ${etiqueta}` },
  };
}

test("abrirDetallePlan: A que termina después de B no sustituye los datos vigentes", async () => {
  await conDocumentoTemporal(async (contenedor) => {
    const contexto = crearContextoPlanesEstudio();
    const control = crearConsultasControladas();
    const aperturaA = abrirDetallePlan({ id: 1 }, contexto, { consultas: control.consultas });
    contexto.estado.mallaAsignaturaSeleccionadaId = 99;
    const aperturaB = abrirDetallePlan({ id: 2 }, contexto, { consultas: control.consultas });
    assert.equal(contexto.estado.mallaAsignaturaSeleccionadaId, null);

    control.completar(2, valoresPlan("B"));
    await aperturaB;
    const htmlPlanB = contenedor.innerHTML;
    control.completar(1, valoresPlan("A"));
    await aperturaA;

    assert.equal(contexto.estado.planSeleccionado.id, 2);
    assert.equal(contexto.estado.asignaturasPlan[0].id, "B");
    assert.equal(contexto.estado.requisitosPlan[0].id, "B");
    assert.equal(contexto.estado.salidasAcademicas[0].id, "B");
    assert.deepEqual(contexto.estado.resumenPlan, { nombre: "Resumen B" });
    assert.deepEqual(contexto.estado.reglaOptativasPlan.regla, { nombre: "Regla B" });
    assert.equal(contenedor.innerHTML, htmlPlanB);
  });
});

test("abrirDetallePlan: error tardío de A no contamina el plan B", async () => {
  await conDocumentoTemporal(async (contenedor) => {
    const contexto = crearContextoPlanesEstudio();
    const control = crearConsultasControladas();
    const aperturaA = abrirDetallePlan({ id: 1 }, contexto, { consultas: control.consultas });
    const aperturaB = abrirDetallePlan({ id: 2 }, contexto, { consultas: control.consultas });

    control.completar(2, valoresPlan("B"));
    await aperturaB;
    const htmlPlanB = contenedor.innerHTML;
    control.fallar(1, "listarPlanAsignaturas", new Error("Error obsoleto de A"));
    await aperturaA;

    assert.equal(contexto.estado.planSeleccionado.id, 2);
    assert.equal(contexto.estado.asignaturasPlan[0].id, "B");
    assert.equal(contenedor.innerHTML, htmlPlanB);
    assert.doesNotMatch(contenedor.innerHTML, /Error obsoleto de A/);
  });
});

test("abrirDetallePlan: cerrar el detalle durante la carga invalida la respuesta", async () => {
  await conDocumentoTemporal(async (contenedor) => {
    const contexto = crearContextoPlanesEstudio();
    const control = crearConsultasControladas();
    const aperturaA = abrirDetallePlan({ id: 1 }, contexto, { consultas: control.consultas });

    contexto.resetearDetalle();
    const htmlCerrado = contenedor.innerHTML;
    control.completar(1, valoresPlan("A"));
    await aperturaA;

    assert.equal(contexto.estado.planSeleccionado, null);
    assert.deepEqual(contexto.estado.asignaturasPlan, []);
    assert.equal(contenedor.innerHTML, htmlCerrado);
  });
});

test("abrirDetallePlan: cambio de instancia por carrera invalida la carga anterior", async () => {
  await conDocumentoTemporal(async (contenedor) => {
    const contexto = crearContextoPlanesEstudio();
    const control = crearConsultasControladas();
    const aperturaA = abrirDetallePlan({ id: 1, carreraId: 10 }, contexto, { consultas: control.consultas });

    contexto.iniciarInstancia();
    const htmlCarreraNueva = "vista de la carrera nueva";
    contenedor.innerHTML = htmlCarreraNueva;
    control.completar(1, valoresPlan("A"));
    await aperturaA;

    assert.deepEqual(contexto.estado.asignaturasPlan, []);
    assert.equal(contenedor.innerHTML, htmlCarreraNueva);
  });
});

test("abrirDetallePlan: las cinco consultas de una selección vigente actualizan el detalle", async () => {
  await conDocumentoTemporal(async (contenedor) => {
    const contexto = crearContextoPlanesEstudio();
    const control = crearConsultasControladas();
    const apertura = abrirDetallePlan({ id: 7 }, contexto, { consultas: control.consultas });

    control.completar(7, valoresPlan("Válido"));
    await apertura;

    assert.equal(contexto.estado.planSeleccionado.id, 7);
    assert.equal(contexto.estado.asignaturasPlan[0].id, "Válido");
    assert.equal(contexto.estado.requisitosPlan[0].id, "Válido");
    assert.equal(contexto.estado.salidasAcademicas[0].id, "Válido");
    assert.deepEqual(contexto.estado.resumenPlan, { nombre: "Resumen Válido" });
    assert.deepEqual(contexto.estado.reglaOptativasPlan.regla, { nombre: "Regla Válido" });
    assert.match(contenedor.innerHTML, /Estructura curricular/);
  });
});
