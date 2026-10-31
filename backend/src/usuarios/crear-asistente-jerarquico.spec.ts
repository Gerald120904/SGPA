import { BadRequestException, ConflictException, ForbiddenException, ValidationPipe } from '@nestjs/common';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { RolSistema } from '../auth/constants/roles.constants';
import { CrearAsistenteJerarquicoDto } from './dto/configurar-jerarquia.dto';
import { JerarquiaUsuariosService } from './jerarquia-usuarios.service';

describe('Validaciones Crear Asistente Jerárquico (Frontend-Backend Alignment)', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  const payloadValido = {
    cedula: '123456789',
    nombres: 'María José',
    apellido1: "O'Neill",
    apellido2: 'Muñoz-Ruiz',
    correo: 'maria.jose@una.ac.cr',
    carreras: [
      {
        carreraId: 1,
        permisos: [PermisoSistema.ESTUDIANTES_VER],
      },
    ],
  };

  const transformar = (body: Record<string, unknown>) =>
    pipe.transform(body, {
      type: 'body',
      metatype: CrearAsistenteJerarquicoDto,
    });

  describe('Validaciones de DTO — Cédula', () => {
    it('acepta cédula válida de 1 y 9 dígitos numéricos', async () => {
      const res1 = await transformar({ ...payloadValido, cedula: '7' });
      expect(res1.cedula).toBe('7');

      const res9 = await transformar({ ...payloadValido, cedula: '123456789' });
      expect(res9.cedula).toBe('123456789');
    });

    it('conserva ceros iniciales en la cédula', async () => {
      const conCero = await transformar({ ...payloadValido, cedula: '012345678' });
      expect(conCero.cedula).toBe('012345678');

      const soloCero = await transformar({ ...payloadValido, cedula: '07' });
      expect(soloCero.cedula).toBe('07');
    });

    it('rechaza cédula vacía o compuesta únicamente por espacios', async () => {
      await expect(transformar({ ...payloadValido, cedula: '' })).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, cedula: '   ' })).rejects.toThrow(BadRequestException);
    });

    it('rechaza cédula con letras o caracteres alfanuméricos', async () => {
      await expect(transformar({ ...payloadValido, cedula: '12A34' })).rejects.toThrow(BadRequestException);
    });

    it('rechaza cédula con guiones o símbolos', async () => {
      await expect(transformar({ ...payloadValido, cedula: '123-456' })).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, cedula: '1-2345-6789' })).rejects.toThrow(BadRequestException);
    });

    it('rechaza cédula con más de 9 dígitos', async () => {
      await expect(transformar({ ...payloadValido, cedula: '1234567890' })).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, cedula: '123456789012' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('Validaciones de DTO — Nombres', () => {
    it('acepta nombres válidos con tildes, diéresis, ñ, guiones, apóstrofes y espacios', async () => {
      const res = await transformar({
        ...payloadValido,
        nombres: 'José María Jean-Luc Güero Iñaki',
      });
      expect(res.nombres).toBe('José María Jean-Luc Güero Iñaki');
    });

    it('rechaza nombres vacíos o formados solo por espacios', async () => {
      await expect(transformar({ ...payloadValido, nombres: '' })).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, nombres: '     ' })).rejects.toThrow(BadRequestException);
    });

    it('rechaza nombres con dígitos o caracteres no permitidos', async () => {
      await expect(transformar({ ...payloadValido, nombres: 'Ana3' })).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, nombres: 'Carlos@' })).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, nombres: 'Luisa #1' })).rejects.toThrow(BadRequestException);
    });

    it('rechaza nombres que superen los 60 caracteres', async () => {
      const limite = 'A'.repeat(60);
      const excede = 'A'.repeat(61);
      const valido = await transformar({ ...payloadValido, nombres: limite });
      expect(valido.nombres).toBe(limite);
      await expect(transformar({ ...payloadValido, nombres: excede })).rejects.toThrow(BadRequestException);
    });
  });

  describe('Validaciones de DTO — Primer Apellido', () => {
    it('acepta primer apellido con tildes, ñ, guiones y apóstrofes', async () => {
      const casos = ["O'Neill", 'Muñoz', 'López-Gómez', 'Núñez'];
      for (const apellido of casos) {
        const res = await transformar({ ...payloadValido, apellido1: apellido });
        expect(res.apellido1).toBe(apellido);
      }
    });

    it('rechaza primer apellido vacío o compuesto solo de espacios', async () => {
      await expect(transformar({ ...payloadValido, apellido1: '' })).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, apellido1: '   ' })).rejects.toThrow(BadRequestException);
    });

    it('rechaza primer apellido con dígitos o caracteres especiales', async () => {
      await expect(transformar({ ...payloadValido, apellido1: 'Pérez2' })).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, apellido1: 'González!' })).rejects.toThrow(BadRequestException);
    });

    it('rechaza primer apellido que supere los 50 caracteres', async () => {
      const limite = 'A'.repeat(50);
      const excede = 'A'.repeat(51);
      const valido = await transformar({ ...payloadValido, apellido1: limite });
      expect(valido.apellido1).toBe(limite);
      await expect(transformar({ ...payloadValido, apellido1: excede })).rejects.toThrow(BadRequestException);
    });
  });

  describe('Validaciones de DTO — Segundo Apellido', () => {
    it('acepta segundo apellido omitido, vacío o con solo espacios (opcional)', async () => {
      const sinSegundo = { ...payloadValido };
      delete (sinSegundo as any).apellido2;
      const res1 = await transformar(sinSegundo);
      expect(res1.apellido2).toBeUndefined();

      const conVacio = await transformar({ ...payloadValido, apellido2: '' });
      expect(conVacio.apellido2).toBeUndefined();

      const conEspacios = await transformar({ ...payloadValido, apellido2: '   ' });
      expect(conEspacios.apellido2).toBeUndefined();
    });

    it('acepta segundo apellido con caracteres válidos (tildes, ñ, guiones, apóstrofes)', async () => {
      const res = await transformar({ ...payloadValido, apellido2: "D'Angelo-Muñoz" });
      expect(res.apellido2).toBe("D'Angelo-Muñoz");
    });

    it('rechaza segundo apellido con números o símbolos cuando se proporciona', async () => {
      await expect(transformar({ ...payloadValido, apellido2: 'Ruiz1' })).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, apellido2: 'Soto$' })).rejects.toThrow(BadRequestException);
    });

    it('rechaza segundo apellido que supere los 50 caracteres', async () => {
      const limite = 'B'.repeat(50);
      const excede = 'B'.repeat(51);
      const valido = await transformar({ ...payloadValido, apellido2: limite });
      expect(valido.apellido2).toBe(limite);
      await expect(transformar({ ...payloadValido, apellido2: excede })).rejects.toThrow(BadRequestException);
    });
  });

  describe('Validaciones de DTO — Correo Electrónico', () => {
    it('elimina espacios exteriores y convierte a minúsculas', async () => {
      const res = await transformar({
        ...payloadValido,
        correo: '   MARIA.JOSE@UNA.AC.CR   ',
      });
      expect(res.correo).toBe('maria.jose@una.ac.cr');
    });

    it('rechaza correo vacío o no proporcionado', async () => {
      await expect(transformar({ ...payloadValido, correo: '' })).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, correo: '   ' })).rejects.toThrow(BadRequestException);
    });

    it('rechaza correos con formato inválido o espacios interiores', async () => {
      await expect(transformar({ ...payloadValido, correo: 'ana@' })).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, correo: 'ana @una.ac.cr' })).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, correo: 'sin-arroba.com' })).rejects.toThrow(BadRequestException);
    });

    it('rechaza correo que supere los 150 caracteres', async () => {
      const excede = 'x'.repeat(148) + '@a.co'; // 153 caracteres
      await expect(transformar({ ...payloadValido, correo: excede })).rejects.toThrow(BadRequestException);
    });
  });

  describe('Validaciones de Jerarquía y Creación — Servicio', () => {
    let service: JerarquiaUsuariosService;
    let mockDataSource: any;
    let mockUsuariosService: any;
    let mockAlcance: any;
    let mockUsuariosRepo: any;
    let mockCarreraRepo: any;
    let mockDependenciaRepo: any;
    let mockAuditoriaRepo: any;

    beforeEach(() => {
      mockUsuariosRepo = {
        findOne: jest.fn(),
        find: jest.fn(),
      };
      mockCarreraRepo = {
        find: jest.fn(),
      };
      mockDependenciaRepo = {
        find: jest.fn(),
        save: jest.fn(),
      };
      mockAuditoriaRepo = {
        find: jest.fn(),
        save: jest.fn(),
      };
      mockAlcance = {
        obtenerCarrerasAutorizadas: jest.fn().mockResolvedValue([1]),
        obtenerPermisosDelegables: jest.fn().mockResolvedValue([
          PermisoSistema.ESTUDIANTES_VER,
          PermisoSistema.ESTUDIANTES_GESTIONAR,
        ]),
      };
      mockUsuariosService = {
        crearConInvitacion: jest.fn(),
      };
      mockDataSource = {
        transaction: jest.fn(),
      };

      service = new JerarquiaUsuariosService(
        mockDataSource as any,
        mockUsuariosRepo as any,
        mockCarreraRepo as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockDependenciaRepo as any,
        mockAuditoriaRepo as any,
        mockAlcance as any,
        mockUsuariosService as any,
      );
    });

    it('rechaza delegación de carreras no autorizadas para el coordinador', async () => {
      const coordinadorActivo = {
        id: 10,
        activo: true,
        usuarioRoles: [{ rol: { nombre: RolSistema.COORDINADOR, activo: true }, activo: true }],
      };
      mockUsuariosRepo.findOne.mockResolvedValue(coordinadorActivo);
      // Coordinador solo autorizado para carrera 1; se intenta delegar carrera 99
      mockAlcance.obtenerCarrerasAutorizadas.mockResolvedValue([1]);

      const dto: CrearAsistenteJerarquicoDto = {
        cedula: '123456789',
        nombres: 'Asistente',
        apellido1: 'Prueba',
        correo: 'asistente@una.ac.cr',
        carreras: [{ carreraId: 99, permisos: [PermisoSistema.ESTUDIANTES_VER] }],
      };

      await expect(service.crearAsistente(10, dto)).rejects.toThrow(ForbiddenException);
      expect(mockUsuariosService.crearConInvitacion).not.toHaveBeenCalled();
    });

    it('rechaza delegación de permisos que el coordinador no posee', async () => {
      const coordinadorActivo = {
        id: 10,
        activo: true,
        usuarioRoles: [{ rol: { nombre: RolSistema.COORDINADOR, activo: true }, activo: true }],
      };
      mockUsuariosRepo.findOne.mockResolvedValue(coordinadorActivo);
      mockAlcance.obtenerCarrerasAutorizadas.mockResolvedValue([1]);
      // Coordinador solo tiene ESTUDIANTES_VER, no CURSOS_GESTIONAR
      mockAlcance.obtenerPermisosDelegables.mockResolvedValue([PermisoSistema.ESTUDIANTES_VER]);

      const dto: CrearAsistenteJerarquicoDto = {
        cedula: '123456789',
        nombres: 'Asistente',
        apellido1: 'Prueba',
        correo: 'asistente@una.ac.cr',
        carreras: [{ carreraId: 1, permisos: [PermisoSistema.CURSOS_GESTIONAR] }],
      };

      await expect(service.crearAsistente(10, dto)).rejects.toThrow(ForbiddenException);
      expect(mockUsuariosService.crearConInvitacion).not.toHaveBeenCalled();
    });

    it('rechaza creación si no se selecciona ninguna carrera', async () => {
      const dto: CrearAsistenteJerarquicoDto = {
        cedula: '123456789',
        nombres: 'Asistente',
        apellido1: 'Prueba',
        correo: 'asistente@una.ac.cr',
        carreras: [],
      };

      await expect(service.crearAsistente(10, dto)).rejects.toThrow('Seleccione al menos una carrera.');
    });

    it('rechaza creación si ninguna carrera tiene permisos delegables seleccionados', async () => {
      const dto: CrearAsistenteJerarquicoDto = {
        cedula: '123456789',
        nombres: 'Asistente',
        apellido1: 'Prueba',
        correo: 'asistente@una.ac.cr',
        carreras: [{ carreraId: 1, permisos: [] }],
      };

      await expect(service.crearAsistente(10, dto)).rejects.toThrow('Seleccione al menos un permiso delegable.');
    });

    it('rechaza cédulas o correos duplicados delegando a la validación de persistencia', async () => {
      const coordinadorActivo = {
        id: 10,
        activo: true,
        usuarioRoles: [{ rol: { nombre: RolSistema.COORDINADOR, activo: true }, activo: true }],
      };
      mockUsuariosRepo.findOne.mockResolvedValue(coordinadorActivo);
      mockAlcance.obtenerCarrerasAutorizadas.mockResolvedValue([1]);
      mockAlcance.obtenerPermisosDelegables.mockResolvedValue([PermisoSistema.ESTUDIANTES_VER]);

      // Simulamos que el servicio de usuarios rechaza por cédula duplicada
      mockUsuariosService.crearConInvitacion.mockRejectedValue(
        new ConflictException('La cédula ya está registrada.'),
      );

      const dto: CrearAsistenteJerarquicoDto = {
        cedula: '123456789',
        nombres: 'Asistente',
        apellido1: 'Prueba',
        correo: 'duplicado@una.ac.cr',
        carreras: [{ carreraId: 1, permisos: [PermisoSistema.ESTUDIANTES_VER] }],
      };

      await expect(service.crearAsistente(10, dto)).rejects.toThrow(ConflictException);
      await expect(service.crearAsistente(10, dto)).rejects.toThrow('La cédula ya está registrada.');
    });

    it('creación válida invoca crearConInvitacion con el rol de asistente y preserva ceros iniciales', async () => {
      const coordinadorActivo = {
        id: 10,
        activo: true,
        usuarioRoles: [{ rol: { nombre: RolSistema.COORDINADOR, activo: true }, activo: true }],
      };
      mockUsuariosRepo.findOne.mockResolvedValue(coordinadorActivo);
      mockAlcance.obtenerCarrerasAutorizadas.mockResolvedValue([1]);
      mockAlcance.obtenerPermisosDelegables.mockResolvedValue([PermisoSistema.ESTUDIANTES_VER]);

      mockUsuariosService.crearConInvitacion.mockResolvedValue({
        id: 99,
        cedula: '012345678',
        invitacion: { estado: 'PENDIENTE', url: 'https://sgpa.una.ac.cr/#token=abc' },
      });

      const dto: CrearAsistenteJerarquicoDto = {
        cedula: '012345678',
        nombres: 'Carlos',
        apellido1: 'Alvarado',
        apellido2: 'Mora',
        correo: 'carlos.alvarado@una.ac.cr',
        carreras: [{ carreraId: 1, permisos: [PermisoSistema.ESTUDIANTES_VER] }],
      };

      const resultado = await service.crearAsistente(10, dto);
      expect(resultado).toBeDefined();
      expect(resultado.cedula).toBe('012345678');
      expect(mockUsuariosService.crearConInvitacion).toHaveBeenCalledWith(
        expect.objectContaining({
          cedula: '012345678',
          roles: [RolSistema.ASISTENTE_ESTUDIANTIL],
          permisos: [PermisoSistema.ESTUDIANTES_VER],
        }),
        expect.any(Function),
        expect.objectContaining({ respetarConfiguracionEnvio: true, incluirEstadoInvitacion: true }),
      );
    });
  });
});
