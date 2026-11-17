/**
 * SGPA — Funciones auxiliares, tipos, constantes y ordenamiento del módulo Aulas.
 * FRONTEND-REF-MASTER
 */

export const TIPOS_AULA = Object.freeze({
  AULA: 'Aula',
  LABORATORIO: 'Laboratorio',
  AUDITORIO: 'Auditorio',
  SALA: 'Sala',
  VIRTUAL: 'Virtual',
});

export const TIPOS_MOBILIARIO = Object.freeze({
  PUPITRE: 'Pupitre',
  MESA_INDIVIDUAL: 'Mesa individual',
  MESA_GRUPAL: 'Mesa grupal',
  MESA_COMPUTADORA: 'Mesa para computadora',
  BUTACA: 'Butaca',
  SIN_MOBILIARIO: 'Sin mobiliario',
  SIN_ESPECIFICAR: 'Sin especificar',
});

export const ORIGENES_AULA = Object.freeze({
  UNA: 'UNA',
  UNED: 'UNED',
  OTRO: 'Otro',
});

export const LIMITES_AULAS_POR_ORIGEN = Object.freeze({
  UNA: 27,
  UNED: 3,
  OTRO: 15,
});

export const DIAS_SEMANA_AULA = Object.freeze({
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
});

export const TIPOS_INDISPONIBILIDAD = Object.freeze({
  MANTENIMIENTO: 'Mantenimiento',
  REPARACION: 'Reparación',
  LIMPIEZA: 'Limpieza',
  BLOQUEO: 'Bloqueo',
  OTRO: 'Otro',
});

export const TIPOS_RESERVA = Object.freeze({
  EXAMEN: 'Examen',
  REUNION: 'Reunión',
  ACTIVIDAD: 'Actividad',
  CONFERENCIA: 'Conferencia',
  EVENTO: 'Evento',
  OTRO: 'Otro',
});

export const RECOMENDACIONES_CAPACIDAD = Object.freeze({
  SOBRECAPACIDAD: 'Sobrecapacidad',
  AL_LIMITE: 'Al límite',
  AJUSTADA: 'Ajustada',
  RECOMENDADA: 'Recomendada',
  MUY_RECOMENDADA: 'Muy recomendada',
});

export const ACCIONES_AUDITORIA_AULA = Object.freeze({
  CREAR: 'Creación',
  ACTUALIZAR: 'Actualización',
  CAMBIAR_ESTADO: 'Cambio de estado',
  ASIGNAR_EQUIPAMIENTO: 'Asignación de equipamiento',
  ACTUALIZAR_EQUIPAMIENTO: 'Actualización de equipamiento',
  CAMBIAR_ESTADO_EQUIPAMIENTO: 'Cambio de estado del equipamiento',
  DESASIGNAR_EQUIPAMIENTO: 'Retiro de equipamiento del aula',
  CREAR_DISPONIBILIDAD: 'Creación de disponibilidad',
  ACTUALIZAR_DISPONIBILIDAD: 'Actualización de disponibilidad',
  ELIMINAR_DISPONIBILIDAD: 'Eliminación de disponibilidad',
});

export const ENTIDADES_AUDITORIA_AULA = Object.freeze({
  AULA: 'Aula',
  EQUIPAMIENTO: 'Equipamiento',
  AULA_EQUIPAMIENTO: 'Equipamiento del aula',
  INDISPONIBILIDAD: 'Indisponibilidad',
  RESERVA: 'Reserva',
  DISPONIBILIDAD_AULA: 'Disponibilidad del aula',
});

export function nombreTipoAula(tipo) {
  return TIPOS_AULA[tipo] || tipo || '—';
}

export function nombreMobiliario(tipo) {
  return TIPOS_MOBILIARIO[tipo] || tipo || '—';
}

export function nombreOrigen(origen) {
  return ORIGENES_AULA[origen] || origen || '—';
}

export function nombreTipoIndisponibilidad(tipo) {
  return TIPOS_INDISPONIBILIDAD[tipo] || tipo || '—';
}

export function contarAulasPorOrigen(origen, listaAulas = []) {
  return listaAulas.filter((aula) => aula.origen === origen).length;
}

export function obtenerLimiteOrigen(origen) {
  return LIMITES_AULAS_POR_ORIGEN[origen] ?? null;
}

export function obtenerMaximoNumeroOrigen(origen) {
  return LIMITES_AULAS_POR_ORIGEN[origen] ?? 1;
}

export function origenTieneCupo(origen, listaAulas = [], aulaEditada = null) {
  const limite = obtenerLimiteOrigen(origen);
  if (limite === null) return true;
  if (aulaEditada && aulaEditada.origen === origen) return true;
  return contarAulasPorOrigen(origen, listaAulas) < limite;
}

export function obtenerNumeroAula(aulaOCodigo) {
  const codigo = typeof aulaOCodigo === 'object' ? aulaOCodigo?.codigo : aulaOCodigo;
  const coincidencia = String(codigo ?? '').match(/\d+/);
  if (!coincidencia) return null;
  const numero = Number(coincidencia[0]);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

export function obtenerNombreEspecialAula(aula) {
  const nombre = String(aula?.nombre ?? '').trim();
  const numero = obtenerNumeroAula(aula);
  if (!nombre) return '';
  if (!numero) return nombre;

  const patron = new RegExp(`^(?:Aula|Sala)\\s+${numero}(?:\\s*[·:\\-]\\s*|\\s+)?`, 'i');
  if (patron.test(nombre)) {
    return nombre.replace(patron, '').trim();
  }
  return nombre;
}

export function prefijoVisibleEspacio(tipo) {
  return tipo === 'SALA' ? 'Sala' : 'Aula';
}

export function construirNombreAula(numero, nombreEspecial = '', tipo = 'AULA') {
  const especial = String(nombreEspecial ?? '').trim();
  const base = `${prefijoVisibleEspacio(tipo)} ${numero}`;
  return especial ? `${base} · ${especial}` : base;
}

export function construirCodigoEspacio(numero, tipo = 'AULA', codigoSugerido = '') {
  const sugerido = String(codigoSugerido ?? '').trim();
  if (sugerido) return sugerido.toUpperCase();
  if (tipo === 'SALA') return `SALA-${numero}`;
  return String(numero);
}

export function nombreVisibleAula(aula) {
  const numero = obtenerNumeroAula(aula);
  if (!numero) {
    return aula?.nombre || aula?.codigo || 'Aula';
  }
  const especial = obtenerNombreEspecialAula(aula);
  return construirNombreAula(numero, especial, aula?.tipo || 'AULA');
}

export function compararAulasPorNumero(a, b) {
  const numeroA = obtenerNumeroAula(a);
  const numeroB = obtenerNumeroAula(b);

  if (numeroA !== null && numeroB !== null) {
    return numeroA - numeroB;
  }
  if (numeroA !== null) return -1;
  if (numeroB !== null) return 1;

  return nombreVisibleAula(a).localeCompare(nombreVisibleAula(b), 'es', {
    sensitivity: 'base',
  });
}

export function compararAulasPorEstadoYNumero(a, b) {
  if (a.activo !== b.activo) {
    return a.activo === true ? -1 : 1;
  }
  return compararAulasPorNumero(a, b);
}

export function claseTipoPlano(tipo) {
  switch (tipo) {
    case 'AUDITORIO':
      return 'is-auditorio';
    case 'LABORATORIO':
      return 'is-laboratorio';
    case 'SALA':
      return 'is-sala';
    default:
      return 'is-aula';
  }
}

export function etiquetaPrincipalSlot(slot, aula = null) {
  const tipo = aula?.tipo || slot?.tipo || 'AULA';
  const numero = obtenerNumeroAula(aula) ?? slot?.numero ?? '';

  if (slot?.etiquetaPlano) {
    return slot.etiquetaPlano;
  }
  return numero ? `${prefijoVisibleEspacio(tipo)} ${numero}` : prefijoVisibleEspacio(tipo);
}

export function aulaCoincideConSlot(aula, slot) {
  if (!aula || !slot) return false;
  if (slot.origen && aula.origen !== slot.origen) return false;

  const codigoAula = String(aula.codigo ?? '').trim().toUpperCase();
  const codigoSlot = String(slot.codigo ?? '').trim().toUpperCase();

  if (codigoSlot) {
    return codigoAula === codigoSlot;
  }

  if (slot.matchUbicacion) {
    const ubicacionAula = String(aula.ubicacion ?? '').trim().toLowerCase();
    const ubicacionSlot = String(slot.ubicacion ?? '').trim().toLowerCase();
    return Boolean(ubicacionSlot) && ubicacionAula === ubicacionSlot;
  }

  if (codigoAula.startsWith('SALA-')) {
    return false;
  }

  return obtenerNumeroAula(aula) === slot.numero;
}

export function formatearFechaHora(valor) {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);
  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(fecha);
}

export function nombreTipoReserva(tipo) {
  return TIPOS_RESERVA[tipo] || tipo || '—';
}

export function nombreRecomendacionCapacidad(valor) {
  return RECOMENDACIONES_CAPACIDAD[valor] || 'Sin evaluar';
}

export function nombreOrigenOcupacion(origen) {
  const nombres = {
    RESERVA: 'Reserva',
    INDISPONIBILIDAD: 'Indisponibilidad',
  };

  return nombres[origen] || origen || '—';
}

export function nombreAccionAuditoria(accion) {
  return ACCIONES_AUDITORIA_AULA[accion] || accion || '—';
}

export function nombreEntidadAuditoria(entidad) {
  return ENTIDADES_AUDITORIA_AULA[entidad] || entidad || '—';
}

export function obtenerDetalleAuditoria(detalle) {
  if (!detalle) {
    return null;
  }

  if (typeof detalle === 'object') {
    return detalle;
  }

  try {
    return JSON.parse(detalle);
  } catch {
    return detalle;
  }
}

export function detalleAuditoriaTexto(detalle) {
  const valor = obtenerDetalleAuditoria(detalle);

  if (valor === null) {
    return '';
  }

  if (typeof valor === 'string') {
    return valor;
  }

  return JSON.stringify(valor, null, 2);
}

export function periodoPermiteEditarDisponibilidad(periodo) {
  return ['BORRADOR', 'EN_PREPARACION'].includes(periodo?.estado);
}

export function seleccionarPeriodoPreferido(periodos = []) {
  if (!Array.isArray(periodos) || !periodos.length) {
    return null;
  }

  return (
    periodos.find((periodo) => periodo.estado === 'EN_PREPARACION') ||
    periodos.find((periodo) => periodo.estado === 'EN_CURSO') ||
    periodos.find((periodo) => periodo.estado === 'BORRADOR') ||
    periodos[0]
  );
}

export function normalizarFechaHoraInput(valor) {
  if (!valor) {
    return valor;
  }

  return valor.length === 16 ? `${valor}:00` : valor;
}

export function fechaHoraLocalParaInput(fecha) {
  const pad = (valor) => String(valor).padStart(2, '0');

  return [
    fecha.getFullYear(),
    '-',
    pad(fecha.getMonth() + 1),
    '-',
    pad(fecha.getDate()),
    'T',
    pad(fecha.getHours()),
    ':',
    pad(fecha.getMinutes()),
  ].join('');
}

export function obtenerRangoOcupacionInicial(referencia = new Date()) {
  const inicio = new Date(
    referencia.getFullYear(),
    referencia.getMonth(),
    referencia.getDate(),
    0,
    0,
  );

  const fin = new Date(
    referencia.getFullYear(),
    referencia.getMonth(),
    referencia.getDate(),
    23,
    59,
  );

  return {
    inicio: fechaHoraLocalParaInput(inicio),
    fin: fechaHoraLocalParaInput(fin),
  };
}

export function horaCorta(hora) {
  if (!hora) {
    return '—';
  }

  return String(hora).slice(0, 5);
}

export function normalizarHoraFormulario(valor) {
  const texto = String(valor || '').trim();
  const match = texto.match(/^(\d{1,2}):(\d{1,2})/);

  if (!match) {
    return '';
  }

  const hora = Number(match[1]);
  const minuto = Number(match[2]);

  if (
    !Number.isInteger(hora) ||
    !Number.isInteger(minuto) ||
    hora < 0 ||
    hora > 23 ||
    minuto < 0 ||
    minuto > 59
  ) {
    return '';
  }

  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}

export function separarFechaHoraFormulario(valor) {
  const texto = String(valor || '').trim();

  if (!texto) {
    return {
      fecha: '',
      hora: '',
    };
  }

  const [fecha = '', hora = ''] = texto.split('T');

  return {
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : '',
    hora: normalizarHoraFormulario(hora),
  };
}

export function fechaParaInput(valor) {
  if (!valor) {
    return '';
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return '';
  }

  const pad = (numero) => String(numero).padStart(2, '0');

  return [
    fecha.getFullYear(),
    '-',
    pad(fecha.getMonth() + 1),
    '-',
    pad(fecha.getDate()),
    'T',
    pad(fecha.getHours()),
    ':',
    pad(fecha.getMinutes()),
  ].join('');
}
