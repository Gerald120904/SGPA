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
import { TipoOptativa } from '../../optativas/constants/tipo-optativa.constant';
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

  @Column({ name: 'curso_optativo_id', type: 'int', unsigned: true, nullable: true })
  cursoOptativoId!: number | null;

  @Column({ name: 'plan_estudio_contexto_id', type: 'int', unsigned: true, nullable: true })
  planEstudioContextoId!: number | null;

  @Column({ name: 'codigo_optativa_real', type: 'varchar', length: 30, nullable: true })
  codigoOptativaReal!: string | null;

  @Column({ name: 'nombre_optativa_real', type: 'varchar', length: 150, nullable: true })
  nombreOptativaReal!: string | null;

  @Column({ name: 'tipo_optativa_real', type: 'varchar', length: 30, nullable: true })
  tipoOptativaReal!: TipoOptativa | null;

  @Column({ name: 'creditos_optativa_real', type: 'smallint', unsigned: true, nullable: true })
  creditosOptativaReal!: number | null;

  @Column({ name: 'reconocimiento_optativo', type: 'varchar', length: 20, nullable: true })
  reconocimientoOptativo!: 'RECONOCIDO' | 'NO_RECONOCIDO' | null;

  @Column({ name: 'creditos_reconocidos', type: 'smallint', unsigned: true, nullable: true })
  creditosReconocidos!: number | null;

  @Column({ name: 'reconocido_por_usuario_id', type: 'int', unsigned: true, nullable: true })
  reconocidoPorUsuarioId!: number | null;

  @Column({ name: 'fecha_reconocimiento', type: 'datetime', nullable: true })
  fechaReconocimiento!: Date | null;

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
