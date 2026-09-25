const mysql = require('mysql2/promise');
require('dotenv').config();

const PERFILES = [
  {
    codigo: 'N1EI',
    nombre:
      'Persona académica en Computación e Informática (núcleo base troncal)',
    descripcion: 'Núcleo base troncal.',
    numeroPerfil: 'Perfil 1-2023',
    consecutivo: 'UNA-CO-EI-ACUE-239-2023',
    acuerdoAprobacion: 'UNA-CO-EI-ACUE-239-2023',
    fechaAprobacion: '2023-08-03',
    tipoRegistro: null,
  },
  {
    codigo: 'N3EI',
    nombre:
      'Persona académica en Computación e Informática (núcleo complementario)',
    descripcion: 'Núcleo complementario.',
    numeroPerfil: 'Perfil 3-2023',
    consecutivo: 'UNA-CO-EI-ACUE-239-2023',
    acuerdoAprobacion: 'UNA-CO-EI-ACUE-239-2023',
    fechaAprobacion: '2023-08-03',
    tipoRegistro: null,
  },
  {
    codigo: 'N4EI',
    nombre:
      'Persona académica en Computación e Informática (núcleo Tecnología Educativa)',
    descripcion: 'Núcleo Tecnología Educativa.',
    numeroPerfil: 'Perfil 4',
    consecutivo: 'UNA-CO-EI-ACUE-239-2023',
    acuerdoAprobacion: 'UNA-CO-EI-ACUE-239-2023',
    fechaAprobacion: '2023-08-03',
    tipoRegistro: null,
  },
  {
    codigo: 'N6EI',
    nombre: 'Persona académica en Computación e Informática (núcleo jurídico)',
    descripcion: 'Núcleo jurídico.',
    numeroPerfil: 'Perfil 6-2023',
    consecutivo: 'UNA-CO-EI-ACUE-239-2023',
    acuerdoAprobacion: 'UNA-CO-EI-ACUE-239-2023',
    fechaAprobacion: '2023-08-03',
    tipoRegistro: null,
  },
];

const AREAS_DISCIPLINARES = {
  N1EI: [
    'Ingeniería de software',
    'Sistemas de información',
    'Tecnologías de información',
    'Ciencias de la computación',
    'Ingeniería de computadores',
    'Ciberseguridad',
  ],
  N3EI: [
    'Sistemas de información',
    'Ingeniería de Software',
    'Tecnologías de información',
    'Ciencias de la computación',
    'Ingeniería de computadores',
  ],
  N4EI: ['Tecnología Educativa'],
  N6EI: [
    'Sistemas de información',
    'Ingeniería de Software',
    'Tecnologías de información',
    'Ciencias de la computación',
    'Ciberseguridad',
    'Ingeniería de Computadores',
  ],
};

const AREAS_ESTRATEGICAS = [
  'Fortalecimiento de competencias digitales en la sociedad.',
  'I+D+i en Tecnologías de la Información y su aplicación en la sociedad y las organizaciones.',
  'Desarrollo de capacidades e iniciativas emprendedoras en la Industria TIC.',
  'Enseñanza y Aprendizaje con apoyo de las Tecnologías de la Información.',
  'Mejora del bienestar y la calidad de vida de los habitantes mediante la creación y aplicación de productos y servicios TIC.',
  'Impacto de las TIC en el desarrollo económico.',
  'Aplicación y desarrollo científico y tecnológico.',
];

const FORMACION_POR_PERFIL = {
  N1EI: 'Bachillerato en Ingeniería de software, Sistemas de información, Tecnologías de información, Ciencias de la computación, Ingeniería de computadores, Ciberseguridad o áreas afines, y maestría profesional, maestría académica o doctorado en Ciencias o en cualquiera de dichas áreas.',
  N3EI: 'Ruta A: Bachillerato en Sistemas de información, Ingeniería de Software, Tecnologías de información, Ingeniería de computadores, Ciencias de la computación o áreas afines, y maestría profesional, maestría académica o doctorado en Administración o áreas afines. Ruta B: Bachillerato en Administración o áreas afines y maestría profesional, maestría académica o doctorado en Sistemas de información, Ingeniería de Software, Tecnologías de información, Ingeniería de computadores, Ciencias de la computación o áreas afines.',
  N4EI: 'Ruta A: Bachillerato en Ingeniería de Software, Sistemas de información, Tecnologías de información, Ciencias de la computación, Ingeniería de computadores o áreas afines, y maestría profesional, maestría académica o doctorado en Educación, Informática Educativa o áreas relacionadas o afines. Ruta B: Bachillerato en Educación, Informática Educativa o áreas relacionadas o afines y maestría profesional, maestría académica o doctorado en Ingeniería de Software, Sistemas de información, Tecnologías de información, Ciencias de la computación, Ingeniería de computadores, áreas afines o Informática Educativa.',
  N6EI: 'Ruta A: Bachillerato en Sistemas de información, Ingeniería de software, Tecnologías de información, Ciencias de la computación, Ciberseguridad o Ingeniería de Computadores o áreas afines y maestría profesional, maestría académica o doctorado en Propiedad Intelectual, Gobierno Electrónico, Derecho Informático o áreas jurídicas afines. Ruta B: Bachillerato o Licenciatura en Derecho o áreas afines y maestría profesional, maestría académica o doctorado en Propiedad Intelectual, Gobierno Electrónico, Derecho Informático o áreas jurídicas afines.',
};

function construirRequisitos(codigoPerfil) {
  return [
    {
      tipo: 'FORMACION_ACADEMICA',
      obligatorio: true,
      descripcion: FORMACION_POR_PERFIL[codigoPerfil],
      orden: 1,
    },
    {
      tipo: 'IDIOMA_INSTRUMENTAL',
      obligatorio: true,
      descripcion: 'Manejo instrumental del inglés.',
      orden: 2,
    },
    {
      tipo: 'EXPERIENCIA_DOCENTE',
      obligatorio: true,
      descripcion:
        'Mínima de 2 años en docencia universitaria en las áreas disciplinares indicadas en este perfil.',
      orden: 3,
    },
    {
      tipo: 'GRADO_COMPLEMENTARIO',
      obligatorio: false,
      descripcion: 'No aplica.',
      orden: 4,
    },
    {
      tipo: 'IDIOMA_GLOBAL',
      obligatorio: false,
      descripcion: 'No aplica.',
      orden: 5,
    },
    {
      tipo: 'EXPERIENCIA_PROFESIONAL',
      obligatorio: false,
      descripcion: 'Mínimo 1 año en áreas propias de la disciplina.',
      orden: 6,
    },
    {
      tipo: 'CAPACITACIONES',
      obligatorio: false,
      descripcion:
        'Participación demostrada en eventos de actualización y capacitación atinentes a la disciplina.',
      orden: 7,
    },
    {
      tipo: 'OTROS',
      obligatorio: false,
      descripcion: 'No aplica.',
      orden: 8,
    },
    {
      tipo: 'JORNADA',
      obligatorio: true,
      descripcion: 'Al menos un cuarto de tiempo.',
      orden: 9,
    },
    {
      tipo: 'HORARIO',
      obligatorio: true,
      descripcion: 'Cualquier horario.',
      orden: 10,
    },
    {
      tipo: 'CAMPUS',
      obligatorio: true,
      descripcion: 'Cualquier campus.',
      orden: 11,
    },
  ];
}

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

async function encontrarCarrera(connection) {
  if (process.env.SEED_PERFILES_CARRERA_ID) {
    const [rows] = await connection.execute(
      'SELECT id, codigo, nombre FROM carreras WHERE id = ? AND activo = 1',
      [Number(process.env.SEED_PERFILES_CARRERA_ID)],
    );
    return rows[0];
  }

  const [porCursos] = await connection.query(`
    SELECT ca.id, ca.codigo, ca.nombre, COUNT(*) coincidencias
    FROM carreras ca
    INNER JOIN curso_carreras cc ON cc.carrera_id = ca.id
    INNER JOIN cursos cu ON cu.id = cc.curso_id
    WHERE cu.codigo IN ('EIF424O', 'EIF425O', 'EIF426O', 'EIG416O', 'EIF430O', 'EIF437O', 'EIF438O')
      AND ca.activo = 1
    GROUP BY ca.id, ca.codigo, ca.nombre
    ORDER BY coincidencias DESC
    LIMIT 1
  `);

  if (porCursos[0]) return porCursos[0];

  const [porNombre] = await connection.query(`
    SELECT id, codigo, nombre
    FROM carreras
    WHERE activo = 1
      AND (codigo IN ('EI', 'EIF') OR nombre LIKE '%Informática%' OR nombre LIKE '%Sistemas%')
    ORDER BY id
    LIMIT 1
  `);
  return porNombre[0];
}

async function reemplazarAreas(connection, perfilId, codigoPerfil) {
  await connection.execute(
    `DELETE FROM areas_perfiles_academicos
     WHERE perfil_academico_id = ?`,
    [perfilId],
  );

  for (const [indice, descripcion] of AREAS_DISCIPLINARES[
    codigoPerfil
  ].entries()) {
    await connection.execute(
      `INSERT INTO areas_perfiles_academicos
        (perfil_academico_id, tipo, descripcion, orden)
       VALUES (?, 'DISCIPLINAR', ?, ?)`,
      [perfilId, descripcion, indice + 1],
    );
  }

  for (const [indice, descripcion] of AREAS_ESTRATEGICAS.entries()) {
    await connection.execute(
      `INSERT INTO areas_perfiles_academicos
        (perfil_academico_id, tipo, descripcion, orden)
       VALUES (?, 'ESTRATEGICA', ?, ?)`,
      [perfilId, descripcion, indice + 1],
    );
  }
}

async function reemplazarRequisitos(connection, perfilId, codigoPerfil) {
  await connection.execute(
    `DELETE FROM requisitos_perfiles_academicos
     WHERE perfil_academico_id = ?`,
    [perfilId],
  );

  for (const requisito of construirRequisitos(codigoPerfil)) {
    await connection.execute(
      `INSERT INTO requisitos_perfiles_academicos
        (perfil_academico_id, tipo, obligatorio, descripcion, orden)
       VALUES (?, ?, ?, ?, ?)`,
      [
        perfilId,
        requisito.tipo,
        requisito.obligatorio,
        requisito.descripcion,
        requisito.orden,
      ],
    );
  }
}

async function seedPerfilesAcademicos() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  const cursosPendientes = [];

  try {
    const carrera = await encontrarCarrera(connection);
    if (!carrera) {
      throw new Error(
        'No se encontró la carrera de Computación e Informática. Defina SEED_PERFILES_CARRERA_ID.',
      );
    }

    await connection.beginTransaction();
    const ids = {};

    for (const perfil of PERFILES) {
      await connection.execute(
        `INSERT INTO perfiles_academicos
          (carrera_id, codigo, nombre, descripcion, numero_perfil,
           consecutivo, acuerdo_aprobacion, fecha_aprobacion,
           tipo_registro, activo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
          nombre = VALUES(nombre),
          descripcion = VALUES(descripcion),
          numero_perfil = VALUES(numero_perfil),
          consecutivo = VALUES(consecutivo),
          acuerdo_aprobacion = VALUES(acuerdo_aprobacion),
          fecha_aprobacion = VALUES(fecha_aprobacion),
          tipo_registro = VALUES(tipo_registro),
          updated_at = NOW()`,
        [
          carrera.id,
          perfil.codigo,
          perfil.nombre,
          perfil.descripcion,
          perfil.numeroPerfil,
          perfil.consecutivo,
          perfil.acuerdoAprobacion,
          perfil.fechaAprobacion,
          perfil.tipoRegistro,
        ],
      );

      const [rows] = await connection.execute(
        'SELECT id FROM perfiles_academicos WHERE carrera_id = ? AND codigo = ?',
        [carrera.id, perfil.codigo],
      );
      const perfilId = rows[0].id;
      ids[perfil.codigo] = perfilId;

      await reemplazarAreas(connection, perfilId, perfil.codigo);
      await reemplazarRequisitos(connection, perfilId, perfil.codigo);
    }

    for (const [codigoPerfil, codigosCursos] of Object.entries(
      CURSOS_POR_PERFIL,
    )) {
      for (const codigoCurso of codigosCursos) {
        const [cursos] = await connection.execute(
          'SELECT id FROM cursos WHERE codigo = ? LIMIT 1',
          [codigoCurso],
        );
        if (!cursos[0]) {
          console.warn(
            `Curso ${codigoCurso} no encontrado; se omitió la asociación.`,
          );
          cursosPendientes.push({ perfil: codigoPerfil, curso: codigoCurso });
          continue;
        }
        await connection.execute(
          `INSERT INTO curso_perfiles_academicos
            (curso_id, perfil_academico_id, activo, created_at)
           VALUES (?, ?, 1, NOW())
           ON DUPLICATE KEY UPDATE activo = 1`,
          [cursos[0].id, ids[codigoPerfil]],
        );
      }
    }

    await connection.commit();

    const [resultado] = await connection.execute(
      `SELECT id, codigo, nombre, numero_perfil AS numeroPerfil, activo
       FROM perfiles_academicos
       WHERE carrera_id = ? AND codigo IN ('N1EI', 'N3EI', 'N4EI', 'N6EI')
       ORDER BY codigo`,
      [carrera.id],
    );
    console.table(resultado);

    if (cursosPendientes.length) {
      console.log('\nCursos oficiales pendientes de existir en el catálogo:');
      console.table(cursosPendientes);
    }

    console.log(
      `Perfiles preparados para ${carrera.codigo} - ${carrera.nombre}.`,
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

seedPerfilesAcademicos().catch((error) => {
  console.error(error);
  process.exit(1);
});
