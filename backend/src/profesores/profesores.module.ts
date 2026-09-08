import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../auth/security.module';
import { PermisosModule } from '../permisos/permisos.module';
import { EstructuraAcademicaModule } from '../estructura-academica/estructura-academica.module';
import { Carrera } from '../carreras/entities/carrera.entity';
import { Curso } from '../cursos/entities/curso.entity';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { CursoPerfilAcademico } from '../perfiles-academicos/entities/curso-perfil-academico.entity';
import { PerfilAcademico } from '../perfiles-academicos/entities/perfil-academico.entity';
import { ProfesorPerfilAcademico } from '../perfiles-academicos/entities/profesor-perfil-academico.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { DisponibilidadProfesoresController } from './disponibilidad-profesores.controller';
import { DisponibilidadProfesoresService } from './disponibilidad-profesores.service';
import { AtestadoProfesor } from './entities/atestado-profesor.entity';
import { BloqueDisponibilidadProfesor } from './entities/bloque-disponibilidad-profesor.entity';
import { DisponibilidadProfesor } from './entities/disponibilidad-profesor.entity';
import { HistorialDisponibilidadProfesor } from './entities/historial-disponibilidad-profesor.entity';
import { HistorialPerfilProfesor } from './entities/historial-perfil-profesor.entity';
import { ProfesorCarrera } from './entities/profesor-carrera.entity';
import { ProfesorCurso } from './entities/profesor-curso.entity';
import { ProyectoProfesor } from './entities/proyecto-profesor.entity';
import { ProfesoresController } from './profesores.controller';
import { ProfesoresService } from './profesores.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Usuario,
      Carrera,
      Curso,
      PeriodoAcademico,
      ProfesorCarrera,
      ProfesorCurso,
      PerfilAcademico,
      CursoPerfilAcademico,
      ProfesorPerfilAcademico,
      AtestadoProfesor,
      ProyectoProfesor,
      DisponibilidadProfesor,
      BloqueDisponibilidadProfesor,
      HistorialDisponibilidadProfesor,
      HistorialPerfilProfesor,
    ]),
    SecurityModule,
    PermisosModule,
    EstructuraAcademicaModule,
  ],
  controllers: [ProfesoresController, DisponibilidadProfesoresController],
  providers: [ProfesoresService, DisponibilidadProfesoresService],
  exports: [ProfesoresService, DisponibilidadProfesoresService],
})
export class ProfesoresModule {}
