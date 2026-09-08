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
import { PerfilAcademico } from '../../perfiles-academicos/entities/perfil-academico.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import {
  AccionHistorialPerfilProfesor,
  TipoHistorialPerfilProfesor,
} from '../constants/historial-perfil-profesor.constant';

@Entity({
  name: 'historial_perfil_profesor',
})
@Index('IDX_historial_perfil_profesor', ['profesorUsuarioId'])
export class HistorialPerfilProfesor {
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
    name: 'usuario_accion_id',
    type: 'int',
    unsigned: true,
  })
  usuarioAccionId!: number;

  @Column({
    name: 'curso_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  cursoId!: number | null;

  @Column({
    name: 'perfil_academico_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  perfilAcademicoId!: number | null;

  @Column({
    type: 'varchar',
    length: 20,
  })
  tipo!: TipoHistorialPerfilProfesor;

  @Column({
    type: 'varchar',
    length: 40,
  })
  accion!: AccionHistorialPerfilProfesor;

  @Column({
    name: 'datos_anteriores',
    type: 'json',
    nullable: true,
  })
  datosAnteriores!: unknown | null;

  @Column({
    name: 'datos_nuevos',
    type: 'json',
    nullable: true,
  })
  datosNuevos!: unknown | null;

  @ManyToOne(() => Usuario, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'profesor_usuario_id',
  })
  profesor!: Usuario;

  @ManyToOne(() => Usuario, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'usuario_accion_id',
  })
  usuarioAccion!: Usuario;

  @ManyToOne(() => Curso, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'curso_id',
  })
  curso!: Curso | null;

  @ManyToOne(() => PerfilAcademico, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'perfil_academico_id',
  })
  perfilAcademico!: PerfilAcademico | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  createdAt!: Date;
}
