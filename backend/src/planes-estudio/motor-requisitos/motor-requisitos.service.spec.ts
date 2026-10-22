import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoRequisito } from '../constants/tipo-requisito.constant';
import { PlanAsignatura } from '../entities/plan-asignatura.entity';
import { PlanEstudio } from '../entities/plan-estudio.entity';
import { PlanRequisito } from '../entities/plan-requisito.entity';
import { MotorRequisitosService } from './motor-requisitos.service';
import { PoliticaCorrequisito } from './types/motor-reglas.types';

describe('MotorRequisitosService (Subfases 1B y 1C - Integración)', () => {
  let service: MotorRequisitosService;
  let planRepo: jest.Mocked<Repository<PlanEstudio>>;
  let asignaturaRepo: jest.Mocked<Repository<PlanAsignatura>>;
  let requisitoRepo: jest.Mocked<Repository<PlanRequisito>>;

  const mockPlan = (id = 1, activo = true, carreraId = 10): PlanEstudio =>
    ({
      id,
      nombre: 'Bachillerato en Informática 2026',
      codigo: 'INF-2026',
      carreraId,
      activo,
      carrera: { id: carreraId, nombre: 'Informática' } as any,
    }) as PlanEstudio;

  const mockAsignatura = (
    id: number,
    planEstudioId: number,
    codigo: string,
    nombre: string,
    nivel: number,
    ciclo: number,
    orden: number,
    activo = true,
  ): PlanAsignatura =>
    ({
      id,
      planEstudioId,
      codigoReferencia: codigo,
      nombreReferencia: nombre,
      nivel,
      ciclo,
      orden,
      creditos: 4,
      activo,
      curso: { id: id * 10, codigo, nombre } as any,
    }) as PlanAsignatura;

  const mockRequisito = (
    id: number,
    asignaturaId: number,
    requisitoAsignaturaId: number,
    planEstudioId = 1,
    tipo: TipoRequisito = TipoRequisito.REQUISITO,
  ): PlanRequisito =>
    ({
      id,
      asignaturaId,
      requisitoAsignaturaId,
      tipo,
      asignatura: { id: asignaturaId, planEstudioId } as PlanAsignatura,
      requisitoAsignatura: {
        id: requisitoAsignaturaId,
        planEstudioId,
      } as PlanAsignatura,
    }) as PlanRequisito;

  beforeEach(async () => {
    const mockRepo = () => ({
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorRequisitosService,
        {
          provide: getRepositoryToken(PlanEstudio),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(PlanAsignatura),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(PlanRequisito),
          useFactory: mockRepo,
        },
      ],
    }).compile();

    service = module.get<MotorRequisitosService>(MotorRequisitosService);
    planRepo = module.get(getRepositoryToken(PlanEstudio));
    asignaturaRepo = module.get(getRepositoryToken(PlanAsignatura));
    requisitoRepo = module.get(getRepositoryToken(PlanRequisito));
  });

  describe('obtenerEstructuraPlan', () => {
    it('lanza NotFoundException si el plan no existe', async () => {
      planRepo.findOne.mockResolvedValue(null);

      await expect(service.obtenerEstructuraPlan(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza BadRequestException si el plan está inactivo y exigirActivo es true', async () => {
      planRepo.findOne.mockResolvedValue(mockPlan(1, false));

      await expect(service.obtenerEstructuraPlan(1, true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('retorna la estructura limpia de asignaturas y requisitos del plan', async () => {
      const plan = mockPlan(1, true);
      planRepo.findOne.mockResolvedValue(plan);

      const asigs = [
        mockAsignatura(1, 1, 'EIF201', 'Prog I', 1, 1, 1),
        mockAsignatura(2, 1, 'EIF202', 'Prog II', 1, 2, 2),
      ];
      asignaturaRepo.find.mockResolvedValue(asigs);

      const reqs = [mockRequisito(101, 2, 1, 1)];
      requisitoRepo.find.mockResolvedValue(reqs);

      const estructura = await service.obtenerEstructuraPlan(1);

      expect(estructura.plan.id).toBe(1);
      expect(estructura.asignaturas).toHaveLength(2);
      expect(estructura.asignaturas[0].codigo).toBe('EIF201');
      expect(estructura.requisitos).toHaveLength(1);
      expect(estructura.requisitos[0].asignaturaId).toBe(2);
      expect(estructura.requisitos[0].requisitoAsignaturaId).toBe(1);
    });

    it('no habilita erróneamente una asignatura si su requisito apunta a otro plan o es inconsistente', async () => {
      planRepo.findOne.mockResolvedValue(mockPlan(1, true));
      asignaturaRepo.find.mockResolvedValue([
        mockAsignatura(1, 1, 'EIF201', 'Prog I', 1, 1, 1),
      ]);

      // Requisito inconsistente donde el requisito pertenece a otro plan o catálogo ajeno
      const reqContaminado: PlanRequisito = {
        id: 99,
        asignaturaId: 1,
        requisitoAsignaturaId: 88,
        tipo: TipoRequisito.REQUISITO,
        asignatura: { id: 1, planEstudioId: 1 } as PlanAsignatura,
        requisitoAsignatura: { id: 88, planEstudioId: 2 } as PlanAsignatura, // Plan ajeno
        createdAt: new Date(),
      };

      requisitoRepo.find.mockResolvedValue([reqContaminado]);

      const resultado = await service.evaluarSeleccionEstudiante(1, [1]);

      // El requisito se preserva para detectar la anomalía y bloquear la asignatura
      expect(resultado.esValido).toBe(false);
      expect(resultado.inconsistenciasGrafo.some((msg) => msg.includes('#88'))).toBe(true);
      expect(resultado.mapaAsignaturas.get(1)?.estado).toBe('BLOQUEADA');
    });

    it('mantiene bloqueada una asignatura si su requisito está inactivo en el plan', async () => {
      planRepo.findOne.mockResolvedValue(mockPlan(1, true));
      asignaturaRepo.find.mockResolvedValue([
        mockAsignatura(1, 1, 'EIF201', 'Prog I', 1, 1, 1, false), // Inactiva
        mockAsignatura(2, 1, 'EIF202', 'Prog II', 1, 2, 1, true),  // Activa
      ]);
      requisitoRepo.find.mockResolvedValue([mockRequisito(1, 2, 1, 1)]);

      const resultado = await service.evaluarSeleccionEstudiante(1, [1, 2]);

      expect(resultado.esValido).toBe(false);
      expect(resultado.inconsistenciasGrafo.some((msg) => msg.includes('inactiva'))).toBe(true);
      expect(resultado.mapaAsignaturas.get(2)?.estado).toBe('BLOQUEADA');
    });
  });

  describe('evaluarSeleccionEstudiante', () => {
    it('evalúa correctamente las asignaturas del plan contra la selección del estudiante', async () => {
      planRepo.findOne.mockResolvedValue(mockPlan(1, true));
      asignaturaRepo.find.mockResolvedValue([
        mockAsignatura(1, 1, 'EIF201', 'Prog I', 1, 1, 1),
        mockAsignatura(2, 1, 'EIF202', 'Prog II', 1, 2, 1),
        mockAsignatura(3, 1, 'EIF203', 'Prog III', 2, 1, 1),
      ]);
      requisitoRepo.find.mockResolvedValue([
        mockRequisito(1, 2, 1, 1),
        mockRequisito(2, 3, 2, 1),
      ]);

      const resultado = await service.evaluarSeleccionEstudiante(1, [1, 2]);

      expect(resultado.esValido).toBe(true);
      expect(resultado.aprobadasValidas).toEqual([1, 2]);
      expect(resultado.mapaAsignaturas.get(3)?.estado).toBe('HABILITADA');
      expect(resultado.desmarcadasCascada).toHaveLength(0);
    });
  });

  describe('validarSeleccionEstricta (Zero-Trust Backend)', () => {
    it('acepta una selección cuando todos los requisitos están legítimamente cumplidos', async () => {
      planRepo.findOne.mockResolvedValue(mockPlan(1, true));
      asignaturaRepo.find.mockResolvedValue([
        mockAsignatura(1, 1, 'EIF201', 'Prog I', 1, 1, 1),
        mockAsignatura(2, 1, 'EIF202', 'Prog II', 1, 2, 1),
      ]);
      requisitoRepo.find.mockResolvedValue([mockRequisito(1, 2, 1, 1)]);

      const res = await service.validarSeleccionEstricta(1, [1, 2]);

      expect(res.esValido).toBe(true);
      expect(res.aprobadasValidas).toEqual([1, 2]);
    });

    it('rechaza con BadRequestException si el estudiante envía una asignatura sin cumplir su requisito', async () => {
      planRepo.findOne.mockResolvedValue(mockPlan(1, true));
      asignaturaRepo.find.mockResolvedValue([
        mockAsignatura(1, 1, 'EIF201', 'Prog I', 1, 1, 1),
        mockAsignatura(2, 1, 'EIF202', 'Prog II', 1, 2, 1),
      ]);
      requisitoRepo.find.mockResolvedValue([mockRequisito(1, 2, 1, 1)]);

      // Intenta enviar Prog II [2] sin Prog I
      await expect(service.validarSeleccionEstricta(1, [2])).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validarSeleccionEstricta(1, [2])).rejects.toThrow(
        /no puede marcarse como aprobada porque falta su requisito previo/,
      );
    });

    it('rechaza con BadRequestException si se envían IDs ajenos al plan', async () => {
      planRepo.findOne.mockResolvedValue(mockPlan(1, true));
      asignaturaRepo.find.mockResolvedValue([
        mockAsignatura(1, 1, 'EIF201', 'Prog I', 1, 1, 1),
      ]);
      requisitoRepo.find.mockResolvedValue([]);

      await expect(
        service.validarSeleccionEstricta(1, [1, 999]),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.validarSeleccionEstricta(1, [1, 999]),
      ).rejects.toThrow(/no pertenece al plan/);
    });
  });

  describe('obtenerCatalogoFormulario (Contrato para API Pública)', () => {
    it('organiza el catálogo jerárquicamente por Niveles y Ciclos con estado reactivo', async () => {
      planRepo.findOne.mockResolvedValue(mockPlan(1, true));
      asignaturaRepo.find.mockResolvedValue([
        mockAsignatura(1, 1, 'EIF201', 'Prog I', 1, 1, 1),
        mockAsignatura(2, 1, 'EIF202', 'Prog II', 1, 2, 1),
        mockAsignatura(3, 1, 'MAT101', 'Matemática I', 1, 1, 2),
        mockAsignatura(4, 1, 'EIF301', 'Estructuras', 2, 1, 1),
      ]);
      requisitoRepo.find.mockResolvedValue([
        mockRequisito(1, 2, 1, 1),
        mockRequisito(2, 4, 2, 1),
      ]);

      const catalogo = await service.obtenerCatalogoFormulario(1, [1]);

      expect(catalogo.plan.id).toBe(1);
      expect(catalogo.aprobadasValidas).toEqual([1]);
      expect(catalogo.niveles).toHaveLength(2); // Nivel 1 y Nivel 2

      // Nivel 1: Ciclo 1 (Prog I, Mat I) y Ciclo 2 (Prog II)
      const nivel1 = catalogo.niveles.find((n) => n.nivel === 1)!;
      expect(nivel1.ciclos).toHaveLength(2);

      const ciclo1 = nivel1.ciclos.find((c) => c.ciclo === 1)!;
      expect(ciclo1.asignaturas).toHaveLength(2);
      expect(ciclo1.asignaturas.find((a) => a.codigo === 'EIF201')?.aprobada).toBe(true);

      const ciclo2 = nivel1.ciclos.find((c) => c.ciclo === 2)!;
      expect(ciclo2.asignaturas).toHaveLength(1);
      expect(ciclo2.asignaturas[0].codigo).toBe('EIF202');
      expect(ciclo2.asignaturas[0].estado).toBe('HABILITADA'); // Prog I aprobada

      // Nivel 2: Ciclo 1 (Estructuras) -> BLOQUEADA porque Prog II no está aprobada
      const nivel2 = catalogo.niveles.find((n) => n.nivel === 2)!;
      const ciclo2_1 = nivel2.ciclos.find((c) => c.ciclo === 1)!;
      expect(ciclo2_1.asignaturas[0].estado).toBe('BLOQUEADA');
    });
  });
});
