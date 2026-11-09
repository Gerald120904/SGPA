import test from 'node:test';
import assert from 'node:assert/strict';
import { guardarSesion, limpiarSesion } from '../src/app/session.js';
import { iniciarPlanesEstudioPage } from '../src/pages/planes-estudio/PlanesEstudioPage.js';

class MockElement extends EventTarget {
  constructor(id, doc) {
    super();
    this.id = id;
    this.doc = doc;
    this.open = false;
    this.value = '';
    this.dataset = {};
    this._checked = false;
    this._html = '';
    this.disabled = false;
    this.textContent = '';
  }
  set innerHTML(html) {
    this._html = html;
    if (this.id.endsWith('DialogContent')) this.doc.limpiarDinamicos();
  }
  get innerHTML() { return this._html; }
  get checked() { return this._checked; }
  set checked(val) { this._checked = Boolean(val); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  click() { this.dispatchEvent(new Event('click')); }
  change(val) {
    this.value = String(val);
    this.dispatchEvent(new Event('change'));
  }
  check(val) {
    this._checked = Boolean(val);
    this.dispatchEvent(new Event('change'));
  }
  querySelectorAll(sel) {
    return this.doc.buscarTodos(this, sel);
  }
  querySelector(sel) {
    return this.doc.buscarTodos(this, sel)[0] || null;
  }
}

function crearEntornoDOM() {
  const fijos = new Map();
  const dinamicos = new Map();

  const mockBody = new MockElement('body', null);
  mockBody.appendChild = (elemento) => dinamicos.set(elemento.id, elemento);
  const doc = {
    body: mockBody,
    createElement(tag) {
      const el = new MockElement(tag, doc);
      el.appendChild = () => {};
      el.setAttribute = () => {};
      el.addEventListener = () => {};
      el.remove = () => dinamicos.delete(el.id);
      return el;
    },
    limpiarDinamicos() { dinamicos.clear(); },
    getElementById(id) {
      if (fijos.has(id)) return fijos.get(id);
      if (dinamicos.has(id)) return dinamicos.get(id);
      for (const nombre of ['comparadorPlanesDialogContent', 'transicionCurricularDialogContent']) {
        const cont = fijos.get(nombre);
        if (cont && cont.innerHTML.includes(`id="${id}"`)) {
          if (!dinamicos.has(id)) dinamicos.set(id, new MockElement(id, doc));
          return dinamicos.get(id);
        }
      }
      return null;
    },
    buscarTodos(raiz, sel) {
      const matchId = sel.match(/^#([\w-]+)$/);
      if (matchId && raiz.innerHTML.includes(`id="${matchId[1]}"`)) {
        if (!dinamicos.has(matchId[1])) dinamicos.set(matchId[1], new MockElement(matchId[1], doc));
        return [dinamicos.get(matchId[1])];
      }
      const matchAttr = sel.match(/^\[(data-[a-z-]+)\]$/);
      if (matchAttr) {
        const attr = matchAttr[1];
        const regex = new RegExp(`${attr}="([^"]+)"`, 'g');
        const resultados = [];
        let m;
        while ((m = regex.exec(raiz.innerHTML)) !== null) {
          const val = m[1];
          const clave = `${attr}:${val}`;
          if (!dinamicos.has(clave)) {
            const el = new MockElement(clave, doc);
            el.dataset[attr.replace(/^data-/, '').replace(/-([a-z])/g, (_, l) => l.toUpperCase())] = val;
            dinamicos.set(clave, el);
          }
          resultados.push(dinamicos.get(clave));
        }
        return resultados;
      }
      return [];
    },
    querySelectorAll() { return []; }
  };

  for (const id of [
    'planesEstudioPage', 'nuevoPlanButton', 'comparadorPlanesButton',
    'transicionCurricularButton', 'planesBuscar', 'planesCarrera', 'planesEstado',
    'planesContent', 'comparadorPlanesDialog', 'comparadorPlanesDialogContent',
    'transicionCurricularDialog', 'transicionCurricularDialogContent'
  ]) {
    fijos.set(id, new MockElement(id, doc));
  }
  fijos.get('planesEstado').value = 'TODOS';
  return doc;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

test('QA-01, QA-02, QA-03 y QA-05: auditoría funcional del comparador y la transición', async (t) => {
  const origDoc = globalThis.document;
  const origWin = globalThis.window;
  const doc = crearEntornoDOM();
  globalThis.document = doc;

  const llamadasIPC = {
    crearEq: [],
    eliminarEq: [],
    listarEq: [],
    simular: [],
    ejecuciones: [],
    listarAsig: []
  };
  let respuestaEjecucion = { ok: false, message: 'Fallo backend QA' };

  const planesFixture = [
    { id: 111, carreraId: 160, codigo: 'QA-PLAN-ORIGEN', nombre: 'Plan Origen QA', activo: true, estado: 'EN_TRANSICION' },
    { id: 112, carreraId: 160, codigo: 'QA-PLAN-DESTINO', nombre: 'Plan Destino QA', activo: true, estado: 'VIGENTE' },
    { id: 109, carreraId: 160, codigo: 'QA-PLAN-VACIO', nombre: 'Plan Vacío QA', activo: true }
  ];

  const asigOrigenFixture = [
    { id: 200, creditos: 4, tipo: 'DISCIPLINARIA', codigoReferencia: 'QA-MAT-01', nombreReferencia: 'Cálculo I' },
    { id: 201, creditos: 3, tipo: 'DISCIPLINARIA', codigoReferencia: 'QA-MAT-02', nombreReferencia: 'Física I' },
    { id: 202, creditos: 1, tipo: 'DISCIPLINARIA', codigoReferencia: 'QA-MAT-03', nombreReferencia: 'Lab Física I' },
    { id: 203, creditos: 4, tipo: 'DISCIPLINARIA', codigoReferencia: 'QA-MAT-04', nombreReferencia: 'Química General' },
    { id: 204, creditos: 2, tipo: 'GENERAL', codigoReferencia: 'QA-MAT-05', nombreReferencia: 'Historia de la Ciencia' },
    { id: 205, creditos: 3, tipo: 'OPTATIVA', codigoReferencia: 'QA-ESP-OPT-01', nombreReferencia: 'Optativa Abierta 1' }
  ];

  const asigDestinoFixture = [
    { id: 206, creditos: 4, tipo: 'DISCIPLINARIA', codigoReferencia: 'QA-MAT-101', nombreReferencia: 'Cálculo Diferencial e Integral' },
    { id: 207, creditos: 4, tipo: 'DISCIPLINARIA', codigoReferencia: 'QA-MAT-102', nombreReferencia: 'Física General Integrada' },
    { id: 208, creditos: 3, tipo: 'DISCIPLINARIA', codigoReferencia: 'QA-MAT-103', nombreReferencia: 'Química Teórica' },
    { id: 209, creditos: 1, tipo: 'DISCIPLINARIA', codigoReferencia: 'QA-MAT-104', nombreReferencia: 'Química Experimental' },
    { id: 210, creditos: 3, tipo: 'DISCIPLINARIA', codigoReferencia: 'QA-MAT-105', nombreReferencia: 'Programación Básica' },
    { id: 211, creditos: 3, tipo: 'OPTATIVA', codigoReferencia: 'QA-ESP-OPT-DEST', nombreReferencia: 'Optativa Abierta Nueva' }
  ];

  let equivalenciasFixture = [
    { id: 1, planOrigenId: 111, asignaturaOrigenId: 200, planDestinoId: 112, asignaturaDestinoId: 206, justificacion: '1 a 1 oficial' }
  ];

  globalThis.window = {
    sgpa: {
      listarPlanesEstudio: async () => ({ ok: true, planes: planesFixture }),
      listarCarreras: async () => ({ ok: true, carreras: [{ id: 160, codigo: 'ADA', nombre: 'Carrera ADA' }] }),
      listarPlanAsignaturas: async (id) => {
        llamadasIPC.listarAsig.push(id);
        if (id === 111) return { ok: true, asignaturas: asigOrigenFixture };
        if (id === 112) return { ok: true, asignaturas: asigDestinoFixture };
        return { ok: true, asignaturas: [] }; // 109 vacío
      },
      listarEquivalenciasPlanes: async (orig, dest) => {
        llamadasIPC.listarEq.push([orig, dest]);
        return { ok: true, data: equivalenciasFixture.filter(e => e.planOrigenId === orig && e.planDestinoId === dest) };
      },
      crearEquivalenciaPlan: async (payload) => {
        llamadasIPC.crearEq.push(payload);
        const nueva = { id: 10, ...payload };
        equivalenciasFixture.push(nueva);
        return { ok: true, data: nueva };
      },
      eliminarEquivalenciaPlan: async (id) => {
        llamadasIPC.eliminarEq.push(id);
        equivalenciasFixture = equivalenciasFixture.filter(e => e.id !== id);
        return { ok: true, data: { success: true, eliminadas: 1 } };
      },
      consultarPoblacionTransicion: async () => ({ ok: true, data: [
        { id: 71, cedula: 'QA-EST-01', nombreCompleto: 'Estudiante Todo Aprobado' },
        { id: 74, cedula: 'QA-EST-04', nombreCompleto: 'Estudiante N1 Incompleta' },
        { id: 78, cedula: 'QA-EST-08', nombreCompleto: 'Estudiante Retirado' },
      ] }),
      simularTransicionCurricular: async (payload) => {
        llamadasIPC.simular.push(payload);
        const data = {
            carreraId: payload.carreraId,
            planOrigenId: payload.planOrigenId,
            planDestinoId: payload.planDestinoId,
            totalAnalizados: 3,
            totalMigrables: 2,
            totalConflictos: 1,
            estudiantes: [
              {
                estudianteId: 71,
                cedula: 'QA-EST-01',
                nombreCompleto: 'Estudiante Todo Aprobado',
                puedeMigrar: true,
                conflictos: [],
                observacionesAcademicas: [],
                asignaturasAprobadasOrigenCount: 5,
                asignaturasReconocidas: [
                  { asignaturaDestinoId: 206, codigo: 'QA-MAT-101', nombre: 'Cálculo Diferencial e Integral', creditos: 4, tipoEquivalencia: '1_A_1' }
                ],
                asignaturasSinEquivalencia: [
                  { asignaturaOrigenId: 204, codigo: 'QA-MAT-05', nombre: 'Historia de la Ciencia', creditos: 2 }
                ]
              },
              {
                estudianteId: 74,
                cedula: 'QA-EST-04',
                nombreCompleto: 'Estudiante N1 Incompleta',
                puedeMigrar: true,
                conflictos: [],
                observacionesAcademicas: ['Equivalencia compuesta N:1 incompleta: faltan materias requeridas.'],
                asignaturasAprobadasOrigenCount: 1,
                asignaturasReconocidas: [],
                asignaturasSinEquivalencia: [
                  { asignaturaOrigenId: 201, codigo: 'QA-MAT-02', nombre: 'Física I', creditos: 3 }
                ]
              },
              {
                estudianteId: 78,
                cedula: 'QA-EST-08',
                nombreCompleto: 'Estudiante Retirado',
                puedeMigrar: false,
                conflictos: ['Estado de expediente no migrable (RETIRADO)'],
                observacionesAcademicas: [],
                asignaturasAprobadasOrigenCount: 1,
                asignaturasReconocidas: [],
                asignaturasSinEquivalencia: []
              }
            ]
          };
        data.estudiantes = data.estudiantes.filter((estudiante) => payload.estudianteIds.includes(Number(estudiante.estudianteId)));
        data.totalAnalizados = data.estudiantes.length;
        data.totalMigrables = data.estudiantes.filter((estudiante) => estudiante.puedeMigrar).length;
        data.totalConflictos = data.estudiantes.filter((estudiante) => !estudiante.puedeMigrar).length;
        return { ok: true, data };
      },
      ejecutarTransicionCurricular: async (payload) => {
        llamadasIPC.ejecuciones.push(payload);
        return respuestaEjecucion;
      },
    }
  };

  try {
    // Iniciar con rol ADMIN_GLOBAL
    guardarSesion({
      usuario: {
        rol: 'ADMIN_GLOBAL',
        rolActivo: 'ADMIN_GLOBAL',
        permisos: ['PLANES_ESTUDIO_VER', 'PLANES_ESTUDIO_GESTIONAR', 'ESTUDIANTES_VER']
      }
    });

    iniciarPlanesEstudioPage();
    await tick();

    await t.test('QA-00: El listado presenta EN_TRANSICION y VIGENTE según su estado académico', () => {
      const html = doc.getElementById('planesContent').innerHTML;
      assert.match(html, /Cerrado a nuevos ingresos · v1/, 'EN_TRANSICION no debe presentarse como Histórico ni Vigente');
      assert.match(html, /Vigente · v1/, 'VIGENTE conserva su etiqueta académica');
    });

    // 1. COMPARADOR DE PLANES
    await t.test('QA-01: Apertura, carga de asignaturas y equivalencias existentes', async () => {
      doc.getElementById('comparadorPlanesButton').click();
      await tick();
      assert.equal(doc.getElementById('comparadorPlanesDialog').open, true, 'El diálogo debe abrirse');
      const html = doc.getElementById('comparadorPlanesDialogContent').innerHTML;

      // Comprobar que cargó asignaturas origen y destino
      assert.match(html, /QA-MAT-01/, 'Debe mostrar QA-MAT-01');
      assert.match(html, /QA-MAT-101/, 'Debe mostrar QA-MAT-101');
      assert.match(html, /Plan Origen QA \(Cerrado a nuevos ingresos\)/, 'EN_TRANSICION debe mantenerse distinto de vigente aunque activo=true');
      assert.match(html, /Plan Destino QA \(Vigente\)/, 'VIGENTE conserva su etiqueta académica');
      assert.match(html, /Cálculo I/);
      assert.match(html, /Cálculo Diferencial e Integral/);

      // Comprobar equivalencia registrada existente
      assert.match(html, /1 a 1 oficial/);
      assert.match(html, /Equivalencias Registradas entre estos Planes/);
    });

    await t.test('QA-01: Comportamiento al seleccionar plan vacío', async () => {
      doc.getElementById('compPlanOrigenSelect').change('109'); // Plan vacío
      await tick();
      const html = doc.getElementById('comparadorPlanesDialogContent').innerHTML;
      assert.match(html, /No hay asignaturas en el plan de origen/, 'Debe indicar plan de origen vacío');
      assert.match(html, /QA-MAT-101/, 'El plan destino conserva sus asignaturas');
    });

    await t.test('QA-01: Comportamiento al seleccionar el mismo plan en origen y destino', async () => {
      doc.getElementById('compPlanOrigenSelect').change('111');
      await tick();
      doc.getElementById('compPlanDestinoSelect').change('111'); // Mismo plan
      await tick();
      const html = doc.getElementById('comparadorPlanesDialogContent').innerHTML;
      assert.match(html, /El plan de origen y de destino no pueden ser el mismo/, 'Debe mostrar advertencia clara');
      assert.doesNotMatch(html, /QA-MAT-01/, 'No debe mostrar asignaturas al ser el mismo plan');
    });

    await t.test('QA-01: Cambio de selección restaura datos correctos sin datos residuales', async () => {
      doc.getElementById('compPlanDestinoSelect').change('112');
      await tick();
      const html = doc.getElementById('comparadorPlanesDialogContent').innerHTML;
      assert.match(html, /QA-MAT-01/, 'Muestra asignaturas origen 111');
      assert.match(html, /QA-MAT-101/, 'Muestra asignaturas destino 112');
    });

    await t.test('QA-02: Validar intentos de creación inválidos (0 materias seleccionadas)', async () => {
      doc.getElementById('compBtnCrearEq').click();
      await tick();
      assert.equal(llamadasIPC.crearEq.length, 0, 'No debe llamar a IPC sin selección');
    });

    await t.test('QA-02: Cierre y apertura limpia del comparador', async () => {
      doc.getElementById('cerrarComparadorBtn').click();
      await tick();
      assert.equal(doc.getElementById('comparadorPlanesDialog').open, false);
    });

    // 2. TRANSICIÓN CURRICULAR
    await t.test('QA-03: Apertura de asistente de transición y simulación completa', async () => {
      doc.getElementById('transicionCurricularButton').click();
      await tick();
      assert.equal(doc.getElementById('transicionCurricularDialog').open, true);

      // Comprobar que botón de ejecución NO está presente (bloqueado por reglas institucionales)
      const htmlInicial = doc.getElementById('transicionCurricularDialogContent').innerHTML;
      assert.doesNotMatch(htmlInicial, /id="tcBtnEjecutar"/, 'La ejecución definitiva debe estar deshabilitada');

      // Seleccionar planes y ejecutar simulación
      doc.getElementById('tcPlanOrigenSelect').change('111');
      doc.getElementById('tcPlanDestinoSelect').change('112');
      await tick();

      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Seleccionados: 3/);
      doc.getElementById('transicionCurricularDialogContent').querySelectorAll('[data-tc-estudiante]')[0].check(false);
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Seleccionados: 2/);
      doc.getElementById('tcSeleccionarTodos').check(true);
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Seleccionados: 3/);

      doc.getElementById('tcBtnSimular').click();
      await tick();

      assert.equal(llamadasIPC.simular.length, 1, 'Debe haber invocado simularTransicionCurricular');
      assert.deepEqual(llamadasIPC.simular[0].estudianteIds, [71, 74, 78]);
      const htmlSim = doc.getElementById('transicionCurricularDialogContent').innerHTML;

      // 1. Estadísticas
      assert.match(htmlSim, /TOTAL ANALIZADOS/);
      assert.match(htmlSim, />3</, '3 analizados');
      assert.match(htmlSim, />2</, '2 sin conflictos');
      assert.match(htmlSim, />1</, '1 con conflictos');

      // 2. Estudiantes y resultados
      assert.match(htmlSim, /Estudiante Todo Aprobado/);
      assert.match(htmlSim, /QA-EST-01/);
      assert.match(htmlSim, /QA-MAT-101/, 'Materia reconocida en destino');
      assert.match(htmlSim, /QA-MAT-05/, 'Materia sin equivalencia');

      assert.match(htmlSim, /Estudiante N1 Incompleta/);
      assert.match(htmlSim, /QA-EST-04/);

      assert.match(htmlSim, /Estudiante Retirado/);
      assert.match(htmlSim, /QA-EST-08/);
      assert.match(htmlSim, /RETIRADO/, 'Muestra diagnóstico de conflicto');

      // Ejecución disponible solo para estudiantes elegibles y con motivo obligatorio
      assert.match(htmlSim, /id="tcBtnEjecutar"/);
      assert.match(htmlSim, /Ejecutar traslado de 2 estudiante\(s\) elegible\(s\)/);
      assert.match(htmlSim, /id="tcMotivoEjecucion"/);

      const botónTraslado = doc.getElementById('tcBtnEjecutar');
      doc.getElementById('tcMotivoEjecucion').value = 'Ajuste curricular aprobado';

      botónTraslado.click();
      assert.equal(botónTraslado.disabled, true, 'El botón se bloquea desde la primera confirmación.');
      let confirmación = doc.getElementById('sgpaConfirmDialog');
      assert.match(confirmación.innerHTML, /Estudiantes seleccionados: 3/);
      assert.match(confirmación.innerHTML, /QA-PLAN-ORIGEN/);
      assert.match(confirmación.innerHTML, /QA-PLAN-DESTINO/);
      assert.match(confirmación.innerHTML, /2 elegible\(s\) de 3; 1 con conflicto/);
      confirmación.querySelector('#sgpaConfirmCancel').click();
      await tick();
      assert.equal(llamadasIPC.ejecuciones.length, 0, 'Cancelar la primera confirmación no traslada estudiantes.');
      assert.equal(botónTraslado.disabled, false, 'Cancelar restablece el botón.');

      botónTraslado.click();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();
      confirmación = doc.getElementById('sgpaConfirmDialog');
      assert.match(confirmación.innerHTML, /Autorizar ejecución definitiva/);
      confirmación.querySelector('#sgpaConfirmCancel').click();
      await tick();
      assert.equal(llamadasIPC.ejecuciones.length, 0, 'Cancelar la confirmación final tampoco traslada estudiantes.');
      assert.equal(botónTraslado.disabled, false, 'La cancelación final restablece el botón.');

      let resolverTraslado;
      respuestaEjecucion = new Promise((resolve) => { resolverTraslado = resolve; });
      botónTraslado.click();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();
      assert.equal(llamadasIPC.ejecuciones.length, 1, 'El lote llega una sola vez a IPC.');
      assert.deepEqual(llamadasIPC.ejecuciones[0].estudianteIds, [71, 74]);
      assert.equal(botónTraslado.disabled, true, 'El botón sigue bloqueado durante IPC.');
      botónTraslado.click();
      await tick();
      assert.equal(llamadasIPC.ejecuciones.length, 1, 'Clics repetidos no duplican la ejecución pendiente.');
      resolverTraslado({ ok: false, message: 'Error backend simulado' });
      await tick();
      assert.equal(botónTraslado.disabled, false, 'Un error backend restablece el botón.');
      assert.equal(llamadasIPC.ejecuciones.length, 1);

      respuestaEjecucion = { ok: true, data: { migrados: 1, solicitados: 1, fallidos: [] } };
      const quitarSeleccion = (id) => doc.getElementById('transicionCurricularDialogContent')
        .querySelectorAll('[data-tc-estudiante]')
        .find((checkbox) => Number(checkbox.dataset.tcEstudiante) === id);
      quitarSeleccion(74).check(false);
      await tick();
      quitarSeleccion(78).check(false);
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();
      assert.equal(llamadasIPC.simular.at(-1).estudianteIds.length, 1, 'La simulación individual incluye solo un estudiante.');
      doc.getElementById('tcMotivoEjecucion').value = 'Traslado individual QA';
      doc.getElementById('tcBtnEjecutar').click();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();
      assert.equal(llamadasIPC.ejecuciones.length, 2);
      assert.deepEqual(llamadasIPC.ejecuciones[1].estudianteIds, [71], 'La ejecución individual solo envía el estudiante elegido.');
      assert.equal(doc.getElementById('tcBtnEjecutar'), null, 'El éxito refresca la simulación ejecutada.');

      // Cerrar diálogo
      doc.getElementById('cerrarTransicionBtn').click();
      await tick();
      assert.equal(doc.getElementById('transicionCurricularDialog').open, false);
    });

    await t.test('QA-05: Seguridad y modo lectura para usuario con rol Profesor', async () => {
      guardarSesion({
        usuario: {
          rol: 'PROFESOR',
          rolActivo: 'PROFESOR',
          permisos: ['PLANES_ESTUDIO_VER']
        }
      });
      iniciarPlanesEstudioPage();
      await tick();

      // Abrir comparador
      doc.getElementById('comparadorPlanesButton').click();
      await tick();
      const htmlComp = doc.getElementById('comparadorPlanesDialogContent').innerHTML;

      // Debe abrir en modo de solo lectura (sin botón de vincular ni de eliminar)
      assert.doesNotMatch(htmlComp, /id="compBtnCrearEq"/, 'Profesor no debe ver botón de vincular equivalencia');
      assert.doesNotMatch(htmlComp, /data-del-eq=/, 'Profesor no debe ver botones de eliminar equivalencia');
      doc.getElementById('cerrarComparadorBtn').click();
      await tick();
    });

  } finally {
    limpiarSesion();
    globalThis.document = origDoc;
    globalThis.window = origWin;
  }
});
