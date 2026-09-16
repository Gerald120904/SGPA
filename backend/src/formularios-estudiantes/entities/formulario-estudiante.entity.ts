import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Carrera } from '../../carreras/entities/carrera.entity';
import { PlanEstudio } from '../../planes-estudio/entities/plan-estudio.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { EstadoFormularioEstudiante } from '../constants/estado-formulario-estudiante.constant';
import { RespuestaFormularioEstudiante } from './respuesta-formulario-estudiante.entity';

import { MapaPreguntasFormulario } from '../types/mapa-preguntas-formulario.type';

@Entity({ name: 'formularios_estudiantes' })
export class FormularioEstudiante {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    type: 'varchar',
    length: 255,
  })
  titulo!: string;

  @Column({
    type: 'text',
  })
  descripcion!: string;

  @Column({
    name: 'carrera_id',
    type: 'int',
    unsigned: true,
  })
  carreraId!: number;

  @Column({
    name: 'plan_estudio_id',
    type: 'int',
    unsigned: true,
  })
  planEstudioId!: number;

  @Column({
    name: 'google_form_id',
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: true,
  })
  @Index('UQ_formulario_google_form_id', { unique: true })
  googleFormId!: string | null;

  @Column({
    name: 'responder_uri',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  responderUri!: string | null;

  @Column({
    type: 'enum',
    enum: EstadoFormularioEstudiante,
    default: EstadoFormularioEstudiante.CREANDO,
  })
  estado!: EstadoFormularioEstudiante;

  @Column({
    name: 'mapa_preguntas',
    type: 'json',
    nullable: true,
  })
  mapaPreguntas!: MapaPreguntasFormulario | null;

  @Column({
    name: 'detalle_error',
    type: 'text',
    nullable: true,
  })
  detalleError!: string | null;

  @Column({
    name: 'ultima_sincronizacion_at',
    type: 'datetime',
    nullable: true,
  })
  ultimaSincronizacionAt!: Date | null;

  @Column({
    name: 'creado_por_usuario_id',
    type: 'int',
    unsigned: true,
  })
  creadoPorUsuarioId!: number;

  @ManyToOne(() => Carrera, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'carrera_id',
  })
  carrera!: Carrera;

  @ManyToOne(() => PlanEstudio, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'plan_estudio_id',
  })
  planEstudio!: PlanEstudio;

  @ManyToOne(() => Usuario, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'creado_por_usuario_id',
  })
  creadoPorUsuario!: Usuario;

  @OneToMany(
    () => RespuestaFormularioEstudiante,
    (respuesta) => respuesta.formulario,
  )
  respuestas!: RespuestaFormularioEstudiante[];

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
  })
  updatedAt!: Date;
}
