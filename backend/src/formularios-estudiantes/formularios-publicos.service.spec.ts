import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { MotorRequisitosService } from '../planes-estudio/motor-requisitos/motor-requisitos.service';
import { EstadoFormularioEstudiante } from './constants/estado-formulario-estudiante.constant';
import { EstadoRespuestaFormulario } from './constants/estado-respuesta-formulario.constant';
import { ProveedorFormulario } from './constants/proveedor-formulario.constant';
import { EnviarRespuestaPublicaDto } from './dto/enviar-respuesta-publica.dto';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { FormulariosInternosPersistenciaService } from './formularios-internos-persistencia.service';
import { FormulariosPublicosService } from './formularios-publicos.service';
import { TipoRequisito } from '../planes-estudio/constants/tipo-requisito.constant';
import { InstantaneaCurricularInterna } from './types/instantanea-curricular-interna.type';

describe('FormulariosPublicosService (Subfases 3A, 3B, 3C)', () => {
  let service: FormulariosPublicosService;
  let formularioRepo: jest.Mocked<Repository<FormularioEstudiante>>;
  let periodoRepo: jest.Mocked<Repository<PeriodoAcademico>>;
  let planAsignaturaRepo: jest.Mocked<Repository<PlanAsignatura>>;
  let persistenciaInternaService: jest.Mocked<FormulariosInternosPersistenciaService>;
  let motorRequisitosService: jest.Mocked<MotorRequisitosService>;

  const tokenValido = 'a'.repeat(64);
  const tokenInvalido = 'invalido-123';
  const instantanea: InstantaneaCurricularInterna = {
    version: 3,
    plan: { id: 10, nombre: 'Plan publicado', codigo: 'PUB-10', carreraId: 2 },
    asignaturas: [
      { id: 101, planEstudioId: 10, cursoId: 201, codigo: 'PROG-I', nombre: 'Programación I', nivel: 1, ciclo: 1, activo: true },
      { id: 102, planEstudioId: 10, cursoId: 202, codigo: 'PROG-II', nombre: 'Programación II', nivel: 1, ciclo: 2, activo: true },
    ],
    requisitos: [{ id: 1, asignaturaId: 102, requisitoAsignaturaId: 101, tipo: TipoRequisito.REQUISITO }],
  };

  beforeEach(async () => {
    formularioRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<FormularioEstudiante>>;

    periodoRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<PeriodoAcademico>>;

    planAsignaturaRepo = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<PlanAsignatura>>;

    persistenciaInternaService = {
      guardarRespuestaInterna: jest.fn(),
    } as unknown as jest.Mocked<FormulariosInternosPersistenciaService>;

    motorRequisitosService = {
      obtenerCatalogoFormulario: jest.fn(),
      validarSeleccionEstricta: jest.fn(),
    } as unknown as jest.Mocked<MotorRequisitosService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormulariosPublicosService,
        {
          provide: getRepositoryToken(FormularioEstudiante),
          useValue: formularioRepo,
        },
        {
          provide: getRepositoryToken(PeriodoAcademico),
          useValue: periodoRepo,
        },
        {
          provide: getRepositoryToken(PlanAsignatura),
          useValue: planAsignaturaRepo,
        },
        {
          provide: FormulariosInternosPersistenciaService,
          useValue: persistenciaInternaService,
        },
        {
          provide: MotorRequisitosService,
          useValue: motorRequisitosService,
        },
      ],
    }).compile();

    service = module.get<FormulariosPublicosService>(FormulariosPublicosService);
  });

  describe('Consulta de formulario público (GET /formularios-publicos/:token)', () => {
    it('usa la versión publicada aunque el plan vigente cambie después', async () => {
      formularioRepo.findOne.mockResolvedValueOnce({
        id: 1,
        titulo: 'QA',
        descripcion: '',
        planEstudioId: 10,
        estado: EstadoFormularioEstudiante.PUBLICADO,
        proveedor: ProveedorFormulario.INTERNO,
        mapaPreguntas: instantanea,
        carrera: { id: 2, nombre: 'Carrera QA', codigo: 'QA' },
        planEstudio: { id: 10, nombre: 'Plan editado', codigo: 'EDITADO' },
      } as FormularioEstudiante);
      periodoRepo.find.mockResolvedValueOnce([]);

      const resultado = await service.consultarFormularioPublico(tokenValido);
      expect(resultado.planEstudio).toMatchObject({ nombre: 'Plan publicado', codigo: 'PUB-10' });
      expect(resultado.catalogo[0].ciclos[1].asignaturas[0]).toMatchObject({
        asignaturaId: 102,
        bloqueadaPorRequisitos: true,
      });
      expect(motorRequisitosService.obtenerCatalogoFormulario).not.toHaveBeenCalled();
    });
    it('rechaza tokens con formato inválido (longitud diferente a 64 hex)', async () => {
      await expect(
        service.consultarFormularioPublico(tokenInvalido),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.consultarFormularioPublico(''),
      ).rejects.toThrow(BadRequestException);
    });

    it('falla con 404 si el formulario no existe o no tiene proveedor INTERNO', async () => {
      formularioRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.consultarFormularioPublico(tokenValido),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza con BadRequestException si el formulario está en estado CERRADO', async () => {
      formularioRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tokenPublico: tokenValido,
        proveedor: ProveedorFormulario.INTERNO,
        estado: EstadoFormularioEstudiante.CERRADO,
      } as FormularioEstudiante);

      await expect(
        service.consultarFormularioPublico(tokenValido),
      ).rejects.toThrow('El formulario se encuentra cerrado');
    });

    it('rechaza si el formulario no se encuentra PUBLICADO (ej. CREANDO o ERROR)', async () => {
      formularioRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tokenPublico: tokenValido,
        proveedor: ProveedorFormulario.INTERNO,
        estado: EstadoFormularioEstudiante.CREANDO,
      } as FormularioEstudiante);

      await expect(
        service.consultarFormularioPublico(tokenValido),
      ).rejects.toThrow('El formulario no se encuentra disponible');
    });

    it('retorna formulario público válido y catálogo jerárquico sin exponer datos sensibles', async () => {
      formularioRepo.findOne.mockResolvedValueOnce({
        id: 1,
        titulo: 'Matrícula 2026',
        descripcion: 'Formulario de materias',
        planEstudioId: 10,
        estado: EstadoFormularioEstudiante.PUBLICADO,
        proveedor: ProveedorFormulario.INTERNO,
        creadoPorUsuarioId: 99, // Dato interno que NO debe exponerse
        carrera: { id: 2, nombre: 'Ingeniería en Sistemas', codigo: 'SOF' },
        planEstudio: { id: 10, nombre: 'Plan 2024', anioAprobacion: 2024 },
      } as any);

      periodoRepo.find.mockResolvedValueOnce([
        { id: 1, codigo: '2026-I', nombre: 'I Ciclo 2026', anio: 2026, ciclo: 1 } as unknown as PeriodoAcademico,
      ]);

      motorRequisitosService.obtenerCatalogoFormulario.mockResolvedValueOnce({
        plan: { id: 10, nombre: 'Plan 2024', carreraId: 2 },
        aprobadasValidas: [],
        niveles: [
          {
            nivel: 1,
            ciclos: [
              {
                ciclo: 1,
                asignaturas: [
                  {
                    asignaturaId: 101,
                    codigo: 'IF-1000',
                    nombre: 'Programación I',
                    creditos: 4,
                    nivel: 1,
                    ciclo: 1,
                    estado: 'HABILITADA',
                    requisitos: [],
                  } as any,
                ],
              },
            ],
          },
        ],
        resumen: [] as any,
      });

      const resultado = await service.consultarFormularioPublico(tokenValido);

      expect(resultado.formulario.titulo).toBe('Matrícula 2026');
      expect(resultado.carrera.nombre).toBe('Ingeniería en Sistemas');
      expect(resultado.planEstudio.nombre).toBe('Plan 2024');
      expect(resultado.periodos).toHaveLength(1);
      expect(resultado.catalogo).toHaveLength(1);
      expect(resultado.catalogo[0].nivel).toBe(1);

      // Verificación de seguridad: No se exponen datos internos
      expect((resultado as any).creadoPorUsuarioId).toBeUndefined();
      expect((resultado as any).creadoPorUsuario).toBeUndefined();
      expect((resultado as any).googleFormId).toBeUndefined();
    });
  });

  describe('Envío y registro de respuestas (POST /formularios-publicos/:token/respuestas)', () => {
    const dtoValido: EnviarRespuestaPublicaDto = {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '118230948',
      primerNombre: 'Ana',
      segundoNombre: 'Lucía',
      primerApellido: 'Vargas',
      segundoApellido: 'Mora',
      correoEstudiantil: 'avargas@universidad.ac.cr',
      contacto: '8888-9999',
      periodoIngresoId: 1,
      asignaturasAprobadasIds: [101, 102],
      optativasNoDisciplinarias: null,
    };

    const formPublicadoMock = {
      id: 1,
      planEstudioId: 10,
      tokenPublico: tokenValido,
      proveedor: ProveedorFormulario.INTERNO,
      estado: EstadoFormularioEstudiante.PUBLICADO,
    } as FormularioEstudiante;

    it('rechaza materias sin prerrequisito según la instantánea publicada aunque cambie el plan vigente', async () => {
      formularioRepo.findOne.mockResolvedValueOnce({
        ...formPublicadoMock,
        mapaPreguntas: instantanea,
      });
      periodoRepo.findOne.mockResolvedValueOnce({ id: 1 } as PeriodoAcademico);

      await expect(service.registrarRespuestaPublica(tokenValido, {
        ...dtoValido,
        asignaturasAprobadasIds: [102],
      })).rejects.toThrow(BadRequestException);
      expect(motorRequisitosService.validarSeleccionEstricta).not.toHaveBeenCalled();
      expect(persistenciaInternaService.guardarRespuestaInterna).not.toHaveBeenCalled();
    });

    it('normaliza materias desde la instantánea sin consultar el plan vigente', async () => {
      formularioRepo.findOne.mockResolvedValueOnce({
        ...formPublicadoMock,
        mapaPreguntas: instantanea,
      });
      periodoRepo.findOne.mockResolvedValueOnce({ id: 1 } as PeriodoAcademico);
      persistenciaInternaService.guardarRespuestaInterna.mockResolvedValueOnce({
        id: 401,
        googleResponseId: 'INT-snapshot',
        estado: EstadoRespuestaFormulario.PENDIENTE,
        createdAt: new Date(),
      } as any);

      await service.registrarRespuestaPublica(tokenValido, dtoValido);
      expect(motorRequisitosService.validarSeleccionEstricta).not.toHaveBeenCalled();
      expect(planAsignaturaRepo.find).not.toHaveBeenCalled();
      expect(persistenciaInternaService.guardarRespuestaInterna).toHaveBeenCalledWith(
        expect.objectContaining({
          datosNormalizadosJson: expect.objectContaining({
            asignaturasAprobadas: [
              { planAsignaturaId: 101, cursoId: 201, codigo: 'PROG-I' },
              { planAsignaturaId: 102, cursoId: 202, codigo: 'PROG-II' },
            ],
          }),
        }),
      );
    });

    it('rechaza envíos de bots que completan el honeypot (sitioWeb)', async () => {
      const dtoBot = { ...dtoValido, sitioWeb: 'https://spam-bot.xyz' };

      await expect(
        service.registrarRespuestaPublica(tokenValido, dtoBot),
      ).rejects.toThrow('La solicitud no pudo ser procesada');

      expect(formularioRepo.findOne).not.toHaveBeenCalled();
    });

    it('rechaza si el período de ingreso seleccionado no existe', async () => {
      formularioRepo.findOne.mockResolvedValueOnce(formPublicadoMock);
      periodoRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.registrarRespuestaPublica(tokenValido, dtoValido),
      ).rejects.toThrow('El período de ingreso seleccionado no es válido');
    });

    it('rechaza selección si el motor detecta que falta un prerrequisito (ej. Prog III sin Prog II)', async () => {
      formularioRepo.findOne.mockResolvedValueOnce(formPublicadoMock);
      periodoRepo.findOne.mockResolvedValueOnce({ id: 1 } as PeriodoAcademico);

      motorRequisitosService.validarSeleccionEstricta.mockRejectedValueOnce(
        new BadRequestException(
          'Selección inválida: La asignatura "IF-3000 - Programación III" no puede marcarse como aprobada porque falta su requisito previo.',
        ),
      );

      await expect(
        service.registrarRespuestaPublica(tokenValido, {
          ...dtoValido,
          asignaturasAprobadasIds: [103], // Prog III sin Prog II
        }),
      ).rejects.toThrow('Programación III');

      expect(persistenciaInternaService.guardarRespuestaInterna).not.toHaveBeenCalled();
    });

    it('rechaza si la asignatura solicitada no pertenece al plan de estudios', async () => {
      formularioRepo.findOne.mockResolvedValueOnce(formPublicadoMock);
      periodoRepo.findOne.mockResolvedValueOnce({ id: 1 } as PeriodoAcademico);

      motorRequisitosService.validarSeleccionEstricta.mockRejectedValueOnce(
        new BadRequestException('La asignatura #999 no pertenece al plan de estudios #10.'),
      );

      await expect(
        service.registrarRespuestaPublica(tokenValido, {
          ...dtoValido,
          asignaturasAprobadasIds: [999],
        }),
      ).rejects.toThrow('no pertenece al plan');

      expect(persistenciaInternaService.guardarRespuestaInterna).not.toHaveBeenCalled();
    });

    it('rechaza si la asignatura posee correquisitos bajo la política preventiva BLOQUEAR_REVISION', async () => {
      formularioRepo.findOne.mockResolvedValueOnce(formPublicadoMock);
      periodoRepo.findOne.mockResolvedValueOnce({ id: 1 } as PeriodoAcademico);

      motorRequisitosService.validarSeleccionEstricta.mockRejectedValueOnce(
        new BadRequestException(
          'Selección inválida: Asignatura con correquisito pendiente de confirmación de política académica.',
        ),
      );

      await expect(
        service.registrarRespuestaPublica(tokenValido, dtoValido),
      ).rejects.toThrow('pendiente de confirmación de política académica');

      expect(persistenciaInternaService.guardarRespuestaInterna).not.toHaveBeenCalled();
    });

    it('guarda exitosamente una respuesta válida en estado PENDIENTE sin aprobación automática inmediata', async () => {
      formularioRepo.findOne.mockResolvedValueOnce(formPublicadoMock);
      periodoRepo.findOne.mockResolvedValueOnce({ id: 1 } as PeriodoAcademico);
      motorRequisitosService.validarSeleccionEstricta.mockResolvedValueOnce({
        esValido: true,
        aprobadasValidas: [101, 102],
        asignaturas: [],
        solicitadasOriginales: [101, 102],
        desmarcadasCascada: [],
        inconsistenciasGrafo: [],
        resumenPorNivelCiclo: [],
        mapaAsignaturas: new Map(),
      } as any);

      planAsignaturaRepo.find.mockResolvedValueOnce([
        { id: 101, cursoId: 5, codigoReferencia: 'IF-1000' } as PlanAsignatura,
        { id: 102, cursoId: 6, codigoReferencia: 'IF-2000' } as PlanAsignatura,
      ]);

      persistenciaInternaService.guardarRespuestaInterna.mockResolvedValueOnce({
        id: 400,
        googleResponseId: 'INT-abc-123-uuid',
        estado: EstadoRespuestaFormulario.PENDIENTE,
        createdAt: new Date(),
      } as any);

      const resultado = await service.registrarRespuestaPublica(tokenValido, dtoValido);

      expect(resultado.mensaje).toContain('registrada satisfactoriamente');
      expect(resultado.codigoConfirmacion).toBe('INT-abc-123-uuid');
      expect(resultado.estado).toBe(EstadoRespuestaFormulario.PENDIENTE);

      // Verificación de normalización
      expect(persistenciaInternaService.guardarRespuestaInterna).toHaveBeenCalledWith({
        formularioId: 1,
        idempotencyKey: dtoValido.idempotencyKey,
        payloadJson: expect.objectContaining({
          identificacion: '118230948',
          primerNombre: 'Ana',
          correoEstudiantil: 'avargas@universidad.ac.cr',
        }),
        datosNormalizadosJson: expect.objectContaining({
          identificacion: '118230948',
          correoEstudiantil: 'avargas@universidad.ac.cr',
          asignaturasAprobadas: [
            { planAsignaturaId: 101, cursoId: 5, codigo: 'IF-1000' },
            { planAsignaturaId: 102, cursoId: 6, codigo: 'IF-2000' },
          ],
        }),
      });
    });

    it('previene duplicaciones accidentales por reintento de red inmediato (idempotencia)', async () => {
      formularioRepo.findOne.mockResolvedValue(formPublicadoMock);
      periodoRepo.findOne.mockResolvedValue({ id: 1 } as PeriodoAcademico);
      motorRequisitosService.validarSeleccionEstricta.mockResolvedValue({
        esValido: true,
        aprobadasValidas: [101],
        asignaturas: [],
        solicitadasOriginales: [101],
        desmarcadasCascada: [],
        inconsistenciasGrafo: [],
        resumenPorNivelCiclo: [],
        mapaAsignaturas: new Map(),
      } as any);
      planAsignaturaRepo.find.mockResolvedValue([
        { id: 101, cursoId: 5, codigoReferencia: 'IF-1000' } as PlanAsignatura,
      ]);
      persistenciaInternaService.guardarRespuestaInterna.mockResolvedValueOnce({
        id: 401,
        googleResponseId: 'INT-original-uuid',
        estado: EstadoRespuestaFormulario.PENDIENTE,
        createdAt: new Date(),
      } as any).mockResolvedValueOnce({
        id: 401,
        googleResponseId: 'INT-original-uuid',
        estado: EstadoRespuestaFormulario.PENDIENTE,
        idempotente: true,
      } as any);

      // Primer envío
      const res1 = await service.registrarRespuestaPublica(tokenValido, {
        ...dtoValido,
        identificacion: '99999999',
        asignaturasAprobadasIds: [101],
      });
      expect(res1.codigoConfirmacion).toBe('INT-original-uuid');
      expect(persistenciaInternaService.guardarRespuestaInterna).toHaveBeenCalledTimes(1);

      // Segundo envío idéntico inmediato (reintento de red o doble click)
      const res2 = await service.registrarRespuestaPublica(tokenValido, {
        ...dtoValido,
        identificacion: '99999999',
        asignaturasAprobadasIds: [101],
      });

      expect(res2.codigoConfirmacion).toBe('INT-original-uuid');
      expect(res2.idempotente).toBe(true);
      // La segunda llamada consulta la fila existente; el índice único impide otra inserción.
      expect(persistenciaInternaService.guardarRespuestaInterna).toHaveBeenCalledTimes(2);
    });
  });
});
