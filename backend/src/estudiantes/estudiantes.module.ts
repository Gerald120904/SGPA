import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../auth/security.module';
import { Carrera } from '../carreras/entities/carrera.entity';
import { EstructuraAcademicaModule } from '../estructura-academica/estructura-academica.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { PermisosModule } from '../permisos/permisos.module';
import { EquivalenciaPlan } from '../planes-estudio/entities/equivalencia-plan.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { PlanRequisito } from '../planes-estudio/entities/plan-requisito.entity';
import { ReglaOptativaPlan } from '../planes-estudio/entities/regla-optativa-plan.entity';
import { SalidaAcademica } from '../planes-estudio/entities/salida-academica.entity';
import { BandejaRevisionEstudiantesController } from './bandeja-revision-estudiantes.controller';
import { BandejaRevisionEstudiantesService } from './bandeja-revision-estudiantes.service';
import { AuditoriaHistorialAcademico } from './entities/auditoria-historial-academico.entity';
import { Estudiante } from './entities/estudiante.entity';
import { HistorialAcademicoEstudiante } from './entities/historial-academico-estudiante.entity';
import { HistorialPlanEstudiante } from './entities/historial-plan-estudiante.entity';
import { LoteImportacionEstudiante } from './entities/lote-importacion-estudiante.entity';
import { RegistroImportacionEstudiante } from './entities/registro-importacion-estudiante.entity';
import { TituloEstudiante } from './entities/titulo-estudiante.entity';
import { EstudiantesController } from './estudiantes.controller';
import { EstudiantesImportacionController } from './estudiantes-importacion.controller';
import { EstudiantesImportacionService } from './estudiantes-importacion.service';
import { EstudiantesService } from './estudiantes.service';
import { EvaluacionGraduacionService } from './evaluacion-graduacion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Estudiante,
      HistorialAcademicoEstudiante,
      HistorialPlanEstudiante,
      AuditoriaHistorialAcademico,
      LoteImportacionEstudiante,
      RegistroImportacionEstudiante,
      TituloEstudiante,
      Carrera,
      PlanEstudio,
      PlanAsignatura,
      PlanRequisito,
      ReglaOptativaPlan,
      SalidaAcademica,
      EquivalenciaPlan,
      PeriodoAcademico,
    ]),
    SecurityModule,
    PermisosModule,
    EstructuraAcademicaModule,
    NotificacionesModule,
  ],
  controllers: [
    BandejaRevisionEstudiantesController,
    EstudiantesController,
    EstudiantesImportacionController,
  ],
  providers: [
    EstudiantesService,
    EstudiantesImportacionService,
    EvaluacionGraduacionService,
    BandejaRevisionEstudiantesService,
  ],
  exports: [
    EstudiantesService,
    EstudiantesImportacionService,
    EvaluacionGraduacionService,
    BandejaRevisionEstudiantesService,
  ],
})
export class EstudiantesModule {}
