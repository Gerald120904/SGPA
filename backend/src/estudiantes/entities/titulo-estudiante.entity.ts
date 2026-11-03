import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Carrera } from '../../carreras/entities/carrera.entity';
import { PlanEstudio } from '../../planes-estudio/entities/plan-estudio.entity';
import { SalidaAcademica } from '../../planes-estudio/entities/salida-academica.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Estudiante } from './estudiante.entity';

@Entity({ name: 'titulos_estudiantes' })
@Index('IDX_titulos_estudiantes_estudiante', ['estudianteId'])
@Index('IDX_titulos_estudiantes_plan', ['planEstudioId'])
// La migración crea un índice único funcional con COALESCE(salida_academica_id, 0).
@Index('UQ_titulos_estudiante_plan_grado_salida', ['estudianteId', 'planEstudioId', 'grado', 'salidaAcademicaId'], { unique: true, synchronize: false } as any)
export class TituloEstudiante {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'estudiante_id', type: 'int', unsigned: true })
  estudianteId!: number;

  @Column({ name: 'plan_estudio_id', type: 'int', unsigned: true })
  planEstudioId!: number;

  @Column({ name: 'carrera_id', type: 'int', unsigned: true })
  carreraId!: number;

  @Column({ name: 'salida_academica_id', type: 'int', unsigned: true, nullable: true })
  salidaAcademicaId!: number | null;

  @Column({ type: 'varchar', length: 50 })
  grado!: string; // 'DIPLOMADO' | 'BACHILLERATO' | 'LICENCIATURA' | 'MAESTRIA'

  @Column({ name: 'nombre_titulo', type: 'varchar', length: 200 })
  nombreTitulo!: string;

  @Column({ name: 'fecha_graduacion', type: 'datetime' })
  fechaGraduacion!: Date;

  @Column({ name: 'graduado_por_usuario_id', type: 'int', unsigned: true })
  graduadoPorUsuarioId!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  observaciones!: string | null;

  @ManyToOne(() => Estudiante, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'estudiante_id', foreignKeyConstraintName: 'FK_titulos_estudiantes_estudiante' })
  estudiante!: Estudiante;

  @ManyToOne(() => PlanEstudio, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'plan_estudio_id', foreignKeyConstraintName: 'FK_titulos_estudiantes_plan' })
  planEstudio!: PlanEstudio;

  @ManyToOne(() => Carrera, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'carrera_id', foreignKeyConstraintName: 'FK_titulos_estudiantes_carrera' })
  carrera!: Carrera;

  @ManyToOne(() => SalidaAcademica, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'salida_academica_id', foreignKeyConstraintName: 'FK_titulos_estudiantes_salida' })
  salidaAcademica!: SalidaAcademica | null;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'graduado_por_usuario_id', foreignKeyConstraintName: 'FK_titulos_estudiantes_usuario' })
  graduadoPorUsuario!: Usuario;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 0, default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

