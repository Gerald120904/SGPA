const mysql = require('mysql2/promise');
require('dotenv').config();

const CURSOS_POR_PERFIL = {
  N1EI: [
    'EIF203',
    'EIF207',
    'EIF208',
    'EIF209',
    'EIF210',
    'EIF211',
    'EIF212',
    'EIF400',
    'EIF401',
    'EIF402',
    'EIF406',
    'EIF411',
    'EIF412',
    'EIF413',
    'MAT006',
    'EIF100O',
    'EIF101O',
    'EIF421O',
    'EIF422O',
    'EIF423O',
    'EIF427O',
    'EIF428O',
    'EIF431O',
    'EIF432O',
    'EIF433O',
    'EIF436O',
    'EIF440O',
    'EIF441O',
    'EIF442O',
    'EIF443O',
    'EIF542',
    'EIF541',
    'EIF501',
    'EIF544',
    'EIF502',
    'EIF506',
    'EIF507',
    'EIF508',
    'EIF509',
    'EIF511',
  ],
  N3EI: [
    'EIF404',
    'EIF407',
    'EIF408',
    'EIF409',
    'EIF429O',
    'EIF439O',
    'EIF44O',
    'EIG417O',
    'EIG418O',
    'EIF500',
    'EIF543',
    'EIF545',
  ],
  N4EI: ['EIF424O', 'EIF425O', 'EIF426O', 'EIG416O'],
  N6EI: ['EIF430O', 'EIF437O', 'EIF438O'],
};

const ESTADOS = Object.freeze({
  CURSO_EXISTENTE: 'CURSO_EXISTENTE',
  PLAN_REGULAR_SIN_CURSO: 'PLAN_REGULAR_SIN_CURSO',
  PLAN_MULTIPLE_COMPATIBLE: 'PLAN_MULTIPLE_COMPATIBLE',
  OPTATIVA_EXISTENTE: 'OPTATIVA_EXISTENTE',
  ESPACIO_OPTATIVO_NO_CURSO: 'ESPACIO_OPTATIVO_NO_CURSO',
  CONFLICTO_NOMBRE: 'CONFLICTO_NOMBRE',
  AUSENTE_EN_PLAN_Y_CATALOGO: 'AUSENTE_EN_PLAN_Y_CATALOGO',
});

const TIPOS_ESPACIO = new Set(['OPTATIVA', 'GENERAL']);

function normalizarCodigo(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase();
}

function normalizarNombre(valor) {
  return String(valor || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es');
}

function valoresUnicos(valores) {
  return [...new Set(valores.filter(Boolean))];
}

function placeholders(cantidad) {
  return Array.from({ length: cantidad }, () => '?').join(', ');
}

function clasificar({ curso, optativa, asignaturas }) {
  if (curso && optativa) {
    return ESTADOS.OPTATIVA_EXISTENTE;
  }

  if (curso) {
    return ESTADOS.CURSO_EXISTENTE;
  }

  const nombres = new Map();
  for (const asignatura of asignaturas) {
    const normalizado = normalizarNombre(asignatura.nombreReferencia);
    if (normalizado && !nombres.has(normalizado)) {
      nombres.set(normalizado, asignatura.nombreReferencia.trim());
    }
  }

  if (nombres.size > 1) {
    return ESTADOS.CONFLICTO_NOMBRE;
  }

  if (asignaturas.some((item) => TIPOS_ESPACIO.has(item.tipo))) {
    return ESTADOS.ESPACIO_OPTATIVO_NO_CURSO;
  }

  const candidatasRegulares = asignaturas.filter(
    (item) => item.activo && !item.cursoId && !TIPOS_ESPACIO.has(item.tipo),
  );
  const planesCandidatos = new Set(
    candidatasRegulares.map((item) => item.planEstudioId),
  );

  if (planesCandidatos.size > 1) {
    return ESTADOS.PLAN_MULTIPLE_COMPATIBLE;
  }

  if (candidatasRegulares.length) {
    return ESTADOS.PLAN_REGULAR_SIN_CURSO;
  }

  return ESTADOS.AUSENTE_EN_PLAN_Y_CATALOGO;
}

function describirPlanes(asignaturas) {
  if (!asignaturas.length) return '-';

  return valoresUnicos(
    asignaturas.map((item) => {
      const estadoPlan = item.planActivo ? 'activo' : 'inactivo';
      return `${item.planCodigo} [${estadoPlan}]`;
    }),
  ).join(' | ');
}

function describirAsignaturas(asignaturas) {
  if (!asignaturas.length) return '-';

  return asignaturas
    .map((item) => {
      const estado = item.activo ? 'activa' : 'inactiva';
      const vinculacion = item.cursoId ? `curso ${item.cursoId}` : 'sin curso';
      return `#${item.id} ${item.tipo} ${estado}, ${vinculacion}`;
    })
    .join(' | ');
}

function nombresEncontrados(curso, asignaturas) {
  return (
    valoresUnicos([
      curso?.nombre,
      ...asignaturas.map((item) => item.nombreReferencia?.trim()),
    ]).join(' | ') || '-'
  );
}

function construirResumen(resultados) {
  const contar = (estado) =>
    resultados.filter((resultado) => resultado.estado === estado).length;

  return {
    oficiales: resultados.length,
    existentes: contar(ESTADOS.CURSO_EXISTENTE),
    desdePlan: contar(ESTADOS.PLAN_REGULAR_SIN_CURSO),
    multiples: contar(ESTADOS.PLAN_MULTIPLE_COMPATIBLE),
    optativas: contar(ESTADOS.OPTATIVA_EXISTENTE),
    espacios: contar(ESTADOS.ESPACIO_OPTATIVO_NO_CURSO),
    conflictos: contar(ESTADOS.CONFLICTO_NOMBRE),
    sinFuente: contar(ESTADOS.AUSENTE_EN_PLAN_Y_CATALOGO),
  };
}

function imprimirResumen(resultados) {
  const resumen = construirResumen(resultados);

  console.log('\n==================================================');
  console.log('RESUMEN');
  console.log('==================================================\n');
  console.log(`Cursos oficiales:                 ${resumen.oficiales}`);
  console.log(`Ya existentes:                    ${resumen.existentes}`);
  console.log(`Creables desde Plan regular:      ${resumen.desdePlan}`);
  console.log(`Presentes en varios planes:       ${resumen.multiples}`);
  console.log(`Optativas reales existentes:      ${resumen.optativas}`);
  console.log(`Espacios curriculares:            ${resumen.espacios}`);
  console.log(`Conflictos de nombre:             ${resumen.conflictos}`);
  console.log(`Sin fuente suficiente:            ${resumen.sinFuente}`);

  const porPerfil = Object.keys(CURSOS_POR_PERFIL).map((perfil) => {
    const elementos = resultados.filter((item) => item.perfil === perfil);
    const contar = (...estados) =>
      elementos.filter((item) => estados.includes(item.estado)).length;

    return {
      Perfil: perfil,
      Total: elementos.length,
      Existentes: contar(ESTADOS.CURSO_EXISTENTE),
      'Desde plan': contar(
        ESTADOS.PLAN_REGULAR_SIN_CURSO,
        ESTADOS.PLAN_MULTIPLE_COMPATIBLE,
      ),
      Optativas: contar(ESTADOS.OPTATIVA_EXISTENTE),
      Conflictos: contar(ESTADOS.CONFLICTO_NOMBRE),
      'Sin fuente': contar(ESTADOS.AUSENTE_EN_PLAN_Y_CATALOGO),
    };
  });

  console.log('');
  console.table(porPerfil);
}

async function diagnosticar() {
  const oficiales = Object.entries(CURSOS_POR_PERFIL).flatMap(
    ([perfil, codigos]) => codigos.map((codigo) => ({ perfil, codigo })),
  );
  const codigosNormalizados = valoresUnicos(
    oficiales.map((item) => normalizarCodigo(item.codigo)),
  );
  const marcadores = placeholders(codigosNormalizados.length);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    const [cursos] = await connection.query(
      `SELECT id, codigo, nombre, activo
       FROM cursos
       WHERE UPPER(TRIM(codigo)) IN (${marcadores})`,
      codigosNormalizados,
    );
    const [asignaturas] = await connection.query(
      `SELECT
         pa.id,
         pa.plan_estudio_id AS planEstudioId,
         pa.curso_id AS cursoId,
         pa.codigo_referencia AS codigoReferencia,
         pa.nombre_referencia AS nombreReferencia,
         pa.tipo,
         pa.activo,
         pe.id AS planId,
         pe.codigo AS planCodigo,
         pe.activo AS planActivo,
         ca.id AS carreraId,
         ca.codigo AS carreraCodigo,
         ca.nombre AS carreraNombre,
         ca.activo AS carreraActiva
       FROM plan_asignaturas pa
       INNER JOIN planes_estudio pe ON pe.id = pa.plan_estudio_id
       INNER JOIN carreras ca ON ca.id = pe.carrera_id
       WHERE UPPER(TRIM(pa.codigo_referencia)) IN (${marcadores})
       ORDER BY pa.codigo_referencia, pe.codigo, pa.id`,
      codigosNormalizados,
    );
    const [optativas] = await connection.query(
      `SELECT
         co.id,
         co.curso_id AS cursoId,
         co.tipo,
         co.carrera_origen_id AS carreraOrigenId,
         co.activo,
         c.codigo AS cursoCodigo,
         c.nombre AS cursoNombre
       FROM curso_optativas co
       INNER JOIN cursos c ON c.id = co.curso_id
       WHERE UPPER(TRIM(c.codigo)) IN (${marcadores})`,
      codigosNormalizados,
    );

    const resultados = oficiales.map(({ perfil, codigo }) => {
      const normalizado = normalizarCodigo(codigo);
      const curso = cursos.find(
        (item) => normalizarCodigo(item.codigo) === normalizado,
      );
      const asignaturasCodigo = asignaturas.filter(
        (item) => normalizarCodigo(item.codigoReferencia) === normalizado,
      );
      const optativa = optativas.find(
        (item) => normalizarCodigo(item.cursoCodigo) === normalizado,
      );

      return {
        perfil,
        codigo,
        estado: clasificar({ curso, optativa, asignaturas: asignaturasCodigo }),
        nombre: nombresEncontrados(curso, asignaturasCodigo),
        plan: describirPlanes(asignaturasCodigo),
        asignaturas: describirAsignaturas(asignaturasCodigo),
        carrera:
          valoresUnicos(
            asignaturasCodigo.map(
              (item) =>
                `${item.carreraCodigo} - ${item.carreraNombre} [${
                  item.carreraActiva ? 'activa' : 'inactiva'
                }]`,
            ),
          ).join(' | ') || '-',
      };
    });

    console.table(
      resultados.map((item) => ({
        Perfil: item.perfil,
        Código: item.codigo,
        Estado: item.estado,
        'Nombre encontrado': item.nombre,
        Plan: item.plan,
      })),
    );

    const conAsignaturas = resultados.filter((item) => item.plan !== '-');
    if (conAsignaturas.length) {
      console.log('\nDetalle de asignaturas y carreras encontradas:');
      console.table(
        conAsignaturas.map((item) => ({
          Perfil: item.perfil,
          Código: item.codigo,
          Asignaturas: item.asignaturas,
          Carrera: item.carrera,
        })),
      );
    }

    imprimirResumen(resultados);
  } finally {
    await connection.end();
  }
}

diagnosticar().catch((error) => {
  console.error(error);
  process.exit(1);
});
