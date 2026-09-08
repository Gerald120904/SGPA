import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../auth/security.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { UsuarioPermiso } from './entities/usuario-permiso.entity';
import { PermisosGuard } from './guards/permisos.guard';
import { PermisosController } from './permisos.controller';
import { PermisosService } from './permisos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsuarioPermiso, Usuario]),
    SecurityModule,
  ],
  controllers: [PermisosController],
  providers: [PermisosService, PermisosGuard],
  exports: [PermisosService, PermisosGuard],
})
export class PermisosModule {}
