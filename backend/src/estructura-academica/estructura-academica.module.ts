import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../auth/security.module';
import { Carrera } from '../carreras/entities/carrera.entity';
import { ProfesorCarrera } from '../profesores/entities/profesor-carrera.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AreaAcademica } from './entities/area-academica.entity';
import { AreaCarrera } from './entities/area-carrera.entity';
import { AsignacionAcademica } from './entities/asignacion-academica.entity';
import { EstructuraAcademicaController } from './estructura-academica.controller';
import { EstructuraAcademicaService } from './estructura-academica.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AreaAcademica,
      AreaCarrera,
      AsignacionAcademica,
      Carrera,
      Usuario,
      ProfesorCarrera,
    ]),
    SecurityModule,
  ],
  controllers: [EstructuraAcademicaController],
  providers: [EstructuraAcademicaService],
  exports: [EstructuraAcademicaService],
})
export class EstructuraAcademicaModule {}
