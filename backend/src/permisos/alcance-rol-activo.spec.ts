import { establecerRolActivo, iniciarContextoRolActivo } from '../auth/active-role-context';
import { RolSistema } from '../auth/constants/roles.constants';
import { AlcanceJerarquicoService } from './alcance-jerarquico.service';

describe('D-01: alcance por carrera con rol activo', () => {
  const usuarios = { findOne: jest.fn() };
  const carreras = { find: jest.fn() };
  const asignaciones = { find: jest.fn() };
  const permisos = { findOne: jest.fn() };
  const dependencias = { findOne: jest.fn() };
  const service = new AlcanceJerarquicoService(
    usuarios as any, carreras as any, asignaciones as any, permisos as any, dependencias as any,
  );

  beforeEach(() => {
    usuarios.findOne.mockResolvedValue({ id: 7, activo: true, usuarioRoles: [
      { rol: { nombre: RolSistema.ADMIN_GLOBAL, activo: true } },
      { rol: { nombre: RolSistema.COORDINADOR, activo: true } },
      { rol: { nombre: RolSistema.PROFESOR, activo: true } },
    ] });
    carreras.find.mockResolvedValue([{ id: 11 }, { id: 12 }]);
    asignaciones.find.mockResolvedValue([]);
    permisos.findOne.mockResolvedValue(null);
  });

  const enPeticion = <T>(rol: RolSistema, operacion: () => Promise<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      iniciarContextoRolActivo({} as any, {} as any, () => {
        establecerRolActivo(7, rol);
        operacion().then(resolve, reject);
      });
    });

  it('no hereda las carreras globales al elegir Coordinador', async () => {
    const ids = await enPeticion(RolSistema.COORDINADOR, () => service.obtenerCarrerasAutorizadas(7));
    expect(ids).toEqual([]);
    expect(await enPeticion(RolSistema.COORDINADOR,
      () => service.puedeEjecutar(7, 'ESTUDIANTES_GESTIONAR' as any, 11))).toBe(false);
  });

  it('conserva el alcance global solo con Admin activo', async () => {
    const ids = await enPeticion(RolSistema.ADMIN_GLOBAL, () => service.obtenerCarrerasAutorizadas(7));
    expect(ids).toEqual([11, 12]);
  });

  it('Profesor no hereda alcance de Admin ni Coordinador', async () => {
    expect(await enPeticion(RolSistema.PROFESOR,
      () => service.obtenerCarrerasAutorizadas(7))).toEqual([]);
  });
});
