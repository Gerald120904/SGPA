import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoRequisito } from '../constants/tipo-requisito.constant';
import { PlanAsignatura } from './plan-asignatura.entity';

@Entity({ name: 'plan_requisitos' })
@Index(
  'UQ_plan_requisito_relacion',
  ['asignaturaId', 'requisitoAsignaturaId', 'tipo'],
  { unique: true },
)
export class PlanRequisito {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'asignatura_id',
    type: 'int',
    unsigned: true,
  })
  asignaturaId!: number;

  @Column({
    name: 'requisito_asignatura_id',
    type: 'int',
    unsigned: true,
  })
  requisitoAsignaturaId!: number;

  @Column({
    type: 'varchar',
    length: 20,
  })
  tipo!: TipoRequisito;

  @ManyToOne(() => PlanAsignatura, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'asignatura_id' })
  asignatura!: PlanAsignatura;

  @ManyToOne(() => PlanAsignatura, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'requisito_asignatura_id' })
  requisitoAsignatura!: PlanAsignatura;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  createdAt!: Date;
}
