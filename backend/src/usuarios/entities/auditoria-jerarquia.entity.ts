import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'auditoria_jerarquia' })
@Index('IDX_auditoria_jerarquia_objetivo', ['objetivoUsuarioId', 'createdAt'])
export class AuditoriaJerarquia {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'actor_usuario_id', type: 'int', unsigned: true })
  actorUsuarioId!: number;

  @Column({ name: 'objetivo_usuario_id', type: 'int', unsigned: true })
  objetivoUsuarioId!: number;

  @Column({ type: 'varchar', length: 60 })
  accion!: string;

  @Column({ type: 'json' })
  detalle!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
