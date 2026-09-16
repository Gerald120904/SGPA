import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoRespuestaFormulario } from '../constants/estado-respuesta-formulario.constant';
import { DatosNormalizadosFormulario } from '../types/datos-normalizados-formulario.type';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { FormularioEstudiante } from './formulario-estudiante.entity';

@Entity({ name: 'respuestas_formularios_estudiantes' })
@Index('UQ_formulario_google_response', ['formularioId', 'googleResponseId'], {
  unique: true,
})
export class RespuestaFormularioEstudiante {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'formulario_id',
    type: 'int',
    unsigned: true,
  })
  formularioId!: number;

  @Column({
    name: 'google_response_id',
    type: 'varchar',
    length: 255,
  })
  googleResponseId!: string;

  @Column({
    name: 'payload_json',
    type: 'json',
  })
  payloadJson!: Record<string, unknown>;

  @Column({
    name: 'datos_normalizados_json',
    type: 'json',
    nullable: true,
  })
  datosNormalizadosJson!: DatosNormalizadosFormulario | null;

  @Column({
    type: 'enum',
    enum: EstadoRespuestaFormulario,
    default: EstadoRespuestaFormulario.PENDIENTE,
  })
  estado!: EstadoRespuestaFormulario;

  @Column({
    name: 'detalle_error',
    type: 'text',
    nullable: true,
  })
  detalleError!: string | null;

  @Column({
    name: 'optativas_no_disciplinarias',
    type: 'text',
    nullable: true,
  })
  optativasNoDisciplinarias!: string | null;

  @Column({
    name: 'procesado_at',
    type: 'datetime',
    nullable: true,
  })
  procesadoAt!: Date | null;

  @Column({
    name: 'revisado_por_usuario_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  revisadoPorUsuarioId!: number | null;

  @Column({
    name: 'revisado_at',
    type: 'datetime',
    nullable: true,
  })
  revisadoAt!: Date | null;

  @Column({
    name: 'motivo_rechazo',
    type: 'text',
    nullable: true,
  })
  motivoRechazo!: string | null;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'revisado_por_usuario_id',
  })
  revisadoPor!: Usuario | null;

  @ManyToOne(
    () => FormularioEstudiante,
    (formulario) => formulario.respuestas,
    {
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'formulario_id',
  })
  formulario!: FormularioEstudiante;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt!: Date;
}
