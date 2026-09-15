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
import { Carrera } from '../../../carreras/entities/carrera.entity';
import { PlanEstudio } from '../../../planes-estudio/entities/plan-estudio.entity';
import { ImportacionGoogleEstudiante } from './importacion-google-estudiante.entity';

@Entity({ name: 'configuraciones_formularios_estudiantes' })
@Index('IDX_config_form_carrera', ['carreraId'])
@Index('IDX_config_form_plan', ['planEstudioId'])
export class ConfiguracionFormularioEstudiantes {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'varchar', length: 150 })
  nombre!: string;

  @Column({ name: 'google_form_id', type: 'varchar', length: 100 })
  googleFormId!: string;

  @Column({ name: 'google_sheet_id', type: 'varchar', length: 100 })
  googleSheetId!: string;

  @Column({ name: 'carrera_id', type: 'int', unsigned: true })
  carreraId!: number;

  @Column({ name: 'plan_estudio_id', type: 'int', unsigned: true })
  planEstudioId!: number;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @Column({ name: 'ultima_fila_procesada', type: 'int', default: 1 })
  ultimaFilaProcesada!: number;

  @ManyToOne(() => Carrera, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'carrera_id' })
  carrera!: Carrera;

  @ManyToOne(() => PlanEstudio, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'plan_estudio_id' })
  planEstudio!: PlanEstudio;

  @OneToMany(
    () => ImportacionGoogleEstudiante,
    (respuesta) => respuesta.configuracion,
  )
  respuestas!: ImportacionGoogleEstudiante[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
