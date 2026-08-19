import { Module } from '@nestjs/common';
import { PeriodosAcademicosController } from './periodos-academicos.controller';
import { PeriodosAcademicosService } from './periodos-academicos.service';

@Module({
  controllers: [PeriodosAcademicosController],
  providers: [PeriodosAcademicosService]
})
export class PeriodosAcademicosModule {}
