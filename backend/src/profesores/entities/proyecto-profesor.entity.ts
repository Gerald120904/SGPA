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

@Entity({ name: 'proyectos_profesor' })
@Index('IDX_proyectos_profesor', ['profesorUsuarioId'])
export class ProyectoProfesor {
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
    type: 'varchar',
    length: 180,
  })
  nombre!: string;

  @Column({
    type: 'varchar',
    length: 180,
    nullable: true,
  })
  unidad!: string | null;

  @Column({
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  rol!: string | null;

  @Column({
    name: 'fecha_inicio',
    type: 'date',
    nullable: true,
  })
  fechaInicio!: string | null;

  @Column({
    name: 'fecha_fin',
    type: 'date',
    nullable: true,
  })
  fechaFin!: string | null;

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

  @ManyToOne(() => Usuario, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'profesor_usuario_id',
  })
  profesor!: Usuario;

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
