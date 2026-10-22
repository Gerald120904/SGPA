import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';

export type EstadoInvitacion =
  'PENDIENTE' | 'EN_PROCESO' | 'ENVIADA' | 'INCIERTA' | 'ACEPTADA' | 'CADUCADA';

@Entity({ name: 'invitacion_outbox' })
export class InvitacionOutbox {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'usuario_id', type: 'int', unsigned: true, unique: true })
  usuarioId!: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'usuario_id',
    foreignKeyConstraintName: 'FK_invitacion_outbox_usuario',
  })
  usuario!: Usuario;

  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash!: string;

  @Column({ name: 'enlace_cifrado', type: 'text', nullable: true })
  enlaceCifrado!: string | null;

  @Column({ type: 'varchar', length: 16 })
  estado!: EstadoInvitacion;

  @Column({ type: 'smallint', unsigned: true, default: 0 })
  intentos!: number;

  @Column({ name: 'lease_id', type: 'char', length: 36, nullable: true })
  leaseId!: string | null;

  @Column({
    name: 'bloqueado_hasta',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  bloqueadoHasta!: Date | null;

  @Column({ name: 'expira_en', type: 'datetime', precision: 3 })
  expiraEn!: Date;

  @Column({
    name: 'enviado_en',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  enviadoEn!: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
    onUpdate: 'CURRENT_TIMESTAMP(3)',
  })
  updatedAt!: Date;
}
