/* =========================================================
   SGPA — MÓDULO CURSOS: FUNCIONES PURAS Y HELPERS
   frontend/src/pages/cursos/cursos.helpers.js
   ========================================================= */

export const CURSOS_POR_PAGINA = 10;

/* =========================================================
   ORDENAMIENTO
   ========================================================= */

export function compararCursosPorEstadoYCodigo(a, b) {
  if (a?.activo !== b?.activo) {
    return a?.activo === true ? -1 : 1;
  }

  return String(a?.codigo ?? '').localeCompare(
    String(b?.codigo ?? ''),
    'es',
    {
      numeric: true,
      sensitivity: 'base',
    },
  );
}

/* =========================================================
   PAGINACIÓN
   ========================================================= */

export function calcularPaginacionCursos(totalCursos, paginaSolicitada = 1) {
  const total = Number.isFinite(Number(totalCursos))
    ? Math.max(0, Math.floor(Number(totalCursos)))
    : 0;
  const totalPaginas = Math.max(1, Math.ceil(total / CURSOS_POR_PAGINA));
  const solicitada = Number(paginaSolicitada);
  const pagina = Number.isInteger(solicitada)
    ? Math.min(totalPaginas, Math.max(1, solicitada))
    : 1;
  const inicio = (pagina - 1) * CURSOS_POR_PAGINA;
  const fin = Math.min(inicio + CURSOS_POR_PAGINA, total);

  const cantidadVisible = Math.min(totalPaginas, 5);
  const primeraVisible = Math.max(
    1,
    Math.min(pagina - 2, totalPaginas - cantidadVisible + 1),
  );
  const paginasVisibles = Array.from(
    { length: cantidadVisible },
    (_, indice) => primeraVisible + indice,
  );

  return { total, pagina, totalPaginas, inicio, fin, paginasVisibles };
}

/* =========================================================
   FILTRADO DE CURSOS
   ========================================================= */

export function filtrarCursos(
  cursos = [],
  { busqueda = '', estado = 'TODOS' } = {},
) {
  const termino = String(busqueda ?? '').trim().toLowerCase();
  const estadoFiltro = String(estado ?? 'TODOS').toUpperCase();

  return (Array.isArray(cursos) ? cursos : [])
    .filter((curso) => {
      const coincideBusqueda =
        !termino ||
        [
          curso?.codigo,
          curso?.nombre,
          curso?.descripcion,
        ]
          .filter(Boolean)
          .some((valor) =>
            String(valor)
              .toLowerCase()
              .includes(termino),
          );

      let coincideEstado = true;

      if (estadoFiltro === 'ACTIVOS') {
        coincideEstado = curso?.activo === true;
      }

      if (estadoFiltro === 'INACTIVOS') {
        coincideEstado = curso?.activo === false;
      }

      return coincideBusqueda && coincideEstado;
    })
    .sort(compararCursosPorEstadoYCodigo);
}

/* =========================================================
   CÁLCULOS Y RELACIONES ACADÉMICAS
   ========================================================= */

export function obtenerCreditosCurso(curso, asignaturaPlan = null) {
  const valor =
    asignaturaPlan?.creditos ??
    curso?.creditos ??
    curso?.planAsignatura?.creditos ??
    0;

  return Number(valor || 0);
}

export function obtenerCarreraCursoIds(curso) {
  if (!Array.isArray(curso?.carreras)) {
    return [];
  }

  return curso.carreras
    .map((carrera) => Number(carrera.id))
    .filter((id) => Number.isInteger(id) && id > 0);
}

export function cursoPerteneceACarrera(
  curso,
  carreraId,
  asignaturasPlan = [],
) {
  const id = Number(carreraId);

  if (!Number.isInteger(id) || id < 1) {
    return false;
  }

  if (obtenerCarreraCursoIds(curso).includes(id)) {
    return true;
  }

  return asignaturasPlan.some((asignatura) => {
    if (
      asignatura?.cursoId !== null &&
      asignatura?.cursoId !== undefined
    ) {
      return Number(asignatura.cursoId) === Number(curso.id);
    }

    const codigoAsignatura =
      asignatura?.codigoReferencia ||
      asignatura?.curso?.codigo ||
      "";

    return (
      codigoAsignatura &&
      String(codigoAsignatura).toUpperCase() ===
        String(curso?.codigo || "").toUpperCase()
    );
  });
}

export function encontrarAsignaturaPlanCurso(
  curso,
  asignaturasPlan = [],
) {
  const porId = asignaturasPlan.find(
    (asignatura) =>
      Number(asignatura?.cursoId) === Number(curso?.id),
  );

  if (porId) {
    return porId;
  }

  const codigoCurso =
    String(curso?.codigo || "")
      .trim()
      .toUpperCase();

  if (!codigoCurso) {
    return null;
  }

  return (
    asignaturasPlan.find((asignatura) => {
      const codigo =
        asignatura?.codigoReferencia ||
        asignatura?.curso?.codigo ||
        "";

      return (
        String(codigo).trim().toUpperCase() ===
        codigoCurso
      );
    }) || null
  );
}

export function obtenerRequisitosCurso(
  curso,
  asignaturasPlan = [],
  requisitosPlan = [],
) {
  const asignatura =
    encontrarAsignaturaPlanCurso(
      curso,
      asignaturasPlan,
    );

  if (!asignatura) {
    return [];
  }

  return requisitosPlan
    .filter(
      (relacion) =>
        Number(relacion.asignaturaId) ===
        Number(asignatura.id),
    )
    .map((relacion) => {
      const requisito =
        asignaturasPlan.find(
          (item) =>
            Number(item.id) ===
            Number(
              relacion.requisitoAsignaturaId,
            ),
        ) ||
        relacion.requisitoAsignatura ||
        null;

      const codigo =
        requisito?.codigoReferencia ||
        requisito?.curso?.codigo ||
        "SIN CÓDIGO";

      const nombre =
        requisito?.nombreReferencia ||
        requisito?.curso?.nombre ||
        "Asignatura no disponible";

      return {
        relacionId: relacion.id,
        tipo:
          relacion.tipo === "CORREQUISITO"
            ? "CORREQUISITO"
            : "REQUISITO",
        codigo,
        nombre,
        creditos:
          Number(requisito?.creditos || 0),
        nivel:
          requisito?.nivel ?? null,
        ciclo:
          requisito?.ciclo ?? null,
      };
    });
}
