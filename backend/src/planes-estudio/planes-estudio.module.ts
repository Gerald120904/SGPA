import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../auth/security.module';
import { Carrera } from '../carreras/entities/carrera.entity';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { PlanRequisito } from './entities/plan-requisito.entity';
import { ReglaOptativaPlan } from './entities/regla-optativa-plan.entity';
import { SalidaAcademica } from './entities/salida-academica.entity';
import { PlanAsignaturasController } from './plan-asignaturas.controller';
import { PlanAsignaturasService } from './plan-asignaturas.service';
import { PlanImportacionController } from './plan-importacion.controller';
import { PlanImportacionService } from './plan-importacion.service';
import { PlanReglasOptativasController } from './plan-reglas-optativas.controller';
import { PlanReglasOptativasService } from './plan-reglas-optativas.service';
import { PlanRequisitosController } from './plan-requisitos.controller';
import { PlanRequisitosService } from './plan-requisitos.service';
import { PlanResumenController } from './plan-resumen.controller';
import { PlanResumenService } from './plan-resumen.service';
import { PlanValidacionesController } from './plan-validaciones.controller';
import { PlanValidacionesService } from './plan-validaciones.service';
import { PlanesEstudioController } from './planes-estudio.controller';
import { PlanesEstudioService } from './planes-estudio.service';
import { SalidasAcademicasController } from './salidas-academicas.controller';
import { SalidasAcademicasService } from './salidas-academicas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlanEstudio,
      PlanAsignatura,
      PlanRequisito,
      SalidaAcademica,
      ReglaOptativaPlan,
      Carrera,
    ]),
    SecurityModule,
  ],
  controllers: [
    PlanesEstudioController,
    PlanAsignaturasController,
    PlanRequisitosController,
    SalidasAcademicasController,
    PlanResumenController,
    PlanValidacionesController,
    PlanImportacionController,
    PlanReglasOptativasController,
  ],
  providers: [
    PlanesEstudioService,
    PlanAsignaturasService,
    PlanRequisitosService,
    SalidasAcademicasService,
    PlanResumenService,
    PlanValidacionesService,
    PlanImportacionService,
    PlanReglasOptativasService,
  ],
  exports: [
    PlanesEstudioService,
    PlanAsignaturasService,
    PlanRequisitosService,
    SalidasAcademicasService,
    PlanResumenService,
    PlanValidacionesService,
    PlanImportacionService,
    PlanReglasOptativasService,
  ],
})
export class PlanesEstudioModule {}
