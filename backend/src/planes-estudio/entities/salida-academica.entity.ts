import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlanAsignatura } from './plan-asignatura.entity';
import { PlanEstudio } from './plan-estudio.entity';

export enum TipoSalidaAcademica {
  DIPLOMADO = 'DIPLOMADO',
  BACHILLERATO = 'BACHILLERATO',
  LICENCIATURA = 'LICENCIATURA',
  CERTIFICADO = 'CERTIFICADO',
  OTRO = 'OTRO',
}

@Entity({ name: 'salidas_academicas' })
@Index('UQ_salidas_academicas_plan_codigo', ['planEstudioId', 'codigo'], {
  unique: true,
})
export class SalidaAcademica {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'plan_estudio_id',
    type: 'int',
    unsigned: true,
  })
  planEstudioId!: number;

  @Column({
    type: 'varchar',
    length: 30,
  })
  codigo!: string;

  @Column({
    type: 'varchar',
    length: 160,
  })
  nombre!: string;

  @Column({
    type: 'varchar',
    length: 25,
  })
  tipo!: TipoSalidaAcademica;

  @Column({
    name: 'creditos_requeridos',
    type: 'smallint',
    unsigned: true,
  })
  creditosRequeridos!: number;

  @Column({
    type: 'smallint',
    unsigned: true,
    default: 1,
  })
  orden!: number;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  descripcion!: string | null;

  @Column({
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @ManyToOne(() => PlanEstudio, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_estudio_id' })
  planEstudio!: PlanEstudio;

  @ManyToMany(() => PlanAsignatura)
  @JoinTable({
    name: 'salida_academica_asignaturas',
    joinColumn: {
      name: 'salida_academica_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'plan_asignatura_id',
      referencedColumnName: 'id',
    },
  })
  asignaturas!: PlanAsignatura[];

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
