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
    this.style = {};
  }
  get checked() { return this._checked; }
  set checked(val) { this._checked = Boolean(val); }
  get innerHTML() { return this._html; }
  set innerHTML(val) {
    this._html = String(val);
    if (this.id.endsWith('DialogContent')) this.doc.limpiarDinamicos();
  }
  showModal() { this.open = true; }
  close() {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  }
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

function inicializarAtributosDesdeHtml(el, id, html) {
  const matchTag = new RegExp(`<[^>]*id="${id}"[^>]*>`, 'i').exec(html);
  if (matchTag) {
    const tag = matchTag[0];
    if (/\bdisabled\b/i.test(tag)) el.disabled = true;
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
    limpiarDinamicos() {
      for (const [k] of Array.from(dinamicos.entries())) {
        if (!k.startsWith('sgpaConfirm')) dinamicos.delete(k);
      }
    },
    getElementById(id) {
      if (fijos.has(id)) return fijos.get(id);
      if (dinamicos.has(id)) return dinamicos.get(id);
      for (const nombre of ['comparadorPlanesDialogContent', 'transicionCurricularDialogContent', 'sgpaConfirmDialog']) {
        const cont = fijos.get(nombre) || dinamicos.get(nombre);
        if (cont && cont.innerHTML.includes(`id="${id}"`)) {
          if (!dinamicos.has(id)) {
            const el = new MockElement(id, doc);
            inicializarAtributosDesdeHtml(el, id, cont.innerHTML);
            dinamicos.set(id, el);
          }
          return dinamicos.get(id);
        }
      }
      return null;
    },
    buscarTodos(raiz, sel) {
      const matchId = sel.match(/^#([\w-]+)$/);
      if (matchId && raiz.innerHTML.includes(`id="${matchId[1]}"`)) {
        const targetId = matchId[1];
        if (!dinamicos.has(targetId)) {
          const el = new MockElement(targetId, doc);
          inicializarAtributosDesdeHtml(el, targetId, raiz.innerHTML);
          dinamicos.set(targetId, el);
        }
        return [dinamicos.get(targetId)];
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
    querySelectorAll() { return []; },
  };

  for (const id of [
    'planesEstudioPage', 'nuevoPlanButton', 'comparadorPlanesButton',
    'transicionCurricularButton', 'planesBuscar', 'planesCarrera', 'planesEstado',
    'planesContent', 'comparadorPlanesDialog', 'comparadorPlanesDialogContent',
    'transicionCurricularDialog', 'transicionCurricularDialogContent',
  ]) {
    fijos.set(id, new MockElement(id, doc));
  }
  fijos.get('planesEstado').value = 'TODOS';
  return { doc, fijos, dinamicos };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('TRANSICIONES CURRICULARES — CONCURRENCIA, IDENTIDAD DE CONTEXTO Y PERMISOS', async (t) => {
  const origDoc = globalThis.document;
  const origWin = globalThis.window;

  let doc, fijos;
  let llamadasIPC;
  let planesMock;
  let carrerasMock;
  let estudiantesMock;

  function resetEntorno() {
    const entorno = crearEntornoDOM();
    doc = entorno.doc;
    fijos = entorno.fijos;
    globalThis.document = doc;

    llamadasIPC = {
      simulaciones: [],
      ejecuciones: [],
      poblaciones: [],
    };

    planesMock = [
      { id: 101, carreraId: 10, codigo: 'PLAN-A', nombre: 'Plan Origen A', activo: true },
      { id: 102, carreraId: 10, codigo: 'PLAN-B', nombre: 'Plan Destino B', activo: true },
      { id: 103, carreraId: 10, codigo: 'PLAN-C', nombre: 'Plan Destino C', activo: true },
    ];

    carrerasMock = [
      { id: 10, codigo: 'INFO', nombre: 'Informática' },
      { id: 20, codigo: 'ADMIN', nombre: 'Administración' },
    ];

    estudiantesMock = [
      { id: 1, cedula: '1-1111', nombreCompleto: 'Estudiante Uno' },
      { id: 2, cedula: '2-2222', nombreCompleto: 'Estudiante Dos' },
    ];

    globalThis.window = {
      sgpa: {
        listarPlanesEstudio: async () => ({ ok: true, planes: planesMock }),
        listarCarreras: async () => ({ ok: true, carreras: carrerasMock }),
        listarPlanAsignaturas: async () => ({ ok: true, asignaturas: [] }),
        listarEquivalenciasPlanes: async () => ({ ok: true, data: [] }),
        consultarPoblacionTransicion: async (planId, carId) => {
          llamadasIPC.poblaciones.push({ planId, carId });
          return { ok: true, data: estudiantesMock };
        },
        simularTransicionCurricular: async (payload) => {
          llamadasIPC.simulaciones.push(payload);
          return {
            ok: true,
            data: {
              totalAnalizados: payload.estudianteIds.length,
              totalMigrables: payload.estudianteIds.length,
              totalConflictos: 0,
              estudiantes: payload.estudianteIds.map((eid) => ({
                estudianteId: eid,
                cedula: `CED-${eid}`,
                nombreCompleto: `Estudiante ${eid}`,
                puedeMigrar: true,
                conflictos: [],
                asignaturasReconocidas: [],
                asignaturasSinEquivalencia: [],
              })),
            },
          };
        },
        ejecutarTransicionCurricular: async (payload) => {
          llamadasIPC.ejecuciones.push(payload);
          return {
            ok: true,
            data: {
              migrados: payload.estudianteIds.length,
              solicitados: payload.estudianteIds.length,
              fallidos: [],
            },
          };
        },
      },
    };
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Simulación A responde antes que B
    // -------------------------------------------------------------------------
    await t.test('1. Simulación A responde antes que B (orden secuencial)', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();

      // Simulación A hacia Plan B (102)
      doc.getElementById('tcPlanDestinoSelect').change('102');
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      assert.equal(llamadasIPC.simulaciones.length, 1);
      assert.equal(llamadasIPC.simulaciones[0].planDestinoId, 102);

      // Simulación B hacia Plan C (103)
      doc.getElementById('tcPlanDestinoSelect').change('103');
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      assert.equal(llamadasIPC.simulaciones.length, 2);
      assert.equal(llamadasIPC.simulaciones[1].planDestinoId, 103);
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Ejecutar traslado/);
    });

    // -------------------------------------------------------------------------
    // 2. Simulación B responde antes que A (carrera de promesas - out of order)
    // -------------------------------------------------------------------------
    await t.test('2. Simulación B responde antes que A: descarta respuesta obsoleta de A', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      let resolverA, resolverB;
      const promesaA = new Promise((res) => { resolverA = res; });
      const promesaB = new Promise((res) => { resolverB = res; });

      globalThis.window.sgpa.simularTransicionCurricular = async (payload) => {
        llamadasIPC.simulaciones.push(payload);
        if (payload.planDestinoId === 102) return promesaA;
        if (payload.planDestinoId === 103) return promesaB;
      };

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();

      // Dispara A
      doc.getElementById('tcPlanDestinoSelect').change('102');
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      // Dispara B
      doc.getElementById('tcPlanDestinoSelect').change('103');
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      // Resuelve B primero con datos de B
      resolverB({
        ok: true,
        data: {
          totalAnalizados: 1,
          totalMigrables: 1,
          totalConflictos: 0,
          estudiantes: [{ estudianteId: 1, cedula: '1-1111', nombreCompleto: 'Estudiante B', puedeMigrar: true, conflictos: [], asignaturasReconocidas: [], asignaturasSinEquivalencia: [] }],
        },
      });
      await tick();

      // Verifica que B está activo
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Estudiante B/);

      // Ahora resuelve A tarde con datos de A
      resolverA({
        ok: true,
        data: {
          totalAnalizados: 1,
          totalMigrables: 1,
          totalConflictos: 0,
          estudiantes: [{ estudianteId: 1, cedula: '1-1111', nombreCompleto: 'Estudiante A OBSOLETO', puedeMigrar: true, conflictos: [], asignaturasReconocidas: [], asignaturasSinEquivalencia: [] }],
        },
      });
      await tick();

      // La respuesta de A DEBE haber sido descartada
      assert.doesNotMatch(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Estudiante A OBSOLETO/);
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Estudiante B/);
    });

    // -------------------------------------------------------------------------
    // 3. Respuesta tardía de A tras cambiar planes de destino
    // -------------------------------------------------------------------------
    await t.test('3. Respuesta tardía de A tras cambiar destino: no se asigna al nuevo destino', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      let resolverA;
      const promesaA = new Promise((res) => { resolverA = res; });
      globalThis.window.sgpa.simularTransicionCurricular = async (payload) => {
        llamadasIPC.simulaciones.push(payload);
        return promesaA;
      };

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();

      // Dispara A hacia 102
      doc.getElementById('tcPlanDestinoSelect').change('102');
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      // Usuario cambia a plan 103 sin simular aún
      doc.getElementById('tcPlanDestinoSelect').change('103');
      await tick();

      // Resuelve A
      resolverA({
        ok: true,
        data: { totalAnalizados: 2, totalMigrables: 2, totalConflictos: 0, estudiantes: [] },
      });
      await tick();

      // No debe haber quedado ninguna simulación activa para el plan 103
      assert.doesNotMatch(doc.getElementById('transicionCurricularDialogContent').innerHTML, /TOTAL ANALIZADOS/);
    });

    // -------------------------------------------------------------------------
    // 4. Error tardío de A no genera alertas incorrectas
    // -------------------------------------------------------------------------
    await t.test('4. Error tardío de A tras seleccionar otro plan: no muestra alertas erróneas', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      let rechazarA;
      const promesaA = new Promise((_, rej) => { rechazarA = rej; });
      globalThis.window.sgpa.simularTransicionCurricular = async () => promesaA;

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();

      // Dispara A
      doc.getElementById('tcBtnSimular').click();
      await tick();

      // Usuario cambia selección
      doc.getElementById('tcPlanDestinoSelect').change('103');
      await tick();

      // Falla A tardíamente
      rechazarA(new Error('Fallo de red en A'));
      await tick();

      // El diálogo debe seguir en pie sin alerta destructiva
      assert.equal(doc.getElementById('transicionCurricularDialog').open, true);
    });

    // -------------------------------------------------------------------------
    // 5. Cambio de origen invalida simulación vigente
    // -------------------------------------------------------------------------
    await t.test('5. Cambio de plan origen invalida la simulación activa', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /TOTAL ANALIZADOS/);

      // Cambia origen
      doc.getElementById('tcPlanOrigenSelect').change('102');
      await tick();

      // La simulación previa DEBE haber desaparecido
      assert.doesNotMatch(doc.getElementById('transicionCurricularDialogContent').innerHTML, /TOTAL ANALIZADOS/);
    });

    // -------------------------------------------------------------------------
    // 6. Cierre de diálogo invalida simulación pendiente
    // -------------------------------------------------------------------------
    await t.test('6. Cierre del diálogo descarta respuesta tardía pendiente', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      let resolver;
      const lenta = new Promise((res) => { resolver = res; });
      globalThis.window.sgpa.simularTransicionCurricular = async () => lenta;

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      // Cierra diálogo
      doc.getElementById('cerrarTransicionBtn').click();
      await tick();
      assert.equal(doc.getElementById('transicionCurricularDialog').open, false);

      // Resuelve la petición cuando el diálogo está cerrado
      resolver({ ok: true, data: { totalAnalizados: 1, totalMigrables: 1, totalConflictos: 0, estudiantes: [] } });
      await tick();

      // Debe permanecer cerrado
      assert.equal(doc.getElementById('transicionCurricularDialog').open, false);
    });

    // -------------------------------------------------------------------------
    // 7. Ejecución válida con simulación vigente y doble confirmación
    // -------------------------------------------------------------------------
    await t.test('7. Ejecución válida con simulación vigente realiza el traslado completo', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      doc.getElementById('tcMotivoEjecucion').value = 'Resolución institucional aprobada número 12345';
      doc.getElementById('tcBtnEjecutar').click();
      await tick();

      // 1ra confirmación
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();

      // 2da confirmación final
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();

      assert.equal(llamadasIPC.ejecuciones.length, 1);
      assert.equal(llamadasIPC.ejecuciones[0].planOrigenId, 101);
      assert.equal(llamadasIPC.ejecuciones[0].planDestinoId, 102);
      assert.deepEqual(llamadasIPC.ejecuciones[0].estudianteIds, [1, 2]);
      assert.equal(llamadasIPC.ejecuciones[0].motivo, 'Resolución institucional aprobada número 12345');
    });

    // -------------------------------------------------------------------------
    // 8. Cancelación en primera confirmación
    // -------------------------------------------------------------------------
    await t.test('8. Cancelación en 1ra confirmación aborta la ejecución', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      doc.getElementById('tcMotivoEjecucion').value = 'Motivo institucional válido';
      doc.getElementById('tcBtnEjecutar').click();
      await tick();

      // Cancela 1ra confirmación
      doc.getElementById('sgpaConfirmCancel').click();
      await tick();

      assert.equal(llamadasIPC.ejecuciones.length, 0);
    });

    // -------------------------------------------------------------------------
    // 9. Cancelación en segunda confirmación
    // -------------------------------------------------------------------------
    await t.test('9. Cancelación en 2da confirmación aborta la ejecución', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      doc.getElementById('tcMotivoEjecucion').value = 'Motivo institucional válido';
      doc.getElementById('tcBtnEjecutar').click();
      await tick();

      // Acepta 1ra confirmación
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();

      // Cancela 2da confirmación
      doc.getElementById('sgpaConfirmCancel').click();
      await tick();

      assert.equal(llamadasIPC.ejecuciones.length, 0);
    });

    // -------------------------------------------------------------------------
    // 10. Cambio de selección durante confirmación cancela traslado
    // -------------------------------------------------------------------------
    await t.test('10. Cambio de selección durante confirmación cancela la operación', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      doc.getElementById('tcMotivoEjecucion').value = 'Motivo institucional válido';
      doc.getElementById('tcBtnEjecutar').click();
      await tick();

      // Mientras la 1ra confirmación está abierta, cambia el destino
      doc.getElementById('tcPlanDestinoSelect').change('103');
      await tick();

      // Usuario confirma en el modal
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();

      // La ejecución no debe haber procedido
      assert.equal(llamadasIPC.ejecuciones.length, 0);
    });

    // -------------------------------------------------------------------------
    // 11. Prevención de doble pulsación simultánea
    // -------------------------------------------------------------------------
    await t.test('11. Doble clic simultáneo no ejecuta la transición dos veces', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      doc.getElementById('tcMotivoEjecucion').value = 'Motivo institucional válido';

      // Doble pulsación
      doc.getElementById('tcBtnEjecutar').click();
      doc.getElementById('tcBtnEjecutar').click();
      await tick();

      doc.getElementById('sgpaConfirmAccept').click();
      await tick();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();

      assert.equal(llamadasIPC.ejecuciones.length, 1);
    });

    // -------------------------------------------------------------------------
    // 12. Permisos: Administrador autorizado puede ejecutar
    // -------------------------------------------------------------------------
    await t.test('12. Administrador autorizado ve habilitada la ejecución', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      const boton = doc.getElementById('tcBtnEjecutar');
      assert.equal(boton.disabled, false);
      assert.doesNotMatch(boton.style?.display || '', /none/);
    });

    // -------------------------------------------------------------------------
    // 13. Permisos: Rol PROFESOR (modo lectura) tiene acción deshabilitada
    // -------------------------------------------------------------------------
    await t.test('13. Rol PROFESOR (solo lectura): simulación permitida, ejecución bloqueada', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'PROFESOR', rolActivo: 'PROFESOR', permisos: ['PLANES_ESTUDIO_VER'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();

      // Simulación informativa está permitida
      doc.getElementById('tcBtnSimular').click();
      await tick();
      assert.equal(llamadasIPC.simulaciones.length, 1);
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /TOTAL ANALIZADOS/);

      // Botón de ejecución debe estar deshabilitado y en modo consulta
      const boton = doc.getElementById('tcBtnEjecutar');
      assert.equal(boton.disabled, true);
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Modo consulta/);

      // Intento programático de ejecución debe abortar
      boton.click();
      await tick();
      assert.equal(llamadasIPC.ejecuciones.length, 0);
    });

    // -------------------------------------------------------------------------
    // 14. Permisos: Invocación programática sin permiso no abre confirmaciones
    // -------------------------------------------------------------------------
    await t.test('14. Invocación programática sin permiso de gestión no ejecuta IPC', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ASISTENTE', rolActivo: 'ASISTENTE', permisos: ['PLANES_ESTUDIO_VER'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      // Intenta click directo en tcBtnEjecutar
      doc.getElementById('tcBtnEjecutar').click();
      await tick();

      assert.equal(llamadasIPC.ejecuciones.length, 0);
    });

    // -------------------------------------------------------------------------
    // 15. Permisos: Revocación de permisos durante confirmación pendiente
    // -------------------------------------------------------------------------
    await t.test('15. Revocación de permisos durante la confirmación cancela el traslado', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      doc.getElementById('tcMotivoEjecucion').value = 'Motivo institucional válido';
      doc.getElementById('tcBtnEjecutar').click();
      await tick();

      // Revocar permisos en la sesión antes de confirmar
      guardarSesion({ usuario: { rol: 'PROFESOR', rolActivo: 'PROFESOR', permisos: ['PLANES_ESTUDIO_VER'] } });

      // Confirmar en el modal
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();

      assert.equal(llamadasIPC.ejecuciones.length, 0);
    });

    // -------------------------------------------------------------------------
    // 16. Ejecución una única vez: simulación queda invalidada tras el éxito
    // -------------------------------------------------------------------------
    await t.test('16. Ejecución exitosa invalida simulación y requiere nueva simulación para reintentar', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      doc.getElementById('tcMotivoEjecucion').value = 'Motivo institucional';
      doc.getElementById('tcBtnEjecutar').click();
      await tick();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();

      assert.equal(llamadasIPC.ejecuciones.length, 1);

      // Tras la ejecución, el botón de ejecución no debe estar disponible o debe estar deshabilitado
      assert.equal(doc.getElementById('tcBtnEjecutar'), null);
    });

  } finally {
    limpiarSesion();
    globalThis.document = origDoc;
    globalThis.window = origWin;
  }
});

test('CARGA DE POBLACIÓN — CONCURRENCIA Y CICLO DE VIDA (P0)', async (t) => {
  const origDoc = globalThis.document;
  const origWin = globalThis.window;

  let doc, fijos;
  let llamadasIPC;
  let planesMock;
  let carrerasMock;

  function resetEntorno() {
    const entorno = crearEntornoDOM();
    doc = entorno.doc;
    fijos = entorno.fijos;
    globalThis.document = doc;

    llamadasIPC = {
      simulaciones: [],
      ejecuciones: [],
      poblaciones: [],
    };

    planesMock = [
      { id: 101, carreraId: 10, codigo: 'PLAN-A', nombre: 'Plan Origen A', activo: true },
      { id: 102, carreraId: 10, codigo: 'PLAN-B', nombre: 'Plan Destino B', activo: true },
      { id: 201, carreraId: 20, codigo: 'PLAN-X', nombre: 'Plan Carrera 20', activo: true },
    ];

    carrerasMock = [
      { id: 10, codigo: 'INFO', nombre: 'Informática' },
      { id: 20, codigo: 'ADMIN', nombre: 'Administración' },
    ];

    globalThis.window = {
      sgpa: {
        listarPlanesEstudio: async () => ({ ok: true, planes: planesMock }),
        listarCarreras: async () => ({ ok: true, carreras: carrerasMock }),
        listarPlanAsignaturas: async () => ({ ok: true, asignaturas: [] }),
        listarEquivalenciasPlanes: async () => ({ ok: true, data: [] }),
        consultarPoblacionTransicion: async (planId, carId) => {
          llamadasIPC.poblaciones.push({ planId, carId });
          return {
            ok: true,
            data: [
              { id: 1, cedula: '1-1111', nombreCompleto: 'Estudiante Uno' },
              { id: 2, cedula: '2-2222', nombreCompleto: 'Estudiante Dos' },
            ],
          };
        },
        simularTransicionCurricular: async (payload) => {
          llamadasIPC.simulaciones.push(payload);
          return {
            ok: true,
            data: {
              totalAnalizados: payload.estudianteIds.length,
              totalMigrables: payload.estudianteIds.length,
              totalConflictos: 0,
              estudiantes: payload.estudianteIds.map((eid) => ({
                estudianteId: eid,
                cedula: `CED-${eid}`,
                nombreCompleto: `Estudiante ${eid}`,
                puedeMigrar: true,
                conflictos: [],
                asignaturasReconocidas: [],
                asignaturasSinEquivalencia: [],
              })),
            },
          };
        },
        ejecutarTransicionCurricular: async (payload) => {
          llamadasIPC.ejecuciones.push(payload);
          return {
            ok: true,
            data: {
              migrados: payload.estudianteIds.length,
              solicitados: payload.estudianteIds.length,
              fallidos: [],
            },
          };
        },
      },
    };
  }

  try {
    // 1. Población A responde y se muestra correctamente
    await t.test('1. Población A responde y se muestra correctamente', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      await tick();

      assert.equal(llamadasIPC.poblaciones.length, 1);
      assert.equal(llamadasIPC.poblaciones[0].planId, 101);
      assert.equal(llamadasIPC.poblaciones[0].carId, 10);
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Estudiante Uno/);
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Estudiante Dos/);
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Seleccionar todos \(2\)/);
    });

    // 2. Se selecciona A y luego B; B responde primero
    await t.test('2. Se selecciona A y luego B; B responde primero', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      let resolverA, resolverB;
      const promesaA = new Promise((res) => { resolverA = res; });
      const promesaB = new Promise((res) => { resolverB = res; });

      globalThis.window.sgpa.consultarPoblacionTransicion = async (planId, carId) => {
        llamadasIPC.poblaciones.push({ planId, carId });
        if (planId === 101) return promesaA;
        if (planId === 102) return promesaB;
      };

      doc.getElementById('transicionCurricularButton').click();
      await tick();

      // Cargar para 101
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();

      // Cambiar a 102 y cargar
      doc.getElementById('tcPlanOrigenSelect').change('102');
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();

      // B responde primero
      resolverB({
        ok: true,
        data: [
          { id: 201, cedula: 'B-201', nombreCompleto: 'Estudiante B201' },
          { id: 202, cedula: 'B-202', nombreCompleto: 'Estudiante B202' },
        ],
      });
      await tick();
      await tick();

      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Estudiante B201/);
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Estudiante B202/);
    });

    // 3. La respuesta tardía de A no reemplaza la población de B
    await t.test('3. La respuesta tardía de A no reemplaza la población de B', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      let resolverA, resolverB;
      const promesaA = new Promise((res) => { resolverA = res; });
      const promesaB = new Promise((res) => { resolverB = res; });

      globalThis.window.sgpa.consultarPoblacionTransicion = async (planId, carId) => {
        llamadasIPC.poblaciones.push({ planId, carId });
        if (planId === 101) return promesaA;
        if (planId === 102) return promesaB;
      };

      doc.getElementById('transicionCurricularButton').click();
      await tick();

      // Inicia consulta A (101)
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();

      // Cambia a B (102) e inicia consulta B
      doc.getElementById('tcPlanOrigenSelect').change('102');
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();

      // B responde
      resolverB({
        ok: true,
        data: [{ id: 50, cedula: 'B-50', nombreCompleto: 'Estudiante Valido B' }],
      });
      await tick();
      await tick();
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Estudiante Valido B/);

      // Ahora resuelve A tardíamente
      resolverA({
        ok: true,
        data: [{ id: 99, cedula: 'A-99', nombreCompleto: 'Estudiante A OBSOLETO' }],
      });
      await tick();
      await tick();

      // Debe conservar la población de B y descartar la obsoleta de A
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Estudiante Valido B/);
      assert.doesNotMatch(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Estudiante A OBSOLETO/);
    });

    // 4. Un error tardío de A no muestra alertas ni borra B
    await t.test('4. Un error tardío de A no muestra alertas ni borra B', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      let rechazarA, resolverB;
      const promesaA = new Promise((_, rej) => { rechazarA = rej; });
      const promesaB = new Promise((res) => { resolverB = res; });

      globalThis.window.sgpa.consultarPoblacionTransicion = async (planId, carId) => {
        if (planId === 101) return promesaA;
        if (planId === 102) return promesaB;
      };

      doc.getElementById('transicionCurricularButton').click();
      await tick();

      // Inicia A
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();

      // Cambia a B
      doc.getElementById('tcPlanOrigenSelect').change('102');
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();

      resolverB({
        ok: true,
        data: [{ id: 60, cedula: 'B-60', nombreCompleto: 'Estudiante Activo B' }],
      });
      await tick();
      await tick();

      // Falla A tardíamente
      rechazarA(new Error('Fallo de red en A'));
      await tick();
      await tick();

      // La población de B se mantiene y no hay error
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Estudiante Activo B/);
      assert.doesNotMatch(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Fallo de red en A/);
    });

    // 5. Cambiar carrera invalida la población anterior
    await t.test('5. Cambiar carrera invalida la población anterior', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      await tick();

      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Estudiante Uno/);

      // Cambiar carrera a 20
      doc.getElementById('tcCarreraSelect').change('20');
      await tick();

      // La población previa debe estar invalidada
      assert.doesNotMatch(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Estudiante Uno/);
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Consulte la población/);
    });

    // 6. Cambiar origen invalida estudiantes seleccionados
    await t.test('6. Cambiar origen invalida estudiantes seleccionados', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      await tick();

      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Seleccionados: 2/);

      // Cambiar plan origen a 102
      doc.getElementById('tcPlanOrigenSelect').change('102');
      await tick();

      // Los estudiantes seleccionados deben estar limpios
      assert.doesNotMatch(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Seleccionados: 2/);
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Consulte la población/);
    });

    // 7. Cerrar el diálogo descarta respuestas pendientes
    await t.test('7. Cerrar el diálogo descarta respuestas pendientes', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      let resolverPob;
      const promesaPob = new Promise((res) => { resolverPob = res; });
      globalThis.window.sgpa.consultarPoblacionTransicion = async () => promesaPob;

      doc.getElementById('transicionCurricularButton').click();
      await tick();

      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();

      // Cerrar diálogo mientras está pendiente
      doc.getElementById('transicionCurricularDialog').close();
      await tick();

      resolverPob({
        ok: true,
        data: [{ id: 999, cedula: '9-9999', nombreCompleto: 'Estudiante Fantasma' }],
      });
      await tick();
      await tick();

      // No debe inyectar datos en el diálogo cerrado
      assert.doesNotMatch(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Estudiante Fantasma/);
    });

    // 8. Reabrir el diálogo no reutiliza población de una instancia antigua
    await t.test('8. Reabrir el diálogo no reutiliza población de una instancia antigua', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      // Instancia 1
      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      await tick();
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Estudiante Uno/);

      doc.getElementById('transicionCurricularDialog').close();
      await tick();

      // Instancia 2: Reabrir
      doc.getElementById('transicionCurricularButton').click();
      await tick();

      // La nueva instancia debe iniciar limpia sin población heredada
      assert.doesNotMatch(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Estudiante Uno/);
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Consulte la población/);
    });

    // 9. No puede iniciarse una simulación con estudiantes obsoletos
    await t.test('9. No puede iniciarse una simulación con estudiantes obsoletos', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      await tick();

      // Cambiar plan origen a 102 sin volver a consultar población
      doc.getElementById('tcPlanOrigenSelect').change('102');
      await tick();

      // Intentar simular
      doc.getElementById('tcBtnSimular').click();
      await tick();

      // Simulación NO debe ejecutarse hacia el backend
      assert.equal(llamadasIPC.simulaciones.length, 0);
    });

  } finally {
    limpiarSesion();
    globalThis.document = origDoc;
    globalThis.window = origWin;
  }
});

test('EJECUCIÓN DE TRANSICIÓN — CICLO DE VIDA Y CIERRE DE DIÁLOGO (P0)', async (t) => {
  const origDoc = globalThis.document;
  const origWin = globalThis.window;

  let doc, fijos;
  let llamadasIPC;
  let planesMock;
  let carrerasMock;

  function resetEntorno() {
    const entorno = crearEntornoDOM();
    doc = entorno.doc;
    fijos = entorno.fijos;
    globalThis.document = doc;

    llamadasIPC = {
      simulaciones: [],
      ejecuciones: [],
      poblaciones: [],
    };

    planesMock = [
      { id: 101, carreraId: 10, codigo: 'PLAN-A', nombre: 'Plan Origen A', activo: true },
      { id: 102, carreraId: 10, codigo: 'PLAN-B', nombre: 'Plan Destino B', activo: true },
    ];

    carrerasMock = [
      { id: 10, codigo: 'INFO', nombre: 'Informática' },
    ];

    globalThis.window = {
      sgpa: {
        listarPlanesEstudio: async () => ({ ok: true, planes: planesMock }),
        listarCarreras: async () => ({ ok: true, carreras: carrerasMock }),
        listarPlanAsignaturas: async () => ({ ok: true, asignaturas: [] }),
        listarEquivalenciasPlanes: async () => ({ ok: true, data: [] }),
        consultarPoblacionTransicion: async (planId, carId) => {
          llamadasIPC.poblaciones.push({ planId, carId });
          return {
            ok: true,
            data: [
              { id: 1, cedula: '1-1111', nombreCompleto: 'Estudiante Uno' },
              { id: 2, cedula: '2-2222', nombreCompleto: 'Estudiante Dos' },
            ],
          };
        },
        simularTransicionCurricular: async (payload) => {
          llamadasIPC.simulaciones.push(payload);
          return {
            ok: true,
            data: {
              totalAnalizados: payload.estudianteIds.length,
              totalMigrables: payload.estudianteIds.length,
              totalConflictos: 0,
              estudiantes: payload.estudianteIds.map((eid) => ({
                estudianteId: eid,
                cedula: `CED-${eid}`,
                nombreCompleto: `Estudiante ${eid}`,
                puedeMigrar: true,
                conflictos: [],
                asignaturasReconocidas: [],
                asignaturasSinEquivalencia: [],
              })),
            },
          };
        },
        ejecutarTransicionCurricular: async (payload) => {
          llamadasIPC.ejecuciones.push(payload);
          return {
            ok: true,
            data: {
              migrados: payload.estudianteIds.length,
              solicitados: payload.estudianteIds.length,
              fallidos: [],
            },
          };
        },
      },
    };
  }

  try {
    // 1. Ejecución exitosa con el diálogo abierto
    await t.test('1. Ejecución exitosa con el diálogo abierto', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      await tick();

      doc.getElementById('tcBtnSimular').click();
      await tick();

      doc.getElementById('tcMotivoEjecucion').value = 'Motivo de traslado válido';
      doc.getElementById('tcBtnEjecutar').click();
      await tick();

      doc.getElementById('sgpaConfirmAccept').click();
      await tick();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();
      await tick();

      assert.equal(llamadasIPC.ejecuciones.length, 1);
      assert.equal(llamadasIPC.ejecuciones[0].planOrigenId, 101);
      assert.equal(llamadasIPC.ejecuciones[0].planDestinoId, 102);
      assert.deepEqual(llamadasIPC.ejecuciones[0].estudianteIds, [1, 2]);
    });

    // 2 y 3. Cierre mientras la ejecución está pendiente y respuesta exitosa después de cerrar
    await t.test('2 y 3. Cierre mientras la ejecución está pendiente y respuesta exitosa después de cerrar', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      let resolverEjecucion;
      const promesaEjecucion = new Promise((res) => { resolverEjecucion = res; });
      globalThis.window.sgpa.ejecutarTransicionCurricular = async (payload) => {
        llamadasIPC.ejecuciones.push(payload);
        return promesaEjecucion;
      };

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      await tick();

      doc.getElementById('tcBtnSimular').click();
      await tick();

      doc.getElementById('tcMotivoEjecucion').value = 'Motivo de prueba pendiente';
      doc.getElementById('tcBtnEjecutar').click();
      await tick();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();

      assert.equal(llamadasIPC.ejecuciones.length, 1);

      // Cerrar el diálogo mientras la promesa de ejecución está en vuelo
      doc.getElementById('transicionCurricularDialog').close();
      await tick();
      assert.equal(fijos.get('transicionCurricularDialog').open, false);

      // Servidor responde exitosamente
      resolverEjecucion({
        ok: true,
        data: { migrados: 2, solicitados: 2, fallidos: [] },
      });
      await tick();
      await tick();

      // Diálogo permanece cerrado
      assert.equal(fijos.get('transicionCurricularDialog').open, false);
    });

    // 4. Error después de cerrar
    await t.test('4. Error después de cerrar no muestra alerta errónea', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      let rechazarEjecucion;
      const promesaEjecucion = new Promise((_, rej) => { rechazarEjecucion = rej; });
      globalThis.window.sgpa.ejecutarTransicionCurricular = async (payload) => {
        llamadasIPC.ejecuciones.push(payload);
        return promesaEjecucion;
      };

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      await tick();

      doc.getElementById('tcBtnSimular').click();
      await tick();

      doc.getElementById('tcMotivoEjecucion').value = 'Motivo de prueba con error';
      doc.getElementById('tcBtnEjecutar').click();
      await tick();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();

      // Cerrar mientras está pendiente
      doc.getElementById('transicionCurricularDialog').close();
      await tick();

      // Falla en el backend
      rechazarEjecucion(new Error('Fallo crítico en base de datos'));
      await tick();
      await tick();

      assert.equal(fijos.get('transicionCurricularDialog').open, false);
    });

    // 5, 6, 7 y 8. Cierre y reapertura antes de respuesta
    await t.test('5, 6, 7 y 8. Cierre y reapertura antes de respuesta: instancia nueva aislada sin alertas ni datos antiguos', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      let resolverInstancia1;
      const promesa1 = new Promise((res) => { resolverInstancia1 = res; });
      globalThis.window.sgpa.ejecutarTransicionCurricular = async (payload) => {
        llamadasIPC.ejecuciones.push(payload);
        return promesa1;
      };

      // Instancia 1
      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      doc.getElementById('tcMotivoEjecucion').value = 'Motivo instancia 1';
      doc.getElementById('tcBtnEjecutar').click();
      await tick();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();

      assert.equal(llamadasIPC.ejecuciones.length, 1);

      // Cierra instancia 1
      doc.getElementById('transicionCurricularDialog').close();
      await tick();

      // Abre Instancia 2
      doc.getElementById('transicionCurricularButton').click();
      await tick();

      // Resuelve la petición de la Instancia 1 tardíamente mientras la Instancia 2 está abierta
      resolverInstancia1({
        ok: true,
        data: { migrados: 2, solicitados: 2, fallidos: [] },
      });
      await tick();
      await tick();

      // La Instancia 2 no debe haber sido modificada con el resumen de la instancia 1
      assert.doesNotMatch(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Traslado procesado: 2\/2/);
      assert.match(doc.getElementById('transicionCurricularDialogContent').innerHTML, /Consulte la población/);
    });

    // 9. Prevención de doble ejecución entre cierre y reapertura
    await t.test('9. Prevención de doble ejecución entre cierre y reapertura mientras hay solicitud pendiente', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      let resolverPendiente;
      const promesaPendiente = new Promise((res) => { resolverPendiente = res; });
      globalThis.window.sgpa.ejecutarTransicionCurricular = async (payload) => {
        llamadasIPC.ejecuciones.push(payload);
        return promesaPendiente;
      };

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      doc.getElementById('tcMotivoEjecucion').value = 'Motivo intento 1';
      doc.getElementById('tcBtnEjecutar').click();
      await tick();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();

      assert.equal(llamadasIPC.ejecuciones.length, 1);

      // Cerrar y reabrir de inmediato
      doc.getElementById('transicionCurricularDialog').close();
      await tick();
      doc.getElementById('transicionCurricularButton').click();
      await tick();

      // El botón ejecutar en la nueva instancia no permite enviar si hay solicitud global en vuelo
      const btnEjecutarInstancia2 = doc.getElementById('tcBtnEjecutar');
      assert.equal(btnEjecutarInstancia2, null);

      // Liberar la petición pendiente
      resolverPendiente({ ok: true, data: { migrados: 2, solicitados: 2, fallidos: [] } });
      await tick();
      await tick();
    });

    // 10 y 11. Recuperación del estado y verificación de parámetros originales
    await t.test('10 y 11. Recuperación del estado y verificación de parámetros originales', async () => {
      resetEntorno();
      guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL', permisos: ['PLANES_ESTUDIO_GESTIONAR'] } });
      iniciarPlanesEstudioPage();
      await tick();

      doc.getElementById('transicionCurricularButton').click();
      await tick();
      doc.getElementById('tcBtnCargarPoblacion').click();
      await tick();
      await tick();
      doc.getElementById('tcBtnSimular').click();
      await tick();

      doc.getElementById('tcMotivoEjecucion').value = 'Traslado formal extraordinario';
      doc.getElementById('tcBtnEjecutar').click();
      await tick();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();
      doc.getElementById('sgpaConfirmAccept').click();
      await tick();
      await tick();

      // Verificación de parámetros originales enviados
      assert.equal(llamadasIPC.ejecuciones.length, 1);
      const ejecucion = llamadasIPC.ejecuciones[0];
      assert.equal(ejecucion.carreraId, 10);
      assert.equal(ejecucion.planOrigenId, 101);
      assert.equal(ejecucion.planDestinoId, 102);
      assert.deepEqual(ejecucion.estudianteIds, [1, 2]);
      assert.equal(ejecucion.motivo, 'Traslado formal extraordinario');
    });

  } finally {
    limpiarSesion();
    globalThis.document = origDoc;
    globalThis.window = origWin;
  }
});
