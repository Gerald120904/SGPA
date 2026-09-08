import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { DisponibilidadProfesor } from './disponibilidad-profesor.entity';

@Entity({
  name: 'historial_disponibilidad_profesor',
})
@Index('IDX_historial_disponibilidad', ['disponibilidadId'])
export class HistorialDisponibilidadProfesor {
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
    name: 'usuario_id',
    type: 'int',
    unsigned: true,
  })
  usuarioId!: number;

  @Column({
    type: 'varchar',
    length: 30,
  })
  accion!: string;

  @Column({
    name: 'datos_anteriores',
    type: 'json',
    nullable: true,
  })
  datosAnteriores!: unknown | null;

  @Column({
    name: 'datos_nuevos',
    type: 'json',
    nullable: true,
  })
  datosNuevos!: unknown | null;

  @ManyToOne(() => DisponibilidadProfesor, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'disponibilidad_id',
  })
  disponibilidad!: DisponibilidadProfesor;

  @ManyToOne(() => Usuario, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'usuario_id',
  })
  usuario!: Usuario;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  createdAt!: Date;
}
