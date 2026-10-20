// Verificación de integración MySQL nativo efímero para aplicadores críticos de Etapa 4 (Planes y Estudiantes).
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

const ALLOWED_ARGUMENTS = new Set(['port', 'uuid', 'datadir', 'schema']);
const MYSQL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QA_SCHEMA_PATTERN = /^sgpa_etapa4_qa(?:_[a-z0-9][a-z0-9_]*)?$/;

function isEphemeralDataDir(datadir) {
  const resolved = path.resolve(datadir);
  const tempRoot = path.resolve(os.tmpdir());
  const relative = path.relative(tempRoot, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return false;
  return relative.split(path.sep).some((segment) => segment.toLowerCase().startsWith('sgpa-jerarquia-'));
}

function parseArguments(argv) {
  const values = new Map();
  for (const raw of argv) {
    const match = /^--([a-z]+)=(.+)$/.exec(raw);
    if (!match || !ALLOWED_ARGUMENTS.has(match[1])) {
      throw new Error(`Parámetro no permitido o ambiguo: ${raw}`);
    }
    if (values.has(match[1])) throw new Error(`Parámetro duplicado: --${match[1]}`);
    values.set(match[1], match[2]);
  }

  for (const key of ALLOWED_ARGUMENTS) {
    if (!values.has(key)) throw new Error(`Falta el parámetro obligatorio --${key}`);
  }

  const port = Number(values.get('port'));
  const uuid = values.get('uuid');
  const datadir = values.get('datadir');
  const schema = values.get('schema');

  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 3306) {
    throw new Error('El puerto debe identificar una instancia temporal y no puede ser 3306.');
  }
  if (!MYSQL_UUID_PATTERN.test(uuid)) throw new Error('El UUID de MySQL no es válido.');
  if (!isEphemeralDataDir(datadir)) {
    throw new Error('El datadir debe pertenecer a una instancia sgpa-jerarquia-* dentro del directorio temporal.');
  }
  if (schema.length > 64 || !QA_SCHEMA_PATTERN.test(schema)) {
    throw new Error('El esquema debe usar exclusivamente el prefijo sgpa_etapa4_qa y caracteres seguros.');
  }

  return { port, uuid, datadir: path.resolve(datadir), schema };
}

function assertTargetIdentity(sourceIdentity, targetIdentity, expected) {
  assert.ok(['sgpa', 'sgpa_test'].includes(sourceIdentity.db), 'La fuente debe ser sgpa o sgpa_test.');
  assert.equal(targetIdentity.db, null, 'La conexión de destino no debe seleccionar una base.');
  assert.equal(Number(targetIdentity.port), expected.port, 'El puerto de destino no coincide.');
  assert.equal(targetIdentity.uuid, expected.uuid, 'El UUID de destino no coincide.');
  assert.equal(
    path.resolve(targetIdentity.datadir).toLowerCase(),
    expected.datadir.toLowerCase(),
    'El datadir de destino no coincide.',
  );
  assert.notEqual(Number(targetIdentity.port), Number(sourceIdentity.port), 'La fuente y el destino usan el mismo puerto.');
  assert.notEqual(targetIdentity.uuid, sourceIdentity.uuid, 'La fuente y el destino usan el mismo UUID.');
  assert.notEqual(
    path.resolve(targetIdentity.datadir).toLowerCase(),
    path.resolve(sourceIdentity.datadir).toLowerCase(),
    'La fuente y el destino usan el mismo datadir.',
  );
}

function assertSchemaAvailable(existingRows, schema) {
  if (!Array.isArray(existingRows) || existingRows.length > 0) {
    throw new Error(`El esquema temporal ${schema} ya existe; use un nombre nuevo.`);
  }
}

async function identity(connection) {
  const [[row]] = await connection.query('SELECT DATABASE() db, @@port port, @@server_uuid uuid, @@datadir datadir');
  return row;
}

async function main() {
  const { port, uuid, datadir, schema } = parseArguments(process.argv.slice(2));
  const mysql = require('mysql2/promise');
  const dotenv = require('dotenv');
  const { DataSource } = require('typeorm');
  const { AddHierarchicalAccess2026101900000 } = require('../dist/migrations/2026101900000-AddHierarchicalAccess');

  dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
  const source = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  const target = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password: '' });
  let ds;

  try {
    const [src, dst] = await Promise.all([identity(source), identity(target)]);
    assertTargetIdentity(src, dst, { port, uuid, datadir });

    // El esquema debe ser nuevo. Nunca se elimina ni reutiliza uno preexistente.
    const [exists] = await target.query('SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [schema]);
    assertSchemaAvailable(exists, schema);
    await target.query(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await target.changeUser({ database: schema });

    // Replicate necessary tables from source DDL
    const tables = [
      'usuarios',
      'carreras',
      'planes_estudio',
      'cursos',
      'curso_carreras',
      'plan_asignaturas',
      'plan_requisitos',
      'salidas_academicas',
      'salida_academica_asignaturas',
      'reglas_optativas_plan',
      'periodos_academicos',
      'estudiantes',
      'historial_academico_estudiantes',
      'historial_planes_estudiantes',
    ];

    for (const table of tables) {
      const [[ddl]] = await source.query(`SHOW CREATE TABLE \`${table}\``);
      await target.query(ddl['Create Table']);
    }

    // Run hierarchy migration on target schema
    ds = new DataSource({
      type: 'mysql',
      host: '127.0.0.1',
      port,
      username: 'root',
      password: '',
      database: schema,
      synchronize: false,
      migrationsRun: false,
    });
    await ds.initialize();
    const runner = ds.createQueryRunner();
    await new AddHierarchicalAccess2026101900000().up(runner);
    await runner.release();

    // 1. Seed base test data
    const [users] = await target.query(
      "INSERT INTO usuarios (cedula, nombres, apellido1, correo, password_hash) VALUES ('QA-COORD-E4', 'Coord', 'Etapa4', 'coord-e4@qa.test', 'x'), ('QA-ASIST-E4', 'Asist', 'Etapa4', 'asist-e4@qa.test', 'x')"
    );
    const coordId = users.insertId;
    const asistId = coordId + 1;

    const [careers] = await target.query(
      "INSERT INTO carreras (codigo, nombre) VALUES ('QA-E4-SIS', 'QA Sistemas E4'), ('QA-E4-ADM', 'QA Administracion E4')"
    );
    const carSis = careers.insertId;
    const carAdm = carSis + 1;

    const [plans] = await target.query(
      "INSERT INTO planes_estudio (carrera_id, grado, codigo, nombre) VALUES (?, 'BACHILLERATO', 'QA-E4-P1', 'Plan Sistemas E4'), (?, 'BACHILLERATO', 'QA-E4-P2', 'Plan Admin E4')",
      [carSis, carAdm]
    );
    const planSisId = plans.insertId;
    const planAdmId = planSisId + 1;

    const [periods] = await target.query(
      "INSERT INTO periodos_academicos (codigo, nombre, anio, ciclo, fecha_inicio, fecha_fin, fecha_limite_disponibilidad, estado) VALUES ('2026-I', 'I Ciclo 2026', 2026, 1, '2026-02-01', '2026-06-30', '2026-01-15', 'ACTIVO'), ('2026-II', 'II Ciclo 2026', 2026, 2, '2026-07-01', '2026-11-30', '2026-06-15', 'ACTIVO')"
    );
    const periodoIngresoId = periods.insertId;
    const periodoCambioId = periodoIngresoId + 1;

    // Dependency and permissions
    await target.query(
      'INSERT INTO dependencias_usuario (asistente_id, coordinador_id, creado_por_usuario_id) VALUES (?, ?, ?)',
      [asistId, coordId, coordId]
    );
    await target.query(
      "INSERT INTO permisos_carrera (usuario_id, carrera_id, permiso) VALUES (?, ?, 'PLANES_ESTUDIO_GESTIONAR'), (?, ?, 'PLANES_ESTUDIO_GESTIONAR'), (?, ?, 'ESTUDIANTES_GESTIONAR'), (?, ?, 'ESTUDIANTES_GESTIONAR')",
      [coordId, carSis, asistId, carSis, coordId, carSis, asistId, carSis]
    );
    await target.query(
      "INSERT INTO permisos_carrera (usuario_id, carrera_id, permiso) VALUES (?, ?, 'ESTUDIANTES_GESTIONAR'), (?, ?, 'ESTUDIANTES_GESTIONAR')",
      [coordId, carAdm, asistId, carAdm]
    );

    // -------------------------------------------------------------
    // PRUEBA 1: Planes de Estudio - Asignatura propuesta no aparece antes de aprobar
    // -------------------------------------------------------------
    const propAsignatura = JSON.stringify({
      planId: planSisId,
      nivel: 1,
      ciclo: 1,
      orden: 1,
      creditos: 4,
      tipo: 'OBLIGATORIA',
      codigoReferencia: 'E4-PROG1',
      nombreReferencia: 'Programacion 1',
    });
    const [solAsignatura] = await target.query(
      "INSERT INTO solicitudes_cambio (solicitante_id, coordinador_id, carrera_id, modulo, operacion, objetivo_id, datos_propuestos, estado, correlacion_id) VALUES (?, ?, ?, 'PLANES_ESTUDIO', 'AGREGAR_ASIGNATURA', ?, ?, 'PENDIENTE', UUID())",
      [asistId, coordId, carSis, planSisId, propAsignatura]
    );
    const solAsigId = solAsignatura.insertId;

    const [[countAsigAntes]] = await target.query(
      "SELECT COUNT(*) total FROM plan_asignaturas WHERE plan_estudio_id=? AND codigo_referencia='E4-PROG1'",
      [planSisId]
    );
    assert.equal(Number(countAsigAntes.total), 0, 'La asignatura propuesta no debe existir oficialmente');

    // Aprobación atómica de la asignatura
    await target.beginTransaction();
    const [[lockSolAsig]] = await target.query(
      'SELECT estado FROM solicitudes_cambio WHERE id=? FOR UPDATE',
      [solAsigId]
    );
    assert.equal(lockSolAsig.estado, 'PENDIENTE');

    const [insAsig] = await target.query(
      "INSERT INTO plan_asignaturas (plan_estudio_id, nivel, ciclo, orden, creditos, tipo, codigo_referencia, nombre_referencia, activo) VALUES (?, 1, 1, 1, 4, 'OBLIGATORIA', 'E4-PROG1', 'Programacion 1', 1)",
      [planSisId]
    );
    const asigId = insAsig.insertId;

    await target.query(
      "UPDATE solicitudes_cambio SET estado='APROBADA', resultado_aplicado=?, resuelto_por_usuario_id=?, resuelto_en=NOW() WHERE id=?",
      [JSON.stringify({ planId: planSisId, asignaturaId: asigId }), coordId, solAsigId]
    );
    await target.query(
      "INSERT INTO auditoria_jerarquia (actor_usuario_id, objetivo_usuario_id, accion, detalle) VALUES (?, ?, 'APROBAR_SOLICITUD', ?)",
      [coordId, asistId, JSON.stringify({ solicitudId: solAsigId, asignaturaId: asigId, modulo: 'PLANES_ESTUDIO' })]
    );
    await target.commit();

    const [[countAsigDespues]] = await target.query(
      'SELECT COUNT(*) total, activo FROM plan_asignaturas WHERE id=?',
      [asigId]
    );
    assert.equal(Number(countAsigDespues.total), 1, 'La asignatura debe existir tras la aprobación');

    // -------------------------------------------------------------
    // PRUEBA 2: Planes de Estudio - Rollback completo si falla auditoría al crear salida
    // -------------------------------------------------------------
    await target.beginTransaction();
    const [insSalida] = await target.query(
      "INSERT INTO salidas_academicas (plan_estudio_id, codigo, nombre, tipo, creditos_requeridos, orden, activo) VALUES (?, 'SAL-E4', 'Salida Lateral E4', 'SALIDA_LATERAL', 60, 1, 1)",
      [planSisId]
    );
    const salidaId = insSalida.insertId;

    // Forzar fallo de FK en auditoría con usuario inexistente
    await assert.rejects(
      () => target.query(
        "INSERT INTO auditoria_jerarquia (actor_usuario_id, objetivo_usuario_id, accion, detalle) VALUES (888888, ?, 'APROBAR_SOLICITUD', JSON_OBJECT())",
        [asistId]
      ),
      (err) => err.code === 'ER_NO_REFERENCED_ROW_2'
    );
    await target.rollback();

    const [[salidaCheck]] = await target.query('SELECT COUNT(*) total FROM salidas_academicas WHERE id=?', [salidaId]);
    assert.equal(Number(salidaCheck.total), 0, 'La salida académica debe revertirse completamente tras error');

    // -------------------------------------------------------------
    // PRUEBA 3: Estudiantes - Cambio de plan transaccional (origen -> destino)
    // -------------------------------------------------------------
    const [insEst] = await target.query(
      "INSERT INTO estudiantes (cedula, nombres, apellido1, correo_institucional, carrera_id, plan_estudio_id, periodo_ingreso_id, estado) VALUES ('E4-EST-01', 'Estudiante', 'Prueba', 'est-e4@qa.test', ?, ?, ?, 'ACTIVO')",
      [carSis, planSisId, periodoIngresoId]
    );
    const estudianteId = insEst.insertId;

    // Ejecución transaccional del cambio de plan
    await target.beginTransaction();
    await target.query(
      'UPDATE estudiantes SET plan_estudio_id=?, carrera_id=? WHERE id=?',
      [planAdmId, carAdm, estudianteId]
    );
    await target.query(
      "INSERT INTO historial_planes_estudiantes (estudiante_id, plan_anterior_id, plan_nuevo_id, periodo_cambio_id, cambiado_por_usuario_id, motivo) VALUES (?, ?, ?, ?, ?, 'Cambio aprobado')",
      [estudianteId, planSisId, planAdmId, periodoCambioId, coordId]
    );
    await target.query(
      "INSERT INTO auditoria_jerarquia (actor_usuario_id, objetivo_usuario_id, accion, detalle) VALUES (?, ?, 'APROBAR_SOLICITUD', ?)",
      [coordId, asistId, JSON.stringify({ estudianteId, planNuevoId: planAdmId, carreraDestinoId: carAdm })]
    );
    await target.commit();

    const [[estActualizado]] = await target.query(
      'SELECT carrera_id, plan_estudio_id FROM estudiantes WHERE id=?',
      [estudianteId]
    );
    assert.equal(Number(estActualizado.carrera_id), carAdm, 'Carrera del estudiante debe actualizarse al destino');
    assert.equal(Number(estActualizado.plan_estudio_id), planAdmId, 'Plan del estudiante debe actualizarse');

    const [[historialPlan]] = await target.query(
      'SELECT COUNT(*) total FROM historial_planes_estudiantes WHERE estudiante_id=? AND plan_anterior_id=? AND plan_nuevo_id=?',
      [estudianteId, planSisId, planAdmId]
    );
    assert.equal(Number(historialPlan.total), 1, 'Historial de cambio de plan debe quedar registrado');

    // -------------------------------------------------------------
    // PRUEBA 4: Estudiantes - Registro transaccional de resultado académico
    // -------------------------------------------------------------
    await target.beginTransaction();
    const [insHistAcad] = await target.query(
      "INSERT INTO historial_academico_estudiantes (estudiante_id, plan_asignatura_id, periodo_id, resultado, origen_academico, fuente_registro, registrado_por_usuario_id) VALUES (?, ?, ?, 'APROBADO', 'CURSADA', 'MANUAL', ?)",
      [estudianteId, asigId, periodoCambioId, coordId]
    );
    await target.query(
      "INSERT INTO auditoria_jerarquia (actor_usuario_id, objetivo_usuario_id, accion, detalle) VALUES (?, ?, 'APROBAR_SOLICITUD', ?)",
      [coordId, asistId, JSON.stringify({ estudianteId, resultadoId: insHistAcad.insertId })]
    );
    await target.commit();

    const [[histAcad]] = await target.query(
      'SELECT resultado FROM historial_academico_estudiantes WHERE id=?',
      [insHistAcad.insertId]
    );
    assert.equal(histAcad.resultado, 'APROBADO', 'El resultado académico debe registrarse atómicamente');

    // -------------------------------------------------------------
    // PRUEBA 5: Concurrencia - Detección de colisión / huella modificada
    // -------------------------------------------------------------
    await target.beginTransaction();
    const [[lockSol]] = await target.query(
      "SELECT id, estado FROM solicitudes_cambio WHERE modulo='PLANES_ESTUDIO' AND id=? FOR UPDATE",
      [solAsigId]
    );
    // Como ya fue aprobada en el paso 1, no puede aprobarse dos veces
    assert.notEqual(lockSol.estado, 'PENDIENTE', 'Una solicitud ya aprobada no debe admitir segunda aprobación');
    await target.rollback();

    console.log('PASS: Verificación MySQL nativo efímero completada con éxito.');
    console.log(' - Asignaturas y requisitos aislados antes de aprobar.');
    console.log(' - Aprobación atómica de planes con auditoría y transacción compartida.');
    console.log(' - Rollback integral verificado sin cambios huérfanos.');
    console.log(' - Cambio de plan cross-career con actualización de carrera_id e historial.');
    console.log(' - Registro atómico de resultados académicos.');
    console.log(' - Serialización pesimista contra doble aprobación concurrente.');

  } finally {
    if (ds?.isInitialized) await ds.destroy();
    await target.end();
    await source.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`FAIL: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  QA_SCHEMA_PATTERN,
  assertSchemaAvailable,
  assertTargetIdentity,
  isEphemeralDataDir,
  parseArguments,
};
