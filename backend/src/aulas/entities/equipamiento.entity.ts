import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'equipamientos' })
@Check('chk_equipamiento_cantidad_total', 'cantidad_total >= 0')
export class Equipamiento {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
  })
  nombre!: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  descripcion!: string | null;

  @Column({
    name: 'cantidad_total',
    type: 'smallint',
    unsigned: true,
    default: 0,
  })
  cantidadTotal!: number;

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
