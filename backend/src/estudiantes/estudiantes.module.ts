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
import { ConfiguracionFormularioEstudiantes } from './google-forms/entities/configuracion-formulario-estudiantes.entity';
import { ImportacionGoogleEstudiante } from './google-forms/entities/importacion-google-estudiante.entity';
import { GoogleFormsController } from './google-forms/google-forms.controller';
import { GoogleFormsSyncService } from './google-forms/google-forms-sync.service';
import { GoogleFormsService } from './google-forms/google-forms.service';

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
      ConfiguracionFormularioEstudiantes,
      ImportacionGoogleEstudiante,
    ]),
    SecurityModule,
    PermisosModule,
    EstructuraAcademicaModule,
  ],
  controllers: [
    EstudiantesController,
    EstudiantesImportacionController,
    GoogleFormsController,
  ],
  providers: [
    EstudiantesService,
    EstudiantesImportacionService,
    GoogleFormsService,
    GoogleFormsSyncService,
  ],
  exports: [
    EstudiantesService,
    EstudiantesImportacionService,
    GoogleFormsService,
    GoogleFormsSyncService,
  ],
})
export class EstudiantesModule {}
