import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity({ name: 'auditoria_jerarquia' })
@Index('IDX_auditoria_jerarquia_objetivo', ['objetivoUsuarioId', 'createdAt'])
export class AuditoriaJerarquia {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'actor_usuario_id', type: 'int', unsigned: true })
  actorUsuarioId!: number;

  @Column({ name: 'objetivo_usuario_id', type: 'int', unsigned: true })
  objetivoUsuarioId!: number;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actor_usuario_id', foreignKeyConstraintName: 'FK_auditoria_actor' })
  actor!: Usuario;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'objetivo_usuario_id', foreignKeyConstraintName: 'FK_auditoria_objetivo' })
  objetivo!: Usuario;

  @Column({ type: 'varchar', length: 60 })
  accion!: string;

  @Column({ type: 'json' })
  detalle!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
