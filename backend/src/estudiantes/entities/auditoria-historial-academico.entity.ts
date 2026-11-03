import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { OrigenAcademico } from '../constants/origen-academico.constant';
import { ResultadoAcademico } from '../constants/resultado-academico.constant';
import { Estudiante } from './estudiante.entity';
import { PlanAsignatura } from '../../planes-estudio/entities/plan-asignatura.entity';

@Entity({ name: 'auditoria_historial_academico' })
@Index('IDX_auditoria_historial_estudiante', ['estudianteId'])
@Index('IDX_auditoria_historial_registro', ['historialAcademicoId'])
export class AuditoriaHistorialAcademico {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'estudiante_id', type: 'int', unsigned: true })
  estudianteId!: number;

  @Column({ name: 'historial_academico_id', type: 'int', unsigned: true })
  historialAcademicoId!: number;

  @Column({ name: 'carrera_id', type: 'int', unsigned: true })
  carreraId!: number;

  @Column({ name: 'plan_asignatura_id', type: 'int', unsigned: true })
  planAsignaturaId!: number;

  @Column({ name: 'resultado_anterior', type: 'varchar', length: 20 })
  resultadoAnterior!: ResultadoAcademico;

  @Column({ name: 'resultado_nuevo', type: 'varchar', length: 20 })
  resultadoNuevo!: ResultadoAcademico;

  @Column({ name: 'origen_academico_anterior', type: 'varchar', length: 30 })
  origenAcademicoAnterior!: OrigenAcademico;

  @Column({ name: 'origen_academico_nuevo', type: 'varchar', length: 30 })
  origenAcademicoNuevo!: OrigenAcademico;

  @Column({ name: 'observaciones_anteriores', type: 'varchar', length: 1000, nullable: true })
  observacionesAnteriores!: string | null;

  @Column({ name: 'observaciones_nuevas', type: 'varchar', length: 1000, nullable: true })
  observacionesNuevas!: string | null;

  @Column({ type: 'varchar', length: 500 })
  motivo!: string;

  @Column({ name: 'usuario_responsable_id', type: 'int', unsigned: true })
  usuarioResponsableId!: number;

  @ManyToOne(() => Estudiante, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'estudiante_id', foreignKeyConstraintName: 'FK_auditoria_historial_estudiante' })
  estudiante!: Estudiante;

  @ManyToOne(() => PlanAsignatura, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'plan_asignatura_id', foreignKeyConstraintName: 'FK_auditoria_historial_plan_asignatura' })
  planAsignatura!: PlanAsignatura;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'usuario_responsable_id', foreignKeyConstraintName: 'FK_auditoria_historial_usuario' })
  usuarioResponsable!: Usuario;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 0, default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

