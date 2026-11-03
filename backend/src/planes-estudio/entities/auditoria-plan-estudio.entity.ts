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
import { PlanEstudio } from './plan-estudio.entity';

@Entity({ name: 'auditoria_planes_estudio' })
@Index('IDX_auditoria_planes_estudio_plan_id', ['planEstudioId'])
@Index('IDX_auditoria_planes_estudio_tipo', ['tipoModificacion'])
export class AuditoriaPlanEstudio {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'plan_estudio_id', type: 'int', unsigned: true })
  planEstudioId!: number;

  @Column({ name: 'tipo_modificacion', type: 'varchar', length: 50 })
  tipoModificacion!: string; // 'CAMBIO_ESTADO' | 'CIERRE' | 'REAPERTURA' | 'CAMBIO_NOMBRE_ASIGNATURA' | 'MODIFICACION_MALLA'

  @Column({ name: 'valor_anterior', type: 'varchar', length: 255, nullable: true })
  valorAnterior!: string | null;

  @Column({ name: 'valor_nuevo', type: 'varchar', length: 255, nullable: true })
  valorNuevo!: string | null;

  @Column({ type: 'varchar', length: 500 })
  motivo!: string;

  @Column({ name: 'usuario_id', type: 'int', unsigned: true })
  usuarioId!: number;

  @Column({ name: 'metadata_json', type: 'json', nullable: true })
  metadataJson!: Record<string, unknown> | null;

  @ManyToOne(() => PlanEstudio, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'plan_estudio_id', foreignKeyConstraintName: 'FK_auditoria_planes_estudio_plan' })
  planEstudio!: PlanEstudio;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'FK_auditoria_planes_estudio_usuario' })
  usuario!: Usuario;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 0, default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

