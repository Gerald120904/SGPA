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
import { PlanAsignatura } from '../../planes-estudio/entities/plan-asignatura.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { FuenteRegistroAcademico } from '../constants/fuente-registro-academico.constant';
import { OrigenAcademico } from '../constants/origen-academico.constant';
import { ResultadoAcademico } from '../constants/resultado-academico.constant';
import { Estudiante } from './estudiante.entity';

@Entity({ name: 'historial_academico_estudiantes' })
@Index('IDX_historial_academico_estudiante_asignatura', [
  'estudianteId',
  'planAsignaturaId',
])
export class HistorialAcademicoEstudiante {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'estudiante_id', type: 'int', unsigned: true })
  estudianteId!: number;

  @Column({ name: 'plan_asignatura_id', type: 'int', unsigned: true })
  planAsignaturaId!: number;

  @Column({ name: 'periodo_id', type: 'int', unsigned: true, nullable: true })
  periodoId!: number | null;

  @Column({ type: 'varchar', length: 20 })
  resultado!: ResultadoAcademico;

  @Column({ name: 'origen_academico', type: 'varchar', length: 30 })
  origenAcademico!: OrigenAcademico;

  @Column({ name: 'fuente_registro', type: 'varchar', length: 30 })
  fuenteRegistro!: FuenteRegistroAcademico;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  observaciones!: string | null;

  @Column({ name: 'registrado_por_usuario_id', type: 'int', unsigned: true })
  registradoPorUsuarioId!: number;

  @ManyToOne(() => Estudiante, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'estudiante_id' })
  estudiante!: Estudiante;

  @ManyToOne(() => PlanAsignatura, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_asignatura_id' })
  planAsignatura!: PlanAsignatura;

  @ManyToOne(() => PeriodoAcademico, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'periodo_id' })
  periodo!: PeriodoAcademico | null;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'registrado_por_usuario_id' })
  registradoPor!: Usuario;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
