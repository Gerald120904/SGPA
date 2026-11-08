import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('google_sync_logs')
export class GoogleSyncLog {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    type: 'varchar',
    length: 20,
  })
  tipo!: 'AUTOMATICO' | 'MANUAL';

  @Column({
    type: 'varchar',
    length: 20,
  })
  resultado!: 'EXITOSO' | 'ERROR' | 'PARCIAL';

  @Column({
    name: 'formularios_procesados',
    type: 'int',
    unsigned: true,
    default: 0,
  })
  formulariosProcesados!: number;

  @Column({
    name: 'respuestas_nuevas',
    type: 'int',
    unsigned: true,
    default: 0,
  })
  respuestasNuevas!: number;

  @Column({
    name: 'detalle_error',
    type: 'text',
    nullable: true,
  })
  detalleError!: string | null;

  @Column({
    name: 'ejecutado_por_usuario_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  ejecutadoPorUsuarioId!: number | null;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt!: Date;
}

