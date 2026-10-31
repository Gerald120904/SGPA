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
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity({ name: 'notificaciones' })
@Index('IDX_notificaciones_usuario_leido', ['usuarioId', 'leido'])
@Index('IDX_notificaciones_carrera', ['carreraId'])
@Index('UQ_notificaciones_clave_idempotencia', ['claveIdempotencia'], { unique: true })
export class Notificacion {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'clave_idempotencia', type: 'varchar', length: 180, nullable: true })
  claveIdempotencia!: string | null;

  @Column({ name: 'usuario_id', type: 'int', unsigned: true })
  usuarioId!: number;

  @Column({ name: 'carrera_id', type: 'int', unsigned: true, nullable: true })
  carreraId!: number | null;

  @Column({ type: 'varchar', length: 150 })
  titulo!: string;

  @Column({ type: 'varchar', length: 1000 })
  mensaje!: string;

  @Column({ type: 'varchar', length: 50 })
  tipo!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  enlace!: string | null;

  @Column({ type: 'json', nullable: true })
  metadatos!: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  leido!: boolean;

  @Column({ name: 'leido_at', type: 'datetime', nullable: true })
  leidoAt!: Date | null;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @ManyToOne(() => Carrera, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'carrera_id' })
  carrera!: Carrera | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
