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
import { Carrera } from '../../carreras/entities/carrera.entity';

@Entity({ name: 'planes_estudio' })
@Index('UQ_planes_estudio_carrera_codigo', ['carreraId', 'codigo'], {
  unique: true,
})
export class PlanEstudio {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'carrera_id',
    type: 'int',
    unsigned: true,
  })
  carreraId!: number;

  @Column({
    type: 'varchar',
    length: 40,
  })
  codigo!: string;

  @Column({
    type: 'varchar',
    length: 180,
  })
  nombre!: string;

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

  @ManyToOne(() => Carrera, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'carrera_id',
  })
  carrera!: Carrera;

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
