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
import { PeriodoAcademico } from '../../periodos-academicos/entities/periodo-academico.entity';
import { PlanEstudio } from '../../planes-estudio/entities/plan-estudio.entity';
import { EstadoEstudiante } from '../constants/estado-estudiante.constant';

@Entity({ name: 'estudiantes' })
@Index('UQ_estudiantes_carrera_cedula', ['carreraId', 'cedula'], { unique: true })
@Index('IDX_estudiantes_carrera', ['carreraId'])
@Index('IDX_estudiantes_plan', ['planEstudioId'])
export class Estudiante {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'varchar', length: 30 })
  cedula!: string;

  @Column({ type: 'varchar', length: 100 })
  nombres!: string;

  @Column({ type: 'varchar', length: 100 })
  apellido1!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  apellido2!: string | null;

  @Column({
    name: 'correo_institucional',
    type: 'varchar',
    length: 150,
  })
  correoInstitucional!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono!: string | null;

  @Column({ name: 'carrera_id', type: 'int', unsigned: true })
  carreraId!: number;

  @Column({ name: 'plan_estudio_id', type: 'int', unsigned: true })
  planEstudioId!: number;

  @Column({ name: 'periodo_ingreso_id', type: 'int', unsigned: true })
  periodoIngresoId!: number;

  @Column({ type: 'varchar', length: 20, default: EstadoEstudiante.ACTIVO })
  estado!: EstadoEstudiante;

  @Column({ name: 'fecha_graduacion', type: 'datetime', nullable: true })
  fechaGraduacion!: Date | null;

  @Column({ name: 'graduado_por_usuario_id', type: 'int', unsigned: true, nullable: true })
  graduadoPorUsuarioId!: number | null;

  @Column({ name: 'observacion_graduacion', type: 'varchar', length: 500, nullable: true })
  observacionGraduacion!: string | null;

  @ManyToOne(() => Carrera, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'carrera_id' })
  carrera!: Carrera;

  @ManyToOne(() => PlanEstudio, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'plan_estudio_id' })
  planEstudio!: PlanEstudio;

  @ManyToOne(() => PeriodoAcademico, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'periodo_ingreso_id' })
  periodoIngreso!: PeriodoAcademico;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
