import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Carrera } from '../../carreras/entities/carrera.entity';
import { PlanEstudio } from '../../planes-estudio/entities/plan-estudio.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { FuenteRegistroAcademico } from '../constants/fuente-registro-academico.constant';
import { RegistroImportacionEstudiante } from './registro-importacion-estudiante.entity';

@Entity({ name: 'lotes_importacion_estudiantes' })
@Index('IDX_lote_carrera_plan', ['carreraId', 'planEstudioId'])
export class LoteImportacionEstudiante {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'carrera_id', type: 'int', unsigned: true })
  carreraId!: number;

  @Column({ name: 'plan_estudio_id', type: 'int', unsigned: true })
  planEstudioId!: number;

  @Column({
    type: 'varchar',
    length: 30,
    default: FuenteRegistroAcademico.EXCEL,
  })
  fuente!: FuenteRegistroAcademico;

  @Column({ name: 'nombre_archivo', type: 'varchar', length: 255, nullable: true })
  nombreArchivo!: string | null;

  @Column({ name: 'total_filas', type: 'int', default: 0 })
  totalFilas!: number;

  @Column({ name: 'total_validas', type: 'int', default: 0 })
  totalValidas!: number;

  @Column({ name: 'total_errores', type: 'int', default: 0 })
  totalErrores!: number;

  @Column({ type: 'varchar', length: 30, default: 'PENDIENTE' })
  estado!: string;

  @Column({ name: 'creado_por_usuario_id', type: 'int', unsigned: true })
  creadoPorUsuarioId!: number;

  @ManyToOne(() => Carrera, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'carrera_id', foreignKeyConstraintName: 'FK_lote_carrera' })
  carrera!: Carrera;

  @ManyToOne(() => PlanEstudio, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'plan_estudio_id', foreignKeyConstraintName: 'FK_lote_plan' })
  planEstudio!: PlanEstudio;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'creado_por_usuario_id', foreignKeyConstraintName: 'FK_lote_usuario' })
  creadoPor!: Usuario;

  @OneToMany(() => RegistroImportacionEstudiante, (r) => r.lote)
  registros!: RegistroImportacionEstudiante[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 0, default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 0, default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}

