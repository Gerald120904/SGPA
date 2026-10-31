import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { rolActivoDePeticion } from '../auth/active-role-context';
import { Carrera } from '../carreras/entities/carrera.entity';
import { TipoAsignacionAcademica } from '../estructura-academica/constants/tipo-asignacion-academica.constant';
import { AsignacionAcademica } from '../estructura-academica/entities/asignacion-academica.entity';
import { DependenciaUsuario } from '../usuarios/entities/dependencia-usuario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { PermisoSistema } from './constants/permisos.constant';
import { PermisoCarrera } from './entities/permiso-carrera.entity';

@Injectable()
export class AlcanceJerarquicoService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Carrera) private readonly carreras: Repository<Carrera>,
    @InjectRepository(AsignacionAcademica) private readonly asignaciones: Repository<AsignacionAcademica>,
    @InjectRepository(PermisoCarrera) private readonly permisos: Repository<PermisoCarrera>,
    @InjectRepository(DependenciaUsuario) private readonly dependencias: Repository<DependenciaUsuario>,
  ) {}

  private async usuarioVigente(id: number): Promise<{ roles: Set<string> } | null> {
    const usuario = await this.usuarios.findOne({
      where: { id, activo: true },
      relations: { usuarioRoles: { rol: true } },
    });
    if (!usuario) return null;
    const roles = new Set((usuario.usuarioRoles ?? [])
      .filter((rel) => rel.rol?.activo)
      .map((rel) => rel.rol.nombre));
    const activo = rolActivoDePeticion(id);
    if (activo) {
      return { roles: roles.has(activo) ? new Set([activo]) : new Set<string>() };
    }
    // Fuera de una petición autenticada, una cuenta multirrol no recibe
    // el alcance global por el mero hecho de conservar ADMIN_GLOBAL.
    if (roles.size > 1) roles.delete(RolSistema.ADMIN_GLOBAL);
    return { roles };
  }

  async tipoCuentaJerarquica(id: number): Promise<'COORDINADOR' | 'ASISTENTE_ESTUDIANTIL' | null> {
    const usuario = await this.usuarioVigente(id);
    if (!usuario || usuario.roles.has(RolSistema.ADMIN_GLOBAL)) return null;
    if (usuario.roles.has(RolSistema.ASISTENTE_ESTUDIANTIL)) return 'ASISTENTE_ESTUDIANTIL';
    if (usuario.roles.has(RolSistema.COORDINADOR)) return 'COORDINADOR';
    return null;
  }

  private hoyInstitucional(): string {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
    return `${valor('year')}-${valor('month')}-${valor('day')}`;
  }

  private async carrerasDirectas(id: number, tipo: TipoAsignacionAcademica): Promise<number[]> {
    const hoy = this.hoyInstitucional();
    const asignaciones = await this.asignaciones.find({ where: { usuarioId: id, tipo, activo: true } });
    const ids = [...new Set(asignaciones.filter((a) =>
      a.carreraId && a.fechaInicio <= hoy && (!a.fechaFin || a.fechaFin >= hoy),
    ).map((a) => a.carreraId!))];
    if (!ids.length) return [];
    const carreras = await this.carreras.find({ where: { id: In(ids), activo: true } });
    return carreras.map((c) => c.id);
  }

  async obtenerCarrerasAutorizadas(usuarioId: number): Promise<number[]> {
    const usuario = await this.usuarioVigente(usuarioId);
    if (!usuario) return [];
    if (usuario.roles.has(RolSistema.ADMIN_GLOBAL)) {
      return (await this.carreras.find({ where: { activo: true } })).map((c) => c.id);
    }
    if (usuario.roles.has(RolSistema.ASISTENTE_ESTUDIANTIL)) {
      const dependencia = await this.dependencias.findOne({ where: { asistenteId: usuarioId, activo: true } });
      if (!dependencia || !(await this.usuarioVigente(dependencia.coordinadorId))?.roles.has(RolSistema.COORDINADOR)) return [];
      const propias = await this.carrerasDirectas(usuarioId, TipoAsignacionAcademica.ASISTENTE_CARRERA);
      const coordinador = new Set(await this.carrerasDirectas(dependencia.coordinadorId, TipoAsignacionAcademica.COORDINADOR_CARRERA));
      return propias.filter((id) => coordinador.has(id));
    }
    if (usuario.roles.has(RolSistema.COORDINADOR)) {
      return this.carrerasDirectas(usuarioId, TipoAsignacionAcademica.COORDINADOR_CARRERA);
    }
    return [];
  }

  async puedeEjecutar(usuarioId: number, permiso: PermisoSistema, carreraId: number): Promise<boolean> {
    if (!Number.isInteger(carreraId) || carreraId <= 0) return false;
    const usuario = await this.usuarioVigente(usuarioId);
    if (!usuario) return false;
    if (usuario.roles.has(RolSistema.ADMIN_GLOBAL)) return true;
    if (!(await this.obtenerCarrerasAutorizadas(usuarioId)).includes(carreraId)) return false;
    const propio = await this.permisos.findOne({ where: { usuarioId, carreraId, permiso, activo: true } });
    if (!propio) return false;
    if (usuario.roles.has(RolSistema.ASISTENTE_ESTUDIANTIL)) {
      const dependencia = await this.dependencias.findOne({ where: { asistenteId: usuarioId, activo: true } });
      if (!dependencia) return false;
      return !!(await this.permisos.findOne({ where: {
        usuarioId: dependencia.coordinadorId, carreraId, permiso, activo: true,
      } }));
    }
    return usuario.roles.has(RolSistema.COORDINADOR);
  }

  async obtenerPermisosDelegables(coordinadorId: number, carreraId: number): Promise<PermisoSistema[]> {
    const usuario = await this.usuarioVigente(coordinadorId);
    if (!usuario?.roles.has(RolSistema.COORDINADOR) ||
      !(await this.obtenerCarrerasAutorizadas(coordinadorId)).includes(carreraId)) return [];
    const permisos = await this.permisos.find({ where: { usuarioId: coordinadorId, carreraId, activo: true } });
    return permisos.map((p) => p.permiso);
  }

  async puedeAdministrarAsistente(coordinadorId: number, asistenteId: number): Promise<boolean> {
    const coordinador = await this.usuarioVigente(coordinadorId);
    const asistente = await this.usuarioVigente(asistenteId);
    if (!coordinador?.roles.has(RolSistema.COORDINADOR) ||
      !asistente?.roles.has(RolSistema.ASISTENTE_ESTUDIANTIL)) return false;
    return !!(await this.dependencias.findOne({ where: {
      coordinadorId, asistenteId, activo: true,
    } }));
  }

  async tieneCoordinadorResponsableActivo(asistenteId: number): Promise<boolean> {
    const dependencia = await this.dependencias.findOne({ where: { asistenteId, activo: true } });
    if (!dependencia) return false;
    return !!(await this.usuarioVigente(dependencia.coordinadorId))?.roles.has(RolSistema.COORDINADOR);
  }

  async validarDelegacion(coordinadorId: number, asistenteId: number, carreraId: number, permisos: PermisoSistema[]): Promise<void> {
    if (!(await this.puedeAdministrarAsistente(coordinadorId, asistenteId))) {
      throw new ForbiddenException('El asistente no pertenece al coordinador.');
    }
    if (!(await this.obtenerCarrerasAutorizadas(coordinadorId)).includes(carreraId)) {
      throw new ForbiddenException('Carrera no delegable.');
    }
    if (new Set(permisos).size !== permisos.length) throw new BadRequestException('Permisos duplicados.');
    const delegables = new Set(await this.obtenerPermisosDelegables(coordinadorId, carreraId));
    if (permisos.some((permiso) => !delegables.has(permiso))) {
      throw new ForbiddenException('Permiso no delegable.');
    }
  }
}
