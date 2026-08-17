import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UsuarioRol } from './usuario-rol.entity';

@Entity({ name: 'usuarios' })
export class Usuario {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    type: 'varchar',
    length: 20,
    unique: true,
  })
  cedula!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  nombres!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  apellido1!: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  apellido2!: string | null;

  @Column({
    type: 'varchar',
    length: 150,
    unique: true,
  })
  correo!: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
  })
  passwordHash!: string;

  @Column({
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @Column({
    name: 'ultimo_acceso',
    type: 'datetime',
    nullable: true,
  })
  ultimoAcceso!: Date | null;

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

  @OneToMany(() => UsuarioRol, (usuarioRol) => usuarioRol.usuario)
  usuarioRoles!: UsuarioRol[];
}
