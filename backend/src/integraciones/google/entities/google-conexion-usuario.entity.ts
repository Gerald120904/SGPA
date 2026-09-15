import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Usuario } from '../../../usuarios/entities/usuario.entity';

@Entity('google_conexiones_usuario')
export class GoogleConexionUsuario {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'usuario_id',
    type: 'int',
    unsigned: true,
    unique: true,
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
    name: 'google_email',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  googleEmail!: string | null;

  @Column({
    name: 'google_subject',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  googleSubject!: string | null;

  @Column({
    name: 'refresh_token_cifrado',
    type: 'text',
    nullable: true,
  })
  refreshTokenCifrado!: string | null;

  @Column({
    type: 'json',
  })
  scopes!: string[];

  @Column({
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @Column({
    name: 'conectado_at',
    type: 'datetime',
  })
  conectadoAt!: Date;

  @Column({
    name: 'revocado_at',
    type: 'datetime',
    nullable: true,
  })
  revocadoAt!: Date | null;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt!: Date;
}
