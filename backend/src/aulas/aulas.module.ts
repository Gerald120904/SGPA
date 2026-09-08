import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../auth/security.module';
import { AulasController } from './aulas.controller';
import { AulasService } from './aulas.service';
import { Aula } from './entities/aula.entity';
import { AulaEquipamiento } from './entities/aula-equipamiento.entity';
import { Equipamiento } from './entities/equipamiento.entity';
import { IndisponibilidadAula } from './entities/indisponibilidad-aula.entity';
import { PeriodosAcademicosModule } from '../periodos-academicos/periodos-academicos.module';
import { AuditoriaAula } from './entities/auditoria-aula.entity';
import { DisponibilidadAula } from './entities/disponibilidad-aula.entity';
import { ReservaAula } from './entities/reserva-aula.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Aula,
      Equipamiento,
      AulaEquipamiento,
      IndisponibilidadAula,
      ReservaAula,
      AuditoriaAula,
      DisponibilidadAula,
    ]),
    SecurityModule,
    PeriodosAcademicosModule,
  ],
  controllers: [AulasController],
  providers: [AulasService],
  exports: [AulasService],
})
export class AulasModule {}
