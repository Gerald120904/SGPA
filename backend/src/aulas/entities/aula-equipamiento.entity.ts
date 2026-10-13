import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Aula } from './aula.entity';
import { Equipamiento } from './equipamiento.entity';

@Entity({ name: 'aula_equipamientos' })
@Index(
  'UQ_aula_equipamientos_aula_equipamiento',
  ['aulaId', 'equipamientoId'],
  { unique: true },
)
@Check('chk_aula_equipamiento_cantidad_asignada', 'cantidad_asignada > 0')
export class AulaEquipamiento {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'aula_id',
    type: 'int',
    unsigned: true,
  })
  aulaId!: number;

  @Column({
    name: 'equipamiento_id',
    type: 'int',
    unsigned: true,
  })
  equipamientoId!: number;

  @Column({
    name: 'cantidad_asignada',
    type: 'smallint',
    unsigned: true,
  })
  cantidadAsignada!: number;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  observaciones!: string | null;

  @ManyToOne(() => Aula, (aula) => aula.equipamientos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'aula_id' })
  aula!: Aula;

  @ManyToOne(() => Equipamiento, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'equipamiento_id' })
  equipamiento!: Equipamiento;

  @Column({
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @Column({
    name: 'asignado_en',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  asignadoEn!: Date;

  @Column({
    name: 'retirado_en',
    type: 'datetime',
    nullable: true,
  })
  retiradoEn!: Date | null;

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
