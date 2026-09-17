import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PeriodoAcademico } from '../../periodos-academicos/entities/periodo-academico.entity';
import { PlanEstudio } from '../../planes-estudio/entities/plan-estudio.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Estudiante } from './estudiante.entity';

@Entity({ name: 'historial_planes_estudiantes' })
@Index('IDX_historial_planes_estudiante', ['estudianteId'])
export class HistorialPlanEstudiante {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'estudiante_id', type: 'int', unsigned: true })
  estudianteId!: number;

  @Column({ name: 'plan_anterior_id', type: 'int', unsigned: true })
  planAnteriorId!: number;

  @Column({ name: 'plan_nuevo_id', type: 'int', unsigned: true })
  planNuevoId!: number;

  @Column({ name: 'periodo_cambio_id', type: 'int', unsigned: true })
  periodoCambioId!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  motivo!: string | null;

  @Column({ name: 'cambiado_por_usuario_id', type: 'int', unsigned: true })
  cambiadoPorUsuarioId!: number;

  @ManyToOne(() => Estudiante, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'estudiante_id' })
  estudiante!: Estudiante;

  @ManyToOne(() => PlanEstudio, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'plan_anterior_id' })
  planAnterior!: PlanEstudio;

  @ManyToOne(() => PlanEstudio, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'plan_nuevo_id' })
  planNuevo!: PlanEstudio;

  @ManyToOne(() => PeriodoAcademico, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'periodo_cambio_id' })
  periodoCambio!: PeriodoAcademico;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'cambiado_por_usuario_id' })
  cambiadoPor!: Usuario;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
