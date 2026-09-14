import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../auth/security.module';
import { PermisosModule } from '../permisos/permisos.module';
import { CarrerasController } from './carreras.controller';
import { CarrerasService } from './carreras.service';
import { Carrera } from './entities/carrera.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Carrera]),
    SecurityModule,
    PermisosModule,
  ],
  controllers: [CarrerasController],
  providers: [CarrerasService],
  exports: [CarrerasService],
})
export class CarrerasModule {}
