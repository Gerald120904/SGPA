import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UsuarioRol } from '../../usuarios/entities/usuario-rol.entity';

@Entity({ name: 'roles' })
export class Rol {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
  })
  nombre!: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  descripcion!: string | null;

  @Column({
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  createdAt!: Date;

  @OneToMany(() => UsuarioRol, (usuarioRol) => usuarioRol.rol)
  usuarioRoles!: UsuarioRol[];
}
