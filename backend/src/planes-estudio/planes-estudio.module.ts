import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../auth/security.module';
import { Carrera } from '../carreras/entities/carrera.entity';
import { Curso } from '../cursos/entities/curso.entity';
import { BloquesPlanController } from './bloques-plan.controller';
import { BloquesPlanService } from './bloques-plan.service';
import { BloquePlan } from './entities/bloque-plan.entity';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { PlanRequisito } from './entities/plan-requisito.entity';
import { SalidaAcademica } from './entities/salida-academica.entity';
import { PlanAsignaturasController } from './plan-asignaturas.controller';
import { PlanAsignaturasService } from './plan-asignaturas.service';
import { PlanRequisitosController } from './plan-requisitos.controller';
import { PlanRequisitosService } from './plan-requisitos.service';
import { PlanesEstudioController } from './planes-estudio.controller';
import { PlanesEstudioService } from './planes-estudio.service';
import { PlanResumenController } from './plan-resumen.controller';
import { PlanResumenService } from './plan-resumen.service';
import { PlanImportacionController } from './plan-importacion.controller';
import { PlanImportacionService } from './plan-importacion.service';
import { PlanValidacionesController } from './plan-validaciones.controller';
import { PlanValidacionesService } from './plan-validaciones.service';
import { SalidasAcademicasController } from './salidas-academicas.controller';
import { SalidasAcademicasService } from './salidas-academicas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlanEstudio,
      PlanAsignatura,
      PlanRequisito,
      SalidaAcademica,
      BloquePlan,
      Carrera,
      Curso,
    ]),
    SecurityModule,
  ],
  controllers: [
    PlanesEstudioController,
    PlanAsignaturasController,
    PlanRequisitosController,
    BloquesPlanController,
    SalidasAcademicasController,
    PlanResumenController,
    PlanValidacionesController,
    PlanImportacionController,
  ],
  providers: [
    PlanesEstudioService,
    PlanAsignaturasService,
    PlanRequisitosService,
    BloquesPlanService,
    SalidasAcademicasService,
    PlanResumenService,
    PlanValidacionesService,
    PlanImportacionService,
  ],
  exports: [
    PlanesEstudioService,
    PlanAsignaturasService,
    PlanRequisitosService,
    BloquesPlanService,
    SalidasAcademicasService,
    PlanResumenService,
    PlanValidacionesService,
    PlanImportacionService,
  ],
})
export class PlanesEstudioModule {}
