import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TipoIndisponibilidadAula } from '../constants/tipo-indisponibilidad-aula.constant';
import { Aula } from './aula.entity';

@Entity({ name: 'indisponibilidades_aulas' })
@Index('IDX_indisponibilidades_aulas_aula_inicio_fin', [
  'aulaId',
  'fechaHoraInicio',
  'fechaHoraFin',
])
@Check('chk_indisponibilidad_aula_fechas', 'fecha_hora_inicio < fecha_hora_fin')
export class IndisponibilidadAula {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'aula_id',
    type: 'int',
    unsigned: true,
  })
  aulaId!: number;

  @Column({
    type: 'varchar',
    length: 30,
  })
  tipo!: TipoIndisponibilidadAula;

  @Column({
    name: 'fecha_hora_inicio',
    type: 'datetime',
  })
  fechaHoraInicio!: Date;

  @Column({
    name: 'fecha_hora_fin',
    type: 'datetime',
  })
  fechaHoraFin!: Date;

  @Column({
    type: 'varchar',
    length: 500,
  })
  motivo!: string;

  @Column({
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @ManyToOne(() => Aula, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'aula_id',
  })
  aula!: Aula;

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
