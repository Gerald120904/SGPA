import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../../usuarios/entities/usuario.entity';

@Entity('google_oauth_estados')
@Index('UQ_google_oauth_estado_hash', ['stateHash'], {
  unique: true,
})
export class GoogleOauthEstado {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'usuario_id',
    type: 'int',
    unsigned: true,
  })
  usuarioId!: number;

  @ManyToOne(() => Usuario, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'usuario_id',
  })
  usuario!: Usuario;

  @Column({
    name: 'state_hash',
    type: 'char',
    length: 64,
  })
  stateHash!: string;

  @Column({
    name: 'code_verifier_cifrado',
    type: 'text',
  })
  codeVerifierCifrado!: string;

  @Column({
    name: 'expira_at',
    type: 'datetime',
  })
  expiraAt!: Date;

  @Column({
    name: 'usado_at',
    type: 'datetime',
    nullable: true,
  })
  usadoAt!: Date | null;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt!: Date;
}
