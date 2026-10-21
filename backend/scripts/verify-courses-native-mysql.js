// Verifica el contrato transaccional de Cursos solo en una instancia MySQL efimera identificada.
const assert = require('node:assert/strict');
const path = require('node:path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { DataSource } = require('typeorm');
const { AddHierarchicalAccess2026101900000 } = require('../dist/migrations/2026101900000-AddHierarchicalAccess');

const arg = (key) => process.argv.find((v) => v.startsWith(`--${key}=`))?.slice(key.length + 3);
const port = Number(arg('port'));
const uuid = arg('uuid');
const datadir = arg('datadir');
const schema = arg('schema');
if (!Number.isInteger(port) || port < 1024 || port === 3306 || !uuid || !datadir ||
    !path.resolve(datadir).toLowerCase().includes('sgpa-jerarquia-') ||
    !/^sgpa_cursos_qa[a-z0-9_]+$/.test(schema || '')) {
  throw new Error('Se requieren puerto, UUID, datadir efimero y un esquema sgpa_cursos_qa* nuevos.');
}
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

async function identity(connection) {
  const [[row]] = await connection.query('SELECT DATABASE() db, @@port port, @@server_uuid uuid, @@datadir datadir');
  return row;
}

async function main() {
  const source = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE });
  const target = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password: '' });
  let ds;
  try {
    const [src, dst] = await Promise.all([identity(source), identity(target)]);
    assert.ok(['sgpa', 'sgpa_test'].includes(src.db));
    assert.equal(dst.db, null);
    assert.equal(Number(dst.port), port);
    assert.equal(dst.uuid, uuid);
    assert.equal(path.resolve(dst.datadir).toLowerCase(), path.resolve(datadir).toLowerCase());
    assert.notEqual(dst.uuid, src.uuid);
    assert.notEqual(path.resolve(dst.datadir).toLowerCase(), path.resolve(src.datadir).toLowerCase());
    const [exists] = await target.query('SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [schema]);
    assert.equal(exists.length, 0, 'El esquema temporal ya existe; se rehusa modificarlo.');
    await target.query(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await target.changeUser({ database: schema });
    for (const table of ['usuarios', 'carreras', 'planes_estudio', 'cursos', 'curso_carreras',
      'plan_asignaturas', 'curso_requisitos', 'curso_optativas']) {
      const [[ddl]] = await source.query(`SHOW CREATE TABLE \`${table}\``);
      await target.query(ddl['Create Table']);
    }
    ds = new DataSource({ type: 'mysql', host: '127.0.0.1', port, username: 'root', password: '',
      database: schema, synchronize: false, migrationsRun: false });
    await ds.initialize();
    const runner = ds.createQueryRunner();
    await new AddHierarchicalAccess2026101900000().up(runner);
    await runner.release();

    const [users] = await target.query("INSERT INTO usuarios (cedula,nombres,apellido1,correo,password_hash) VALUES ('QA-C-1','Coord','Cursos','coord-c@qa.test','x'),('QA-C-2','Asistente','Cursos','asist-c@qa.test','x')");
    const coordinatorId = users.insertId;
    const assistantId = coordinatorId + 1;
    const [careers] = await target.query("INSERT INTO carreras (codigo,nombre) VALUES ('QA-SIS','QA Sistemas'),('QA-COM','QA Comercio')");
    const sis = careers.insertId;
    const com = sis + 1;
    const [plans] = await target.query("INSERT INTO planes_estudio (carrera_id,grado,codigo,nombre) VALUES (?,'BACHILLERATO','QA-P1','QA Plan 1'),(?,'BACHILLERATO','QA-P2','QA Plan 2')", [sis, com]);
    const planSis = plans.insertId;
    const [subjects] = await target.query("INSERT INTO plan_asignaturas (plan_estudio_id,nivel,ciclo,orden,creditos,tipo,codigo_referencia,nombre_referencia) VALUES (?,1,1,1,3,'OBLIGATORIA','QA-101','QA Curso Uno'),(?,1,1,1,3,'OBLIGATORIA','QA-201','QA Curso Dos')", [planSis, planSis + 1]);
    const subjectId = subjects.insertId;
    await target.query('INSERT INTO dependencias_usuario (asistente_id,coordinador_id,creado_por_usuario_id) VALUES (?,?,?)', [assistantId, coordinatorId, coordinatorId]);
    for (const careerId of [sis, com]) {
      await target.query("INSERT INTO permisos_carrera (usuario_id,carrera_id,permiso) VALUES (?,?, 'CURSOS_GESTIONAR'),(?,?, 'CURSOS_GESTIONAR')", [coordinatorId, careerId, assistantId, careerId]);
    }

    const proposed = JSON.stringify({ planAsignaturaId: subjectId, descripcion: 'pendiente', carrerasAfectadas: [sis] });
    const [request] = await target.query("INSERT INTO solicitudes_cambio (solicitante_id,coordinador_id,carrera_id,modulo,operacion,datos_propuestos,estado,correlacion_id) VALUES (?,?,?,'CURSOS','CREAR',?,'PENDIENTE',UUID())", [assistantId, coordinatorId, sis, proposed]);
    const [[before]] = await target.query("SELECT COUNT(*) total FROM cursos WHERE codigo='QA-101'");
    assert.equal(Number(before.total), 0, 'Una solicitud pendiente altero el catalogo oficial.');

    // El mismo limite transaccional usado por la aprobacion: operacion, solicitud y auditoria confirman juntos.
    await target.beginTransaction();
    const [[locked]] = await target.query('SELECT estado FROM solicitudes_cambio WHERE id=? FOR UPDATE', [request.insertId]);
    assert.equal(locked.estado, 'PENDIENTE');
    const [course] = await target.query("INSERT INTO cursos (codigo,nombre,descripcion) VALUES ('QA-101','QA Curso Uno','aprobado')");
    await target.query('INSERT INTO curso_carreras (curso_id,carrera_id) VALUES (?,?)', [course.insertId, sis]);
    await target.query('UPDATE plan_asignaturas SET curso_id=? WHERE id=? AND curso_id IS NULL', [course.insertId, subjectId]);
    await target.query("UPDATE solicitudes_cambio SET estado='APROBADA',resultado_aplicado=?,resuelto_por_usuario_id=?,resuelto_en=NOW() WHERE id=?", [JSON.stringify({ cursoId: course.insertId }), coordinatorId, request.insertId]);
    await target.query("INSERT INTO auditoria_jerarquia (actor_usuario_id,objetivo_usuario_id,accion,detalle) VALUES (?,?,'APROBAR_SOLICITUD',?)", [coordinatorId, assistantId, JSON.stringify({ solicitudId: request.insertId, cursoId: course.insertId })]);
    await target.commit();
    const [[applied]] = await target.query('SELECT s.estado,pa.curso_id cursoId FROM solicitudes_cambio s JOIN plan_asignaturas pa ON pa.id=? WHERE s.id=?', [subjectId, request.insertId]);
    assert.equal(applied.estado, 'APROBADA');
    assert.equal(Number(applied.cursoId), course.insertId);

    // Curso compartido: faltar una sola carrera invalida la autorizacion global.
    await target.query('INSERT INTO curso_carreras (curso_id,carrera_id) VALUES (?,?)', [course.insertId, com]);
    await target.query("DELETE FROM permisos_carrera WHERE usuario_id=? AND carrera_id=? AND permiso='CURSOS_GESTIONAR'", [assistantId, com]);
    const [[scope]] = await target.query("SELECT COUNT(DISTINCT cc.carrera_id)=COUNT(DISTINCT pc.carrera_id) autorizado FROM curso_carreras cc LEFT JOIN permisos_carrera pc ON pc.carrera_id=cc.carrera_id AND pc.usuario_id=? AND pc.permiso='CURSOS_GESTIONAR' WHERE cc.curso_id=?", [assistantId, course.insertId]);
    assert.equal(Number(scope.autorizado), 0);

    // Una falla de auditoria revierte todos los efectos oficiales.
    await target.beginTransaction();
    await target.query("UPDATE cursos SET descripcion='no debe confirmar' WHERE id=?", [course.insertId]);
    await assert.rejects(() => target.query("INSERT INTO auditoria_jerarquia (actor_usuario_id,objetivo_usuario_id,accion,detalle) VALUES (999999,?,'APROBAR_SOLICITUD',JSON_OBJECT())", [assistantId]), (e) => e.code === 'ER_NO_REFERENCED_ROW_2');
    await target.rollback();
    const [[rolledBack]] = await target.query('SELECT descripcion FROM cursos WHERE id=?', [course.insertId]);
    assert.equal(rolledBack.descripcion, 'aprobado');

    // Requisito duplicado queda protegido por la restriccion real del esquema.
    const [secondCourse] = await target.query("INSERT INTO cursos (codigo,nombre) VALUES ('QA-201','QA Curso Dos')");
    await target.query('INSERT INTO curso_carreras (curso_id,carrera_id) VALUES (?,?)', [secondCourse.insertId, sis]);
    await target.query("INSERT INTO curso_requisitos (curso_id,requisito_curso_id,tipo) VALUES (?,?,'REQUISITO')", [secondCourse.insertId, course.insertId]);
    await assert.rejects(() => target.query("INSERT INTO curso_requisitos (curso_id,requisito_curso_id,tipo) VALUES (?,?,'REQUISITO')", [secondCourse.insertId, course.insertId]), (e) => e.code === 'ER_DUP_ENTRY');
    console.log('PASS: identidad aislada, pendiente sin efectos, aplicacion atomica, recurso compartido, rollback y requisito unico.');
  } finally {
    if (ds?.isInitialized) await ds.destroy();
    await target.end();
    await source.end();
  }
}
main().catch((error) => { console.error(`FAIL: ${error.message}`); process.exitCode = 1; });
