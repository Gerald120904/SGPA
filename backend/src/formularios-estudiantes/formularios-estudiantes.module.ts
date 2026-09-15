import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { RespuestaFormularioEstudiante } from './entities/respuesta-formulario-estudiante.entity';
import { FormulariosEstudiantesController } from './formularios-estudiantes.controller';
import { FormulariosEstudiantesService } from './formularios-estudiantes.service';
import { FormulariosEstudiantesSyncService } from './formularios-estudiantes-sync.service';
import { NormalizadorRespuestaFormularioService } from './normalizador-respuesta-formulario.service';
import { GoogleModule } from '../integraciones/google/google.module';
import { SecurityModule } from '../auth/security.module';
import { PermisosModule } from '../permisos/permisos.module';
import { EstudiantesModule } from '../estudiantes/estudiantes.module';
import { CarrerasModule } from '../carreras/carreras.module';
import { PlanesEstudioModule } from '../planes-estudio/planes-estudio.module';
import { PeriodosAcademicosModule } from '../periodos-academicos/periodos-academicos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FormularioEstudiante,
      RespuestaFormularioEstudiante,
    ]),
    GoogleModule,
    SecurityModule,
    PermisosModule,
    EstudiantesModule,
    CarrerasModule,
    PlanesEstudioModule,
    PeriodosAcademicosModule,
  ],
  controllers: [FormulariosEstudiantesController],
  providers: [
    FormulariosEstudiantesService,
    FormulariosEstudiantesSyncService,
    NormalizadorRespuestaFormularioService,
  ],
  exports: [
    FormulariosEstudiantesService,
    FormulariosEstudiantesSyncService,
  ],
})
export class FormulariosEstudiantesModule {}
