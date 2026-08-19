import { Module } from '@nestjs/common';
import { ProfesoresController } from './profesores.controller';
import { ProfesoresService } from './profesores.service';

@Module({
  controllers: [ProfesoresController],
  providers: [ProfesoresService]
})
export class ProfesoresModule {}
