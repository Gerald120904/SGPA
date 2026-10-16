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
import { PermisoSistema } from '../constants/permisos.constant';

export type TipoExcepcion = 'CONCEDER' | 'DENEGAR';

@Entity({ name: 'usuario_permiso_excepciones' })
@Index('UQ_usuario_permiso_excepcion', ['usuarioId', 'permiso'], { unique: true })
export class UsuarioPermisoExcepcion {
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
    length: 80,
  })
  permiso!: PermisoSistema;

  @Column({
    type: 'enum',
    enum: ['CONCEDER', 'DENEGAR'],
  })
  tipo!: TipoExcepcion;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  motivo!: string | null;

  @Column({
    name: 'asignado_por_usuario_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  asignadoPorUsuarioId!: number | null;

  @ManyToOne(() => Usuario, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'usuario_id',
  })
  usuario!: Usuario;

  @ManyToOne(() => Usuario, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({
    name: 'asignado_por_usuario_id',
  })
  asignadoPorUsuario!: Usuario | null;

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
