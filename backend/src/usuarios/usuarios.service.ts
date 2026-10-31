import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DataSource, EntityManager, In, MoreThan, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { RolSistema } from '../auth/constants/roles.constants';
import { Rol } from '../roles/entities/rol.entity';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { UsuarioRol } from './entities/usuario-rol.entity';
import { Usuario } from './entities/usuario.entity';
import { UsuarioPermiso } from '../permisos/entities/usuario-permiso.entity';
import { UsuarioPermisoExcepcion } from '../permisos/entities/usuario-permiso-excepcion.entity';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import {
  obtenerPermisosPredeterminadosPorRoles,
  PERMISOS_PREDETERMINADOS_POR_ROL,
} from '../permisos/constants/plantillas-permisos.constant';
import { PermisosService } from '../permisos/permisos.service';
import { ProfesorCarrera } from '../profesores/entities/profesor-carrera.entity';
import { Carrera } from '../carreras/entities/carrera.entity';
import { InvitacionOutboxService } from './invitacion-outbox.service';
import { DependenciaUsuario } from './entities/dependencia-usuario.entity';
import { AuditoriaJerarquia } from './entities/auditoria-jerarquia.entity';
import { SolicitudCambio } from './entities/solicitud-cambio.entity';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(UsuarioRol)
    private readonly usuarioRolRepository: Repository<UsuarioRol>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    @InjectRepository(ProfesorCarrera)
    private readonly profesorCarreraRepository: Repository<ProfesorCarrera>,
    @InjectRepository(Carrera)
    private readonly carreraRepository: Repository<Carrera>,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly permisosService?: PermisosService,
    @Optional()
    private readonly mailService?: MailService,
    @Optional()
    private readonly invitaciones?: InvitacionOutboxService,
  ) {}

  private normalizarCampoRequerido(valor: string, etiqueta: string): string {
    const normalizado = valor.trim();

    if (!normalizado) {
      throw new BadRequestException(
        `El campo ${etiqueta} no puede estar vacío.`,
      );
    }

    return normalizado;
  }

  private serializarUsuario(usuario: Usuario) {
    const roles = (usuario.usuarioRoles ?? [])
      .filter((relacion) => relacion.rol?.activo)
      .map((relacion) => ({
        id: relacion.rol.id,
        nombre: relacion.rol.nombre,
        descripcion: relacion.rol.descripcion,
      }))
      .sort((a, b) => a.id - b.id);

    const carreras = (usuario.profesorCarreras ?? [])
      .filter((relacion) => relacion.carrera?.activo !== false)
      .map((relacion) => ({
        id: relacion.carrera?.id ?? relacion.carreraId,
        codigo: relacion.carrera?.codigo,
        nombre: relacion.carrera?.nombre,
      }))
      .sort((a, b) => a.id - b.id);

    return {
      id: usuario.id,
      cedula: usuario.cedula,
      nombres: usuario.nombres,
      apellido1: usuario.apellido1,
      apellido2: usuario.apellido2,
      correo: usuario.correo,
      activo: usuario.activo,
      ultimoAcceso: usuario.ultimoAcceso,
      roles,
      carreras,
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
    };
  }

  private usuarioTieneRol(usuario: Usuario, rol: RolSistema): boolean {
    return (usuario.usuarioRoles ?? []).some(
      (relacion) =>
        relacion.rol?.activo === true && relacion.rol.nombre === rol,
    );
  }

  private async obtenerEntidadPorId(id: number): Promise<Usuario> {
    const usuario = await this.buscarPorId(id);

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return usuario;
  }

  private async validarDuplicados(
    cedula?: string,
    correo?: string,
    excluirId?: number,
  ): Promise<void> {
    if (cedula) {
      const existente = await this.usuarioRepository.findOne({
        where: { cedula },
      });

      if (existente && existente.id !== excluirId) {
        throw new ConflictException('La cédula ya está registrada.');
      }
    }

    if (correo) {
      const existente = await this.usuarioRepository.findOne({
        where: { correo },
      });

      if (existente && existente.id !== excluirId) {
        throw new ConflictException('El correo ya está registrado.');
      }
    }
  }

  private relanzarErrorPersistencia(error: unknown): never {
    const codigo =
      (
        error as {
          code?: string;
          driverError?: {
            code?: string;
          };
        }
      )?.driverError?.code ?? (error as { code?: string })?.code;

    if (codigo === 'ER_DUP_ENTRY') {
      throw new ConflictException(
        'La cédula, el correo o la relación de rol ya está registrada.',
      );
    }

    throw error;
  }

  async listar() {
    const usuarios = await this.usuarioRepository.find({
      relations: {
        usuarioRoles: {
          rol: true,
        },
        profesorCarreras: {
          carrera: true,
        },
      },
      order: {
        nombres: 'ASC',
        apellido1: 'ASC',
      },
    });

    return usuarios.map((usuario) => this.serializarUsuario(usuario));
  }

  async obtenerPorId(id: number) {
    const usuario = await this.obtenerEntidadPorId(id);
    return this.serializarUsuario(usuario);
  }

  private origenInvitacion(): URL {
    if (!this.mailService || !this.invitaciones) {
      throw new BadRequestException('El servicio de invitaciones no está disponible.');
    }
    const esProduccion = process.env.NODE_ENV === 'production';
    const base = process.env.SGPA_INVITATION_BASE_URL ||
      (esProduccion ? '' : `http://127.0.0.1:${process.env.PORT || 3000}`);
    try {
      const origen = new URL(base);
      const hostname = origen.hostname.toLowerCase().replace(/\.$/, '');
      const esLocal = hostname === 'localhost' || hostname === '[::1]' ||
        hostname.endsWith('.localhost') || /^127\./.test(hostname);
      if (origen.username || origen.password || origen.search || origen.hash ||
        (esProduccion && esLocal) ||
        (origen.protocol !== 'https:' &&
          (esProduccion || origen.protocol !== 'http:' || !esLocal))) {
        throw new Error('Origen inseguro');
      }
      return new URL('/auth/invitacion', origen);
    } catch {
      throw new BadRequestException('Configure una URL pública HTTPS para las invitaciones.');
    }
  }

  async crearConInvitacion(dto: CrearUsuarioDto, despuesDeCrear?: (manager: EntityManager, usuarioId: number) => Promise<void>,
    opciones: { respetarConfiguracionEnvio?: boolean; incluirEstadoInvitacion?: boolean } = {}) {
    const url = this.origenInvitacion();
    await this.invitaciones!.verificarDestino();
    const token = randomBytes(32).toString('hex');
    url.hash = new URLSearchParams({
      correo: dto.correo.trim().toLowerCase(),
      token,
    }).toString();
    return this.crear(
      { ...dto, password: randomBytes(32).toString('hex') },
      { tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        url: url.toString() },
      despuesDeCrear, opciones,
    );
  }

  async crear(
    dto: CrearUsuarioDto,
    invitacion?: { tokenHash: string; expiresAt: Date; url: string },
    despuesDeCrear?: (manager: EntityManager, usuarioId: number) => Promise<void>,
    opciones: { respetarConfiguracionEnvio?: boolean; incluirEstadoInvitacion?: boolean } = {},
  ) {
    if (!dto.password) {
      throw new BadRequestException('La contraseña es obligatoria.');
    }
    const password = dto.password;
    const cedula = this.normalizarCampoRequerido(dto.cedula, 'cédula');
    const nombres = this.normalizarCampoRequerido(dto.nombres, 'nombre');
    const apellido1 = this.normalizarCampoRequerido(
      dto.apellido1,
      'primer apellido',
    );
    const correo = dto.correo.trim().toLowerCase();

    await this.validarDuplicados(cedula, correo);

    if (dto.carreraIds?.length && !dto.roles.includes(RolSistema.PROFESOR)) {
      throw new BadRequestException(
        'Solo un usuario con rol PROFESOR puede tener carreras docentes asociadas.',
      );
    }

    const cuentaJerarquica = dto.roles.includes(RolSistema.COORDINADOR) ||
      dto.roles.includes(RolSistema.ASISTENTE_ESTUDIANTIL);
    const permisosFinales = dto.roles.includes(RolSistema.ADMIN_GLOBAL) || cuentaJerarquica
      ? []
      : (dto.permisos ?? obtenerPermisosPredeterminadosPorRoles(dto.roles));

    let carrerasValidadas: Carrera[] = [];
    if (dto.carreraIds && dto.carreraIds.length > 0) {
      carrerasValidadas = await this.carreraRepository.find({
        where: {
          id: In(dto.carreraIds),
          activo: true,
        },
      });

      if (carrerasValidadas.length !== new Set(dto.carreraIds).size) {
        throw new BadRequestException(
          'Una o más carreras no existen o están inactivas.',
        );
      }
    }

    let usuarioId: number;

    try {
      usuarioId = await this.dataSource.transaction(async (manager) => {
        const usuarios = manager.getRepository(Usuario);
        const relaciones = manager.getRepository(UsuarioRol);
        const rolesRepository = manager.getRepository(Rol);
        const permisosRepository = manager.getRepository(UsuarioPermiso);
        const profesorCarrerasRepository =
          manager.getRepository(ProfesorCarrera);

        const roles = await rolesRepository.find({
          where: {
            nombre: In(dto.roles),
            activo: true,
          },
        });

        if (roles.length !== new Set(dto.roles).size) {
          throw new BadRequestException(
            'Uno o más roles no existen o están inactivos.',
          );
        }

        const usuario = usuarios.create({
          cedula,
          nombres,
          apellido1,
          apellido2: dto.apellido2?.trim() || null,
          correo,
          passwordHash: await bcrypt.hash(password, 10),
          activo: !invitacion,
          ultimoAcceso: null,
          passwordResetTokenHash: invitacion?.tokenHash ?? null,
          passwordResetExpiresAt: invitacion?.expiresAt ?? null,
        });

        const guardado = await usuarios.save(usuario);

        await relaciones.save(
          roles.map((rol) =>
            relaciones.create({
              usuarioId: guardado.id,
              rolId: rol.id,
            }),
          ),
        );

        if (this.permisosService?.esPoliticaOpcionBActiva()) {
          if (cuentaJerarquica || (dto.permisos && !dto.roles.includes(RolSistema.ADMIN_GLOBAL))) {
            const basePlantilla = new Set<PermisoSistema>();
            for (const r of roles) {
              for (
                const p of PERMISOS_PREDETERMINADOS_POR_ROL[
                  r.nombre as RolSistema
                ] || []
              ) {
                basePlantilla.add(p);
              }
            }
            const deseados = new Set(permisosFinales);
            const excepcionesPorCrear: UsuarioPermisoExcepcion[] = [];
            let repoExc: Repository<UsuarioPermisoExcepcion> | null = null;
            try {
              repoExc = manager.getRepository(UsuarioPermisoExcepcion);
            } catch {
              repoExc = null;
            }

            if (repoExc) {
              for (const p of basePlantilla) {
                if (!deseados.has(p)) {
                  excepcionesPorCrear.push(
                    repoExc.create({
                      usuarioId: guardado.id,
                      permiso: p,
                      tipo: 'DENEGAR',
                      motivo: 'Exclusión inicial al crear usuario',
                      asignadoPorUsuarioId: null,
                    }),
                  );
                }
              }
              for (const p of deseados) {
                if (!basePlantilla.has(p)) {
                  excepcionesPorCrear.push(
                    repoExc.create({
                      usuarioId: guardado.id,
                      permiso: p,
                      tipo: 'CONCEDER',
                      motivo: 'Concesión inicial al crear usuario',
                      asignadoPorUsuarioId: null,
                    }),
                  );
                }
              }
              if (excepcionesPorCrear.length > 0) {
                await repoExc.save(excepcionesPorCrear);
              }
            }
          }
          await this.permisosService?.sincronizarDobleEscritura(
            manager,
            guardado.id,
            new Set(permisosFinales),
          );
        } else {
          if (permisosFinales.length > 0) {
            await permisosRepository.save(
              permisosFinales.map((permiso) =>
                permisosRepository.create({
                  usuarioId: guardado.id,
                  permiso,
                  activo: true,
                }),
              ),
            );
          }
        }

        if (carrerasValidadas.length > 0) {
          await profesorCarrerasRepository.save(
            carrerasValidadas.map((carrera) =>
              profesorCarrerasRepository.create({
                profesorUsuarioId: guardado.id,
                carreraId: carrera.id,
              }),
            ),
          );
        }

        await despuesDeCrear?.(manager, guardado.id);
        if (invitacion) await this.invitaciones!.crearPendiente(
          manager, guardado.id, invitacion.tokenHash,
          invitacion.url, invitacion.expiresAt,
        );
        return guardado.id;
      });
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }

    let estadoInvitacion: 'PENDIENTE' | 'ENVIADA' = 'PENDIENTE';
    const envioHabilitado = !opciones.respetarConfiguracionEnvio ||
      process.env.SGPA_INVITATION_OUTBOX_ENABLED === 'true';
    if (invitacion && envioHabilitado) {
      const enviado = await this.invitaciones!.procesarUsuario(usuarioId);
      if (enviado !== 'ENVIADA') {
        throw new ServiceUnavailableException(
          'Usuario inactivo registrado; la invitación requiere recuperación administrativa.',
        );
      }
      estadoInvitacion = 'ENVIADA';
    }
    const usuario = await this.obtenerPorId(usuarioId);
    return opciones.incluirEstadoInvitacion
      ? { ...usuario, invitacion: { estado: estadoInvitacion } }
      : usuario;
  }

  async reintentarInvitacion(id: number) {
    const origen = this.origenInvitacion();
    const estado = await this.invitaciones!.rotarYReintentar(id, origen);
    if (estado !== 'ENVIADA') {
      throw new ServiceUnavailableException(
        'La invitación requiere una nueva revisión administrativa.',
      );
    }
    return { estado };
  }

  async obtenerEstadoInvitacion(id: number) {
    await this.obtenerEntidadPorId(id);
    return this.invitaciones!.obtenerEstado(id);
  }

  async actualizar(id: number, dto: ActualizarUsuarioDto) {
    const usuarioActual = await this.obtenerEntidadPorId(id);

    const cedula =
      dto.cedula === undefined
        ? undefined
        : this.normalizarCampoRequerido(dto.cedula, 'cédula');
    const nombres =
      dto.nombres === undefined
        ? undefined
        : this.normalizarCampoRequerido(dto.nombres, 'nombre');
    const apellido1 =
      dto.apellido1 === undefined
        ? undefined
        : this.normalizarCampoRequerido(
            dto.apellido1,
            'primer apellido',
          );
    const correo = dto.correo?.trim().toLowerCase();

    await this.validarDuplicados(cedula, correo, id);

    const cambios: Partial<Usuario> = {};

    if (cedula !== undefined) cambios.cedula = cedula;
    if (nombres !== undefined) cambios.nombres = nombres;
    if (apellido1 !== undefined) cambios.apellido1 = apellido1;
    if (dto.apellido2 !== undefined) {
      cambios.apellido2 = dto.apellido2?.trim() || null;
    }
    if (correo !== undefined) cambios.correo = correo;

    if (Object.keys(cambios).length > 0) {
      try {
        await this.usuarioRepository.update(id, cambios);
      } catch (error) {
        this.relanzarErrorPersistencia(error);
      }
    }

    if (
      dto.carreraIds !== undefined &&
      dto.carreraIds.length > 0 &&
      !this.usuarioTieneRol(usuarioActual, RolSistema.PROFESOR)
    ) {
      throw new BadRequestException(
        'Solo un usuario con rol PROFESOR puede tener carreras docentes asociadas.',
      );
    }

    if (dto.carreraIds !== undefined) {
      let carrerasValidadas: Carrera[] = [];
      if (dto.carreraIds.length > 0) {
        carrerasValidadas = await this.carreraRepository.find({
          where: {
            id: In(dto.carreraIds),
            activo: true,
          },
        });

        if (carrerasValidadas.length !== new Set(dto.carreraIds).size) {
          throw new BadRequestException(
            'Una o más carreras no existen o están inactivas.',
          );
        }
      }

      await this.dataSource.transaction(async (manager) => {
        const profesorCarrerasRepository =
          manager.getRepository(ProfesorCarrera);
        await profesorCarrerasRepository.delete({ profesorUsuarioId: id });

        if (carrerasValidadas.length > 0) {
          await profesorCarrerasRepository.save(
            carrerasValidadas.map((carrera) =>
              profesorCarrerasRepository.create({
                profesorUsuarioId: id,
                carreraId: carrera.id,
              }),
            ),
          );
        }
      });
    }

    return this.obtenerPorId(id);
  }

  async cambiarEstado(id: number, activo: boolean, usuarioActualId: number) {
    const usuario = await this.obtenerEntidadPorId(id);

    if (activo && !usuario.activo && usuario.passwordResetTokenHash) {
      throw new BadRequestException(
        'La cuenta debe completar su invitación antes de activarse.',
      );
    }

    if (activo && !usuario.activo && this.usuarioTieneRol(usuario, RolSistema.ASISTENTE_ESTUDIANTIL)) {
      throw new BadRequestException('La reactivacion de asistentes requiere restablecer su dependencia jerarquica.');
    }

    if (id === usuarioActualId && !activo) {
      throw new BadRequestException('No puede desactivar su propia cuenta.');
    }

    if (!activo && this.usuarioTieneRol(usuario, RolSistema.ASISTENTE_ESTUDIANTIL)) {
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(Usuario).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        await manager.getRepository(Usuario).update(id, { activo: false });
        await manager.getRepository(DependenciaUsuario).update(
          { asistenteId: id, activo: true },
          { activo: false, desactivadoEn: new Date(), motivoDesactivacion: 'Desactivación operativa del asistente' },
        );
        await manager.getRepository(SolicitudCambio).update(
          { solicitanteId: id, estado: 'PENDIENTE' },
          { estado: 'INVALIDADA', resueltoEn: new Date(), resueltoPorUsuarioId: usuarioActualId },
        );
        await manager.getRepository(AuditoriaJerarquia).save({
          actorUsuarioId: usuarioActualId, objetivoUsuarioId: id,
          accion: 'DESACTIVAR_ASISTENTE', detalle: { asistenteId: id },
        });
      });
    } else if (!activo && this.usuarioTieneRol(usuario, RolSistema.COORDINADOR)) {
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(Usuario).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        const dependencias = manager.getRepository(DependenciaUsuario);
        const relacionadas = await dependencias.find({ where: { coordinadorId: id, activo: true } });
        const asistentes = relacionadas.map((rel) => rel.asistenteId);
        if (asistentes.length) {
          await manager.getRepository(Usuario).update({ id: In(asistentes) }, { activo: false });
          for (const relacion of relacionadas) {
            relacion.activo = false;
            relacion.desactivadoEn = new Date();
            relacion.motivoDesactivacion = 'Desactivación operativa del coordinador responsable';
          }
          await dependencias.save(relacionadas);
        }
        await manager.getRepository(SolicitudCambio).update(
          { coordinadorId: id, estado: 'PENDIENTE' },
          { estado: 'INVALIDADA', resueltoEn: new Date(), resueltoPorUsuarioId: usuarioActualId },
        );
        await manager.getRepository(Usuario).update(id, { activo: false });
        await manager.getRepository(AuditoriaJerarquia).save({
          actorUsuarioId: usuarioActualId,
          objetivoUsuarioId: id,
          accion: 'DESACTIVAR_COORDINADOR',
          detalle: { asistentesDesactivados: asistentes },
        });
      });
    } else {
      await this.usuarioRepository.update(id, { activo });
    }
    return this.obtenerPorId(id);
  }

  async asignarRol(id: number, nombreRol: RolSistema) {
    await this.obtenerEntidadPorId(id);

    const rol = await this.rolRepository.findOne({
      where: {
        nombre: nombreRol,
        activo: true,
      },
    });

    if (!rol) {
      throw new NotFoundException('Rol no encontrado o inactivo.');
    }

    const existente = await this.usuarioRolRepository.findOne({
      where: {
        usuarioId: id,
        rolId: rol.id,
      },
    });

    if (existente) {
      throw new ConflictException('El usuario ya posee este rol.');
    }

    try {
      if (this.permisosService?.esPoliticaOpcionBActiva()) {
        await this.dataSource.transaction(async (manager) => {
          const usuarioRolRepo = manager.getRepository(UsuarioRol);
          await usuarioRolRepo.save(
            usuarioRolRepo.create({
              usuarioId: id,
              rolId: rol.id,
            }),
          );

          await this.permisosService?.sincronizarPermisosUsuarioEnTransaccion(
            manager,
            id,
          );
        });
      } else {
        await this.usuarioRolRepository.save(
          this.usuarioRolRepository.create({
            usuarioId: id,
            rolId: rol.id,
          }),
        );
      }
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }

    return this.obtenerPorId(id);
  }

  async revocarRol(id: number, rolId: number, usuarioActualId: number) {
    await this.obtenerEntidadPorId(id);

    const relacion = await this.usuarioRolRepository.findOne({
      where: {
        usuarioId: id,
        rolId,
      },
      relations: {
        rol: true,
      },
    });

    if (!relacion) {
      throw new NotFoundException('El usuario no posee este rol.');
    }

    if (
      id === usuarioActualId &&
      relacion.rol.nombre === RolSistema.ADMIN_GLOBAL
    ) {
      throw new BadRequestException(
        'No puede revocar su propio rol de administrador global.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Usuario).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      const relaciones = manager.getRepository(UsuarioRol);
      const profesorCarreras = manager.getRepository(ProfesorCarrera);

      await relaciones.delete({
        usuarioId: id,
        rolId,
      });

      if (relacion.rol.nombre === RolSistema.PROFESOR) {
        await profesorCarreras.delete({
          profesorUsuarioId: id,
        });
      }

      if (relacion.rol.nombre === RolSistema.COORDINADOR) {
        const dependencias = manager.getRepository(DependenciaUsuario);
        const relacionadas = await dependencias.find({ where: { coordinadorId: id, activo: true } });
        const asistentes = relacionadas.map((rel) => rel.asistenteId);
        if (asistentes.length) {
          await manager.getRepository(Usuario).update({ id: In(asistentes) }, { activo: false });
          for (const rel of relacionadas) {
            rel.activo = false;
            rel.desactivadoEn = new Date();
            rel.motivoDesactivacion = 'Revocación del rol de coordinador responsable';
          }
          await dependencias.save(relacionadas);
        }
        await manager.getRepository(SolicitudCambio).update(
          { coordinadorId: id, estado: 'PENDIENTE' },
          { estado: 'INVALIDADA', resueltoEn: new Date(), resueltoPorUsuarioId: usuarioActualId },
        );
        await manager.getRepository(AuditoriaJerarquia).save({
          actorUsuarioId: usuarioActualId,
          objetivoUsuarioId: id,
          accion: 'REVOCAR_COORDINADOR',
          detalle: { asistentesDesactivados: asistentes },
        });
      }

      if (relacion.rol.nombre === RolSistema.ASISTENTE_ESTUDIANTIL) {
        await manager.getRepository(DependenciaUsuario).update(
          { asistenteId: id, activo: true },
          { activo: false, desactivadoEn: new Date(), motivoDesactivacion: 'Revocación del rol de asistente' },
        );
        await manager.getRepository(SolicitudCambio).update(
          { solicitanteId: id, estado: 'PENDIENTE' },
          { estado: 'INVALIDADA', resueltoEn: new Date(), resueltoPorUsuarioId: usuarioActualId },
        );
        await manager.getRepository(AuditoriaJerarquia).save({
          actorUsuarioId: usuarioActualId, objetivoUsuarioId: id,
          accion: 'REVOCAR_ASISTENTE', detalle: { asistenteId: id },
        });
      }

      if (this.permisosService?.esPoliticaOpcionBActiva()) {
        await this.permisosService?.sincronizarPermisosUsuarioEnTransaccion(
          manager,
          id,
        );
      }
    });

    return this.obtenerPorId(id);
  }

  async buscarPorCorreo(correo: string): Promise<Usuario | null> {
    return this.usuarioRepository.findOne({
      where: { correo },
      relations: {
        usuarioRoles: {
          rol: true,
        },
      },
    });
  }

  async buscarPorId(id: number): Promise<Usuario | null> {
    return this.usuarioRepository.findOne({
      where: { id },
      relations: {
        usuarioRoles: {
          rol: true,
        },
        profesorCarreras: {
          carrera: true,
        },
      },
    });
  }

  async actualizarUltimoAcceso(id: number): Promise<void> {
    await this.usuarioRepository.update(id, {
      ultimoAcceso: new Date(),
    });
  }

  async rotarVersionAutenticacion(id: number, versionEsperada: number): Promise<number> {
    if (!Number.isSafeInteger(versionEsperada) || versionEsperada < 0) {
      throw new BadRequestException('Versión de autenticación inválida.');
    }
    const resultado = await this.usuarioRepository.createQueryBuilder()
      .update(Usuario)
      .set({ versionAutenticacion: () => 'version_autenticacion + 1' })
      .where('id = :id AND version_autenticacion = :version AND activo = 1', {
        id, version: versionEsperada,
      })
      .execute();
    if (resultado.affected !== 1) {
      throw new ConflictException('La sesión cambió. Inicie sesión nuevamente.');
    }
    return versionEsperada + 1;
  }

  async guardarRecuperacionPassword(
    id: number,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.usuarioRepository.update(id, {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: expiresAt,
    });
  }

  async actualizarPassword(id: number, passwordHash: string): Promise<void> {
    await this.usuarioRepository.update(id, {
      passwordHash,
      versionAutenticacion: () => 'version_autenticacion + 1',
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    });
  }

  async aceptarInvitacion(correo: string, token: string, password: string) {
    const error = new BadRequestException('Invitación inválida o expirada.');
    if (!/^[a-f0-9]{64}$/.test(token)) throw error;
    const usuario = await this.buscarPorCorreo(correo.trim().toLowerCase());
    if (!usuario || usuario.activo || !usuario.passwordResetTokenHash ||
        !usuario.passwordResetExpiresAt ||
        usuario.passwordResetExpiresAt.getTime() <= Date.now()) {
      throw error;
    }
    const esperado = Buffer.from(usuario.passwordResetTokenHash, 'hex');
    const recibido = Buffer.from(createHash('sha256').update(token).digest('hex'), 'hex');
    if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) {
      throw error;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const resultado = await this.usuarioRepository.update(
      {
        id: usuario.id,
        activo: false,
        passwordResetTokenHash: usuario.passwordResetTokenHash,
        passwordResetExpiresAt: MoreThan(new Date()),
      },
      {
        passwordHash,
        activo: true,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    );
    if (resultado.affected !== 1) throw error;
    return { message: 'Contraseña establecida. Ya puede iniciar sesión.' };
  }

  async limpiarRecuperacionPassword(id: number): Promise<void> {
    await this.usuarioRepository.update(id, {
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    });
  }

}
