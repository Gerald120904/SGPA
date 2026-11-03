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
import { PlanEstudio } from '../../planes-estudio/entities/plan-estudio.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { LoteImportacionEstudiante } from './lote-importacion-estudiante.entity';

@Entity({ name: 'registros_importacion_estudiantes' })
@Index('IDX_reg_importacion_lote', ['loteId'])
@Index('IDX_reg_importacion_estado', ['estado'])
@Index('IDX_reg_importacion_carrera', ['carreraId'])
export class RegistroImportacionEstudiante {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'lote_id', type: 'int', unsigned: true })
  loteId!: number;

  @Column({ name: 'carrera_id', type: 'int', unsigned: true })
  carreraId!: number;

  @Column({ name: 'plan_estudio_id', type: 'int', unsigned: true })
  planEstudioId!: number;

  @Column({ type: 'int' })
  fila!: number;

  @Column({ type: 'varchar', length: 30 })
  cedula!: string;

  @Column({ type: 'varchar', length: 20 })
  accion!: string; // 'CREAR' | 'ACTUALIZAR' | 'SIN_CAMBIOS' | 'ERROR'

  @Column({ name: 'datos_json', type: 'json' })
  datosJson!: {
    nombres: string;
    apellido1: string;
    apellido2: string | null;
    correoInstitucional: string;
    telefono: string | null;
    periodoIngresoCodigo: string;
    periodoIngresoId: number | null;
    asignaturasAprobadas: string[];
    formularioRespuestaId?: number;
    advertenciasCorrequisitos?: string[];
    optativasNoDisciplinarias?: string | null;
  };

  @Column({ name: 'datos_existentes_json', type: 'json', nullable: true })
  datosExistentesJson!: Record<string, unknown> | null;

  @Column({ name: 'cambios_detectados_json', type: 'json', nullable: true })
  cambiosDetectadosJson!: Array<{
    campo: string;
    actual: string | null;
    nuevo: string | null;
  }> | null;

  @Column({ name: 'aprobaciones_nuevas_json', type: 'json', nullable: true })
  aprobacionesNuevasJson!: Array<{
    codigo: string;
    planAsignaturaId: number;
  }> | null;

  @Column({ name: 'errores_json', type: 'json', nullable: true })
  erroresJson!: string[] | null;

  @Column({ type: 'varchar', length: 35, default: 'PENDIENTE' })
  estado!: string; // 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'DEVUELTO_PARA_CORRECCION' | 'REQUIERE_REVISION'

  @Column({ name: 'motivo_rechazo', type: 'varchar', length: 500, nullable: true })
  motivoRechazo!: string | null;

  @Column({ name: 'revisado_por_usuario_id', type: 'int', unsigned: true, nullable: true })
  revisadoPorUsuarioId!: number | null;

  @Column({ name: 'revisado_en', type: 'datetime', nullable: true })
  revisadoEn!: Date | null;

  @Column({ name: 'estudiante_id_aplicado', type: 'int', unsigned: true, nullable: true })
  estudianteIdAplicado!: number | null;

  @ManyToOne(() => LoteImportacionEstudiante, (l) => l.registros, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'lote_id', foreignKeyConstraintName: 'FK_reg_lote' })
  lote!: LoteImportacionEstudiante;

  @ManyToOne(() => Carrera, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'carrera_id', foreignKeyConstraintName: 'FK_reg_carrera' })
  carrera!: Carrera;

  @ManyToOne(() => PlanEstudio, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'plan_estudio_id', foreignKeyConstraintName: 'FK_reg_plan' })
  planEstudio!: PlanEstudio;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'revisado_por_usuario_id', foreignKeyConstraintName: 'FK_reg_usuario_revisor' })
  revisadoPor!: Usuario | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 0, default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 0, default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}
