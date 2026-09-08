import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrigenAula } from '../constants/origen-aula.constant';
import { TipoAula } from '../constants/tipo-aula.constant';
import { TipoMobiliarioAula } from '../constants/tipo-mobiliario-aula.constant';
import { AulaEquipamiento } from './aula-equipamiento.entity';

@Entity({ name: 'aulas' })
@Check('chk_aula_capacidad', 'capacidad > 0')
export class Aula {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    type: 'varchar',
    length: 30,
    unique: true,
  })
  codigo!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  nombre!: string;

  @Column({
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  ubicacion!: string | null;

  @Column({
    type: 'smallint',
    unsigned: true,
  })
  capacidad!: number;

  @Column({
    type: 'varchar',
    length: 30,
  })
  tipo!: TipoAula;

  @Column({
    name: 'tipo_mobiliario',
    type: 'varchar',
    length: 30,
    default: TipoMobiliarioAula.SIN_ESPECIFICAR,
  })
  tipoMobiliario!: TipoMobiliarioAula;

  @Column({
    type: 'varchar',
    length: 20,
  })
  origen!: OrigenAula;

  @Column({
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @OneToMany(
    () => AulaEquipamiento,
    (aulaEquipamiento) => aulaEquipamiento.aula,
  )
  equipamientos!: AulaEquipamiento[];

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
