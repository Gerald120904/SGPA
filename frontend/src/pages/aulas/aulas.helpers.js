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
