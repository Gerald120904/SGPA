import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EstadoFormularioEstudiante } from './constants/estado-formulario-estudiante.constant';
import { EstadoRespuestaFormulario } from './constants/estado-respuesta-formulario.constant';
import { FormulariosEstudiantesSyncService } from './formularios-estudiantes-sync.service';

describe('FormulariosEstudiantesSyncService', () => {
  let service: FormulariosEstudiantesSyncService;

  let formularioRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let respuestaRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let googleFormsClient: {
    listarRespuestas: jest.Mock;
  };
  let normalizador: {
    normalizar: jest.Mock;
  };
  let estructuraAcademicaService: {
    tieneAlcanceSobreCarrera: jest.Mock;
  };

  const usuarioAId = 55;
  const usuarioBId = 99;
  const formularioId = 1;

  const mockFormulario = {
    id: 1,
    carreraId: 2,
    creadoPorUsuarioId: 55,
    googleFormId: 'form-google-123',
    estado: EstadoFormularioEstudiante.PUBLICADO,
    mapaPreguntas: {
      primerNombre: { questionId: 'q1' },
    },
    ultimaSincronizacionAt: null,
  };

  beforeEach(() => {
    formularioRepo = {
      findOne: jest.fn().mockResolvedValue({ ...mockFormulario }),
      save: jest.fn(async (f) => f),
    };

    respuestaRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((datos) => ({ id: 50, ...datos })),
      save: jest.fn(async (r) => ({ id: r.id ?? 50, ...r })),
    };

    googleFormsClient = {
      listarRespuestas: jest.fn().mockResolvedValue([]),
    };

    normalizador = {
      normalizar: jest.fn().mockReturnValue({
        primerNombre: 'Carlos',
        requiereRevisionOptativas: false,
        optativasNoDisciplinarias: null,
      }),
    };

    estructuraAcademicaService = {
      tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true),
    };

    service = new FormulariosEstudiantesSyncService(
      formularioRepo as never,
      respuestaRepo as never,
      googleFormsClient as never,
      normalizador as never,
      estructuraAcademicaService as never,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sincronizar', () => {
    it('falla con NotFoundException si el formulario no existe', async () => {
      formularioRepo.findOne.mockResolvedValue(null);

      await expect(
        service.sincronizar(formularioId, usuarioBId),
      ).rejects.toThrow(NotFoundException);
      expect(googleFormsClient.listarRespuestas).not.toHaveBeenCalled();
    });

    it('falla con BadRequestException si el formulario no tiene googleFormId o mapaPreguntas', async () => {
      formularioRepo.findOne.mockResolvedValue({
        id: 1,
        carreraId: 2,
        creadoPorUsuarioId: usuarioAId,
        googleFormId: null,
        mapaPreguntas: null,
      });

      await expect(
        service.sincronizar(formularioId, usuarioBId),
      ).rejects.toThrow(BadRequestException);
    });

    it('usuario B sin alcance no puede sincronizar', async () => {
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        false,
      );

      await expect(
        service.sincronizar(formularioId, usuarioBId),
      ).rejects.toThrow(ForbiddenException);
      expect(
        estructuraAcademicaService.tieneAlcanceSobreCarrera,
      ).toHaveBeenCalledWith(usuarioBId, 2);
      expect(googleFormsClient.listarRespuestas).not.toHaveBeenCalled();
    });

    it('usuario B con alcance puede sincronizar formulario creado por usuario A', async () => {
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        true,
      );
      googleFormsClient.listarRespuestas.mockResolvedValue([]);

      const resultado = await service.sincronizar(formularioId, usuarioBId);

      expect(
        estructuraAcademicaService.tieneAlcanceSobreCarrera,
      ).toHaveBeenCalledWith(usuarioBId, 2);
      expect(resultado.recibidasGoogle).toBe(0);
    });

    it('Forms API recibe usuario A como propietario Google', async () => {
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        true,
      );
      googleFormsClient.listarRespuestas.mockResolvedValue([]);

      await service.sincronizar(formularioId, usuarioBId);

      expect(googleFormsClient.listarRespuestas).toHaveBeenCalledWith(
        usuarioAId,
        'form-google-123',
      );
    });

    it('permite sincronizar formularios en estado CERRADO', async () => {
      formularioRepo.findOne.mockResolvedValue({
        ...mockFormulario,
        estado: EstadoFormularioEstudiante.CERRADO,
      });

      googleFormsClient.listarRespuestas.mockResolvedValue([]);

      const resultado = await service.sincronizar(formularioId, usuarioBId);

      expect(resultado.recibidasGoogle).toBe(0);
      expect(googleFormsClient.listarRespuestas).toHaveBeenCalledWith(
        usuarioAId,
        'form-google-123',
      );
    });

    it('obtiene respuestas de Google y guarda una nueva respuesta en estado PENDIENTE', async () => {
      const respGoogle = {
        responseId: 'resp-1',
        answers: {},
      };
      googleFormsClient.listarRespuestas.mockResolvedValue([respGoogle]);

      const resultado = await service.sincronizar(formularioId, usuarioBId);

      expect(resultado).toEqual({
        recibidasGoogle: 1,
        nuevas: 1,
        ignoradasExistentes: 0,
        pendientes: 1,
        requierenRevision: 0,
        errores: 0,
      });

      expect(respuestaRepo.create).toHaveBeenCalledWith({
        formularioId: 1,
        googleResponseId: 'resp-1',
        payloadJson: respGoogle,
        datosNormalizadosJson: expect.objectContaining({
          primerNombre: 'Carlos',
        }),
        estado: EstadoRespuestaFormulario.PENDIENTE,
        detalleError: null,
        optativasNoDisciplinarias: null,
        procesadoAt: null,
      });
      expect(respuestaRepo.save).toHaveBeenCalled();
      expect(formularioRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ultimaSincronizacionAt: expect.any(Date),
        }),
      );
    });

    it('si la respuesta incluye optativas, se guarda en estado REQUIERE_REVISION', async () => {
      normalizador.normalizar.mockReturnValue({
        primerNombre: 'Carlos',
        requiereRevisionOptativas: true,
        optativasNoDisciplinarias: 'Teatro',
      });

      googleFormsClient.listarRespuestas.mockResolvedValue([
        { responseId: 'resp-2' },
      ]);

      const resultado = await service.sincronizar(formularioId, usuarioBId);

      expect(resultado.requierenRevision).toBe(1);
      expect(resultado.pendientes).toBe(0);

      expect(respuestaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: EstadoRespuestaFormulario.REQUIERE_REVISION,
          optativasNoDisciplinarias: 'Teatro',
        }),
      );
    });

    it('ignora respuestas ya existentes en la BD (idempotencia) sin duplicar', async () => {
      respuestaRepo.findOne.mockResolvedValue({ id: 10, googleResponseId: 'resp-1' });

      googleFormsClient.listarRespuestas.mockResolvedValue([
        { responseId: 'resp-1' },
      ]);

      const resultado = await service.sincronizar(formularioId, usuarioBId);

      expect(resultado).toEqual({
        recibidasGoogle: 1,
        nuevas: 0,
        ignoradasExistentes: 1,
        pendientes: 0,
        requierenRevision: 0,
        errores: 0,
      });

      expect(normalizador.normalizar).not.toHaveBeenCalled();
      expect(respuestaRepo.create).not.toHaveBeenCalled();
    });

    it('guarda una respuesta en estado ERROR si la normalización falla, sin detener las demás', async () => {
      normalizador.normalizar
        .mockImplementationOnce(() => {
          throw new BadRequestException('Faltan datos requeridos');
        })
        .mockReturnValueOnce({
          primerNombre: 'María',
          requiereRevisionOptativas: false,
          optativasNoDisciplinarias: null,
        });

      googleFormsClient.listarRespuestas.mockResolvedValue([
        { responseId: 'resp-err' },
        { responseId: 'resp-ok' },
      ]);

      const resultado = await service.sincronizar(formularioId, usuarioBId);

      expect(resultado).toEqual({
        recibidasGoogle: 2,
        nuevas: 2,
        ignoradasExistentes: 0,
        pendientes: 1,
        requierenRevision: 0,
        errores: 1,
      });

      // Primer llamado debe ser con estado ERROR
      expect(respuestaRepo.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          googleResponseId: 'resp-err',
          estado: EstadoRespuestaFormulario.ERROR,
          detalleError: 'Faltan datos requeridos',
          datosNormalizadosJson: null,
        }),
      );

      // Segundo llamado debe ser exitoso PENDIENTE
      expect(respuestaRepo.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          googleResponseId: 'resp-ok',
          estado: EstadoRespuestaFormulario.PENDIENTE,
          detalleError: null,
        }),
      );
    });
  });

  describe('listarRespuestas', () => {
    it('falla con NotFoundException si el formulario no existe', async () => {
      formularioRepo.findOne.mockResolvedValue(null);

      await expect(
        service.listarRespuestas(formularioId, usuarioBId),
      ).rejects.toThrow(NotFoundException);
    });

    it('falla con ForbiddenException si el usuario no tiene alcance', async () => {
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        false,
      );

      await expect(
        service.listarRespuestas(formularioId, usuarioBId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('retorna las respuestas del formulario ordenadas por createdAt DESC', async () => {
      const mockRespuestas = [
        { id: 2, createdAt: new Date('2026-09-15T12:00:00Z') },
        { id: 1, createdAt: new Date('2026-09-15T11:00:00Z') },
      ];
      respuestaRepo.find.mockResolvedValue(mockRespuestas);

      const res = await service.listarRespuestas(formularioId, usuarioBId);

      expect(respuestaRepo.find).toHaveBeenCalledWith({
        where: { formularioId: 1 },
        order: { createdAt: 'DESC' },
      });
      expect(res).toBe(mockRespuestas);
    });
  });
});
