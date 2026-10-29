import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndisponibilidadAula } from '../aulas/entities/indisponibilidad-aula.entity';
import { ReservaAula } from '../aulas/entities/reserva-aula.entity';
import { ConflictosAcademicosService } from './conflictos-academicos.service';
import { OfertaAcademicaController } from './oferta-academica.controller';
import { OfertaAcademicaService } from './oferta-academica.service';
import { Grupo } from './entities/grupo.entity';
import { HorarioGrupo } from './entities/horario-grupo.entity';
import { ProfesorLegado } from './entities/profesor-legado.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Grupo,
      HorarioGrupo,
      ProfesorLegado,
      ReservaAula,
      IndisponibilidadAula,
    ]),
  ],
  controllers: [OfertaAcademicaController],
  providers: [OfertaAcademicaService, ConflictosAcademicosService],
  exports: [OfertaAcademicaService, ConflictosAcademicosService],
})
export class OfertaAcademicaModule {}
