import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoRequisito } from '../../planes-estudio/constants/tipo-requisito.constant';
import { Curso } from './curso.entity';

@Entity({ name: 'curso_requisitos' })
@Index('UQ_curso_requisito_relacion', ['cursoId', 'requisitoCursoId', 'tipo'], {
  unique: true,
})
export class CursoRequisito {
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
    name: 'requisito_curso_id',
    type: 'int',
    unsigned: true,
  })
  requisitoCursoId!: number;

  @Column({
    type: 'varchar',
    length: 20,
  })
  tipo!: TipoRequisito;

  @ManyToOne(() => Curso, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'curso_id' })
  curso!: Curso;

  @ManyToOne(() => Curso, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'requisito_curso_id' })
  requisitoCurso!: Curso;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  createdAt!: Date;
}
