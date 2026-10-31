import { MailModule } from '../mail/mail.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { CarrerasModule } from '../carreras/carreras.module';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { PeriodosAcademicosModule } from '../periodos-academicos/periodos-academicos.module';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { PlanesEstudioModule } from '../planes-estudio/planes-estudio.module';
import { SecurityModule } from '../auth/security.module';
import { PermisosModule } from '../permisos/permisos.module';
import { EstudiantesModule } from '../estudiantes/estudiantes.module';
import { EstructuraAcademicaModule } from '../estructura-academica/estructura-academica.module';
import { GoogleModule } from '../integraciones/google/google.module';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { RespuestaFormularioEstudiante } from './entities/respuesta-formulario-estudiante.entity';
import { FormulariosEstudiantesAutoSyncService } from './formularios-estudiantes-auto-sync.service';
import { FormulariosEstudiantesController } from './formularios-estudiantes.controller';
import { FormulariosEstudiantesProcesamientoService } from './formularios-estudiantes-procesamiento.service';
import { FormulariosEstudiantesService } from './formularios-estudiantes.service';
import { FormulariosEstudiantesSyncService } from './formularios-estudiantes-sync.service';
import { FormulariosInternosPersistenciaService } from './formularios-internos-persistencia.service';
import { FormulariosPublicosController } from './formularios-publicos.controller';
import { FormulariosPublicosWebController } from './formularios-publicos-web.controller';
import { FormulariosPublicosService } from './formularios-publicos.service';
import { RateLimitPublicoGuard } from './guards/rate-limit-publico.guard';
import { NormalizadorRespuestaFormularioService } from './normalizador-respuesta-formulario.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FormularioEstudiante,
      RespuestaFormularioEstudiante,
      Carrera,
      PlanEstudio,
      PlanAsignatura,
      PeriodoAcademico,
    ]),
    GoogleModule,
    SecurityModule,
    PermisosModule,
    EstudiantesModule,
    CarrerasModule,
    PlanesEstudioModule,
    PeriodosAcademicosModule,
    EstructuraAcademicaModule,
    MailModule,
  ],
  controllers: [
    FormulariosEstudiantesController,
    FormulariosPublicosController,
    FormulariosPublicosWebController,
  ],
  providers: [
    FormulariosEstudiantesService,
    FormulariosEstudiantesSyncService,
    FormulariosEstudiantesAutoSyncService,
    FormulariosEstudiantesProcesamientoService,
    FormulariosInternosPersistenciaService,
    FormulariosPublicosService,
    RateLimitPublicoGuard,
    NormalizadorRespuestaFormularioService,
  ],
  exports: [
    FormulariosEstudiantesService,
    FormulariosEstudiantesSyncService,
    FormulariosEstudiantesAutoSyncService,
    FormulariosEstudiantesProcesamientoService,
    FormulariosInternosPersistenciaService,
    FormulariosPublicosService,
  ],
})
export class FormulariosEstudiantesModule {}
