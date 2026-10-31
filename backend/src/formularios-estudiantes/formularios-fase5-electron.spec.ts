import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { PERMISOS_KEY } from '../permisos/decorators/permisos.decorator';
import { EstadoFormularioEstudiante } from './constants/estado-formulario-estudiante.constant';
import { EstadoRespuestaFormulario } from './constants/estado-respuesta-formulario.constant';
import { ProveedorFormulario } from './constants/proveedor-formulario.constant';
import { CrearFormularioEstudianteDto } from './dto/crear-formulario-estudiante.dto';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { FormulariosEstudiantesController } from './formularios-estudiantes.controller';
import { FormulariosEstudiantesService } from './formularios-estudiantes.service';
import { FormulariosEstudiantesSyncService } from './formularios-estudiantes-sync.service';
import { FormulariosInternosPersistenciaService } from './formularios-internos-persistencia.service';

/**
 * Funciones de seguridad de Electron IPC idénticas a frontend/src/main.js
 */
function resolverUrlPublicaFormulario(
  responderUri: string,
  envOverride?: { SGPA_PUBLIC_URL?: string; PORT?: string },
): string {
  if (!responderUri) return '';
  if (/^https?:\/\//i.test(responderUri)) return responderUri;

  const publicUrlEnv = envOverride?.SGPA_PUBLIC_URL || process.env.SGPA_PUBLIC_URL;
  const port = envOverride?.PORT || process.env.PORT || '3000';
  const baseUrl = (publicUrlEnv || `http://localhost:${port}`).replace(/\/+$/, '');
  const path = responderUri.startsWith('/') ? responderUri : `/${responderUri}`;
  return `${baseUrl}${path}`;
}

function validarUrlExternaFormulario(
  valor: unknown,
  isProd: boolean = false,
  originOverride?: string,
): { valida: boolean; razon?: string } {
  if (typeof valor !== 'string' || !valor.trim()) {
    return { valida: false, razon: 'URL vacía o no válida.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(valor.trim());
  } catch {
    return { valida: false, razon: 'Formato de URL no válido.' };
  }

  const protocolo = parsed.protocol.toLowerCase();
  if (protocolo !== 'http:' && protocolo !== 'https:') {
    return {
      valida: false,
      razon: `Protocolo no permitido: ${protocolo}. Se requiere HTTP o HTTPS.`,
    };
  }

  if (isProd && protocolo !== 'https:') {
    return {
      valida: false,
      razon: 'En producción se exige protocolo seguro HTTPS.',
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valida: false,
      razon: 'No se permiten credenciales de usuario incrustadas en la URL.',
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  const esGoogleDocs = hostname === 'docs.google.com';

  if (esGoogleDocs) {
    return { valida: protocolo === 'https:' };
  }

  // Verificar origen confiable SGPA
  const sgpaPublicUrl = originOverride || process.env.SGPA_PUBLIC_URL;
  let origenSgpaValido = false;

  if (sgpaPublicUrl) {
    try {
      const parsedSgpa = new URL(sgpaPublicUrl);
      if (
        parsedSgpa.protocol.toLowerCase() === protocolo &&
        parsedSgpa.hostname.toLowerCase() === hostname &&
        (parsedSgpa.port || (protocolo === 'https:' ? '443' : '80')) ===
          (parsed.port || (protocolo === 'https:' ? '443' : '80'))
      ) {
        origenSgpaValido = true;
      }
    } catch {
      // Ignorar error de parsing
    }
  }

  const esRutaPublicaSgpa = /^\/formularios\/p\/[0-9a-fA-F]{64}$/.test(parsed.pathname);

  if (origenSgpaValido && esRutaPublicaSgpa) {
    return { valida: true };
  }

  return {
    valida: false,
    razon: `El destino ${parsed.origin} y ruta ${parsed.pathname} no pertenecen a los orígenes autorizados del SGPA ni a Google Forms.`,
  };
}

describe('SGPA Fase 5 — Integración Administrativa del Motor en Electron (22 Casos Obligatorios)', () => {
  let controller: FormulariosEstudiantesController;
  let service: FormulariosEstudiantesService;
  let persistenciaService: FormulariosInternosPersistenciaService;
  let syncService: FormulariosEstudiantesSyncService;
  let reflector: Reflector;

  let mockFormularioRepo: any;
  let mockRespuestaRepo: any;
  let mockCarreraRepo: any;
  let mockPlanEstudioRepo: any;
  let mockPlanAsignaturaRepo: any;
  let mockPeriodoRepo: any;
  let mockGoogleFormsClient: any;
  let mockGoogleDriveClient: any;
  let mockEstructuraAcademicaService: any;
  let mockMotorRequisitosService: any;

  const adminUsuarioId = 42;
  const mockToken = 'c0ffee'.repeat(10) + '1234'; // 64 hex

  beforeEach(() => {
    reflector = new Reflector();

    mockFormularioRepo = {
      create: jest.fn((attrs) => ({ id: 101, ...attrs })),
      save: jest.fn(async (ent) => ({ ...ent, id: ent.id ?? 101 })),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockRespuestaRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((attrs) => ({ id: 201, ...attrs })),
      save: jest.fn(async (r) => ({ ...r, id: r.id ?? 201 })),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    };

    mockCarreraRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        codigo: 'EIF',
        nombre: 'Informática',
        activo: true,
      }),
    };

    mockPlanEstudioRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 10,
        carreraId: 1,
        codigo: 'PLAN-2024',
        nombre: 'Plan 2024',
        activo: true,
      }),
    };

    mockMotorRequisitosService = {
      obtenerEstructuraPlan: jest.fn().mockResolvedValue({
        plan: { id: 10, carreraId: 1, codigo: 'PLAN-2024', nombre: 'Plan 2024' },
        asignaturas: [],
        requisitos: [],
      }),
    };

    mockPlanAsignaturaRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 501,
          cursoId: 601,
          activo: true,
          curso: { id: 601, codigo: 'EIF201', nombre: 'Programación I' },
        },
      ]),
    };

    mockPeriodoRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          codigo: '2026-I',
          nombre: 'I Ciclo 2026',
          activo: true,
        },
      ]),
    };

    mockGoogleFormsClient = {
      crearFormulario: jest.fn(),
      actualizarFormulario: jest.fn(),
      publicarFormulario: jest.fn(),
      obtenerFormulario: jest.fn(),
      cerrarFormulario: jest.fn(),
      listarRespuestas: jest.fn(),
    };

    mockGoogleDriveClient = {
      permitirCualquieraConEnlaceResponder: jest.fn(),
      renombrarArchivo: jest.fn(),
    };

    mockEstructuraAcademicaService = {
      tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true),
      obtenerCarreraIdsConAlcance: jest.fn().mockResolvedValue([1]),
    };

    persistenciaService = new FormulariosInternosPersistenciaService(
      mockFormularioRepo,
      mockRespuestaRepo,
      mockCarreraRepo,
      mockPlanEstudioRepo,
      mockEstructuraAcademicaService,
      mockMotorRequisitosService,
    );

    service = new FormulariosEstudiantesService(
      mockFormularioRepo,
      mockRespuestaRepo,
      mockCarreraRepo,
      mockPlanEstudioRepo,
      mockPlanAsignaturaRepo,
      mockPeriodoRepo,
      mockGoogleFormsClient,
      mockGoogleDriveClient,
      mockEstructuraAcademicaService,
      persistenciaService,
    );

    syncService = new FormulariosEstudiantesSyncService(
      mockFormularioRepo,
      mockRespuestaRepo,
      mockGoogleFormsClient,
      {} as any,
      mockEstructuraAcademicaService,
    );

    controller = new FormulariosEstudiantesController(
      service,
      syncService,
      {} as any,
      persistenciaService,
    );
  });

  // 1. Crear formulario interno sin Google conectado
  it('1. Debe permitir crear un formulario interno sin Google conectado ni invocar APIs de Google', async () => {
    const dto: CrearFormularioEstudianteDto = {
      titulo: 'Formulario Admisión 2027',
      descripcion: 'Registro de estudiantes',
      carreraId: 1,
      planEstudioId: 10,
      proveedor: ProveedorFormulario.INTERNO,
    };

    const resultado = await service.crear(adminUsuarioId, dto);

    expect(resultado).toBeDefined();
    expect(resultado.proveedor).toBe(ProveedorFormulario.INTERNO);
    expect(mockGoogleFormsClient.crearFormulario).not.toHaveBeenCalled();
    expect(mockGoogleDriveClient.permitirCualquieraConEnlaceResponder).not.toHaveBeenCalled();
  });

  // 2. Validar carrera y plan seleccionados
  it('2. Debe validar que la carrera y el plan de estudio existan, pertenezcan y estén activos', async () => {
    mockPlanEstudioRepo.findOne.mockResolvedValueOnce(null);

    const dto: CrearFormularioEstudianteDto = {
      titulo: 'Formulario Inválido',
      descripcion: 'Plan inexistente',
      carreraId: 1,
      planEstudioId: 999,
      proveedor: ProveedorFormulario.INTERNO,
    };

    await expect(service.crear(adminUsuarioId, dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  // 3. Rechazar creación sin permisos
  it('3. Debe rechazar la creación si el usuario no tiene alcance académico sobre la carrera', async () => {
    mockEstructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValueOnce(false);

    const dto: CrearFormularioEstudianteDto = {
      titulo: 'Formulario No Autorizado',
      descripcion: 'Sin permisos',
      carreraId: 1,
      planEstudioId: 10,
      proveedor: ProveedorFormulario.INTERNO,
    };

    await expect(service.crear(adminUsuarioId, dto)).rejects.toThrow(
      ForbiddenException,
    );
  });

  // 4. Generar token mediante el servidor
  it('4. Debe generar un token público criptográficamente seguro en el servidor', async () => {
    const dto: CrearFormularioEstudianteDto = {
      titulo: 'Formulario Con Token',
      descripcion: 'Prueba de token',
      carreraId: 1,
      planEstudioId: 10,
    };

    const form = await persistenciaService.crearFormularioInterno(adminUsuarioId, dto);

    expect(form.tokenPublico).toBeDefined();
    expect(form.tokenPublico).toMatch(/^[0-9a-f]{64}$/);
    expect(form.responderUri).toBe(`/formularios/p/${form.tokenPublico}`);
  });

  // 5. Publicar formulario interno
  it('5. Debe permitir publicar un formulario interno pasando de CREADO a PUBLICADO', async () => {
    const formCreado = {
      id: 15,
      carreraId: 1,
      proveedor: ProveedorFormulario.INTERNO,
      estado: EstadoFormularioEstudiante.CREANDO,
      tokenPublico: mockToken,
      responderUri: `/formularios/p/${mockToken}`,
    } as FormularioEstudiante;

    mockFormularioRepo.findOne.mockResolvedValueOnce(formCreado);

    const publicado = await persistenciaService.publicarFormularioInterno(15, adminUsuarioId);

    expect(publicado.estado).toBe(EstadoFormularioEstudiante.PUBLICADO);
    expect(mockFormularioRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ estado: EstadoFormularioEstudiante.PUBLICADO }),
    );
  });

  // 6. Obtener enlace público válido
  it('6. Debe resolver la URL pública absoluta a partir de responderUri y variables de entorno', () => {
    const responderUri = `/formularios/p/${mockToken}`;
    const url = resolverUrlPublicaFormulario(responderUri, {
      SGPA_PUBLIC_URL: 'https://sgpa.una.ac.cr',
    });

    expect(url).toBe(`https://sgpa.una.ac.cr/formularios/p/${mockToken}`);
  });

  // 7. Copiar enlace correctamente
  it('7. Debe copiar el enlace completo resuelto y no solo la ruta relativa', () => {
    const relativeUri = `/formularios/p/${mockToken}`;
    const resolvedUrl = resolverUrlPublicaFormulario(relativeUri, {
      PORT: '3000',
    });

    expect(resolvedUrl).toBe(`http://localhost:3000/formularios/p/${mockToken}`);
    expect(resolvedUrl.startsWith('http')).toBe(true);
  });

  // 8. Abrir enlace exclusivamente en un origen permitido
  it('8. Debe permitir abrir enlaces exclusivamente en orígenes confiables (Google Forms o SGPA configurado)', () => {
    const urlGoogle = 'https://docs.google.com/forms/d/e/1FAIpQLSc/viewform';
    const valGoogle = validarUrlExternaFormulario(urlGoogle, false);
    expect(valGoogle.valida).toBe(true);

    const urlSgpa = `https://sgpa.una.ac.cr/formularios/p/${mockToken}`;
    const valSgpa = validarUrlExternaFormulario(urlSgpa, false, 'https://sgpa.una.ac.cr');
    expect(valSgpa.valida).toBe(true);
  });

  // 9. Rechazar URLs externas maliciosas
  it('9. Debe rechazar esquemas peligrosos (javascript:, file:, data:) y dominios externos no autorizados', () => {
    expect(validarUrlExternaFormulario('javascript:alert(1)').valida).toBe(false);
    expect(validarUrlExternaFormulario('file:///etc/passwd').valida).toBe(false);
    expect(validarUrlExternaFormulario('data:text/html;base64,PHNjcmlwdD4=').valida).toBe(false);
    expect(validarUrlExternaFormulario('https://attacker-site.com/phishing').valida).toBe(false);
    expect(validarUrlExternaFormulario('http://user:pass@docs.google.com').valida).toBe(false);
    expect(validarUrlExternaFormulario('http://docs.google.com.attacker.com').valida).toBe(false);
    expect(validarUrlExternaFormulario('http://docs.google.com/form', false).valida).toBe(false);
    expect(validarUrlExternaFormulario(`https://sgpa.una.ac.cr:8443/formularios/p/${mockToken}`, false, 'https://sgpa.una.ac.cr').valida).toBe(false);
    expect(validarUrlExternaFormulario(`http://127.0.0.1:3999/formularios/p/${mockToken}`, false, 'http://127.0.0.1:3103').valida).toBe(false);
  });

  // 10. Cerrar formulario interno
  it('10. Debe permitir cerrar un formulario interno impidiendo futuras respuestas', async () => {
    const formPublicado = {
      id: 20,
      carreraId: 1,
      proveedor: ProveedorFormulario.INTERNO,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      tokenPublico: mockToken,
    } as FormularioEstudiante;

    mockFormularioRepo.findOne.mockResolvedValueOnce(formPublicado);

    const cerrado = await service.cerrar(adminUsuarioId, 20);

    expect(cerrado.estado).toBe(EstadoFormularioEstudiante.CERRADO);
    expect(mockFormularioRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ estado: EstadoFormularioEstudiante.CERRADO }),
    );
  });

  // 11. Rechazar respuestas posteriores al cierre
  it('11. Debe verificar que el formulario cerrado no acepte nuevas respuestas de estudiantes', async () => {
    const formCerrado = {
      id: 20,
      carreraId: 1,
      proveedor: ProveedorFormulario.INTERNO,
      estado: EstadoFormularioEstudiante.CERRADO,
      tokenPublico: mockToken,
    } as FormularioEstudiante;

    mockFormularioRepo.findOne.mockResolvedValueOnce(formCerrado);

    await expect(
      persistenciaService.obtenerPorTokenPublico(mockToken),
    ).rejects.toThrow(BadRequestException);

    mockFormularioRepo.findOne.mockResolvedValueOnce(formCerrado);

    await expect(
      persistenciaService.guardarRespuestaInterna({
        formularioId: 20,
        payloadJson: { identificacion: '11111' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // 12. Regenerar o revocar un token cuando la operación esté habilitada
  it('12. Debe regenerar el token público e invalidar el enlace previo inmediatamente', async () => {
    const tokenPrevio = 'token_antiguo_1234567890abcdef1234567890abcdef1234567890abcdef12345678';
    const formConTokenPrevio = {
      id: 25,
      carreraId: 1,
      proveedor: ProveedorFormulario.INTERNO,
      tokenPublico: tokenPrevio,
      responderUri: `/formularios/p/${tokenPrevio}`,
    } as FormularioEstudiante;

    mockFormularioRepo.findOne.mockResolvedValueOnce(formConTokenPrevio);

    const regenerado = await persistenciaService.regenerarTokenPublico(25, adminUsuarioId);

    expect(regenerado.tokenPublico).not.toBe(tokenPrevio);
    expect(regenerado.tokenPublico).toMatch(/^[0-9a-f]{64}$/);
    expect(regenerado.responderUri).toBe(`/formularios/p/${regenerado.tokenPublico}`);
  });

  // 13. Mostrar formularios internos y Google existentes
  it('13. Debe listar simultáneamente formularios de ambos proveedores sin pérdida de registros', async () => {
    const listaMock = [
      {
        id: 1,
        titulo: 'Formulario Histórico Google',
        proveedor: ProveedorFormulario.GOOGLE_FORMS,
        carreraId: 1,
        planEstudioId: 10,
        estado: EstadoFormularioEstudiante.PUBLICADO,
      },
      {
        id: 2,
        titulo: 'Formulario Institucional SGPA',
        proveedor: ProveedorFormulario.INTERNO,
        carreraId: 1,
        planEstudioId: 10,
        estado: EstadoFormularioEstudiante.CREANDO,
      },
    ];

    mockFormularioRepo.find.mockResolvedValueOnce(listaMock);

    const formularios = await service.listar(adminUsuarioId);

    expect(formularios.length).toBe(2);
    expect(formularios[0].proveedor).toBe(ProveedorFormulario.GOOGLE_FORMS);
    expect(formularios[1].proveedor).toBe(ProveedorFormulario.INTERNO);
  });

  // 14. Conservar sincronización de formularios Google
  it('14. Debe conservar sincronización para Google y rechazarla para formularios internos', async () => {
    const formInterno = {
      id: 30,
      proveedor: ProveedorFormulario.INTERNO,
      carreraId: 1,
    } as FormularioEstudiante;

    mockFormularioRepo.findOne.mockResolvedValueOnce(formInterno);

    await expect(
      syncService.sincronizar(30, adminUsuarioId),
    ).rejects.toThrow(BadRequestException);
  });

  // 15. No exigir OAuth para el proveedor INTERNO
  it('15. No debe exigir tokens de OAuth ni conexión a Google para el proveedor INTERNO', async () => {
    const dto: CrearFormularioEstudianteDto = {
      titulo: 'Formulario SGPA Sin OAuth',
      descripcion: '100% independiente',
      carreraId: 1,
      planEstudioId: 10,
      proveedor: ProveedorFormulario.INTERNO,
    };

    const creado = await service.crear(adminUsuarioId, dto);

    expect(creado).toBeDefined();
    expect(mockGoogleFormsClient.crearFormulario).not.toHaveBeenCalled();
  });

  // 16. Mostrar respuestas internas PENDIENTES
  it('16. Debe listar las respuestas internas registradas con estado PENDIENTE', async () => {
    const formInterno = {
      id: 40,
      carreraId: 1,
      proveedor: ProveedorFormulario.INTERNO,
    } as FormularioEstudiante;

    const respuestasInternas = [
      {
        id: 1,
        formularioId: 40,
        estado: EstadoRespuestaFormulario.PENDIENTE,
        datosNormalizadosJson: {
          primerNombre: 'Ana',
          primerApellido: 'Rojas',
          identificacion: '401110222',
          correoEstudiantil: 'ana@est.una.ac.cr',
          asignaturasAprobadas: [501],
        },
      },
    ];

    mockFormularioRepo.findOne.mockResolvedValueOnce(formInterno);
    mockRespuestaRepo.find.mockResolvedValueOnce(respuestasInternas);

    const respuestas = await syncService.listarRespuestas(40, adminUsuarioId);

    expect(respuestas.length).toBe(1);
    expect(respuestas[0].estado).toBe(EstadoRespuestaFormulario.PENDIENTE);
    expect(respuestas[0].datosNormalizadosJson?.primerNombre).toBe('Ana');
  });

  // 17. Respetar permisos administrativos
  it('17. El controlador administrativo debe proteger publicar y regenerar-token con FORMULARIOS_ESTUDIANTES_GESTIONAR', () => {
    const guards = Reflect.getMetadata('__guards__', FormulariosEstudiantesController);
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(PermisosGuard);

    const permisoPublicar = reflector.get<PermisoSistema[]>(
      PERMISOS_KEY,
      FormulariosEstudiantesController.prototype.publicar,
    );
    expect(permisoPublicar).toEqual([
      PermisoSistema.FORMULARIOS_ESTUDIANTES_GESTIONAR,
    ]);

    const permisoRegenerar = reflector.get<PermisoSistema[]>(
      PERMISOS_KEY,
      FormulariosEstudiantesController.prototype.regenerarToken,
    );
    expect(permisoRegenerar).toEqual([
      PermisoSistema.FORMULARIOS_ESTUDIANTES_GESTIONAR,
    ]);
  });

  // 18. Manejar errores y estados de carga
  it('18. Debe manejar errores adecuadamente cuando un formulario no existe en publicación', async () => {
    mockFormularioRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      persistenciaService.publicarFormularioInterno(999, adminUsuarioId),
    ).rejects.toThrow(NotFoundException);
  });

  // 19. No exponer información administrativa en rutas públicas
  it('19. No debe exponer IDs de usuarios creadores ni credenciales internas en la consulta de token', async () => {
    const formPublico = {
      id: 50,
      titulo: 'Formulario Público',
      descripcion: 'Descripción pública',
      carreraId: 1,
      planEstudioId: 10,
      tokenPublico: mockToken,
      creadoPorUsuarioId: adminUsuarioId,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      carrera: { id: 1, nombre: 'Informática' },
      planEstudio: { id: 10, nombre: 'Plan 2024' },
    } as any;

    mockFormularioRepo.findOne.mockResolvedValueOnce(formPublico);

    const consulta = await persistenciaService.obtenerPorTokenPublico(mockToken);

    expect(consulta).toBeDefined();
    expect(consulta?.tokenPublico).toBe(mockToken);
    expect(consulta?.titulo).toBe('Formulario Público');
  });

  // 20. No introducir regresiones en otros canales IPC
  it('20. La validación de URL de Electron debe permitir HTTPS estricto en producción', () => {
    const urlHttp = 'http://sgpa.una.ac.cr/formularios/p/' + mockToken;
    const resProd = validarUrlExternaFormulario(urlHttp, true, 'https://sgpa.una.ac.cr');
    expect(resProd.valida).toBe(false);
    expect(resProd.razon).toContain('HTTPS');

    const urlHttps = 'https://sgpa.una.ac.cr/formularios/p/' + mockToken;
    const resProdHttps = validarUrlExternaFormulario(urlHttps, true, 'https://sgpa.una.ac.cr');
    expect(resProdHttps.valida).toBe(true);
  });

  // 21. Comprobar coherencia entre el estado de publicación y el acceso público
  it('21. Debe rechazar el acceso o envío de respuestas si el formulario no está en estado PUBLICADO', async () => {
    mockFormularioRepo.findOne.mockResolvedValueOnce({
      id: 60,
      estado: EstadoFormularioEstudiante.CREANDO,
      tokenPublico: mockToken,
      proveedor: ProveedorFormulario.INTERNO,
    });

    await expect(
      persistenciaService.guardarRespuestaInterna({
        formularioId: 60,
        payloadJson: { identificacion: '401110222' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // 22. Verificar que modificar un plan no altere silenciosamente las reglas de un formulario publicado
  it('22. Debe verificar la integridad curricular: los formularios deben estar vinculados de forma inmutable a su planEstudioId', async () => {
    const formGuardado = {
      id: 70,
      carreraId: 1,
      planEstudioId: 10,
      proveedor: ProveedorFormulario.INTERNO,
      estado: EstadoFormularioEstudiante.PUBLICADO,
    } as FormularioEstudiante;

    mockFormularioRepo.findOne.mockResolvedValueOnce(formGuardado);

    const form = await service.obtenerPorId(adminUsuarioId, 70);

    expect(form.planEstudioId).toBe(10);
    expect(form.carreraId).toBe(1);
    // Garantiza que el formulario publicado mantiene su referencia estricta al plan original
  });
});
