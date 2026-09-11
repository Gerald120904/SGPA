import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosService } from './usuarios.service';
import { Usuario } from './entities/usuario.entity';
import { UsuarioRol } from './entities/usuario-rol.entity';
import { UsuarioPermiso } from '../permisos/entities/usuario-permiso.entity';
import { UsuariosController } from './usuarios.controller';
import { SecurityModule } from '../auth/security.module';
import { Rol } from '../roles/entities/rol.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, UsuarioRol, UsuarioPermiso, Rol]),
    SecurityModule,
  ],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
