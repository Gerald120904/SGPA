const mysql = require('mysql2/promise');
require('dotenv').config();

const ESPERADO = {
  N1EI: { disciplinares: 6, estrategicas: 7, requisitos: 11 },
  N3EI: { disciplinares: 5, estrategicas: 7, requisitos: 11 },
  N4EI: { disciplinares: 1, estrategicas: 7, requisitos: 11 },
  N6EI: { disciplinares: 6, estrategicas: 7, requisitos: 11 },
};

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

function validarIgual(errores, actual, esperado, mensaje) {
  if (Number(actual) !== Number(esperado)) {
    errores.push(`${mensaje}: esperado ${esperado}, obtenido ${actual}.`);
  }
}

async function verificarCursos(connection, perfil, errores) {
  let asociados = 0;
  let pendientes = 0;

  for (const codigoCurso of CURSOS_POR_PERFIL[perfil.codigo]) {
    const [rows] = await connection.execute(
      `SELECT
         c.id AS cursoId,
         cpa.id AS relacionId,
         cpa.activo AS relacionActiva
       FROM cursos c
       LEFT JOIN curso_perfiles_academicos cpa
         ON cpa.curso_id = c.id
        AND cpa.perfil_academico_id = ?
       WHERE c.codigo = ?
       LIMIT 1`,
      [perfil.id, codigoCurso],
    );

    if (!rows[0]) {
      pendientes += 1;
      continue;
    }

    if (!rows[0].relacionId || !rows[0].relacionActiva) {
      errores.push(
        `${perfil.codigo}: el curso ${codigoCurso} existe, pero no está relacionado activamente.`,
      );
      continue;
    }

    asociados += 1;
  }

  return { asociados, pendientes };
}

async function verificar() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    const errores = [];
    const [columnas] = await connection.query(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'perfiles_academicos'
        AND COLUMN_NAME IN (
          'numero_perfil', 'consecutivo', 'acuerdo_aprobacion',
          'fecha_aprobacion', 'tipo_registro'
        )
    `);
    const [tablas] = await connection.query(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
          'areas_perfiles_academicos',
          'requisitos_perfiles_academicos'
        )
    `);
    const [perfiles] = await connection.query(`
      SELECT
        id,
        codigo,
        numero_perfil AS numeroPerfil,
        consecutivo,
        acuerdo_aprobacion AS acuerdoAprobacion,
        DATE_FORMAT(fecha_aprobacion, '%Y-%m-%d') AS fechaAprobacion,
        tipo_registro AS tipoRegistro
      FROM perfiles_academicos
      WHERE codigo IN ('N1EI', 'N3EI', 'N4EI', 'N6EI')
      ORDER BY codigo
    `);

    validarIgual(errores, columnas.length, 5, 'Columnas administrativas');
    validarIgual(errores, tablas.length, 2, 'Tablas de áreas y requisitos');
    validarIgual(errores, perfiles.length, 4, 'Perfiles oficiales');

    const resumen = [];

    for (const [codigo, esperado] of Object.entries(ESPERADO)) {
      const perfil = perfiles.find((item) => item.codigo === codigo);
      if (!perfil) {
        errores.push(`${codigo}: perfil no encontrado.`);
        continue;
      }

      if (!perfil.numeroPerfil) errores.push(`${codigo}: falta numeroPerfil.`);
      if (!perfil.consecutivo) errores.push(`${codigo}: falta consecutivo.`);
      if (!perfil.acuerdoAprobacion) {
        errores.push(`${codigo}: falta acuerdoAprobacion.`);
      }
      if (perfil.fechaAprobacion !== '2023-08-03') {
        errores.push(
          `${codigo}: fechaAprobacion esperada 2023-08-03, obtenida ${perfil.fechaAprobacion}.`,
        );
      }
      if (perfil.tipoRegistro !== null) {
        errores.push(
          `${codigo}: tipoRegistro debe permanecer NULL, obtenido ${perfil.tipoRegistro}.`,
        );
      }

      const [conteosAreas] = await connection.execute(
        `SELECT tipo, COUNT(*) total
         FROM areas_perfiles_academicos
         WHERE perfil_academico_id = ?
         GROUP BY tipo`,
        [perfil.id],
      );
      const disciplinares = Number(
        conteosAreas.find((item) => item.tipo === 'DISCIPLINAR')?.total || 0,
      );
      const estrategicas = Number(
        conteosAreas.find((item) => item.tipo === 'ESTRATEGICA')?.total || 0,
      );
      const [conteosRequisitos] = await connection.execute(
        `SELECT COUNT(*) total
         FROM requisitos_perfiles_academicos
         WHERE perfil_academico_id = ?`,
        [perfil.id],
      );
      const requisitos = Number(conteosRequisitos[0].total);

      validarIgual(
        errores,
        disciplinares,
        esperado.disciplinares,
        `${codigo} áreas disciplinares`,
      );
      validarIgual(
        errores,
        estrategicas,
        esperado.estrategicas,
        `${codigo} áreas estratégicas`,
      );
      validarIgual(
        errores,
        requisitos,
        esperado.requisitos,
        `${codigo} requisitos`,
      );

      const cursos = await verificarCursos(connection, perfil, errores);
      resumen.push({
        Perfil: codigo,
        Disc: disciplinares,
        'Estratég.': estrategicas,
        Requisitos: requisitos,
        'Cursos asociados': cursos.asociados,
        Pendientes: cursos.pendientes,
      });
    }

    console.table(resumen);

    if (errores.length) {
      throw new Error(`Verificación fallida:\n- ${errores.join('\n- ')}`);
    }

    console.log(
      'Verificación MySQL de perfiles académicos completada correctamente.',
    );
  } finally {
    await connection.end();
  }
}

verificar().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
