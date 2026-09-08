import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { PermisoSistema } from '../constants/permisos.constant';

@Entity({ name: 'usuario_permisos' })
@Index('UQ_usuario_permiso', ['usuarioId', 'permiso'], { unique: true })
export class UsuarioPermiso {
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
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @ManyToOne(() => Usuario, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'usuario_id',
  })
  usuario!: Usuario;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  createdAt!: Date;
}
