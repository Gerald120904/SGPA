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
import { Curso } from '../../cursos/entities/curso.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { EstadoCursoProfesor } from '../constants/estado-curso-profesor.constant';

@Entity({ name: 'profesor_cursos' })
@Index('UQ_profesor_cursos_profesor_curso', ['profesorUsuarioId', 'cursoId'], {
  unique: true,
})
export class ProfesorCurso {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'profesor_usuario_id',
    type: 'int',
    unsigned: true,
  })
  profesorUsuarioId!: number;

  @Column({
    name: 'curso_id',
    type: 'int',
    unsigned: true,
  })
  cursoId!: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: EstadoCursoProfesor.PENDIENTE,
  })
  estado!: EstadoCursoProfesor;

  @Column({
    name: 'solicitado_por_usuario_id',
    type: 'int',
    unsigned: true,
  })
  solicitadoPorUsuarioId!: number;

  @Column({
    name: 'revisado_por_usuario_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  revisadoPorUsuarioId!: number | null;

  @Column({
    name: 'fecha_revision',
    type: 'datetime',
    nullable: true,
  })
  fechaRevision!: Date | null;

  @Column({
    name: 'observacion_revision',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  observacionRevision!: string | null;

  @ManyToOne(() => Usuario, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'profesor_usuario_id',
  })
  profesor!: Usuario;

  @ManyToOne(() => Curso, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'curso_id',
  })
  curso!: Curso;

  @ManyToOne(() => Usuario, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'solicitado_por_usuario_id',
  })
  solicitadoPor!: Usuario;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'revisado_por_usuario_id',
  })
  revisadoPor!: Usuario | null;

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
