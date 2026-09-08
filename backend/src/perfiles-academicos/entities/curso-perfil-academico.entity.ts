import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Curso } from '../../cursos/entities/curso.entity';
import { PerfilAcademico } from './perfil-academico.entity';

@Entity({
  name: 'curso_perfiles_academicos',
})
@Index('UQ_curso_perfil_academico', ['cursoId', 'perfilAcademicoId'], {
  unique: true,
})
export class CursoPerfilAcademico {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'curso_id',
    type: 'int',
    unsigned: true,
  })
  cursoId!: number;

  @Column({
    name: 'perfil_academico_id',
    type: 'int',
    unsigned: true,
  })
  perfilAcademicoId!: number;

  @Column({
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @ManyToOne(() => Curso, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'curso_id' })
  curso!: Curso;

  @ManyToOne(() => PerfilAcademico, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'perfil_academico_id',
  })
  perfilAcademico!: PerfilAcademico;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  createdAt!: Date;
}
