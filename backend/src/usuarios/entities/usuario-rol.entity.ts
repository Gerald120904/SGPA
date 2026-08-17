import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { Rol } from '../../roles/entities/rol.entity';

@Entity({ name: 'usuario_roles' })
export class UsuarioRol {
  @PrimaryColumn({
    name: 'usuario_id',
    type: 'int',
    unsigned: true,
  })
  usuarioId!: number;

  @PrimaryColumn({
    name: 'rol_id',
    type: 'int',
    unsigned: true,
  })
  rolId!: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  createdAt!: Date;

  @ManyToOne(() => Usuario, (usuario) => usuario.usuarioRoles, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @ManyToOne(() => Rol, (rol) => rol.usuarioRoles, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'rol_id' })
  rol!: Rol;
}
