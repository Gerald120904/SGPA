import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { SolicitudCambio } from './entities/solicitud-cambio.entity';
import { carrerasDeSolicitud, solicitudAfectada } from './revocacion-impacto';

const solicitud = (modulo: string, carreraId: number, datosPropuestos = {},
  operacion = 'ACTUALIZAR') => ({ modulo, carreraId, datosPropuestos, operacion }) as SolicitudCambio;

describe('impacto selectivo de revocación administrativa', () => {
  it('rechaza solo el módulo y la carrera cuyo permiso se retiró', () => {
    const revocados = new Set([`2:${PermisoSistema.PLANES_ESTUDIO_GESTIONAR}`]);
    expect(solicitudAfectada(solicitud('PLANES_ESTUDIO', 2), revocados)).toBe(true);
    expect(solicitudAfectada(solicitud('ESTUDIANTES', 2), revocados)).toBe(false);
    expect(solicitudAfectada(solicitud('PLANES_ESTUDIO', 3), revocados)).toBe(false);
  });

  it('incluye optativas y carreras compartidas de cursos', () => {
    expect(solicitudAfectada(solicitud('OPTATIVAS', 4),
      new Set([`4:${PermisoSistema.OPTATIVAS_GESTIONAR}`]))).toBe(true);
    const curso = solicitud('CURSOS', 2, { carrerasAfectadas: [2, 5] });
    expect(carrerasDeSolicitud(curso)).toEqual([2, 5]);
    expect(solicitudAfectada(curso, new Set([`5:${PermisoSistema.CURSOS_GESTIONAR}`]))).toBe(true);
  });

  it('considera la carrera destino de un cambio de plan', () => {
    const cambio = solicitud('ESTUDIANTES', 2, { carreraDestinoId: 7 }, 'CAMBIAR_PLAN');
    expect(carrerasDeSolicitud(cambio)).toEqual([2, 7]);
    expect(solicitudAfectada(cambio, new Set([`7:${PermisoSistema.ESTUDIANTES_GESTIONAR}`]))).toBe(true);
  });
});
