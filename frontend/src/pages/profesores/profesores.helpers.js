/**
 * SGPA — Funciones puras, formateadores y constantes del módulo Profesores.
 * FRONTEND-REF-MASTER
 */

export const NOMBRES_DIA = Object.freeze({
  LUNES: 'Lunes',
  MARTES: 'Martes',
  MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves',
  VIERNES: 'Viernes',
  SABADO: 'Sábado',
  DOMINGO: 'Domingo',
});

export const ORDEN_DIA = Object.freeze({
  LUNES: 1,
  MARTES: 2,
  MIERCOLES: 3,
  JUEVES: 4,
  VIERNES: 5,
  SABADO: 6,
  DOMINGO: 7,
});

export const NOMBRES_ESTADO_PROFESOR = Object.freeze({
  PENDIENTE: 'Pendiente',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  INACTIVO: 'Inactivo',
});

export const NOMBRES_TIPO_ATESTADO = Object.freeze({
  TITULO_ACADEMICO: 'Título académico',
  CERTIFICACION: 'Certificación',
  EXPERIENCIA_DOCENTE: 'Experiencia docente',
  EXPERIENCIA_PROFESIONAL: 'Experiencia profesional',
  CAPACITACION: 'Capacitación',
  OTRO: 'Otro',
});

export const NOMBRES_TIPO_REQUISITO = Object.freeze({
  FORMACION_ACADEMICA: 'Formación académica',
  IDIOMA_INSTRUMENTAL: 'Idioma instrumental',
  EXPERIENCIA_DOCENTE: 'Experiencia docente',
  GRADO_COMPLEMENTARIO: 'Grado complementario',
  IDIOMA_GLOBAL: 'Idioma global',
  EXPERIENCIA_PROFESIONAL: 'Experiencia profesional',
  CAPACITACIONES: 'Capacitaciones',
  OTROS: 'Otros requisitos',
  JORNADA: 'Jornada',
  HORARIO: 'Horario',
  CAMPUS: 'Campus',
});

export function obtenerNombreCompleto(profesor) {
  return [
    profesor?.nombres,
    profesor?.apellido1,
    profesor?.apellido2,
  ]
    .filter(Boolean)
    .join(' ');
}

export function obtenerCarreras(profesor) {
  return Array.isArray(profesor?.carreras) ? profesor.carreras : [];
}

export function obtenerPerfiles(profesor) {
  return Array.isArray(profesor?.perfilesAcademicos) ? profesor.perfilesAcademicos : [];
}

export function obtenerCursos(profesor) {
  return Array.isArray(profesor?.cursosHabilitados) ? profesor.cursosHabilitados : [];
}

export function nombreEstadoProfesor(estado) {
  return NOMBRES_ESTADO_PROFESOR[estado] || estado || '—';
}

export function nombreTipoAtestado(tipo) {
  return NOMBRES_TIPO_ATESTADO[tipo] || tipo || '—';
}

export function nombreTipoRequisito(tipo) {
  return NOMBRES_TIPO_REQUISITO[tipo] || tipo;
}

export function tonoCumplimiento(estado) {
  switch (estado) {
    case 'CUMPLE':
      return 'success';
    case 'NO_CUMPLE':
      return 'danger';
    case 'NO_APLICA':
      return 'neutral';
    default:
      return 'warning';
  }
}

export function nombreEstadoDisponibilidad(estado) {
  const estados = {
    PENDIENTE: 'Pendiente',
    REGISTRADA: 'Registrada',
    BLOQUEADA: 'Bloqueada',
  };
  return estados[estado] || estado || 'Pendiente';
}

export function seleccionarPeriodoInicial(periodos) {
  if (!Array.isArray(periodos) || !periodos.length) {
    return null;
  }
  return (
    periodos.find((periodo) => periodo.estado === 'EN_PREPARACION') ||
    periodos.find((periodo) => periodo.estado === 'EN_CURSO') ||
    periodos.find((periodo) => periodo.estado === 'BORRADOR') ||
    periodos[0] ||
    null
  );
}

export function filtrarListaProfesores(profesores = [], busqueda = '') {
  const query = String(busqueda || '').trim().toLowerCase();
  if (!query) return profesores;

  return profesores.filter((profesor) => {
    const nombre = obtenerNombreCompleto(profesor).toLowerCase();
    const cedula = String(profesor?.cedula ?? '').toLowerCase();
    const email = String(profesor?.email ?? '').toLowerCase();
    const carreras = obtenerCarreras(profesor)
      .map((c) => String(c.nombre || c.codigo || '').toLowerCase())
      .join(' ');

    return (
      nombre.includes(query) ||
      cedula.includes(query) ||
      email.includes(query) ||
      carreras.includes(query)
    );
  });
}

export function obtenerPeriodoAnteriorDisponibilidad(destino, periodos = []) {
  if (!destino) {
    return null;
  }

  let anioOrigen;
  let cicloOrigen;

  if (destino.ciclo === 2) {
    anioOrigen = destino.anio;
    cicloOrigen = 1;
  } else if (destino.ciclo === 3) {
    anioOrigen = destino.anio;
    cicloOrigen = 2;
  } else if (destino.ciclo === 1) {
    anioOrigen = destino.anio - 1;
    cicloOrigen = 3;
  } else {
    return null;
  }

  return (
    periodos.find(
      (periodo) =>
        periodo.anio === anioOrigen &&
        periodo.ciclo === cicloOrigen,
    ) || null
  );
}

export function validarBloquesDisponibilidad(bloques = []) {
  for (const bloque of bloques) {
    if (bloque.horaFin <= bloque.horaInicio) {
      return `El bloque del ${
        NOMBRES_DIA[bloque.dia] || 'día'
      } debe terminar después de la hora de inicio.`;
    }
  }

  const porDia = new Map();

  bloques.forEach((bloque) => {
    const actuales = porDia.get(bloque.dia) || [];
    actuales.push(bloque);
    porDia.set(bloque.dia, actuales);
  });

  for (const [dia, bloquesDia] of porDia) {
    const ordenados = [...bloquesDia].sort((a, b) =>
      a.horaInicio.localeCompare(b.horaInicio),
    );

    for (let i = 1; i < ordenados.length; i += 1) {
      if (ordenados[i].horaInicio < ordenados[i - 1].horaFin) {
        return `Existen bloques superpuestos el ${
          NOMBRES_DIA[dia] || 'día'
        }.`;
      }
    }
  }

  return null;
}
