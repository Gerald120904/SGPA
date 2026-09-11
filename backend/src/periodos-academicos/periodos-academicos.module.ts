import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../auth/security.module';
import { PermisosModule } from '../permisos/permisos.module';
import { PeriodoAcademico } from './entities/periodo-academico.entity';
import { PeriodosAcademicosController } from './periodos-academicos.controller';
import { PeriodosAcademicosService } from './periodos-academicos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PeriodoAcademico]),
    SecurityModule,
    PermisosModule,
  ],
  controllers: [PeriodosAcademicosController],
  providers: [PeriodosAcademicosService],
  exports: [PeriodosAcademicosService],
})
export class PeriodosAcademicosModule {}
