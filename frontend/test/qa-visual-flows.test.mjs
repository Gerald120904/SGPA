import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { agruparAsignaturasVistaPrevia } from '../src/pages/formularios-estudiantes/FormulariosEstudiantesPage.js';
import { crearContextoPlanesEstudio } from '../src/pages/planes-estudio/planes-estudio.context.js';

test('la vista previa conserva nombres, códigos, año y ciclo reales', () => {
  const cursos = [
    { id: 1, nivel: 1, ciclo: 1, orden: 2, curso: { nombre: 'Matemática General', codigo: 'MAT101' } },
    { id: 2, nivel: 1, ciclo: 1, orden: 1, curso: { nombre: 'Programación I', codigo: 'EIF101' } },
    { id: 3, nivel: 2, ciclo: 2, orden: 1, curso: { nombre: 'Bases de Datos', codigo: 'EIF201' } },
  ];
  const grupos = agruparAsignaturasVistaPrevia(cursos);
  assert.deepEqual(grupos.get(1).get(1), cursos.slice(0, 2));
  assert.deepEqual(grupos.get(2).get(2), [cursos[2]]);
  assert.match(readFileSync(new URL('../src/pages/formularios-estudiantes/FormulariosEstudiantesPage.js', import.meta.url), 'utf8'), /escapeHtml\(asignatura\.curso\?\.nombre \|\| asignatura\.nombreReferencia/);
});

test('el módulo de requisitos agrega y elimina relaciones conservando el contexto y el diálogo', async () => {
  const fuente = readFileSync(new URL('../src/pages/planes-estudio/PlanRequisitosDialog.js', import.meta.url), 'utf8');
  const extraer = (inicio, fin) => {
    const desde = fuente.indexOf(inicio);
    const hasta = fin ? fuente.indexOf(fin, desde) : fuente.length;
    assert.ok(desde >= 0 && (hasta > desde || !fin), `No se encontró ${inicio}`);
    return fuente.slice(desde, hasta);
  };
  const funciones = [
    extraer('export function actualizarListaRequisitos(', 'export function abrirFormularioRequisitos('),
    extraer('export async function agregarRequisitoFrontend(', 'export async function eliminarRequisitoFrontend('),
    extraer('export async function eliminarRequisitoFrontend(', 'export async function recargarRequisitosPlan('),
  ].join('\n').replaceAll('export function ', 'function ').replaceAll('export async function ', 'async function ');

  const contexto = crearContextoPlanesEstudio();
  const plan = { id: 7, nombre: 'Plan vigente' };
  const asignatura = { id: 1, curso: { codigo: 'MAT101', nombre: 'Matemática' } };
  const relacionada = { id: 2, curso: { codigo: 'MAT102', nombre: 'Álgebra' } };
  Object.assign(contexto.estado, {
    planSeleccionado: plan,
    asignaturasPlan: [asignatura, relacionada],
    requisitosPlan: [],
  });

  const elements = {
    requisitosFormError: { textContent: '', classList: { add() {}, remove() {} } },
    agregarRequisitoButton: { disabled: false, isConnected: true, focus() { this.focused = true; } },
    requisitoTipo: { value: 'REQUISITO' },
    requisitoAsignatura: { value: '2', focused: false, focus() { this.focused = true; } },
    asignaturaDialog: { open: true },
  };
  const lista = { innerHTML: '' };
  const contador = { textContent: '0' };
  const llamadas = { crear: [], eliminar: [], exito: [], recargar: 0 };
  let permitir = true;
  const document = {
    getElementById: (id) => elements[id] || null,
    querySelector: (selector) => selector.endsWith('.plan-requirements-list') ? lista : selector.endsWith('.plan-requirements-count') ? contador : null,
  };
  const sandbox = vm.createContext({
    document,
    puedeGestionarPlanes: () => permitir,
    esAsistente: () => false,
    obtenerRequisitosDeAsignatura: (id, relaciones = contexto.estado.requisitosPlan) => relaciones.filter((item) => Number(item.asignaturaId) === Number(id)),
    obtenerDatosAsignatura: (item) => item.curso || item,
    escapeHtml: (value) => String(value),
    renderizarIconos() {},
    mostrarExito: (mensaje) => llamadas.exito.push(mensaje),
    confirmarAccion: async () => true,
    crearPlanRequisito: async (planId, datos) => {
      llamadas.crear.push({ planId, ...datos });
      const relacion = { id: 15, ...datos };
      contexto.estado.requisitosPlan.push(relacion);
      return { ok: true };
    },
    eliminarPlanRequisito: async (planId, id) => {
      llamadas.eliminar.push({ planId, id });
      contexto.estado.requisitosPlan = contexto.estado.requisitosPlan.filter((item) => Number(item.id) !== Number(id));
      return { ok: true };
    },
    proponerRequisitoPlan: async () => ({ ok: true }),
    proponerEliminarRequisitoPlan: async () => ({ ok: true }),
  });
  vm.runInContext(`${funciones}\nglobalThis.requisitos = { agregarRequisitoFrontend, eliminarRequisitoFrontend };`, sandbox);

  const onRecargar = async (opciones) => {
    assert.equal(opciones.preservarDialogo, true);
    llamadas.recargar++;
  };
  await sandbox.requisitos.agregarRequisitoFrontend(asignatura, contexto, { onRecargar });

  assert.deepEqual(llamadas.crear, [{ planId: 7, asignaturaId: 1, requisitoAsignaturaId: 2, tipo: 'REQUISITO' }]);
  assert.equal(contexto.estado.planSeleccionado, plan);
  assert.equal(contexto.obtenerAsignaturaPorId(1), asignatura);
  assert.equal(contador.textContent, '1');
  assert.match(lista.innerHTML, /MAT102 - Álgebra/);
  assert.equal(elements.asignaturaDialog.open, true);
  assert.equal(elements.requisitoAsignatura.value, '2');
  assert.equal(elements.agregarRequisitoButton.focused, true);
  assert.equal(llamadas.exito[0].titulo, 'Relación agregada');
  assert.equal(llamadas.recargar, 1);

  await sandbox.requisitos.eliminarRequisitoFrontend(15, asignatura, contexto, { onRecargar });
  assert.deepEqual(llamadas.eliminar, [{ planId: 7, id: 15 }]);
  assert.equal(contador.textContent, '0');
  assert.match(lista.innerHTML, /Sin relaciones académicas/);
  assert.equal(elements.asignaturaDialog.open, true);
  assert.equal(elements.requisitoAsignatura.focused, true);
  assert.equal(contexto.estado.planSeleccionado, plan);

  permitir = false;
  const feedback = [];
  await sandbox.requisitos.agregarRequisitoFrontend(asignatura, contexto, { onFeedback: (message) => feedback.push(message) });
  assert.equal(llamadas.crear.length, 1);
  assert.deepEqual(feedback, ['No posee permiso para modificar el plan.']);
});

test('el detalle de Aulas no expone controles de reservas', () => {
  const fuente = readFileSync(new URL('../src/pages/aulas/AulasPage.js', import.meta.url), 'utf8');
  const detalle = fuente.split('async function abrirDetalleAula(')[1].split('function renderizarEquipamientoDelAula')[0];
  assert.doesNotMatch(detalle, /nuevaReservaAulaButton|data-reserva-action|Reservas extraordinarias/);
  assert.match(fuente, /function renderizarSeccionOcupacion/);
});
