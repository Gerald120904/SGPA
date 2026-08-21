import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosService } from './usuarios.service';
import { Usuario } from './entities/usuario.entity';
import { UsuarioRol } from './entities/usuario-rol.entity';
import { UsuariosController } from './usuarios.controller';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Usuario,
      UsuarioRol,
    ]),
    SecurityModule,
  ],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
