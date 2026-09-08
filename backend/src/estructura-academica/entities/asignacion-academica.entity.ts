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
import { Carrera } from '../../carreras/entities/carrera.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { TipoAsignacionAcademica } from '../constants/tipo-asignacion-academica.constant';
import { AreaAcademica } from './area-academica.entity';

@Entity({
  name: 'asignaciones_academicas',
})
@Index('IDX_asignacion_usuario', ['usuarioId'])
export class AsignacionAcademica {
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

  @Column({
    type: 'varchar',
    length: 40,
  })
  tipo!: TipoAsignacionAcademica;

  @Column({
    name: 'carrera_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  carreraId!: number | null;

  @Column({
    name: 'area_academica_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  areaAcademicaId!: number | null;

  @Column({
    name: 'fecha_inicio',
    type: 'date',
  })
  fechaInicio!: string;

  @Column({
    name: 'fecha_fin',
    type: 'date',
    nullable: true,
  })
  fechaFin!: string | null;

  @Column({
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @ManyToOne(() => Usuario, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'usuario_id',
  })
  usuario!: Usuario;

  @ManyToOne(() => Carrera, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'carrera_id',
  })
  carrera!: Carrera | null;

  @ManyToOne(() => AreaAcademica, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'area_academica_id',
  })
  areaAcademica!: AreaAcademica | null;

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
