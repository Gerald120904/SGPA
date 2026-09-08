import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../auth/security.module';
import { Carrera } from '../carreras/entities/carrera.entity';
import { Curso } from '../cursos/entities/curso.entity';
import { CursoOptativo } from './entities/curso-optativo.entity';
import { OptativasController } from './optativas.controller';
import { OptativasService } from './optativas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CursoOptativo, Curso, Carrera]),
    SecurityModule,
  ],
  controllers: [OptativasController],
  providers: [OptativasService],
  exports: [OptativasService],
})
export class OptativasModule {}
