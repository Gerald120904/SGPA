import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../auth/security.module';
import { CursoOptativo } from '../optativas/entities/curso-optativo.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { CursoRequisitosController } from './curso-requisitos.controller';
import { CursoRequisitosService } from './curso-requisitos.service';
import { CursosController } from './cursos.controller';
import { CursosService } from './cursos.service';
import { CursoRequisito } from './entities/curso-requisito.entity';
import { Curso } from './entities/curso.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Curso,
      CursoRequisito,
      CursoOptativo,
      PlanAsignatura,
    ]),
    SecurityModule,
  ],
  controllers: [CursosController, CursoRequisitosController],
  providers: [CursosService, CursoRequisitosService],
  exports: [CursosService, CursoRequisitosService],
})
export class CursosModule {}
