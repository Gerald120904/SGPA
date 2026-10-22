import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

/** Una cuenta asistente conserva un único responsable, incluso tras desactivarse. */
@Entity({ name: 'dependencias_usuario' })
@Index('UQ_dependencia_asistente', ['asistenteId'], { unique: true })
export class DependenciaUsuario {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'asistente_id', type: 'int', unsigned: true })
  asistenteId!: number;

  @Column({ name: 'coordinador_id', type: 'int', unsigned: true })
  coordinadorId!: number;

  @Column({ name: 'creado_por_usuario_id', type: 'int', unsigned: true })
  creadoPorUsuarioId!: number;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'asistente_id', foreignKeyConstraintName: 'FK_dependencia_asistente' })
  asistente!: Usuario;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'coordinador_id', foreignKeyConstraintName: 'FK_dependencia_coordinador' })
  coordinador!: Usuario;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creado_por_usuario_id', foreignKeyConstraintName: 'FK_dependencia_creador' })
  creador!: Usuario;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @Column({ name: 'desactivado_en', type: 'datetime', nullable: true })
  desactivadoEn!: Date | null;

  @Column({ name: 'motivo_desactivacion', type: 'varchar', length: 255, nullable: true })
  motivoDesactivacion!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
