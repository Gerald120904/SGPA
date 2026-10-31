import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosService } from './usuarios.service';
import { Usuario } from './entities/usuario.entity';
import { UsuarioRol } from './entities/usuario-rol.entity';
import { UsuarioPermiso } from '../permisos/entities/usuario-permiso.entity';
import { UsuariosController } from './usuarios.controller';
import { SecurityModule } from '../auth/security.module';
import { Rol } from '../roles/entities/rol.entity';
import { ProfesorCarrera } from '../profesores/entities/profesor-carrera.entity';
import { Carrera } from '../carreras/entities/carrera.entity';
import { PermisosModule } from '../permisos/permisos.module';
import { MailModule } from '../mail/mail.module';
import { InvitacionOutbox } from './entities/invitacion-outbox.entity';
import { InvitacionOutboxService } from './invitacion-outbox.service';
import { DependenciaUsuario } from './entities/dependencia-usuario.entity';
import { AuditoriaJerarquia } from './entities/auditoria-jerarquia.entity';
import { PermisoCarrera } from '../permisos/entities/permiso-carrera.entity';
import { AsignacionAcademica } from '../estructura-academica/entities/asignacion-academica.entity';
import { JerarquiaUsuariosService } from './jerarquia-usuarios.service';
import { JerarquiaUsuariosController } from './jerarquia-usuarios.controller';
import { SolicitudCambio } from './entities/solicitud-cambio.entity';
import { SolicitudesCambioService } from './solicitudes-cambio.service';
import { SolicitudesCambioController } from './solicitudes-cambio.controller';
import { EstudiantesModule } from '../estudiantes/estudiantes.module';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { CursosModule } from '../cursos/cursos.module';
import { PlanesEstudioModule } from '../planes-estudio/planes-estudio.module';
import { OptativasModule } from '../optativas/optativas.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Usuario,
      UsuarioRol,
      UsuarioPermiso,
      Rol,
      ProfesorCarrera,
      Carrera,
      InvitacionOutbox,
      DependenciaUsuario,
      AuditoriaJerarquia,
      PermisoCarrera,
      AsignacionAcademica,
      SolicitudCambio,
      PlanEstudio,
      PeriodoAcademico,
    ]),
    SecurityModule,
    PermisosModule,
    MailModule,
    EstudiantesModule,
    CursosModule,
    PlanesEstudioModule,
    OptativasModule,
    NotificacionesModule,
  ],
  controllers: [UsuariosController, JerarquiaUsuariosController, SolicitudesCambioController],
  providers: [UsuariosService, InvitacionOutboxService, JerarquiaUsuariosService, SolicitudesCambioService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
