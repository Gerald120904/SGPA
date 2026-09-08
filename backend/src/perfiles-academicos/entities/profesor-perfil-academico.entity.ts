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
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { EstadoPerfilProfesor } from '../constants/estado-perfil-profesor.constant';
import { PerfilAcademico } from './perfil-academico.entity';

@Entity({
  name: 'profesor_perfiles_academicos',
})
@Index(
  'UQ_profesor_perfil_academico',
  ['profesorUsuarioId', 'perfilAcademicoId'],
  { unique: true },
)
export class ProfesorPerfilAcademico {
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
    name: 'perfil_academico_id',
    type: 'int',
    unsigned: true,
  })
  perfilAcademicoId!: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: EstadoPerfilProfesor.PENDIENTE,
  })
  estado!: EstadoPerfilProfesor;

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

  @ManyToOne(() => PerfilAcademico, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'perfil_academico_id',
  })
  perfilAcademico!: PerfilAcademico;

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
