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
    ]),
    SecurityModule,
    PermisosModule,
    MailModule,
  ],
  controllers: [UsuariosController],
  providers: [UsuariosService, InvitacionOutboxService],
  exports: [UsuariosService],
})
export class UsuariosModule {}

