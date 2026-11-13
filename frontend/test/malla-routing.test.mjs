import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  agruparRelacionesPorDestinoYTipo,
  buscarRutaOrtogonal,
  calcularRutasTroncales,
  construirPathRedondeado,
  rutaCruzaObstaculos,
} from "../src/pages/planes-estudio/malla-routing.mjs";

const rect = (left, top, width = 100, height = 60) => ({
  left,
  right: left + width,
  top,
  bottom: top + height,
  width,
  height,
});

test("agrupa únicamente relaciones del mismo destino y tipo", () => {
  const grupos = agruparRelacionesPorDestinoYTipo([
    { origenId: "A", destinoId: "C", tipo: "REQUISITO" },
    { origenId: "B", destinoId: "C", tipo: "REQUISITO" },
    { origenId: "D", destinoId: "C", tipo: "CORREQUISITO" },
    { origenId: "E", destinoId: "F", tipo: "REQUISITO" },
  ]);

  assert.equal(grupos.length, 3);
  assert.deepEqual(
    grupos.map((grupo) => [grupo.destinoId, grupo.tipo, grupo.relaciones.length]),
    [
      ["C", "CORREQUISITO", 1],
      ["C", "REQUISITO", 2],
      ["F", "REQUISITO", 1],
    ],
  );
});

test("descarta relaciones gráficas duplicadas sin alterar su dirección", () => {
  const grupos = agruparRelacionesPorDestinoYTipo([
    { origenId: "A", destinoId: "B", tipo: "REQUISITO" },
    { origenId: "A", destinoId: "B", tipo: "REQUISITO" },
    { origenId: "B", destinoId: "A", tipo: "REQUISITO" },
  ]);

  assert.equal(grupos.length, 2);
  assert.equal(grupos.find((grupo) => grupo.destinoId === "B").relaciones.length, 1);
  assert.equal(grupos.find((grupo) => grupo.destinoId === "A").relaciones.length, 1);
});

test("dos requisitos compatibles comparten una troncal y una entrada", () => {
  const rectangulos = new Map([
    ["A", rect(20, 30)],
    ["B", rect(20, 140)],
    ["C", rect(340, 85)],
  ]);
  const bloqueoIntermedio = rect(180, 35, 90, 75);
  const obstaculos = [
    ...Array.from(rectangulos, ([id, item]) => ({ id, ...item })),
    { id: "heading-test", ...bloqueoIntermedio },
  ];
  const rutas = calcularRutasTroncales({
    relaciones: [
      { origenId: "A", destinoId: "C", tipo: "REQUISITO" },
      { origenId: "B", destinoId: "C", tipo: "REQUISITO" },
    ],
    rectangulos,
    obstaculos,
    ancho: 500,
    alto: 250,
  });

  assert.equal(rutas.filter((ruta) => ruta.clase === "rama").length, 2);
  assert.equal(rutas.filter((ruta) => ruta.clase === "troncal").length, 1);
  assert.equal(rutas.filter((ruta) => ruta.clase === "entrada").length, 1);
  assert.equal(rutas.filter((ruta) => ruta.flecha).length, 1);
  assert.ok(
    rutas.every((ruta) => !rutaCruzaObstaculos(ruta.puntos, [bloqueoIntermedio])),
  );
  const troncalX = rutas.find((ruta) => ruta.clase === "troncal").puntos[0].x;
  for (const rama of rutas.filter((ruta) => ruta.clase === "rama")) {
    assert.equal(rama.puntos.at(-1).x, troncalX);
    assert.equal(
      rama.puntos.slice(0, -1).some((punto) => punto.x === troncalX),
      false,
    );
  }
});

test("requisito y correquisito nunca comparten la misma troncal", () => {
  const rectangulos = new Map([
    ["A", rect(20, 20)],
    ["B", rect(20, 100)],
    ["D", rect(20, 180)],
    ["E", rect(20, 260)],
    ["C", rect(400, 140)],
  ]);
  const obstaculos = Array.from(rectangulos, ([id, item]) => ({ id, ...item }));
  const rutas = calcularRutasTroncales({
    relaciones: [
      { origenId: "A", destinoId: "C", tipo: "REQUISITO" },
      { origenId: "B", destinoId: "C", tipo: "REQUISITO" },
      { origenId: "D", destinoId: "C", tipo: "CORREQUISITO" },
      { origenId: "E", destinoId: "C", tipo: "CORREQUISITO" },
    ],
    rectangulos,
    obstaculos,
    ancho: 560,
    alto: 360,
  });
  const troncales = rutas.filter((ruta) => ruta.clase === "troncal");

  assert.equal(troncales.length, 2);
  assert.deepEqual(new Set(troncales.map((ruta) => ruta.tipo)), new Set([
    "REQUISITO",
    "CORREQUISITO",
  ]));
  assert.notEqual(troncales[0].puntos[0].x, troncales[1].puntos[0].x);
});

test("una relación aislada conserva una ruta individual con flecha", () => {
  const rectangulos = new Map([
    ["A", rect(20, 40)],
    ["B", rect(300, 40)],
  ]);
  const rutas = calcularRutasTroncales({
    relaciones: [{ origenId: "A", destinoId: "B", tipo: "REQUISITO" }],
    rectangulos,
    obstaculos: Array.from(rectangulos, ([id, item]) => ({ id, ...item })),
    ancho: 450,
    alto: 180,
  });

  assert.equal(rutas.length, 1);
  assert.equal(rutas[0].clase, "individual");
  assert.equal(rutas[0].flecha, true);
});

test("el enrutador esquiva tarjetas intermedias", () => {
  const obstaculo = rect(190, 55, 120, 90);
  const puntos = buscarRutaOrtogonal({
    origen: { x: 120, y: 100 },
    destino: { x: 390, y: 100 },
    obstaculos: [obstaculo],
    ancho: 520,
    alto: 220,
  });

  assert.ok(puntos.length >= 4);
  assert.equal(rutaCruzaObstaculos(puntos, [obstaculo]), false);
  assert.match(construirPathRedondeado(puntos), /^M /);
});

test("más de diez requisitos mantienen una sola troncal compartida", () => {
  const destinoId = "DESTINO";
  const rectangulos = new Map([[destinoId, rect(500, 360)]]);
  const relaciones = [];

  for (let i = 0; i < 12; i += 1) {
    const id = `R${i + 1}`;
    rectangulos.set(id, rect(20, 10 + i * 70));
    relaciones.push({ origenId: id, destinoId, tipo: "REQUISITO" });
  }

  const rutas = calcularRutasTroncales({
    relaciones,
    rectangulos,
    obstaculos: Array.from(rectangulos, ([id, item]) => ({ id, ...item })),
    ancho: 650,
    alto: 880,
  });

  assert.equal(rutas.filter((ruta) => ruta.clase === "rama").length, 12);
  assert.equal(rutas.filter((ruta) => ruta.clase === "troncal").length, 1);
  assert.equal(rutas.filter((ruta) => ruta.flecha).length, 1);
});

test("las dependencias hacia atrás se enrutan por el lado derecho", () => {
  const rectangulos = new Map([
    ["ORIGEN", rect(420, 40)],
    ["DESTINO", rect(80, 40)],
  ]);
  const rutas = calcularRutasTroncales({
    relaciones: [
      { origenId: "ORIGEN", destinoId: "DESTINO", tipo: "CORREQUISITO" },
    ],
    rectangulos,
    obstaculos: Array.from(rectangulos, ([id, item]) => ({ id, ...item })),
    ancho: 600,
    alto: 180,
  });

  assert.equal(rutas.length, 1);
  assert.equal(rutas[0].puntos.at(0).x, 420);
  assert.equal(rutas[0].puntos.at(-1).x, 180);
});

test("las puntas de requisito y correquisito llegan a puntos distintos del mismo borde", () => {
  const rectangulos = new Map([
    ["REQ", rect(20, 30)],
    ["COREQ", rect(20, 150)],
    ["DESTINO", rect(330, 90, 100, 100)],
  ]);
  const rutas = calcularRutasTroncales({
    relaciones: [
      { origenId: "REQ", destinoId: "DESTINO", tipo: "REQUISITO" },
      { origenId: "COREQ", destinoId: "DESTINO", tipo: "CORREQUISITO" },
    ],
    rectangulos,
    obstaculos: Array.from(rectangulos, ([id, item]) => ({ id, ...item })),
    ancho: 480,
    alto: 260,
  });
  const puntas = rutas.filter((ruta) => ruta.flecha);

  assert.equal(puntas.length, 2);
  assert.ok(puntas.every((ruta) => ruta.puntos.at(-1).x === 330));
  const puntaRequisito = puntas.find((ruta) => ruta.tipo === "REQUISITO");
  const puntaCorrequisito = puntas.find((ruta) => ruta.tipo === "CORREQUISITO");
  assert.ok(puntaRequisito.puntos.at(-1).y < puntaCorrequisito.puntos.at(-1).y);
  assert.ok(
    rutas.every((ruta) =>
      !rutaCruzaObstaculos(ruta.puntos, [rectangulos.get("DESTINO")]),
    ),
  );
});

test("una relación en la misma columna sale y entra por el mismo lateral", () => {
  const rectangulos = new Map([
    ["ORIGEN", rect(120, 20)],
    ["DESTINO", rect(120, 150)],
  ]);
  const rutas = calcularRutasTroncales({
    relaciones: [
      { origenId: "ORIGEN", destinoId: "DESTINO", tipo: "REQUISITO" },
    ],
    rectangulos,
    obstaculos: Array.from(rectangulos, ([id, item]) => ({ id, ...item })),
    ancho: 360,
    alto: 260,
  });

  assert.equal(rutas.length, 1);
  assert.equal(rutas[0].puntos.at(0).x, 220);
  assert.equal(rutas[0].puntos.at(-1).x, 220);
  assert.equal(rutas[0].puntos[1].x, 228);
  assert.equal(rutas[0].puntos.at(-2).x, 228);
});

test("la troncal ocupa solo el intervalo de sus uniones", () => {
  const rectangulos = new Map([
    ["A", rect(20, 50)], ["B", rect(20, 170)],
    ["C", rect(380, 110)],
  ]);
  const rutas = calcularRutasTroncales({
    relaciones: [
      { origenId: "A", destinoId: "C", tipo: "REQUISITO" },
      { origenId: "B", destinoId: "C", tipo: "REQUISITO" },
    ],
    rectangulos,
    obstaculos: Array.from(rectangulos, ([id, item]) => ({ id, ...item })),
    ancho: 540,
    alto: 400,
  });
  const troncal = rutas.find((ruta) => ruta.clase === "troncal");
  assert.ok(troncal);
  const uniones = [140, ...rutas.filter((ruta) => ruta.clase === "rama").map((ruta) => ruta.puntos.at(-1).y)];
  assert.equal(troncal.puntos[0].y, Math.min(...uniones));
  assert.equal(troncal.puntos[1].y, Math.max(...uniones));
});

test("quince conexiones conservan todas las ramas, sin coordenadas inválidas", () => {
  const rectangulos = new Map([["D", rect(500, 500)]]);
  const relaciones = Array.from({ length: 15 }, (_, indice) => {
    const origenId = `R${indice}`;
    rectangulos.set(origenId, rect(20, 10 + indice * 70));
    return { origenId, destinoId: "D", tipo: "REQUISITO" };
  });
  const rutas = calcularRutasTroncales({
    relaciones,
    rectangulos,
    obstaculos: Array.from(rectangulos, ([id, item]) => ({ id, ...item })),
    ancho: 660,
    alto: 1100,
  });
  assert.equal(rutas.filter((ruta) => ruta.clase === "rama").length, 15);
  assert.equal(rutas.filter((ruta) => ruta.flecha).length, 1);
  assert.ok(rutas.every((ruta) => ruta.puntos.every((punto) =>
    Number.isFinite(punto.x) && Number.isFinite(punto.y))));
});

test("un correquisito en el mismo ciclo y uno de otra columna conservan su tipo", () => {
  const rectangulos = new Map([
    ["A", rect(20, 20)], ["B", rect(20, 130)],
    ["C", rect(300, 70)],
  ]);
  const rutas = calcularRutasTroncales({
    relaciones: [
      { origenId: "A", destinoId: "B", tipo: "CORREQUISITO" },
      { origenId: "C", destinoId: "B", tipo: "CORREQUISITO" },
    ],
    rectangulos,
    obstaculos: Array.from(rectangulos, ([id, item]) => ({ id, ...item })),
    ancho: 470,
    alto: 280,
  });
  assert.equal(rutas.filter((ruta) => ruta.flecha).length, 2);
  assert.ok(rutas.every((ruta) => ruta.tipo === "CORREQUISITO"));
});

test("la selección repetida produce exactamente las mismas rutas y omite nodos ausentes", () => {
  const parametros = {
    relaciones: [
      { origenId: "A", destinoId: "C", tipo: "REQUISITO" },
      { origenId: "B", destinoId: "C", tipo: "REQUISITO" },
      { origenId: "AUSENTE", destinoId: "C", tipo: "REQUISITO" },
    ],
    rectangulos: new Map([
      ["A", rect(20, 20)], ["B", rect(20, 130)], ["C", rect(340, 70)],
    ]),
    ancho: 500,
    alto: 250,
  };
  parametros.obstaculos = Array.from(parametros.rectangulos, ([id, item]) => ({ id, ...item }));
  const primera = calcularRutasTroncales(parametros);
  const segunda = calcularRutasTroncales(parametros);
  assert.deepEqual(primera, segunda);
  assert.equal(primera.filter((ruta) => ruta.clase === "rama").length, 2);
});

test("conserva relaciones fuera del viewport dentro del canvas completo", () => {
  const rectangulos = new Map([
    ["EIF207", rect(20, 80, 130, 80)],
    ["EIF406", rect(650, 80, 130, 80)],
    ["EIF408", rect(1000, 80, 130, 80)],
  ]);
  // Solo x=850..1200 sería visible; EIF207 queda fuera de pantalla.
  const rutas = calcularRutasTroncales({
    relaciones: [
      { origenId: "EIF207", destinoId: "EIF408", tipo: "CORREQUISITO" },
      { origenId: "EIF406", destinoId: "EIF408", tipo: "REQUISITO" },
    ],
    rectangulos,
    obstaculos: Array.from(rectangulos, ([id, item]) => ({ id, ...item })),
    ancho: 1200,
    alto: 260,
  });
  assert.equal(rutas.filter((ruta) => ruta.flecha).length, 2);
  assert.deepEqual(
    new Set(rutas.map((ruta) => ruta.tipo)),
    new Set(["REQUISITO", "CORREQUISITO"]),
  );
  assert.ok(rutas.some((ruta) => ruta.puntos[0].x < 850));
  assert.ok(rutas.every((ruta) => ruta.puntos.at(-1).x <= 1130));
});

test("mantiene el contrato visual y los disparadores de recálculo en la arquitectura modular", () => {
  const css = readFileSync(
    new URL("../src/styles/planes-estudio.css", import.meta.url),
    "utf8",
  );
  const mallaView = readFileSync(
    new URL(
      "../src/pages/planes-estudio/PlanMallaCurricularView.js",
      import.meta.url,
    ),
    "utf8",
  );
  const detalleView = readFileSync(
    new URL(
      "../src/pages/planes-estudio/PlanDetalleView.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(css, /\.malla-connection\.is-requirement[\s\S]*?#2563eb/i);
  assert.match(css, /\.malla-connection\.is-corequisite[\s\S]*?#d97706/i);
  assert.match(css, /stroke-width:\s*2\.5/);
  assert.match(css, /stroke-dasharray:\s*8 6/);
  assert.match(detalleView, /new ResizeObserver/);
  assert.doesNotMatch(detalleView, /"scrollend",\s*programarDibujoMalla/);
  assert.match(detalleView, /window\.addEventListener\(\s*["']resize["'],\s*\(\)\s*=>\s*programarDibujoMalla\(contexto\)/);
  assert.match(mallaView, /function mostrarTarjetaMallaCompleta\(card\)/);
  assert.match(mallaView, /scroll\.scrollBy\(\{ left: ajuste, behavior: "smooth" \}\)/);
});

test("la selección destaca solo las tarjetas relacionadas sin mover los puertos SVG", () => {
  const css = readFileSync(
    new URL("../src/styles/planes-estudio.css", import.meta.url),
    "utf8",
  );
  const mallaView = readFileSync(
    new URL("../src/pages/planes-estudio/PlanMallaCurricularView.js", import.meta.url),
    "utf8",
  );

  assert.match(mallaView, /Boolean\(estado\.mallaAsignaturaSeleccionadaId\) && !idsRuta\.has\(id\)/);
  assert.match(mallaView, /card\.classList\.toggle\(\s*"is-muted"/);
  assert.match(css, /\.malla-card\.is-muted\s*\{[^}]*grayscale/);
  assert.match(css, /\.malla-card\.is-route\.is-requirement\s*\{[^}]*0 0 0 3px/);
  assert.match(css, /\.malla-card\.is-route\.is-corequisite\s*\{[^}]*0 0 0 3px/);
  assert.match(css, /\.malla-card\.is-route:hover,[\s\S]*?transform:\s*none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.malla-card\s*\{\s*transition:\s*none/);
});

test("seleccionar y limpiar una asignatura actualiza el estado real de las tarjetas de malla", async () => {
  const { conectarEventosDetallePlan } = await import("../src/pages/planes-estudio/PlanDetalleView.js");
  const { crearContextoPlanesEstudio } = await import("../src/pages/planes-estudio/planes-estudio.context.js");
  const original = {
    document: globalThis.document,
    window: globalThis.window,
    Element: globalThis.Element,
  };
  const frameCalls = [];
  const cancelCalls = [];
  let nextFrame = 0;

  class FakeCard {
    constructor(id) {
      this.dataset = { mallaAsignatura: String(id) };
      this.classes = new Set();
      this.attributes = {};
      this.classList = {
        toggle: (name, force) => force ? this.classes.add(name) : this.classes.delete(name),
      };
    }
    closest(selector) {
      return selector === "[data-malla-asignatura]" ? this : null;
    }
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
    getBoundingClientRect() {
      return rect(10, 10);
    }
  }

  const cards = [1, 2, 3, 4].map((id) => new FakeCard(id));
  const canvas = { querySelectorAll: () => cards };
  const resumen = { innerHTML: "" };
  const scroll = {
    getBoundingClientRect: () => rect(0, 0, 500, 500),
    scrollLeft: 0,
    scrollBy() {},
  };
  const elementos = {
    mallaCanvas: canvas,
    mallaSeleccionResumen: resumen,
    mallaScroll: scroll,
  };
  const listeners = new Map();
  const contenedor = {
    addEventListener(event, handler) {
      listeners.set(event, handler);
    },
    contains: () => true,
  };

  globalThis.Element = FakeCard;
  globalThis.document = { getElementById: (id) => elementos[id] || null };
  globalThis.window = {
    requestAnimationFrame(callback) {
      const id = ++nextFrame;
      frameCalls.push({ id, callback });
      return id;
    },
    cancelAnimationFrame(id) {
      cancelCalls.push(id);
    },
    addEventListener() {},
  };

  try {
    const contexto = crearContextoPlanesEstudio();
    contexto.estado.planSeleccionado = { id: 7 };
    contexto.estado.asignaturasPlan = cards.map((_, index) => ({
      id: index + 1,
      nivel: 1,
      ciclo: 1,
      nombre: `Materia ${index + 1}`,
      curso: { nombre: `Materia ${index + 1}`, codigo: `MAT${index + 1}` },
      activo: true,
    }));
    contexto.estado.requisitosPlan = [
      { asignaturaId: 1, requisitoAsignaturaId: 2, tipo: "REQUISITO" },
      { asignaturaId: 1, requisitoAsignaturaId: 3, tipo: "CORREQUISITO" },
    ];
    conectarEventosDetallePlan(contenedor, contexto);

    const click = listeners.get("click");
    await click({
      target: cards[0],
      preventDefault() {},
      stopPropagation() {},
    });

    assert.equal(contexto.estado.mallaAsignaturaSeleccionadaId, 1);
    assert.ok(cards[0].classes.has("is-selected"));
    assert.ok(cards[1].classes.has("is-route"));
    assert.ok(cards[1].classes.has("is-requirement"));
    assert.ok(cards[2].classes.has("is-route"));
    assert.ok(cards[2].classes.has("is-corequisite"));
    assert.ok(cards[3].classes.has("is-muted"));
    assert.equal(cards[0].attributes["aria-pressed"], "true");
    assert.match(resumen.innerHTML, /Materia 1/);

    await click({ target: cards[0], preventDefault() {}, stopPropagation() {} });
    assert.equal(contexto.estado.mallaAsignaturaSeleccionadaId, null);
    assert.ok(cards.every((card) => !card.classes.has("is-muted")));
    assert.ok(cards.every((card) => !card.classes.has("is-route")));
    assert.equal(cards[0].attributes["aria-pressed"], "false");
    assert.match(resumen.innerHTML, /Seleccione una asignatura/);
    assert.equal(frameCalls.length, 2);
    assert.equal(cancelCalls.length, 1);
  } finally {
    globalThis.document = original.document;
    globalThis.window = original.window;
    globalThis.Element = original.Element;
  }
});

test("programarDibujoMalla: exige contexto válido con estado y lanza TypeError si recibe evento o null", async () => {
  const { programarDibujoMalla } = await import("../src/pages/planes-estudio/PlanMallaCurricularView.js");

  assert.throws(() => programarDibujoMalla(), {
    name: "TypeError",
    message: /programarDibujoMalla requiere un contexto de Planes de Estudio válido con estado/,
  });

  const fakeEvent = { type: "resize" };
  assert.throws(() => programarDibujoMalla(fakeEvent), {
    name: "TypeError",
    message: /programarDibujoMalla requiere un contexto de Planes de Estudio válido con estado/,
  });
});

test("programarDibujoMalla: debouncing mediante requestAnimationFrame cancela frames previos", async () => {
  const { programarDibujoMalla } = await import("../src/pages/planes-estudio/PlanMallaCurricularView.js");

  const originalWindow = globalThis.window;
  const rafCalls = [];
  const cafCalls = [];
  let frameId = 100;

  globalThis.window = {
    requestAnimationFrame: (cb) => {
      const id = ++frameId;
      rafCalls.push({ id, cb });
      return id;
    },
    cancelAnimationFrame: (id) => {
      cafCalls.push(id);
    },
  };

  try {
    const contexto = {
      estado: {
        frameDibujoMalla: null,
        mallaAsignaturaSeleccionadaId: null,
        requisitosPlan: [],
      },
    };

    // Llamada 1
    programarDibujoMalla(contexto);
    assert.equal(contexto.estado.frameDibujoMalla, 101);
    assert.equal(rafCalls.length, 1);
    assert.equal(cafCalls.length, 0);

    // Llamadas rápidas consecutivas deben cancelar el frame previo
    programarDibujoMalla(contexto);
    assert.equal(cafCalls.length, 1);
    assert.equal(cafCalls[0], 101);
    assert.equal(contexto.estado.frameDibujoMalla, 102);

    programarDibujoMalla(contexto);
    assert.equal(cafCalls.length, 2);
    assert.equal(cafCalls[1], 102);
    assert.equal(contexto.estado.frameDibujoMalla, 103);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("conectarEventosDetallePlan: registra listener de resize con contexto y AbortSignal de limpieza", async () => {
  const { conectarEventosDetallePlan } = await import("../src/pages/planes-estudio/PlanDetalleView.js");
  const { crearContextoPlanesEstudio } = await import("../src/pages/planes-estudio/planes-estudio.context.js");

  const listeners = new Map();
  const originalWindow = globalThis.window;
  const rafCalls = [];
  const cancelCalls = [];
  let frameId = 0;

  globalThis.window = {
    addEventListener(event, handler, options) {
      const list = listeners.get(event) || [];
      list.push({ handler, options });
      listeners.set(event, list);

      options?.signal?.addEventListener("abort", () => {
        const current = listeners.get(event) || [];
        listeners.set(
          event,
          current.filter((item) => item.handler !== handler),
        );
      });
    },
    requestAnimationFrame: (cb) => {
      const id = ++frameId;
      rafCalls.push({ id, cb });
      return id;
    },
    cancelAnimationFrame: (id) => cancelCalls.push(id),
  };

  try {
    const contexto = crearContextoPlanesEstudio();
    contexto.estado.planSeleccionado = { id: 10, nombre: "Plan A" };

    const contenedor = {
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    conectarEventosDetallePlan(contenedor, contexto, {});

    const resizeListeners = listeners.get("resize") || [];
    assert.equal(resizeListeners.length, 1);

    resizeListeners[0].handler();
    assert.equal(rafCalls.length, 1, "resize debe programar un frame");
    assert.equal(contexto.estado.frameDibujoMalla, rafCalls[0].id);

    // Registrar de nuevo reemplaza la suscripción anterior en vez de duplicarla.
    conectarEventosDetallePlan(contenedor, contexto, {});
    assert.equal((listeners.get("resize") || []).length, 1);
    (listeners.get("resize") || [])[0].handler();
    assert.equal(rafCalls.length, 2);
    assert.deepEqual(cancelCalls, [rafCalls[0].id]);

    // Desmontar / limpiar detalle
    contexto.cancelarDetalleEventos();
    const listenersActivosTrasLimpieza = listeners.get("resize") || [];
    assert.equal(listenersActivosTrasLimpieza.length, 0);
    contexto.limpiarObserverMalla();
    assert.deepEqual(cancelCalls, [rafCalls[0].id, rafCalls[1].id]);
  } finally {
    globalThis.window = originalWindow;
  }
});
