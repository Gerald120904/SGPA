/**
 * SGPA — Funciones puras de validación, transformación y vista previa de Formularios de Estudiantes.
 * FRONTEND-REF-MASTER
 */

export const LIMITES_FORMULARIO = Object.freeze({ titulo: 255, descripcion: 1000 });
export const MODALIDADES_FORMULARIO = new Set(['INTERNO', 'GOOGLE_FORMS']);

export const CAMPOS_FORMULARIO = Object.freeze({
  proveedor: 'formularioProveedor',
  titulo: 'formularioTitulo',
  descripcion: 'formularioDescripcion',
  carreraId: 'formularioCarrera',
  planEstudioId: 'formularioPlan',
});

export function validarDatosNuevoFormulario(datos = {}) {
  const errores = {};
  const proveedor = String(datos.proveedor ?? '').trim();
  const titulo = String(datos.titulo ?? '').trim();
  const descripcion = String(datos.descripcion ?? '').trim();
  const carreraId = Number(datos.carreraId);
  const planEstudioId = Number(datos.planEstudioId);

  if (!proveedor) errores.proveedor = 'Seleccione una modalidad del formulario.';
  else if (!MODALIDADES_FORMULARIO.has(proveedor)) {
    errores.proveedor = 'Seleccione una modalidad válida.';
  }

  if (!titulo) errores.titulo = 'El título del formulario es obligatorio.';
  else if (titulo.length > LIMITES_FORMULARIO.titulo) {
    errores.titulo = 'El título no puede superar 255 caracteres.';
  }

  if (!descripcion) errores.descripcion = 'La descripción es obligatoria.';
  else if (descripcion.length > LIMITES_FORMULARIO.descripcion) {
    errores.descripcion = 'La descripción no puede superar 1000 caracteres.';
  }

  if (!Number.isSafeInteger(carreraId) || carreraId <= 0) {
    errores.carreraId = 'Seleccione una carrera.';
  }
  if (!Number.isSafeInteger(planEstudioId) || planEstudioId <= 0) {
    errores.planEstudioId = 'Seleccione un plan de estudio.';
  }

  return { valido: Object.keys(errores).length === 0, errores };
}

export function construirDatosCrearFormulario({
  titulo,
  descripcion,
  carreraId,
  planEstudioId,
  proveedor,
}) {
  if (proveedor !== 'INTERNO' && proveedor !== 'GOOGLE_FORMS') {
    throw new Error('Seleccione una modalidad de formulario válida.');
  }

  return { titulo, descripcion, carreraId, planEstudioId, proveedor };
}

export function asignaturasElegiblesParaFormulario(asignaturas = [], proveedor) {
  return asignaturas.filter(
    (asignatura) =>
      asignatura.activo === true &&
      ((asignatura.cursoId != null && asignatura.curso != null) ||
        (proveedor === 'INTERNO' && Boolean(asignatura.codigoReferencia?.trim()))),
  );
}

export function agruparAsignaturasVistaPrevia(asignaturas = []) {
  const estructura = new Map();
  asignaturas.forEach((asignatura) => {
    const nivel = Number(asignatura.nivel);
    const ciclo = Number(asignatura.ciclo);
    const ciclosNivel = estructura.get(nivel) || new Map();
    const cursosCiclo = ciclosNivel.get(ciclo) || [];
    cursosCiclo.push(asignatura);
    ciclosNivel.set(ciclo, cursosCiclo);
    estructura.set(nivel, ciclosNivel);
  });
  return estructura;
}
