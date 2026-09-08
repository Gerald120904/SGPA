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
import { TipoReservaAula } from '../constants/tipo-reserva-aula.constant';
import { Aula } from './aula.entity';

@Entity({ name: 'reservas_aulas' })
@Index('IDX_reservas_aulas_aula_inicio_fin', [
  'aulaId',
  'fechaHoraInicio',
  'fechaHoraFin',
])
@Check('chk_reserva_aula_fechas', 'fecha_hora_inicio < fecha_hora_fin')
export class ReservaAula {
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
    type: 'varchar',
    length: 30,
  })
  tipo!: TipoReservaAula;

  @Column({
    type: 'varchar',
    length: 150,
  })
  titulo!: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  descripcion!: string | null;

  @Column({
    name: 'fecha_hora_inicio',
    type: 'datetime',
  })
  fechaHoraInicio!: Date;

  @Column({
    name: 'fecha_hora_fin',
    type: 'datetime',
  })
  fechaHoraFin!: Date;

  @Column({
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @ManyToOne(() => Aula, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'aula_id',
  })
  aula!: Aula;

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
