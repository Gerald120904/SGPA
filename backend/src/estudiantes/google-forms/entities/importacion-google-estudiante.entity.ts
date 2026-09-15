import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoImportacionGoogle } from '../constants/estado-importacion-google.constant';
import { ConfiguracionFormularioEstudiantes } from './configuracion-formulario-estudiantes.entity';

@Entity({ name: 'importaciones_google_estudiantes' })
@Index('IDX_importacion_google_config', ['configuracionId'])
@Index('IDX_importacion_google_estado', ['estado'])
export class ImportacionGoogleEstudiante {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'configuracion_id', type: 'int', unsigned: true })
  configuracionId!: number;

  @Column({
    name: 'identificador_externo',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  identificadorExterno!: string | null;

  @Column({ name: 'fila_origen', type: 'int' })
  filaOrigen!: number;

  @Column({ type: 'json' })
  payload!: Record<string, unknown>;

  @Column({
    type: 'varchar',
    length: 30,
    default: EstadoImportacionGoogle.PENDIENTE,
  })
  estado!: EstadoImportacionGoogle;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'processed_at', type: 'datetime', nullable: true })
  processedAt!: Date | null;

  @ManyToOne(
    () => ConfiguracionFormularioEstudiantes,
    (config) => config.respuestas,
    {
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'configuracion_id' })
  configuracion!: ConfiguracionFormularioEstudiantes;
}
