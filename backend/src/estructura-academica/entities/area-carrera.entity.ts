import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Carrera } from '../../carreras/entities/carrera.entity';
import { AreaAcademica } from './area-academica.entity';

@Entity({
  name: 'area_carreras',
})
@Index('UQ_area_carrera', ['areaAcademicaId', 'carreraId'], { unique: true })
export class AreaCarrera {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'area_academica_id',
    type: 'int',
    unsigned: true,
  })
  areaAcademicaId!: number;

  @Column({
    name: 'carrera_id',
    type: 'int',
    unsigned: true,
  })
  carreraId!: number;

  @ManyToOne(() => AreaAcademica, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'area_academica_id',
  })
  areaAcademica!: AreaAcademica;

  @ManyToOne(() => Carrera, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'carrera_id',
  })
  carrera!: Carrera;
}
