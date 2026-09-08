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
import { DiaSemana } from '../constants/dia-semana.constant';
import { DisponibilidadProfesor } from './disponibilidad-profesor.entity';

@Entity({
  name: 'bloques_disponibilidad_profesor',
})
@Index('IDX_bloque_disponibilidad_dia', ['disponibilidadId', 'dia'])
export class BloqueDisponibilidadProfesor {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'disponibilidad_id',
    type: 'int',
    unsigned: true,
  })
  disponibilidadId!: number;

  @Column({
    type: 'varchar',
    length: 15,
  })
  dia!: DiaSemana;

  @Column({
    name: 'hora_inicio',
    type: 'time',
  })
  horaInicio!: string;

  @Column({
    name: 'hora_fin',
    type: 'time',
  })
  horaFin!: string;

  @ManyToOne(
    () => DisponibilidadProfesor,
    (disponibilidad) => disponibilidad.bloques,
    {
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'disponibilidad_id',
  })
  disponibilidad!: DisponibilidadProfesor;

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
