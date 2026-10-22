import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Carrera } from '../../carreras/entities/carrera.entity';
import { Usuario } from './usuario.entity';

export type EstadoSolicitudCambio = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA' | 'INVALIDADA';

@Entity({ name: 'solicitudes_cambio' })
@Index('IDX_solicitud_responsable_estado', ['coordinadorId', 'estado'])
@Index('IDX_solicitud_solicitante', ['solicitanteId'])
export class SolicitudCambio {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'solicitante_id', type: 'int', unsigned: true })
  solicitanteId!: number;

  @Column({ name: 'coordinador_id', type: 'int', unsigned: true })
  coordinadorId!: number;

  @Column({ name: 'carrera_id', type: 'int', unsigned: true })
  carreraId!: number;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'solicitante_id', foreignKeyConstraintName: 'FK_solicitud_solicitante' })
  solicitante!: Usuario;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'coordinador_id', foreignKeyConstraintName: 'FK_solicitud_coordinador' })
  coordinador!: Usuario;

  @ManyToOne(() => Carrera, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'carrera_id', foreignKeyConstraintName: 'FK_solicitud_carrera' })
  carrera!: Carrera;

  @Column({ type: 'varchar', length: 50 })
  modulo!: string;

  @Column({ type: 'varchar', length: 50 })
  operacion!: string;

  @Column({ name: 'objetivo_id', type: 'int', unsigned: true, nullable: true })
  objetivoId!: number | null;

  @Column({ name: 'datos_propuestos', type: 'json' })
  datosPropuestos!: Record<string, unknown>;

  @Column({ name: 'huella_original', type: 'char', length: 64, nullable: true })
  huellaOriginal!: string | null;

  @Column({ type: 'varchar', length: 16 })
  estado!: EstadoSolicitudCambio;

  @Column({ name: 'resuelto_en', type: 'datetime', nullable: true })
  resueltoEn!: Date | null;

  @Column({ name: 'resuelto_por_usuario_id', type: 'int', unsigned: true, nullable: true })
  resueltoPorUsuarioId!: number | null;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'resuelto_por_usuario_id', foreignKeyConstraintName: 'FK_solicitud_resolutor' })
  resueltoPor!: Usuario | null;

  @Column({ name: 'motivo_rechazo', type: 'varchar', length: 500, nullable: true })
  motivoRechazo!: string | null;

  @Column({ name: 'correlacion_id', type: 'char', length: 36, unique: true })
  correlacionId!: string;

  @Column({ name: 'resultado_aplicado', type: 'json', nullable: true })
  resultadoAplicado!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
