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
import { TipoRegistroPerfil } from '../constants/tipo-registro-perfil.constant';
import { AreaPerfilAcademico } from './area-perfil-academico.entity';
import { CursoPerfilAcademico } from './curso-perfil-academico.entity';
import { ProfesorPerfilAcademico } from './profesor-perfil-academico.entity';
import { RequisitoPerfilAcademico } from './requisito-perfil-academico.entity';

@Entity({ name: 'perfiles_academicos' })
@Index('UQ_perfiles_academicos_carrera_codigo', ['carreraId', 'codigo'], {
  unique: true,
})
export class PerfilAcademico {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'carrera_id',
    type: 'int',
    unsigned: true,
  })
  carreraId!: number;

  @Column({
    type: 'varchar',
    length: 30,
  })
  codigo!: string;

  @Column({
    type: 'varchar',
    length: 150,
  })
  nombre!: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  descripcion!: string | null;

  @Column({
    name: 'numero_perfil',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  numeroPerfil!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  consecutivo!: string | null;

  @Column({
    name: 'acuerdo_aprobacion',
    type: 'varchar',
    length: 250,
    nullable: true,
  })
  acuerdoAprobacion!: string | null;

  @Column({ name: 'fecha_aprobacion', type: 'date', nullable: true })
  fechaAprobacion!: string | null;

  @Column({
    name: 'tipo_registro',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  tipoRegistro!: TipoRegistroPerfil | null;

  @Column({
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @ManyToOne(() => Carrera, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'carrera_id' })
  carrera!: Carrera;

  @OneToMany(() => AreaPerfilAcademico, (area) => area.perfilAcademico)
  areas!: AreaPerfilAcademico[];

  @OneToMany(
    () => RequisitoPerfilAcademico,
    (requisito) => requisito.perfilAcademico,
  )
  requisitos!: RequisitoPerfilAcademico[];

  @OneToMany(() => CursoPerfilAcademico, (curso) => curso.perfilAcademico)
  cursos!: CursoPerfilAcademico[];

  @OneToMany(
    () => ProfesorPerfilAcademico,
    (profesor) => profesor.perfilAcademico,
  )
  profesores!: ProfesorPerfilAcademico[];

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
