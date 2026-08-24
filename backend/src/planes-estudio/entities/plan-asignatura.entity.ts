import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';
import { Curso } from '../../cursos/entities/curso.entity';
import { TipoPlanAsignatura } from '../constants/tipo-plan-asignatura.constant';
import { BloquePlan } from './bloque-plan.entity';
import { PlanEstudio } from './plan-estudio.entity';

const decimalNumberTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity({ name: 'plan_asignaturas' })
@Index('IDX_plan_asignaturas_orden', [
  'planEstudioId',
  'nivel',
  'ciclo',
  'orden',
])
export class PlanAsignatura {
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
    name: 'curso_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  cursoId!: number | null;

  @Column({
    name: 'bloque_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  bloqueId!: number | null;

  @Column({
    type: 'smallint',
    unsigned: true,
  })
  nivel!: number;

  @Column({
    type: 'smallint',
    unsigned: true,
  })
  ciclo!: number;

  @Column({
    type: 'smallint',
    unsigned: true,
  })
  orden!: number;

  @Column({
    type: 'smallint',
    unsigned: true,
    default: 0,
  })
  creditos!: number;

  @Column({
    name: 'horas_teoria',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalNumberTransformer,
  })
  horasTeoria!: number | null;

  @Column({
    name: 'horas_practica',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalNumberTransformer,
  })
  horasPractica!: number | null;

  @Column({
    name: 'horas_laboratorio',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalNumberTransformer,
  })
  horasLaboratorio!: number | null;

  @Column({
    name: 'horas_gira',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalNumberTransformer,
  })
  horasGira!: number | null;

  @Column({
    name: 'horas_estudio_independiente',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalNumberTransformer,
  })
  horasEstudioIndependiente!: number | null;

  @Column({
    name: 'horas_totales',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalNumberTransformer,
  })
  horasTotales!: number | null;

  @Column({
    name: 'horas_docente',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalNumberTransformer,
  })
  horasDocente!: number | null;

  @Column({
    name: 'observacion_horas',
    type: 'varchar',
    length: 250,
    nullable: true,
  })
  observacionHoras!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
  })
  tipo!: TipoPlanAsignatura;

  @Column({
    name: 'codigo_referencia',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  codigoReferencia!: string | null;

  @Column({
    name: 'nombre_referencia',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  nombreReferencia!: string | null;

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

  @ManyToOne(() => BloquePlan, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'bloque_id' })
  bloque!: BloquePlan | null;

  @ManyToOne(() => Curso, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'curso_id' })
  curso!: Curso | null;

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
