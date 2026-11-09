import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type EstadoCuentaInstitucional =
  | 'CONECTADA'
  | 'REQUIERE_RECONEXION'
  | 'DESCONECTADA';

@Entity('google_cuentas_institucionales')
export class GoogleCuentaInstitucional {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

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
    nullable: true,
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
    nullable: true,
  })
  conectadoAt!: Date | null;

  @Column({
    name: 'revocado_at',
    type: 'datetime',
    nullable: true,
  })
  revocadoAt!: Date | null;

  @Column({
    name: 'autorizado_por_usuario_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  autorizadoPorUsuarioId!: number | null;

  @Column({
    name: 'ultimo_error',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  ultimoError!: string | null;

  @Column({
    name: 'ultimo_sync_at',
    type: 'datetime',
    nullable: true,
  })
  ultimoSyncAt!: Date | null;

  @Column({
    name: 'sync_exitosos',
    type: 'int',
    unsigned: true,
    default: 0,
  })
  syncExitosos!: number;

  @Column({
    name: 'sync_fallidos',
    type: 'int',
    unsigned: true,
    default: 0,
  })
  syncFallidos!: number;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt!: Date;
}

