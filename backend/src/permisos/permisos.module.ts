import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../auth/security.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { UsuarioPermiso } from './entities/usuario-permiso.entity';
import { UsuarioPermisoExcepcion } from './entities/usuario-permiso-excepcion.entity';
import { PermisosGuard } from './guards/permisos.guard';
import { PermisosController } from './permisos.controller';
import { PermisosService } from './permisos.service';
import { Carrera } from '../carreras/entities/carrera.entity';
import { AsignacionAcademica } from '../estructura-academica/entities/asignacion-academica.entity';
import { DependenciaUsuario } from '../usuarios/entities/dependencia-usuario.entity';
import { PermisoCarrera } from './entities/permiso-carrera.entity';
import { AlcanceJerarquicoService } from './alcance-jerarquico.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UsuarioPermiso,
      UsuarioPermisoExcepcion,
      Usuario,
      Carrera,
      AsignacionAcademica,
      DependenciaUsuario,
      PermisoCarrera,
    ]),
    SecurityModule,
  ],
  controllers: [PermisosController],
  providers: [PermisosService, PermisosGuard, AlcanceJerarquicoService],
  exports: [PermisosService, PermisosGuard, AlcanceJerarquicoService],
})
export class PermisosModule {}
