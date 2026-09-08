import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Carrera } from '../../carreras/entities/carrera.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity({ name: 'profesor_carreras' })
@Index(
  'UQ_profesor_carreras_profesor_carrera',
  ['profesorUsuarioId', 'carreraId'],
  {
    unique: true,
  },
)
export class ProfesorCarrera {
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
    name: 'carrera_id',
    type: 'int',
    unsigned: true,
  })
  carreraId!: number;

  @ManyToOne(() => Usuario, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'profesor_usuario_id',
  })
  profesor!: Usuario;

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
}
