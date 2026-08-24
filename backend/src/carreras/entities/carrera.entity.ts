import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GradoAcademico } from '../constants/grado-academico.constant';

@Entity({ name: 'carreras' })
export class Carrera {
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
  codigo!: string;

  @Column({
    type: 'varchar',
    length: 150,
    unique: true,
  })
  nombre!: string;

  @Column({
    type: 'varchar',
    length: 30,
  })
  grado!: GradoAcademico;

  @Column({
    type: 'varchar',
    length: 500,
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

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
  })
  updatedAt!: Date;
}
