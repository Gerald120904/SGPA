import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../auth/security.module';
import { Carrera } from '../carreras/entities/carrera.entity';
import { EstructuraAcademicaModule } from '../estructura-academica/estructura-academica.module';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { PermisosModule } from '../permisos/permisos.module';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { PlanRequisito } from '../planes-estudio/entities/plan-requisito.entity';
import { Estudiante } from './entities/estudiante.entity';
import { HistorialAcademicoEstudiante } from './entities/historial-academico-estudiante.entity';
import { HistorialPlanEstudiante } from './entities/historial-plan-estudiante.entity';
import { EstudiantesController } from './estudiantes.controller';
import { EstudiantesImportacionController } from './estudiantes-importacion.controller';
import { EstudiantesImportacionService } from './estudiantes-importacion.service';
import { EstudiantesService } from './estudiantes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Estudiante,
      HistorialAcademicoEstudiante,
      HistorialPlanEstudiante,
      Carrera,
      PlanEstudio,
      PlanAsignatura,
      PlanRequisito,
      PeriodoAcademico,
    ]),
    SecurityModule,
    PermisosModule,
    EstructuraAcademicaModule,
  ],
  controllers: [
    EstudiantesController,
    EstudiantesImportacionController,
  ],
  providers: [
    EstudiantesService,
    EstudiantesImportacionService,
  ],
  exports: [
    EstudiantesService,
    EstudiantesImportacionService,
  ],
})
export class EstudiantesModule {}
