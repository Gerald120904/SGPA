/**
 * SGPA — Constantes y funciones auxiliares del módulo Perfiles Académicos.
 * FRONTEND-REF-MASTER
 */

export const TIPOS_REQUISITO_PERFIL = [
  'FORMACION_ACADEMICA',
  'IDIOMA_INSTRUMENTAL',
  'EXPERIENCIA_DOCENTE',
  'GRADO_COMPLEMENTARIO',
  'IDIOMA_GLOBAL',
  'EXPERIENCIA_PROFESIONAL',
  'CAPACITACIONES',
  'OTROS',
  'JORNADA',
  'HORARIO',
  'CAMPUS',
];

export const CONDICIONES_PERFIL = new Set(['JORNADA', 'HORARIO', 'CAMPUS']);

export function filtrarPerfilesAcademicos(perfiles = [], texto = '', estado = 'TODOS') {
  const query = String(texto || '').trim().toLowerCase();
  const filtroEstado = String(estado || 'TODOS').toUpperCase();

  return perfiles.filter((perfil) => {
    const coincideTexto =
      !query ||
      [
        perfil.codigo,
        perfil.nombre,
        perfil.numeroPerfil,
        perfil.carrera?.nombre,
      ]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(query));

    const coincideEstado =
      filtroEstado === 'TODOS' ||
      (filtroEstado === 'ACTIVOS' && perfil.activo) ||
      (filtroEstado === 'INACTIVOS' && !perfil.activo);

    return coincideTexto && coincideEstado;
  });
}

export function formatearEtiquetaTipo(valor) {
  if (!valor) return 'No registrado';
  return String(valor)
    .toLowerCase()
    .split('_')
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');
}

export function formatearFechaPerfil(fecha) {
  if (!fecha) return null;
  const [anio, mes, dia] = String(fecha).slice(0, 10).split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : fecha;
}

export function extraerLineasTexto(texto = '') {
  return String(texto || '')
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean);
}

export function encontrarDuplicadoEnLineas(elementos = []) {
  const vistos = new Set();
  for (const elemento of elementos) {
    const clave = String(elemento).trim().toLocaleLowerCase('es');
    if (vistos.has(clave)) {
      return elemento;
    }
    vistos.add(clave);
  }
  return null;
}
