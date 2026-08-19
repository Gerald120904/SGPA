import { Module } from '@nestjs/common';
import { OfertaAcademicaController } from './oferta-academica.controller';
import { OfertaAcademicaService } from './oferta-academica.service';

@Module({
  controllers: [OfertaAcademicaController],
  providers: [OfertaAcademicaService]
})
export class OfertaAcademicaModule {}
