const mysql = require('mysql2/promise');
const { loadTestEnvironment } = require('./test-environment');

loadTestEnvironment({ synchronize: false });

const baseUrl = `http://127.0.0.1:${process.env.PORT || 3100}`;
const password = process.env.SGPA_TEST_PASSWORD;
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail: ok ? '' : detail });
  if (!ok) throw new Error(`${name}: ${detail}`);
}

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: response.status, data };
}

async function expectStatus(name, path, status, options) {
  const response = await request(path, options);
  record(name, response.status === status, `HTTP ${response.status}`);
  return response.data;
}

async function login(correo, expectedRole) {
  const data = await expectStatus(
    `Autenticación ${expectedRole}`,
    '/auth/login',
    200,
    { method: 'POST', body: { correo, password } },
  );
  record(
    `Rol de sesión ${expectedRole}`,
    data.usuario.roles.includes(expectedRole),
    'Rol esperado ausente',
  );
  return data.accessToken;
}

async function cleanupTemporaryUser() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  try {
    const [rows] = await conn.query(
      "SELECT id FROM usuarios WHERE cedula='SGPA-TEST-TEMP'",
    );
    for (const row of rows) {
      await conn.query('DELETE FROM usuario_permisos WHERE usuario_id=?', [
        row.id,
      ]);
      await conn.query('DELETE FROM usuario_roles WHERE usuario_id=?', [
        row.id,
      ]);
      await conn.query('DELETE FROM usuarios WHERE id=?', [row.id]);
    }
  } finally {
    await conn.end();
  }
}

async function main() {
  if (!password) throw new Error('SGPA_TEST_PASSWORD no configurada.');

  await cleanupTemporaryUser();

  const admin = await login('admin@sgpa.test', 'ADMIN_GLOBAL');
  await expectStatus(
    'Login normaliza correo con espacios y mayúsculas',
    '/auth/login',
    200,
    {
      method: 'POST',
      body: { correo: ' ADMIN@SGPA.TEST ', password },
    },
  );
  const coordinator = await login('coordinador@sgpa.test', 'COORDINADOR');
  const professor = await login('profesor@sgpa.test', 'PROFESOR');
  const assistant = await login(
    'asistente@sgpa.test',
    'ASISTENTE_ESTUDIANTIL',
  );

  await expectStatus('Rechazo de contraseña incorrecta', '/auth/login', 401, {
    method: 'POST',
    body: { correo: 'admin@sgpa.test', password: 'incorrecta' },
  });
  await expectStatus('Rechazo sin token', '/usuarios', 401);

  for (const [role, token] of [
    ['ADMIN_GLOBAL', admin],
    ['COORDINADOR', coordinator],
    ['PROFESOR', professor],
    ['ASISTENTE_ESTUDIANTIL', assistant],
  ]) {
    const profile = await expectStatus(
      `Carga de perfil ${role}`,
      '/auth/perfil',
      200,
      { token },
    );
    record(
      `Perfil persistido ${role}`,
      profile.roles.includes(role),
      'Perfil sin rol esperado',
    );
  }

  const users = await expectStatus('Administrador lista usuarios', '/usuarios', 200, {
    token: admin,
  });
  record('Usuarios ficticios visibles', users.length === 4, `${users.length}`);
  await expectStatus('Coordinador no administra usuarios', '/usuarios', 403, {
    token: coordinator,
  });
  await expectStatus('Profesor no administra usuarios', '/usuarios', 403, {
    token: professor,
  });
  await expectStatus('Asistente no administra usuarios', '/usuarios', 403, {
    token: assistant,
  });

  const created = await expectStatus('Creación real de usuario temporal', '/usuarios', 201, {
    method: 'POST',
    token: admin,
    body: {
      cedula: 'SGPA-TEST-TEMP',
      nombres: 'Temporal',
      apellido1: 'Integracion',
      correo: ' TEMPORAL@SGPA.TEST ',
      password,
      roles: ['ASISTENTE_ESTUDIANTIL'],
    },
  });
  record('Usuario temporal activo', created.activo === true, 'Usuario inactivo');
  record(
    'Correo normalizado al crear usuario',
    created.correo === 'temporal@sgpa.test',
    'Correo no normalizado',
  );

  await expectStatus('Duplicado de correo rechazado', '/usuarios', 409, {
    method: 'POST',
    token: admin,
    body: {
      cedula: 'SGPA-TEST-TEMP-2',
      nombres: 'Duplicado',
      apellido1: 'Integracion',
      correo: 'TEMPORAL@SGPA.TEST',
      password,
      roles: ['ASISTENTE_ESTUDIANTIL'],
    },
  });

  const updated = await expectStatus(
    'Edición y normalización de usuario temporal',
    `/usuarios/${created.id}`,
    200,
    {
      method: 'PATCH',
      token: admin,
      body: {
        nombres: 'Temporal Editado',
        correo: ' TEMPORAL.EDITADO@SGPA.TEST ',
      },
    },
  );
  record(
    'Correo normalizado persistido',
    updated.correo === 'temporal.editado@sgpa.test',
    'Correo no normalizado',
  );

  const careers = await expectStatus('Consulta de carreras', '/carreras', 200, {
    token: coordinator,
  });
  const plans = await expectStatus('Consulta de planes', '/planes-estudio', 200, {
    token: coordinator,
  });
  const courses = await expectStatus('Consulta de cursos', '/cursos', 200, {
    token: coordinator,
  });
  const rooms = await expectStatus('Consulta de aulas', '/aulas', 200, {
    token: coordinator,
  });
  const students = await expectStatus('Consulta de estudiantes', '/estudiantes', 200, {
    token: coordinator,
  });
  const forms = await expectStatus(
    'Consulta de formularios simulados',
    '/formularios-estudiantes',
    200,
    { token: coordinator },
  );

  record('Carreras y planes persistidos', careers.length === 2 && plans.length === 2);
  record(
    'Cursos activos e inactivos recuperados',
    courses.filter((item) => item.activo).length === 2 &&
      courses.filter((item) => !item.activo).length === 2,
  );
  record(
    'Aulas activas e inactivas recuperadas',
    rooms.filter((item) => item.activo).length === 2 &&
      rooms.filter((item) => !item.activo).length === 2,
  );
  record('Estudiantes ficticios recuperados', students.length === 2);
  record('Formulario simulado recuperado', forms.length === 1);

  await expectStatus('Profesor puede consultar aulas', '/aulas', 200, {
    token: professor,
  });
  await expectStatus('Profesor no puede consultar cursos', '/cursos', 403, {
    token: professor,
  });
  await expectStatus('Asistente sin permiso de aulas', '/aulas', 403, {
    token: assistant,
  });
  await expectStatus('Asistente sin permiso de estudiantes', '/estudiantes', 403, {
    token: assistant,
  });
  await expectStatus('Profesor sin permiso de formularios', '/formularios-estudiantes', 403, {
    token: professor,
  });

  const googleState = await expectStatus(
    'Google permanece desconectado en pruebas',
    '/integraciones/google/oauth/estado',
    200,
    { token: coordinator },
  );
  record(
    'Sin conexión Google persistente',
    googleState.conectado === false,
    'Google apareció conectado',
  );

  const careerIng = careers.find((item) => item.codigo === 'TEST-ING');
  const planAdm = plans.find((item) => item.codigo === 'TEST-ADM-2026');
  await expectStatus(
    'Formulario rechaza carrera y plan incompatibles antes de Google',
    '/formularios-estudiantes',
    400,
    {
      method: 'POST',
      token: coordinator,
      body: {
        titulo: 'No debe crearse',
        descripcion: 'Validación aislada',
        carreraId: careerIng.id,
        planEstudioId: planAdm.id,
      },
    },
  );
}

main()
  .then(async () => {
    await cleanupTemporaryUser();
    console.log(
      JSON.stringify(
        {
          passed: results.filter((item) => item.ok).length,
          failed: results.filter((item) => !item.ok).length,
          results,
        },
        null,
        2,
      ),
    );
  })
  .catch(async (error) => {
    await cleanupTemporaryUser().catch(() => undefined);
    console.error(
      JSON.stringify(
        {
          passed: results.filter((item) => item.ok).length,
          failed: 1,
          error: error.message,
          results,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  });
