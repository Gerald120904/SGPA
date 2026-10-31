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
import { Carrera } from '../../carreras/entities/carrera.entity';
import { PlanEstudio } from './plan-estudio.entity';
import { PlanAsignatura } from './plan-asignatura.entity';

@Entity({ name: 'equivalencias_plan' })
@Index('IDX_equivalencia_origen', ['planOrigenId', 'asignaturaOrigenId'])
@Index('IDX_equivalencia_destino', ['planDestinoId', 'asignaturaDestinoId'])
export class EquivalenciaPlan {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'carrera_origen_id', type: 'int', unsigned: true })
  carreraOrigenId!: number;

  @Column({ name: 'plan_origen_id', type: 'int', unsigned: true })
  planOrigenId!: number;

  @Column({ name: 'asignatura_origen_id', type: 'int', unsigned: true })
  asignaturaOrigenId!: number;

  @Column({ name: 'carrera_destino_id', type: 'int', unsigned: true })
  carreraDestinoId!: number;

  @Column({ name: 'plan_destino_id', type: 'int', unsigned: true })
  planDestinoId!: number;

  @Column({ name: 'asignatura_destino_id', type: 'int', unsigned: true })
  asignaturaDestinoId!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  justificacion!: string | null;

  @Column({ name: 'autorizado_por_usuario_id', type: 'int', unsigned: true, nullable: true })
  autorizadoPorUsuarioId!: number | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @ManyToOne(() => Carrera, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'carrera_origen_id' })
  carreraOrigen!: Carrera;

  @ManyToOne(() => PlanEstudio, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_origen_id' })
  planOrigen!: PlanEstudio;

  @ManyToOne(() => PlanAsignatura, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'asignatura_origen_id' })
  asignaturaOrigen!: PlanAsignatura;

  @ManyToOne(() => Carrera, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'carrera_destino_id' })
  carreraDestino!: Carrera;

  @ManyToOne(() => PlanEstudio, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_destino_id' })
  planDestino!: PlanEstudio;

  @ManyToOne(() => PlanAsignatura, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'asignatura_destino_id' })
  asignaturaDestino!: PlanAsignatura;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
