import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TipoBloquePlan } from '../constants/tipo-bloque-plan.constant';
import { PlanEstudio } from './plan-estudio.entity';

@Entity({ name: 'bloques_plan' })
@Index('UQ_bloques_plan_codigo', ['planEstudioId', 'codigo'], {
  unique: true,
})
export class BloquePlan {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'plan_estudio_id',
    type: 'int',
    unsigned: true,
  })
  planEstudioId!: number;

  @Column({
    type: 'varchar',
    length: 30,
  })
  codigo!: string;

  @Column({
    type: 'varchar',
    length: 150,
  })
  nombre!: string;

  @Column({
    type: 'varchar',
    length: 30,
  })
  tipo!: TipoBloquePlan;

  @Column({
    type: 'smallint',
    unsigned: true,
    default: 1,
  })
  orden!: number;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  descripcion!: string | null;

  @Column({
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @ManyToOne(() => PlanEstudio, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_estudio_id' })
  planEstudio!: PlanEstudio;

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
