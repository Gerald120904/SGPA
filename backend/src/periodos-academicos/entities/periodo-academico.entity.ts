import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoPeriodoAcademico } from '../constants/estado-periodo-academico.constant';

@Entity({ name: 'periodos_academicos' })
@Index('UQ_periodos_academicos_anio_ciclo', ['anio', 'ciclo'], {
  unique: true,
})
export class PeriodoAcademico {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    type: 'varchar',
    length: 20,
    unique: true,
  })
  codigo!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  nombre!: string;

  @Column({
    type: 'smallint',
    unsigned: true,
  })
  anio!: number;

  @Column({
    type: 'tinyint',
    unsigned: true,
  })
  ciclo!: number;

  @Column({
    name: 'fecha_inicio',
    type: 'date',
  })
  fechaInicio!: string;

  @Column({
    name: 'fecha_fin',
    type: 'date',
  })
  fechaFin!: string;

  @Column({
    name: 'fecha_limite_disponibilidad',
    type: 'date',
  })
  fechaLimiteDisponibilidad!: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: EstadoPeriodoAcademico.BORRADOR,
  })
  estado!: EstadoPeriodoAcademico;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  observaciones!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
  })
  updatedAt!: Date;
}
