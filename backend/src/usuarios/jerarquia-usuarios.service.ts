import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { Carrera } from '../carreras/entities/carrera.entity';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { TipoAsignacionAcademica } from '../estructura-academica/constants/tipo-asignacion-academica.constant';
import { AsignacionAcademica } from '../estructura-academica/entities/asignacion-academica.entity';
import { AlcanceJerarquicoService } from '../permisos/alcance-jerarquico.service';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { PERMISOS_PREDETERMINADOS_POR_ROL } from '../permisos/constants/plantillas-permisos.constant';
import { PERMISOS_JERARQUIA_HABILITADOS } from '../permisos/constants/permisos-jerarquia-habilitados.constant';
import { PermisoCarrera } from '../permisos/entities/permiso-carrera.entity';
import { UsuarioPermisoExcepcion } from '../permisos/entities/usuario-permiso-excepcion.entity';
import { UsuarioPermiso } from '../permisos/entities/usuario-permiso.entity';
import { AlcanceCarreraDto, CrearAsistenteJerarquicoDto } from './dto/configurar-jerarquia.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { AuditoriaJerarquia } from './entities/auditoria-jerarquia.entity';
import { SolicitudCambio } from './entities/solicitud-cambio.entity';
import { DependenciaUsuario } from './entities/dependencia-usuario.entity';
import { Usuario } from './entities/usuario.entity';
import { UsuariosService } from './usuarios.service';

@Injectable()
export class JerarquiaUsuariosService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Carrera) private readonly carreras: Repository<Carrera>,
    @InjectRepository(PlanEstudio) private readonly planes: Repository<PlanEstudio>,
    @InjectRepository(PeriodoAcademico) private readonly periodos: Repository<PeriodoAcademico>,
    @InjectRepository(AsignacionAcademica) private readonly asignaciones: Repository<AsignacionAcademica>,
    @InjectRepository(PermisoCarrera) private readonly permisosCarrera: Repository<PermisoCarrera>,
    @InjectRepository(DependenciaUsuario) private readonly dependencias: Repository<DependenciaUsuario>,
    @InjectRepository(AuditoriaJerarquia) private readonly auditorias: Repository<AuditoriaJerarquia>,
    private readonly alcance: AlcanceJerarquicoService,
    private readonly usuariosService: UsuariosService,
  ) {}

  private hoy(): string {
    const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Costa_Rica',
      year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
    return `${valor('year')}-${valor('month')}-${valor('day')}`;
  }

  private tieneRol(usuario: Usuario, rol: RolSistema): boolean {
    return (usuario.usuarioRoles ?? []).some((ur) => ur.rol?.activo && ur.rol.nombre === rol);
  }

  private async usuarioConRoles(id: number): Promise<Usuario> {
    const usuario = await this.usuarios.findOne({ where: { id }, relations: { usuarioRoles: { rol: true } } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    return usuario;
  }

  private validarCarreras(carreras: AlcanceCarreraDto[]): void {
    if (new Set(carreras.map((c) => c.carreraId)).size !== carreras.length) {
      throw new BadRequestException('Las carreras deben ser unicas.');
    }
    if (carreras.some((c) => c.permisos.some((p) => !PERMISOS_JERARQUIA_HABILITADOS.has(p)))) {
      throw new BadRequestException('El módulo solicitado aún no tiene alcance por carrera verificable.');
    }
  }

  private async configuracion(usuarioId: number, tipo: TipoAsignacionAcademica) {
    const asignaciones = await this.asignaciones.find({ where: { usuarioId, tipo, activo: true } });
    const permisos = await this.permisosCarrera.find({ where: { usuarioId, activo: true } });
    return { usuarioId, carreras: asignaciones.filter((a) => a.carreraId !== null).map((a) => ({
      carreraId: a.carreraId!,
      permisos: permisos.filter((p) => p.carreraId === a.carreraId).map((p) => p.permiso),
    })) };
  }

  async obtenerCoordinador(actorId: number, coordinadorId: number) {
    const actor = await this.usuarioConRoles(actorId);
    if (!actor.activo || !(this.tieneRol(actor, RolSistema.ADMIN_GLOBAL) || actorId === coordinadorId)) {
      throw new ForbiddenException();
    }
    return this.configuracion(coordinadorId, TipoAsignacionAcademica.COORDINADOR_CARRERA);
  }

  async misAlcances(usuarioId: number) {
    const ids = await this.alcance.obtenerCarrerasAutorizadas(usuarioId);
    if (!ids.length) return [];
    const carreras = await this.carreras.find({ where: { id: In(ids), activo: true }, order: { nombre: 'ASC' } });
    return Promise.all(carreras.map(async (carrera) => ({
      id: carrera.id, codigo: carrera.codigo, nombre: carrera.nombre,
      permisos: (await this.alcance.obtenerPermisosDelegables(usuarioId, carrera.id))
        .filter((p) => PERMISOS_JERARQUIA_HABILITADOS.has(p)),
    })));
  }

  async catalogoEstudiantes(usuarioId: number) {
    const ids = (await this.alcance.obtenerCarrerasAutorizadas(usuarioId));
    const autorizadas: number[] = [];
    for (const id of ids) if (
      await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.ESTUDIANTES_VER, id) ||
      await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.ESTUDIANTES_GESTIONAR, id)
    ) autorizadas.push(id);
    if (!autorizadas.length) return { carreras: [], planes: [], periodos: [] };
    const [carreras, planes, periodos] = await Promise.all([
      this.carreras.find({ where: { id: In(autorizadas), activo: true } }),
      this.planes.find({ where: { carreraId: In(autorizadas), activo: true } }),
      this.periodos.find({ select: { id: true, codigo: true, nombre: true, anio: true, ciclo: true },
        order: { anio: 'DESC', ciclo: 'DESC' } }),
    ]);
    return { carreras, planes, periodos };
  }

  async catalogoCursos(usuarioId: number) {
    const ids = await this.alcance.obtenerCarrerasAutorizadas(usuarioId);
    const autorizadas: number[] = [];
    for (const id of ids) if (
      await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.CURSOS_VER, id) ||
      await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.CURSOS_GESTIONAR, id)
    ) autorizadas.push(id);
    if (!autorizadas.length) return { carreras: [], planes: [] };
    const [carreras, planes] = await Promise.all([
      this.carreras.find({ where: { id: In(autorizadas), activo: true }, order: { nombre: 'ASC' } }),
      this.planes.find({ where: { carreraId: In(autorizadas), activo: true } }),
    ]);
    return { carreras: await Promise.all(carreras.map(async (carrera) => ({ ...carrera,
      puedeGestionarCursos: await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.CURSOS_GESTIONAR, carrera.id),
    }))), planes };
  }

  async catalogoPlanes(usuarioId: number) {
    const ids = await this.alcance.obtenerCarrerasAutorizadas(usuarioId);
    const autorizadas: number[] = [];
    for (const id of ids) if (
      await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.PLANES_ESTUDIO_VER, id) ||
      await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.PLANES_ESTUDIO_GESTIONAR, id)
    ) autorizadas.push(id);
    if (!autorizadas.length) return { carreras: [] };
    const carreras = await this.carreras.find({ where: { id: In(autorizadas), activo: true }, order: { nombre: 'ASC' } });
    return { carreras: await Promise.all(carreras.map(async (carrera) => ({ ...carrera,
      puedeGestionarPlanes: await this.alcance.puedeEjecutar(usuarioId,
        PermisoSistema.PLANES_ESTUDIO_GESTIONAR, carrera.id),
    }))) };
  }

  async listarMisAsistentes(coordinadorId: number) {
    const relaciones = await this.dependencias.find({ where: { coordinadorId, activo: true } });
    if (!relaciones.length) return [];
    const usuarios = await this.usuarios.find({ where: { id: In(relaciones.map((d) => d.asistenteId)) } });
    return usuarios.map((u) => ({ id: u.id, nombres: u.nombres, apellido1: u.apellido1,
      apellido2: u.apellido2, correo: u.correo, activo: u.activo }));
  }

  async obtenerAsistente(coordinadorId: number, asistenteId: number) {
    if (!(await this.alcance.puedeAdministrarAsistente(coordinadorId, asistenteId))) {
      throw new ForbiddenException('El asistente no pertenece al coordinador.');
    }
    return this.configuracion(asistenteId, TipoAsignacionAcademica.ASISTENTE_CARRERA);
  }

  async listarAuditoria(actorId: number, objetivoId: number) {
    const actor = await this.usuarioConRoles(actorId);
    if (!this.tieneRol(actor, RolSistema.ADMIN_GLOBAL)) throw new ForbiddenException();
    return this.auditorias.find({ where: { objetivoUsuarioId: objetivoId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  async configurarCoordinador(actorId: number, coordinadorId: number, carreras: AlcanceCarreraDto[]) {
    this.validarCarreras(carreras);
    const actor = await this.usuarioConRoles(actorId);
    if (!actor.activo || !this.tieneRol(actor, RolSistema.ADMIN_GLOBAL)) throw new ForbiddenException();
    const coordinador = await this.usuarioConRoles(coordinadorId);
    if ((!coordinador.activo && !coordinador.passwordResetTokenHash) ||
      !this.tieneRol(coordinador, RolSistema.COORDINADOR) ||
      this.tieneRol(coordinador, RolSistema.ADMIN_GLOBAL)) throw new ForbiddenException('Cuenta de coordinador no válida.');
    return this.dataSource.transaction(async (manager) => {
      const bloqueado = await manager.getRepository(Usuario).findOne({
        where: { id: coordinadorId }, lock: { mode: 'pessimistic_write' },
      });
      const rolesActuales = await manager.getRepository(Usuario).findOne({
        where: { id: coordinadorId }, relations: { usuarioRoles: { rol: true } },
      });
      if (!bloqueado || (!bloqueado.activo && !bloqueado.passwordResetTokenHash) ||
        !rolesActuales || !this.tieneRol(rolesActuales, RolSistema.COORDINADOR) ||
        this.tieneRol(rolesActuales, RolSistema.ADMIN_GLOBAL)) {
        throw new ForbiddenException('La cuenta ya no tiene el rol o estado de coordinador.');
      }
      const validas = await manager.getRepository(Carrera).find({ where: { id: In(carreras.map((c) => c.carreraId)), activo: true } });
      if (validas.length !== carreras.length) throw new BadRequestException('Carrera inexistente o inactiva.');
      await this.reemplazarAsignaciones(manager, coordinadorId, TipoAsignacionAcademica.COORDINADOR_CARRERA, carreras);
      await this.reemplazarPermisos(manager, coordinadorId, carreras);
      const dependientes = await manager.getRepository(DependenciaUsuario).find({ where: { coordinadorId, activo: true } });
      const permitidos = new Set(carreras.flatMap((c) => c.permisos.map((p) => `${c.carreraId}:${p}`)));
      const ids = dependientes.map((d) => d.asistenteId);
      if (ids.length) {
        const asignaciones = await manager.getRepository(AsignacionAcademica).find({ where: {
          usuarioId: In(ids), tipo: TipoAsignacionAcademica.ASISTENTE_CARRERA, activo: true,
        } });
        const carrerasPadre = new Set(carreras.map((c) => c.carreraId));
        for (const a of asignaciones) if (!carrerasPadre.has(a.carreraId!)) {
          a.activo = false; a.fechaFin = this.hoy();
          await manager.getRepository(AsignacionAcademica).save(a);
        }
        const delegados = await manager.getRepository(PermisoCarrera).find({ where: { usuarioId: In(ids), activo: true } });
        for (const p of delegados) if (!permitidos.has(`${p.carreraId}:${p.permiso}`)) {
          p.activo = false;
          await manager.getRepository(PermisoCarrera).save(p);
          await this.sincronizarLegacy(manager, p.usuarioId);
        }
      }
      const pendientes = await manager.getRepository(SolicitudCambio).find({ where: { coordinadorId, estado: 'PENDIENTE' } });
      for (const solicitud of pendientes) {
        const requerido = solicitud.modulo === 'ESTUDIANTES' ? PermisoSistema.ESTUDIANTES_GESTIONAR :
          solicitud.modulo === 'CURSOS' ? PermisoSistema.CURSOS_GESTIONAR :
          solicitud.modulo === 'PLANES_ESTUDIO' ? PermisoSistema.PLANES_ESTUDIO_GESTIONAR : null;
        const carrerasSolicitud = solicitud.modulo === 'CURSOS' && Array.isArray(solicitud.datosPropuestos.carrerasAfectadas) ?
          solicitud.datosPropuestos.carrerasAfectadas as number[] : [solicitud.carreraId];
        if (!requerido || carrerasSolicitud.some((id) => !permitidos.has(`${id}:${requerido}`))) {
          solicitud.estado = 'INVALIDADA';
          solicitud.resueltoEn = new Date();
          solicitud.resueltoPorUsuarioId = actorId;
          await manager.getRepository(SolicitudCambio).save(solicitud);
        }
      }
      await this.sincronizarLegacy(manager, coordinadorId);
      await manager.getRepository(AuditoriaJerarquia).save({
        actorUsuarioId: actorId, objetivoUsuarioId: coordinadorId, accion: 'CONFIGURAR_COORDINADOR',
        detalle: { carreras: carreras.map((c) => ({ carreraId: c.carreraId, permisos: c.permisos })) },
      });
      return { coordinadorId, carreras };
    });
  }

  async vincularAsistente(coordinadorId: number, asistenteId: number, carreras: AlcanceCarreraDto[]) {
    await this.validarDelegacion(coordinadorId, carreras);
    const asistente = await this.usuarioConRoles(asistenteId);
    if (!this.tieneRol(asistente, RolSistema.ASISTENTE_ESTUDIANTIL) ||
      this.tieneRol(asistente, RolSistema.COORDINADOR) || this.tieneRol(asistente, RolSistema.ADMIN_GLOBAL)) {
      throw new ForbiddenException('La cuenta no es exclusivamente asistente.');
    }
    return this.dataSource.transaction(async (manager) => {
      await this.validarDelegacionEnTransaccion(manager, coordinadorId, carreras);
      const bloqueado = await manager.getRepository(Usuario).findOne({
        where: { id: asistenteId, activo: true }, lock: { mode: 'pessimistic_write' },
      });
      const rolesActuales = await manager.getRepository(Usuario).findOne({
        where: { id: asistenteId }, relations: { usuarioRoles: { rol: true } },
      });
      if (!bloqueado || !rolesActuales || !this.tieneRol(rolesActuales, RolSistema.ASISTENTE_ESTUDIANTIL) ||
        this.tieneRol(rolesActuales, RolSistema.COORDINADOR) || this.tieneRol(rolesActuales, RolSistema.ADMIN_GLOBAL)) {
        throw new ForbiddenException('La cuenta ya no tiene el rol o estado de asistente.');
      }
      const existentes = await manager.getRepository(DependenciaUsuario).find({ where: { asistenteId } });
      if (!existentes.length || existentes[0].coordinadorId !== coordinadorId || !existentes[0].activo) {
        throw new ForbiddenException('El asistente no pertenece al coordinador.');
      }
      await this.configurarAsistenteEnTransaccion(manager, coordinadorId, asistenteId, carreras);
      return { asistenteId, coordinadorId, carreras };
    });
  }

  async crearAsistente(coordinadorId: number, dto: CrearAsistenteJerarquicoDto) {
    if (!dto.carreras.length) throw new BadRequestException('Seleccione al menos una carrera.');
    await this.validarDelegacion(coordinadorId, dto.carreras);
    const cuenta: CrearUsuarioDto = {
      cedula: dto.cedula, nombres: dto.nombres, apellido1: dto.apellido1,
      apellido2: dto.apellido2, correo: dto.correo,
      roles: [RolSistema.ASISTENTE_ESTUDIANTIL],
      permisos: [...new Set(dto.carreras.flatMap((c) => c.permisos))],
    };
    return this.usuariosService.crearConInvitacion(cuenta, async (manager, asistenteId) => {
      await this.validarDelegacionEnTransaccion(manager, coordinadorId, dto.carreras);
      await manager.getRepository(DependenciaUsuario).save({
        asistenteId, coordinadorId, creadoPorUsuarioId: coordinadorId, activo: true,
      });
      await this.configurarAsistenteEnTransaccion(manager, coordinadorId, asistenteId, dto.carreras);
    });
  }

  private async validarDelegacion(coordinadorId: number, carreras: AlcanceCarreraDto[]) {
    this.validarCarreras(carreras);
    const coordinador = await this.usuarioConRoles(coordinadorId);
    if (!coordinador.activo || !this.tieneRol(coordinador, RolSistema.COORDINADOR) ||
      this.tieneRol(coordinador, RolSistema.ADMIN_GLOBAL)) throw new ForbiddenException();
    const autorizadas = new Set(await this.alcance.obtenerCarrerasAutorizadas(coordinadorId));
    for (const carrera of carreras) {
      const delegables = new Set(await this.alcance.obtenerPermisosDelegables(coordinadorId, carrera.carreraId));
      if (!autorizadas.has(carrera.carreraId) ||
        carrera.permisos.some((p) => !delegables.has(p))) throw new ForbiddenException('Delegación excede el alcance del coordinador.');
    }
  }

  private async validarDelegacionEnTransaccion(manager: EntityManager, coordinadorId: number, carreras: AlcanceCarreraDto[]) {
    const bloqueado = await manager.getRepository(Usuario).findOne({
      where: { id: coordinadorId, activo: true }, lock: { mode: 'pessimistic_write' },
    });
    if (!bloqueado) throw new ForbiddenException();
    const usuario = await manager.getRepository(Usuario).findOne({
      where: { id: coordinadorId, activo: true }, relations: { usuarioRoles: { rol: true } },
    });
    if (!usuario || !this.tieneRol(usuario, RolSistema.COORDINADOR) ||
      this.tieneRol(usuario, RolSistema.ADMIN_GLOBAL)) throw new ForbiddenException();
    const asignaciones = await manager.getRepository(AsignacionAcademica).find({ where: {
      usuarioId: coordinadorId, tipo: TipoAsignacionAcademica.COORDINADOR_CARRERA, activo: true,
    } });
    const permisos = await manager.getRepository(PermisoCarrera).find({ where: { usuarioId: coordinadorId, activo: true } });
    const hoy = this.hoy();
    const vigentes = new Set(asignaciones.filter((a) => a.fechaInicio <= hoy && (!a.fechaFin || a.fechaFin >= hoy)).map((a) => a.carreraId));
    const concedidos = new Set(permisos.map((p) => `${p.carreraId}:${p.permiso}`));
    for (const carrera of carreras) {
      if (!vigentes.has(carrera.carreraId) || carrera.permisos.some((p) => !concedidos.has(`${carrera.carreraId}:${p}`))) {
        throw new ForbiddenException('La delegación perdió autorización antes de guardarse.');
      }
    }
  }

  private async configurarAsistenteEnTransaccion(manager: EntityManager, coordinadorId: number, asistenteId: number, carreras: AlcanceCarreraDto[]) {
    await this.reemplazarAsignaciones(manager, asistenteId, TipoAsignacionAcademica.ASISTENTE_CARRERA, carreras);
    await this.reemplazarPermisos(manager, asistenteId, carreras);
    await this.sincronizarLegacy(manager, asistenteId);
    const permitidos = new Set(carreras.flatMap((c) => c.permisos.map((p) => `${c.carreraId}:${p}`)));
    const pendientes = await manager.getRepository(SolicitudCambio).find({ where: { solicitanteId: asistenteId, estado: 'PENDIENTE' } });
    for (const solicitud of pendientes) {
      const requerido = solicitud.modulo === 'ESTUDIANTES' ? PermisoSistema.ESTUDIANTES_GESTIONAR :
        solicitud.modulo === 'CURSOS' ? PermisoSistema.CURSOS_GESTIONAR :
        solicitud.modulo === 'PLANES_ESTUDIO' ? PermisoSistema.PLANES_ESTUDIO_GESTIONAR : null;
      const carrerasSolicitud = solicitud.modulo === 'CURSOS' && Array.isArray(solicitud.datosPropuestos.carrerasAfectadas) ?
        solicitud.datosPropuestos.carrerasAfectadas as number[] : [solicitud.carreraId];
      if (requerido && carrerasSolicitud.every((id) => permitidos.has(`${id}:${requerido}`))) continue;
      solicitud.estado = 'INVALIDADA';
      solicitud.resueltoEn = new Date();
      solicitud.resueltoPorUsuarioId = coordinadorId;
      await manager.getRepository(SolicitudCambio).save(solicitud);
    }
    await manager.getRepository(AuditoriaJerarquia).save({
      actorUsuarioId: coordinadorId, objetivoUsuarioId: asistenteId, accion: 'CONFIGURAR_ASISTENTE',
      detalle: { carreras: carreras.map((c) => ({ carreraId: c.carreraId, permisos: c.permisos })) },
    });
  }

  private async reemplazarAsignaciones(manager: EntityManager, usuarioId: number, tipo: TipoAsignacionAcademica, carreras: AlcanceCarreraDto[]) {
    const repo = manager.getRepository(AsignacionAcademica) as Repository<AsignacionAcademica>;
    const activas = await repo.find({ where: { usuarioId, tipo, activo: true } });
    const deseadas = new Set(carreras.map((c) => c.carreraId));
    for (const a of activas) if (!deseadas.has(a.carreraId!)) {
      a.activo = false; a.fechaFin = this.hoy(); await repo.save(a);
    }
    const existentes = new Set(activas.filter((a) => deseadas.has(a.carreraId!)).map((a) => a.carreraId));
    for (const carreraId of deseadas) if (!existentes.has(carreraId)) await repo.save(repo.create({
      usuarioId, tipo, carreraId, areaAcademicaId: null, fechaInicio: this.hoy(), fechaFin: null, activo: true,
    }));
  }

  private async reemplazarPermisos(manager: EntityManager, usuarioId: number, carreras: AlcanceCarreraDto[]) {
    const repo = manager.getRepository(PermisoCarrera) as Repository<PermisoCarrera>;
    const actuales = await repo.find({ where: { usuarioId } });
    const deseados = new Set(carreras.flatMap((c) => c.permisos.map((p) => `${c.carreraId}:${p}`)));
    for (const actual of actuales) {
      const activo = deseados.delete(`${actual.carreraId}:${actual.permiso}`);
      if (actual.activo !== activo) { actual.activo = activo; await repo.save(actual); }
    }
    for (const c of carreras) for (const permiso of c.permisos) {
      if (deseados.has(`${c.carreraId}:${permiso}`)) {
        await repo.save(repo.create({ usuarioId, carreraId: c.carreraId, permiso, activo: true }));
        deseados.delete(`${c.carreraId}:${permiso}`);
      }
    }
  }

  private async sincronizarLegacy(manager: EntityManager, usuarioId: number) {
    const usuario = await manager.getRepository(Usuario).findOne({ where: { id: usuarioId }, relations: { usuarioRoles: { rol: true } } }) as Usuario;
    const roles = (usuario.usuarioRoles ?? []).filter((ur) => ur.rol?.activo).map((ur) => ur.rol.nombre as RolSistema);
    const base = new Set(roles.flatMap((r) => PERMISOS_PREDETERMINADOS_POR_ROL[r] ?? []));
    const particulares = await manager.getRepository(PermisoCarrera).find({ where: { usuarioId, activo: true } }) as PermisoCarrera[];
    const deseados = new Set<PermisoSistema>(particulares.map((p) => p.permiso));
    if (roles.includes(RolSistema.PROFESOR)) {
      for (const p of PERMISOS_PREDETERMINADOS_POR_ROL[RolSistema.PROFESOR]) deseados.add(p);
    }
    const excepciones = manager.getRepository(UsuarioPermisoExcepcion) as Repository<UsuarioPermisoExcepcion>;
    await excepciones.delete({ usuarioId });
    const nuevas = [
      ...[...base].filter((p) => !deseados.has(p)).map((permiso) => excepciones.create({ usuarioId, permiso, tipo: 'DENEGAR' as const, motivo: 'Alcance por carrera', asignadoPorUsuarioId: null })),
      ...[...deseados].filter((p) => !base.has(p)).map((permiso) => excepciones.create({ usuarioId, permiso, tipo: 'CONCEDER' as const, motivo: 'Alcance por carrera', asignadoPorUsuarioId: null })),
    ];
    if (nuevas.length) await excepciones.save(nuevas);
    const legacy = manager.getRepository(UsuarioPermiso) as Repository<UsuarioPermiso>;
    await legacy.delete({ usuarioId });
    if (deseados.size) await legacy.save([...deseados].map((permiso) => legacy.create({ usuarioId, permiso, activo: true })));
  }
}
