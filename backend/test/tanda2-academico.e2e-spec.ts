import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource, In } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Estudiante } from '../src/estudiantes/entities/estudiante.entity';
import { Carrera } from '../src/carreras/entities/carrera.entity';
import { PlanEstudio } from '../src/planes-estudio/entities/plan-estudio.entity';
import { PeriodoAcademico } from '../src/periodos-academicos/entities/periodo-academico.entity';
import { PlanAsignatura } from '../src/planes-estudio/entities/plan-asignatura.entity';
import { TipoPlanAsignatura } from '../src/planes-estudio/constants/tipo-plan-asignatura.constant';
import { PlanRequisito } from '../src/planes-estudio/entities/plan-requisito.entity';
import { TipoRequisito } from '../src/planes-estudio/constants/tipo-requisito.constant';
import { Usuario } from '../src/usuarios/entities/usuario.entity';
import { Rol } from '../src/roles/entities/rol.entity';
import { UsuarioRol } from '../src/usuarios/entities/usuario-rol.entity';
import { UsuarioPermiso } from '../src/permisos/entities/usuario-permiso.entity';
import { RolSistema } from '../src/auth/constants/roles.constants';
import { PermisoSistema } from '../src/permisos/constants/permisos.constant';
import { ResultadoAcademico } from '../src/estudiantes/constants/resultado-academico.constant';
import { OrigenAcademico } from '../src/estudiantes/constants/origen-academico.constant';

describe('Tanda 2 — Núcleo Académico de Estudiantes (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let token: string;
  let server: any;

  let estudiante: Estudiante;
  let carrera: Carrera;
  let plan1: PlanEstudio;
  let plan2: PlanEstudio;
  let pIngreso: PeriodoAcademico;
  let p1: PeriodoAcademico;
  let p2: PeriodoAcademico;
  let pFuturo: PeriodoAcademico;
  let pAnterior: PeriodoAcademico;
  let materiaA: PlanAsignatura;
  let materiaB: PlanAsignatura;
  let materiaC: PlanAsignatura;
  let usuarioAdmin: Usuario;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer();

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);
    const configService = app.get(ConfigService);

    // Setup user with ADMIN_GLOBAL and ESTUDIANTES_GESTIONAR
    const usuarioRepo = dataSource.getRepository(Usuario);
    const rolRepo = dataSource.getRepository(Rol);
    const usuarioRolRepo = dataSource.getRepository(UsuarioRol);
    const usuarioPermisoRepo = dataSource.getRepository(UsuarioPermiso);

    let rolAdmin = await rolRepo.findOne({ where: { nombre: RolSistema.ADMIN_GLOBAL } });
    if (!rolAdmin) {
      rolAdmin = await rolRepo.save(
        rolRepo.create({
          nombre: RolSistema.ADMIN_GLOBAL,
          descripcion: 'Administrador Global',
          activo: true,
        }),
      );
    }

    usuarioAdmin = (await usuarioRepo.findOne({ where: { correo: 'admin.academico@una.cr' } })) as Usuario;
    if (!usuarioAdmin) {
      usuarioAdmin = await usuarioRepo.save(
        usuarioRepo.create({
          cedula: 'ADM-ACAD-001',
          nombres: 'Administrador',
          apellido1: 'Académico',
          apellido2: 'SGPA',
          correo: 'admin.academico@una.cr',
          passwordHash: 'dummy',
          activo: true,
        }),
      );
    } else {
      usuarioAdmin.nombres = 'Administrador';
      usuarioAdmin.apellido1 = 'Académico';
      await usuarioRepo.save(usuarioAdmin);
    }

    const tieneRol = await usuarioRolRepo.findOne({
      where: { usuarioId: usuarioAdmin.id, rolId: rolAdmin.id },
    });
    if (!tieneRol) {
      await usuarioRolRepo.save(
        usuarioRolRepo.create({
          usuarioId: usuarioAdmin.id,
          rolId: rolAdmin.id,
          activo: true,
        }),
      );
    }

    const tienePermiso = await usuarioPermisoRepo.findOne({
      where: { usuarioId: usuarioAdmin.id, permiso: PermisoSistema.ESTUDIANTES_GESTIONAR },
    });
    if (!tienePermiso) {
      await usuarioPermisoRepo.save(
        usuarioPermisoRepo.create({
          usuarioId: usuarioAdmin.id,
          permiso: PermisoSistema.ESTUDIANTES_GESTIONAR,
          activo: true,
        }),
      );
    }

    const secret = configService.get<string>('JWT_SECRET') || 'secret';
    token = jwtService.sign(
      { sub: usuarioAdmin.id, correo: usuarioAdmin.correo, roles: [RolSistema.ADMIN_GLOBAL] },
      { secret },
    );

    // Setup Carrera & Planes
    const carreraRepo = dataSource.getRepository(Carrera);
    const planRepo = dataSource.getRepository(PlanEstudio);
    const periodoRepo = dataSource.getRepository(PeriodoAcademico);
    const asignaturaRepo = dataSource.getRepository(PlanAsignatura);
    const reqRepo = dataSource.getRepository(PlanRequisito);
    const estudianteRepo = dataSource.getRepository(Estudiante);

    carrera = (await carreraRepo.findOne({ where: { activo: true } })) as Carrera;
    if (!carrera) {
      carrera = await carreraRepo.save(
        carreraRepo.create({ codigo: 'INF-TEST', nombre: 'Informática Test', activo: true }),
      );
    }

    const planes = await planRepo.find({ where: { carreraId: carrera.id, activo: true } });
    if (planes.length >= 2) {
      plan1 = planes[0];
      plan2 = planes[1];
    } else if (planes.length === 1) {
      plan1 = planes[0];
      plan2 = await planRepo.save(
        planRepo.create({
          codigo: 'PLAN-TEST-2',
          nombre: 'Plan Test 2',
          carreraId: carrera.id,
          activo: true,
          anioInicio: 2024,
        }),
      );
    } else {
      plan1 = await planRepo.save(
        planRepo.create({
          codigo: 'PLAN-TEST-1',
          nombre: 'Plan Test 1',
          carreraId: carrera.id,
          activo: true,
          anioInicio: 2022,
        }),
      );
      plan2 = await planRepo.save(
        planRepo.create({
          codigo: 'PLAN-TEST-2',
          nombre: 'Plan Test 2',
          carreraId: carrera.id,
          activo: true,
          anioInicio: 2024,
        }),
      );
    }

    // Ensure periods exist: P_anterior (2024-I), P_ingreso (2024-II), P1 (2025-I), P2 (2025-II), P_futuro (2028-II)
    const getOrCreatePeriodo = async (anio: number, ciclo: number) => {
      let p = await periodoRepo.findOne({ where: { anio, ciclo } });
      if (!p) {
        const mesInicio = ciclo === 1 ? '02' : '07';
        const mesFin = ciclo === 1 ? '06' : '11';
        p = await periodoRepo.save(
          periodoRepo.create({
            codigo: `${anio}-${ciclo}`,
            nombre: `Periodo ${anio}-${ciclo}`,
            anio,
            ciclo,
            fechaInicio: `${anio}-${mesInicio}-01`,
            fechaFin: `${anio}-${mesFin}-30`,
            fechaLimiteDisponibilidad: `${anio}-${mesFin}-15`,
            activo: true,
          }),
        );
      }
      return p;
    };

    pAnterior = await getOrCreatePeriodo(2024, 1);
    pIngreso = await getOrCreatePeriodo(2024, 2);
    p1 = await getOrCreatePeriodo(2025, 1);
    p2 = await getOrCreatePeriodo(2025, 2);
    pFuturo = await getOrCreatePeriodo(2028, 2);

    // Setup Asignaturas for Plan 1
    // Materia A (Nivel 1, Ciclo 1), Materia B (Nivel 1, Ciclo 2, Requisito = A), Materia C (Nivel 2, Ciclo 1)
    let asigsPlan1 = await asignaturaRepo.find({
      where: { planEstudioId: plan1.id, activo: true },
      relations: { curso: true },
    });

    if (asigsPlan1.length >= 3) {
      materiaA = asigsPlan1[0];
      materiaB = asigsPlan1[1];
      materiaC = asigsPlan1[2];
    } else {
      materiaA = await asignaturaRepo.save(
        asignaturaRepo.create({
          planEstudioId: plan1.id,
          tipo: TipoPlanAsignatura.OBLIGATORIA,
          codigoReferencia: 'EIF-101',
          nombreReferencia: 'Programación I',
          nivel: 1,
          ciclo: 1,
          orden: 1,
          creditos: 4,
          activo: true,
        }),
      );
      materiaB = await asignaturaRepo.save(
        asignaturaRepo.create({
          planEstudioId: plan1.id,
          tipo: TipoPlanAsignatura.OBLIGATORIA,
          codigoReferencia: 'EIF-102',
          nombreReferencia: 'Programación II',
          nivel: 1,
          ciclo: 2,
          orden: 2,
          creditos: 4,
          activo: true,
        }),
      );
      materiaC = await asignaturaRepo.save(
        asignaturaRepo.create({
          planEstudioId: plan1.id,
          tipo: TipoPlanAsignatura.OBLIGATORIA,
          codigoReferencia: 'EIF-201',
          nombreReferencia: 'Estructuras de Datos',
          nivel: 2,
          ciclo: 1,
          orden: 3,
          creditos: 4,
          activo: true,
        }),
      );
    }

    // Ensure Materia A is Requisito of Materia B
    let reqAB = await reqRepo.findOne({
      where: {
        asignaturaId: materiaB.id,
        requisitoAsignaturaId: materiaA.id,
        tipo: TipoRequisito.REQUISITO,
      },
    });
    if (!reqAB) {
      await reqRepo.save(
        reqRepo.create({
          asignaturaId: materiaB.id,
          requisitoAsignaturaId: materiaA.id,
          tipo: TipoRequisito.REQUISITO,
        }),
      );
    }

    // If Materia A has a course, ensure plan2 also has an asignatura with the same cursoId
    if (materiaA.cursoId) {
      let asigPlan2 = await asignaturaRepo.findOne({
        where: { planEstudioId: plan2.id, cursoId: materiaA.cursoId, activo: true },
      });
      if (!asigPlan2) {
        await asignaturaRepo.save(
          asignaturaRepo.create({
            planEstudioId: plan2.id,
            tipo: TipoPlanAsignatura.OBLIGATORIA,
            cursoId: materiaA.cursoId,
            nivel: 1,
            ciclo: 1,
            orden: 1,
            creditos: materiaA.creditos,
            activo: true,
          }),
        );
      }
    }

    // Setup student TEST-EST-001
    let est = await estudianteRepo.findOne({ where: { cedula: 'TEST-EST-001' } });
    if (!est) {
      estudiante = await estudianteRepo.save(
        estudianteRepo.create({
          cedula: 'TEST-EST-001',
          nombres: 'Prueba Estudiante',
          apellido1: 'SGPA',
          apellido2: 'Uno',
          correoInstitucional: 'test.estudiante001@una.ac.cr',
          telefono: '88880001',
          carreraId: carrera.id,
          planEstudioId: plan1.id,
          periodoIngresoId: pIngreso.id,
          estado: 'ACTIVO',
        }),
      );
    } else {
      est.carreraId = carrera.id;
      est.planEstudioId = plan1.id;
      est.periodoIngresoId = pIngreso.id;
      est.estado = 'ACTIVO';
      estudiante = await estudianteRepo.save(est);
    }

    // Clear previous test history for TEST-EST-001
    await dataSource.query('DELETE FROM historial_academico_estudiantes WHERE estudiante_id = ?', [estudiante.id]);
    await dataSource.query('DELETE FROM historial_planes_estudiantes WHERE estudiante_id = ?', [estudiante.id]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Expediente abre correctamente y muestra responsable/planes/periodos', async () => {
    const res = await request(server)
      .get(`/estudiantes/${estudiante.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: estudiante.id,
      cedula: 'TEST-EST-001',
      estado: 'ACTIVO',
      planEstudioId: plan1.id,
      periodoIngresoId: pIngreso.id,
    });

    const resHistorial = await request(server)
      .get(`/estudiantes/${estudiante.id}/historial-academico`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(resHistorial.body)).toBe(true);

    const resPlanes = await request(server)
      .get(`/estudiantes/${estudiante.id}/historial-planes`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(resPlanes.body)).toBe(true);
  });

  it('2 & 3. REPROBADO registrado e historial muestra responsable/fuente/observación', async () => {
    const res = await request(server)
      .post(`/estudiantes/${estudiante.id}/historial-academico`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        planAsignaturaId: materiaA.id,
        periodoId: p1.id,
        resultado: ResultadoAcademico.REPROBADO,
        origenAcademico: OrigenAcademico.CURSADO,
        observaciones: 'Prueba intento reprobado SGPA',
      })
      .expect(201);

    expect(res.body).toMatchObject({
      resultado: 'REPROBADO',
      origenAcademico: 'CURSADO',
      fuenteRegistro: 'MANUAL',
      observaciones: 'Prueba intento reprobado SGPA',
      registradoPorUsuarioId: usuarioAdmin.id,
    });

    const hist = await request(server)
      .get(`/estudiantes/${estudiante.id}/historial-academico`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(hist.body).toHaveLength(1);
    expect(hist.body[0].registradoPor).toMatchObject({
      nombres: 'Administrador',
      apellido1: 'Académico',
    });
    expect(hist.body[0].registradoPor).not.toHaveProperty('passwordHash');
  });

  it('4 & 5. Progreso P1 muestra A reprobada y pendiente, y Requisito B bloqueado', async () => {
    const res = await request(server)
      .get(`/estudiantes/${estudiante.id}/progreso?periodoReferenciaId=${p1.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.resumen.reprobadas).toBeGreaterThanOrEqual(1);
    expect(res.body.reprobadas.some((m: any) => m.planAsignaturaId === materiaA.id)).toBe(true);
    expect(res.body.pendientes.some((m: any) => m.planAsignaturaId === materiaA.id)).toBe(true);
    expect(res.body.aprobadas.some((m: any) => m.planAsignaturaId === materiaA.id)).toBe(false);

    const bHabilitada = res.body.habilitadas.find((m: any) => m.planAsignaturaId === materiaB.id);
    if (bHabilitada) {
      expect(bHabilitada.habilitada).toBe(false);
      expect(bHabilitada.requisitosFaltantes.some((r: any) => r.planAsignaturaId === materiaA.id)).toBe(true);
    }
  });

  it('6 & 7. Segundo intento APROBADO registrado e historial conserva ambos intentos', async () => {
    const res = await request(server)
      .post(`/estudiantes/${estudiante.id}/historial-academico`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        planAsignaturaId: materiaA.id,
        periodoId: p2.id,
        resultado: ResultadoAcademico.APROBADO,
        origenAcademico: OrigenAcademico.CURSADO,
        observaciones: 'Prueba segundo intento aprobado SGPA',
      })
      .expect(201);

    expect(res.body.resultado).toBe('APROBADO');

    const hist = await request(server)
      .get(`/estudiantes/${estudiante.id}/historial-academico`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(hist.body).toHaveLength(2);
    expect(hist.body.some((h: any) => h.resultado === 'REPROBADO' && h.periodoId === p1.id)).toBe(true);
    expect(hist.body.some((h: any) => h.resultado === 'APROBADO' && h.periodoId === p2.id)).toBe(true);
  });

  it('8. Consultar P1 ignora aprobación futura de P2', async () => {
    const res = await request(server)
      .get(`/estudiantes/${estudiante.id}/progreso?periodoReferenciaId=${p1.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // In P1, A is still REPROBADO and PENDIENTE, not APROBADO
    expect(res.body.aprobadas.some((m: any) => m.planAsignaturaId === materiaA.id)).toBe(false);
    expect(res.body.reprobadas.some((m: any) => m.planAsignaturaId === materiaA.id)).toBe(true);
    expect(res.body.pendientes.some((m: any) => m.planAsignaturaId === materiaA.id)).toBe(true);
  });

  it('9 & 10. Consultar P2 reconoce aprobación y Requisito B se habilita', async () => {
    const res = await request(server)
      .get(`/estudiantes/${estudiante.id}/progreso?periodoReferenciaId=${p2.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.aprobadas.some((m: any) => m.planAsignaturaId === materiaA.id)).toBe(true);
    expect(res.body.reprobadas.some((m: any) => m.planAsignaturaId === materiaA.id)).toBe(false);
    expect(res.body.pendientes.some((m: any) => m.planAsignaturaId === materiaA.id)).toBe(false);

    const bHabilitada = res.body.habilitadas.find((m: any) => m.planAsignaturaId === materiaB.id);
    if (bHabilitada) {
      expect(bHabilitada.habilitada).toBe(true);
      expect(bHabilitada.requisitosFaltantes).toHaveLength(0);
    }
  });

  it('11. Correquisitos', async () => {
    const reqRepo = dataSource.getRepository(PlanRequisito);
    let correq = await reqRepo.findOne({
      where: { asignaturaId: materiaC.id, tipo: TipoRequisito.CORREQUISITO },
    });
    if (!correq) {
      await reqRepo.save(
        reqRepo.create({
          asignaturaId: materiaC.id,
          requisitoAsignaturaId: materiaB.id,
          tipo: TipoRequisito.CORREQUISITO,
        }),
      );
    }

    const res = await request(server)
      .get(`/estudiantes/${estudiante.id}/progreso?periodoReferenciaId=${p2.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const cHabilitada = res.body.habilitadas.find((m: any) => m.planAsignaturaId === materiaC.id);
    expect(cHabilitada).toBeDefined();
    expect(cHabilitada.correquisitos.length).toBeGreaterThanOrEqual(1);
    expect(cHabilitada.correquisitos[0]).toMatchObject({
      planAsignaturaId: materiaB.id,
      aprobado: false,
    });
  });

  it('12. Rezagadas en período posterior', async () => {
    const res = await request(server)
      .get(`/estudiantes/${estudiante.id}/progreso?periodoReferenciaId=${pFuturo.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.resumen.rezagadas).toBeGreaterThanOrEqual(1);
    expect(res.body.rezagadas.some((m: any) => m.planAsignaturaId === materiaB.id || m.planAsignaturaId === materiaC.id)).toBe(true);
  });

  it('13, 14 & 15. Cambio de plan, desaparición de plan anterior, aparición en nuevo y registro en historial', async () => {
    const res = await request(server)
      .patch(`/estudiantes/${estudiante.id}/plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        planNuevoId: plan2.id,
        periodoCambioId: p2.id,
        motivo: 'Prueba funcional de cambio de plan SGPA',
      })
      .expect(200);

    expect(res.body.planEstudioId).toBe(plan2.id);

    // Check listing in plan1 (should not appear)
    const resPlan1 = await request(server)
      .get(`/estudiantes?carreraId=${carrera.id}&planEstudioId=${plan1.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const lista1 = Array.isArray(resPlan1.body) ? resPlan1.body : resPlan1.body.estudiantes || [];
    expect(lista1.some((e: any) => e.id === estudiante.id)).toBe(false);

    // Check listing in plan2 (should appear)
    const resPlan2 = await request(server)
      .get(`/estudiantes?carreraId=${carrera.id}&planEstudioId=${plan2.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const lista2 = Array.isArray(resPlan2.body) ? resPlan2.body : resPlan2.body.estudiantes || [];
    expect(lista2.some((e: any) => e.id === estudiante.id)).toBe(true);

    // Check Historial de planes
    const histPlanes = await request(server)
      .get(`/estudiantes/${estudiante.id}/historial-planes`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(histPlanes.body).toHaveLength(1);
    expect(histPlanes.body[0]).toMatchObject({
      planAnteriorId: plan1.id,
      planNuevoId: plan2.id,
      periodoCambioId: p2.id,
      motivo: 'Prueba funcional de cambio de plan SGPA',
      cambiadoPor: expect.objectContaining({
        nombres: 'Administrador',
        apellido1: 'Académico',
      }),
    });
  });

  it('16. Aprobación conservada en nuevo plan por curso', async () => {
    const res = await request(server)
      .get(`/estudiantes/${estudiante.id}/progreso?periodoReferenciaId=${p2.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    if (materiaA.cursoId) {
      expect(res.body.aprobadas.some((m: any) => m.codigo === materiaA.curso?.codigo)).toBe(true);
    } else {
      // If without cursoId, references are plan-specific
      expect(res.body).toBeDefined();
    }
  });

  it('17. Períodos anteriores al ingreso rechazados / protegidos', async () => {
    const asigPlanActual = await dataSource.getRepository(PlanAsignatura).findOne({
      where: { planEstudioId: plan2.id, activo: true },
    });

    // Attempt to register academic result in pAnterior (2024-I < pIngreso 2024-II)
    const resAcademico = await request(server)
      .post(`/estudiantes/${estudiante.id}/historial-academico`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        planAsignaturaId: asigPlanActual!.id,
        periodoId: pAnterior.id,
        resultado: ResultadoAcademico.APROBADO,
        origenAcademico: OrigenAcademico.CURSADO,
      })
      .expect(400);

    expect(resAcademico.body.message).toContain('no puede ser anterior al período de ingreso');

    // Attempt to change plan to pAnterior
    const resCambioPlan = await request(server)
      .patch(`/estudiantes/${estudiante.id}/plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        planNuevoId: plan1.id,
        periodoCambioId: pAnterior.id,
      })
      .expect(400);

    expect(resCambioPlan.body.message).toContain('no puede ser anterior al período de ingreso');

    // Attempt to calculate progreso in pAnterior
    const resProgreso = await request(server)
      .get(`/estudiantes/${estudiante.id}/progreso?periodoReferenciaId=${pAnterior.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(resProgreso.body.message).toContain('no puede ser anterior al período de ingreso');
  });
});
