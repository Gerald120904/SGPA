const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const { loadTestEnvironment } = require('./test-environment');

const TEST_USERS = [
  {
    cedula: 'SGPA-TEST-ADMIN',
    nombres: 'Admin',
    apellido1: 'Pruebas',
    correo: 'admin@sgpa.test',
    rol: 'ADMIN_GLOBAL',
  },
  {
    cedula: 'SGPA-TEST-COORD',
    nombres: 'Coordinacion',
    apellido1: 'Pruebas',
    correo: 'coordinador@sgpa.test',
    rol: 'COORDINADOR',
  },
  {
    cedula: 'SGPA-TEST-PROFE',
    nombres: 'Profesor',
    apellido1: 'Pruebas',
    correo: 'profesor@sgpa.test',
    rol: 'PROFESOR',
  },
  {
    cedula: 'SGPA-TEST-ASIST',
    nombres: 'Asistente',
    apellido1: 'Pruebas',
    correo: 'asistente@sgpa.test',
    rol: 'ASISTENTE_ESTUDIANTIL',
  },
];

const COORDINATOR_PERMISSIONS = [
  'ESTUDIANTES_VER',
  'ESTUDIANTES_GESTIONAR',
  'FORMULARIOS_ESTUDIANTES_VER',
  'FORMULARIOS_ESTUDIANTES_CREAR',
  'FORMULARIOS_ESTUDIANTES_GESTIONAR',
  'FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS',
  'CARRERAS_VER',
  'CARRERAS_GESTIONAR',
  'PLANES_ESTUDIO_VER',
  'PLANES_ESTUDIO_GESTIONAR',
  'CURSOS_VER',
  'CURSOS_GESTIONAR',
  'OPTATIVAS_VER',
  'OPTATIVAS_GESTIONAR',
  'PROFESORES_VER',
  'ATESTADOS_VALIDAR',
  'PERFILES_DOCENTES_VALIDAR',
  'PERFILES_ACADEMICOS_VER',
  'PERFILES_ACADEMICOS_GESTIONAR',
  'PERIODOS_VER',
  'PERIODOS_GESTIONAR',
  'AULAS_VER',
  'AULAS_GESTIONAR',
  'ESTRUCTURA_ACADEMICA_VER',
  'PROYECCION_VER',
  'PROYECCION_GESTIONAR',
  'OFERTA_VER',
  'OFERTA_GESTIONAR',
  'PROFESORES_ASIGNAR',
  'AULAS_ASIGNAR',
];

async function idPor(conn, tabla, columna, valor) {
  const [rows] = await conn.query(
    `SELECT id FROM \`${tabla}\` WHERE \`${columna}\` = ? LIMIT 1`,
    [valor],
  );
  if (!rows.length) throw new Error(`No se encontró ${tabla}.${columna}`);
  return rows[0].id;
}

async function main() {
  loadTestEnvironment({ synchronize: false });
  const password = process.env.SGPA_TEST_PASSWORD;

  if (!password || password.length < 16) {
    throw new Error('SGPA_TEST_PASSWORD no está configurada de forma segura.');
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    const [[identity]] = await conn.query('SELECT DATABASE() AS db');
    if (identity.db !== 'sgpa_test') {
      throw new Error('Carga bloqueada: la conexión no apunta a sgpa_test.');
    }

    await conn.beginTransaction();

    const roles = [
      ['ADMIN_GLOBAL', 'Administrador global de pruebas'],
      ['COORDINADOR', 'Coordinador de pruebas'],
      ['PROFESOR', 'Profesor de pruebas'],
      ['ASISTENTE_ESTUDIANTIL', 'Asistente estudiantil de pruebas'],
    ];
    for (const [nombre, descripcion] of roles) {
      await conn.query(
        `INSERT INTO roles (nombre, descripcion, activo, created_at)
         VALUES (?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE descripcion=VALUES(descripcion), activo=1`,
        [nombre, descripcion],
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userIds = new Map();
    for (const user of TEST_USERS) {
      await conn.query(
        `INSERT INTO usuarios
          (cedula, nombres, apellido1, apellido2, correo, password_hash,
           password_reset_token_hash, password_reset_expires_at, activo,
           ultimo_acceso, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, ?, NULL, NULL, 1, NULL, NOW(), NOW())
         ON DUPLICATE KEY UPDATE nombres=VALUES(nombres),
           apellido1=VALUES(apellido1), correo=VALUES(correo),
           password_hash=VALUES(password_hash), activo=1, updated_at=NOW()`,
        [user.cedula, user.nombres, user.apellido1, user.correo, passwordHash],
      );
      const userId = await idPor(conn, 'usuarios', 'cedula', user.cedula);
      const roleId = await idPor(conn, 'roles', 'nombre', user.rol);
      userIds.set(user.rol, userId);
      await conn.query(
        `INSERT IGNORE INTO usuario_roles (usuario_id, rol_id, created_at)
         VALUES (?, ?, NOW())`,
        [userId, roleId],
      );
      await conn.query('DELETE FROM usuario_permisos WHERE usuario_id=?', [
        userId,
      ]);

      const permissions =
        user.rol === 'COORDINADOR'
          ? COORDINATOR_PERMISSIONS
          : user.rol === 'PROFESOR'
            ? ['PERIODOS_VER', 'AULAS_VER']
            : [];
      for (const permission of permissions) {
        await conn.query(
          `INSERT INTO usuario_permisos
            (usuario_id, permiso, activo, created_at)
           VALUES (?, ?, 1, NOW())`,
          [userId, permission],
        );
      }
    }

    const carreras = [
      ['TEST-ING', 'Ingeniería de Pruebas', 1],
      ['TEST-ADM', 'Administración de Pruebas', 1],
    ];
    for (const [codigo, nombre, activo] of carreras) {
      await conn.query(
        `INSERT INTO carreras
          (codigo, nombre, descripcion, activo, created_at, updated_at)
         VALUES (?, ?, 'Dato ficticio para integración', ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), activo=VALUES(activo),
           updated_at=NOW()`,
        [codigo, nombre, activo],
      );
    }
    const carreraIngId = await idPor(conn, 'carreras', 'codigo', 'TEST-ING');
    const carreraAdmId = await idPor(conn, 'carreras', 'codigo', 'TEST-ADM');

    const coordinatorId = userIds.get('COORDINADOR');
    const [coordinatorAssignments] = await conn.query(
      `SELECT id FROM asignaciones_academicas
       WHERE usuario_id=? AND tipo='DIRECCION_ACADEMICA' AND activo=1
       LIMIT 1`,
      [coordinatorId],
    );
    if (!coordinatorAssignments.length) {
      await conn.query(
        `INSERT INTO asignaciones_academicas
          (usuario_id, tipo, carrera_id, area_academica_id, fecha_inicio,
           fecha_fin, activo, created_at, updated_at)
         VALUES (?, 'DIRECCION_ACADEMICA', NULL, NULL, '2026-01-01', NULL, 1,
           NOW(), NOW())`,
        [coordinatorId],
      );
    }

    const planes = [
      [carreraIngId, 'TEST-ING-2026', 'Plan Ingeniería de Pruebas'],
      [carreraAdmId, 'TEST-ADM-2026', 'Plan Administración de Pruebas'],
    ];
    for (const [carreraId, codigo, nombre] of planes) {
      await conn.query(
        `INSERT INTO planes_estudio
          (carrera_id, grado, codigo, nombre, descripcion, activo,
           created_at, updated_at)
         VALUES (?, 'BACHILLERATO', ?, ?, 'Dato ficticio', 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), activo=1,
           updated_at=NOW()`,
        [carreraId, codigo, nombre],
      );
    }
    const planIngId = await idPor(
      conn,
      'planes_estudio',
      'codigo',
      'TEST-ING-2026',
    );
    const planAdmId = await idPor(
      conn,
      'planes_estudio',
      'codigo',
      'TEST-ADM-2026',
    );

    const courses = [
      ['TEST-2', 'Curso activo 2', 1, carreraIngId],
      ['TEST-10', 'Curso activo 10', 1, carreraIngId],
      ['TEST-3', 'Curso inactivo 3', 0, carreraIngId],
      ['TEST-20', 'Curso inactivo 20', 0, carreraAdmId],
    ];
    const courseIds = new Map();
    for (const [codigo, nombre, activo, carreraId] of courses) {
      await conn.query(
        `INSERT INTO cursos
          (codigo, nombre, descripcion, activo, created_at, updated_at)
         VALUES (?, ?, 'Dato ficticio', ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), activo=VALUES(activo),
           updated_at=NOW()`,
        [codigo, nombre, activo],
      );
      const courseId = await idPor(conn, 'cursos', 'codigo', codigo);
      courseIds.set(codigo, courseId);
      await conn.query(
        'INSERT IGNORE INTO curso_carreras (curso_id, carrera_id) VALUES (?, ?)',
        [courseId, carreraId],
      );
    }

    const planSubjects = [
      [planIngId, courseIds.get('TEST-2'), 1, 1, 1],
      [planIngId, courseIds.get('TEST-10'), 1, 1, 2],
      [planAdmId, courseIds.get('TEST-20'), 1, 1, 1],
    ];
    for (const [planId, courseId, nivel, ciclo, orden] of planSubjects) {
      const [existing] = await conn.query(
        'SELECT id FROM plan_asignaturas WHERE plan_estudio_id=? AND curso_id=? LIMIT 1',
        [planId, courseId],
      );
      if (existing.length) {
        await conn.query(
          `UPDATE plan_asignaturas SET nivel=?, ciclo=?, orden=?,
           creditos=3, activo=1, updated_at=NOW() WHERE id=?`,
          [nivel, ciclo, orden, existing[0].id],
        );
      } else {
        await conn.query(
          `INSERT INTO plan_asignaturas
            (plan_estudio_id, curso_id, nivel, ciclo, orden, creditos,
             tipo, activo, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 3, 'OBLIGATORIA', 1, NOW(), NOW())`,
          [planId, courseId, nivel, ciclo, orden],
        );
      }
    }

    const rooms = [
      ['TEST-2', 'Aula activa 2', 30, 1],
      ['TEST-10', 'Aula activa 10', 40, 1],
      ['TEST-3', 'Aula inactiva 3', 25, 0],
      ['TEST-20', 'Aula inactiva 20', 20, 0],
    ];
    for (const [codigo, nombre, capacidad, activo] of rooms) {
      await conn.query(
        `INSERT INTO aulas
          (codigo, nombre, ubicacion, capacidad, tipo, tipo_mobiliario,
           origen, activo, created_at, updated_at)
         VALUES (?, ?, 'Campus de pruebas', ?, 'AULA', 'PUPITRE', 'UNA', ?,
           NOW(), NOW())
         ON DUPLICATE KEY UPDATE nombre=VALUES(nombre),
           capacidad=VALUES(capacidad), activo=VALUES(activo), updated_at=NOW()`,
        [codigo, nombre, capacidad, activo],
      );
    }

    await conn.query(
      `INSERT INTO periodos_academicos
        (codigo, nombre, anio, ciclo, fecha_inicio, fecha_fin,
         fecha_limite_disponibilidad, estado, observaciones, created_at,
         updated_at)
       VALUES ('TEST-2026-I', 'Periodo ficticio 2026-I', 2026, 1,
         '2026-01-12', '2026-06-20', '2026-01-05', 'EN_CURSO',
         'Dato ficticio', NOW(), NOW())
       ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), estado=VALUES(estado),
         updated_at=NOW()`,
    );
    const periodId = await idPor(
      conn,
      'periodos_academicos',
      'codigo',
      'TEST-2026-I',
    );

    const students = [
      ['SGPA-TEST-EST-1', 'Ana', 'Ficticia', 'ana@estudiante.sgpa.test'],
      ['SGPA-TEST-EST-2', 'Luis', 'Ficticio', 'luis@estudiante.sgpa.test'],
    ];
    for (const [cedula, nombres, apellido1, correo] of students) {
      await conn.query(
        `INSERT INTO estudiantes
          (cedula, nombres, apellido1, apellido2, correo_institucional,
           telefono, carrera_id, plan_estudio_id, periodo_ingreso_id, estado,
           created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, ?, 'ACTIVO', NOW(), NOW())
         ON DUPLICATE KEY UPDATE nombres=VALUES(nombres),
           apellido1=VALUES(apellido1), carrera_id=VALUES(carrera_id),
           plan_estudio_id=VALUES(plan_estudio_id), estado='ACTIVO',
           updated_at=NOW()`,
        [cedula, nombres, apellido1, correo, carreraIngId, planIngId, periodId],
      );
    }

    await conn.query(
      `INSERT IGNORE INTO profesor_carreras
        (profesor_usuario_id, carrera_id, created_at)
       VALUES (?, ?, NOW())`,
      [userIds.get('PROFESOR'), carreraIngId],
    );

    const [existingForm] = await conn.query(
      "SELECT id FROM formularios_estudiantes WHERE titulo='Formulario ficticio cerrado' LIMIT 1",
    );
    if (!existingForm.length) {
      await conn.query(
        `INSERT INTO formularios_estudiantes
          (titulo, descripcion, carrera_id, plan_estudio_id, google_form_id,
           responder_uri, estado, mapa_preguntas, detalle_error,
           ultima_sincronizacion_at, creado_por_usuario_id, created_at,
           updated_at)
         VALUES ('Formulario ficticio cerrado', 'No conectado a Google', ?, ?,
           NULL, NULL, 'CERRADO', NULL, NULL, NULL, ?, NOW(), NOW())`,
        [carreraIngId, planIngId, userIds.get('COORDINADOR')],
      );
    }

    await conn.commit();
    console.log(
      'Datos ficticios de sgpa_test creados o actualizados correctamente.',
    );
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(`No se pudieron cargar los datos de prueba: ${error.message}`);
  process.exit(1);
});
