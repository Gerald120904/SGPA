import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../auth/security.module';
import { Carrera } from '../carreras/entities/carrera.entity';
import { Curso } from '../cursos/entities/curso.entity';
import { EstructuraAcademicaModule } from '../estructura-academica/estructura-academica.module';
import { PermisosModule } from '../permisos/permisos.module';
import { CursoPerfilAcademico } from './entities/curso-perfil-academico.entity';
import { PerfilAcademico } from './entities/perfil-academico.entity';
import { ProfesorPerfilAcademico } from './entities/profesor-perfil-academico.entity';
import { PerfilesAcademicosController } from './perfiles-academicos.controller';
import { PerfilesAcademicosService } from './perfiles-academicos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PerfilAcademico,
      CursoPerfilAcademico,
      ProfesorPerfilAcademico,
      Carrera,
      Curso,
    ]),
    SecurityModule,
    PermisosModule,
    EstructuraAcademicaModule,
  ],
  controllers: [PerfilesAcademicosController],
  providers: [PerfilesAcademicosService],
  exports: [PerfilesAcademicosService],
})
export class PerfilesAcademicosModule {}
