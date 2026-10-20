import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type EstadoSolicitudCambio = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA' | 'INVALIDADA';

@Entity({ name: 'solicitudes_cambio' })
@Index('IDX_solicitud_responsable_estado', ['coordinadorId', 'estado'])
export class SolicitudCambio {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'solicitante_id', type: 'int', unsigned: true })
  solicitanteId!: number;

  @Column({ name: 'coordinador_id', type: 'int', unsigned: true })
  coordinadorId!: number;

  @Column({ name: 'carrera_id', type: 'int', unsigned: true })
  carreraId!: number;

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

  @Column({ name: 'motivo_rechazo', type: 'varchar', length: 500, nullable: true })
  motivoRechazo!: string | null;

  @Column({ name: 'correlacion_id', type: 'char', length: 36, unique: true })
  correlacionId!: string;

  @Column({ name: 'resultado_aplicado', type: 'json', nullable: true })
  resultadoAplicado!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
