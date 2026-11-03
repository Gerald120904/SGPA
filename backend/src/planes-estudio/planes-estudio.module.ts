import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../auth/security.module';
import { PermisosModule } from '../permisos/permisos.module';
import { Carrera } from '../carreras/entities/carrera.entity';
import { Estudiante } from '../estudiantes/entities/estudiante.entity';
import { HistorialAcademicoEstudiante } from '../estudiantes/entities/historial-academico-estudiante.entity';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { PlanRequisito } from './entities/plan-requisito.entity';
import { ReglaOptativaPlan } from './entities/regla-optativa-plan.entity';
import { SalidaAcademica } from './entities/salida-academica.entity';
import { EquivalenciaPlan } from './entities/equivalencia-plan.entity';
import { AuditoriaPlanEstudio } from './entities/auditoria-plan-estudio.entity';
import { HistorialNombreAsignatura } from './entities/historial-nombre-asignatura.entity';
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
import { EquivalenciasController } from './equivalencias.controller';
import { EquivalenciasService } from './equivalencias.service';
import { TransicionesCurricularesController } from './transiciones-curriculares.controller';
import { TransicionesCurricularesService } from './transiciones-curriculares.service';
import { PlanesAlcanceGuard } from './guards/planes-alcance.guard';
import { MotorRequisitosService } from './motor-requisitos/motor-requisitos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlanEstudio,
      PlanAsignatura,
      PlanRequisito,
      SalidaAcademica,
      ReglaOptativaPlan,
      EquivalenciaPlan,
      AuditoriaPlanEstudio,
      HistorialNombreAsignatura,
      Carrera,
      Estudiante,
      HistorialAcademicoEstudiante,
    ]),
    SecurityModule,
    PermisosModule,
  ],
  controllers: [
    EquivalenciasController,
    PlanesEstudioController,
    PlanAsignaturasController,
    PlanRequisitosController,
    SalidasAcademicasController,
    PlanResumenController,
    PlanValidacionesController,
    PlanImportacionController,
    PlanReglasOptativasController,
    TransicionesCurricularesController,
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
    EquivalenciasService,
    TransicionesCurricularesService,
    PlanesAlcanceGuard,
    MotorRequisitosService,
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
    EquivalenciasService,
    TransicionesCurricularesService,
    MotorRequisitosService,
  ],
})
export class PlanesEstudioModule {}
