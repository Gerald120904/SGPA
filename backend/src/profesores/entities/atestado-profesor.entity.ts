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
import { EstadoAtestadoProfesor } from '../constants/estado-atestado-profesor.constant';
import { TipoAtestadoProfesor } from '../constants/tipo-atestado-profesor.constant';

@Entity({ name: 'atestados_profesor' })
@Index('IDX_atestados_profesor', ['profesorUsuarioId'])
export class AtestadoProfesor {
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
    length: 30,
  })
  tipo!: TipoAtestadoProfesor;

  @Column({
    type: 'varchar',
    length: 180,
  })
  nombre!: string;

  @Column({
    type: 'varchar',
    length: 180,
  })
  institucion!: string;

  @Column({
    name: 'fecha_obtencion',
    type: 'date',
    nullable: true,
  })
  fechaObtencion!: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  descripcion!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: EstadoAtestadoProfesor.PENDIENTE,
  })
  estado!: EstadoAtestadoProfesor;

  @Column({
    name: 'revisado_por_usuario_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  revisadoPorUsuarioId!: number | null;

  @Column({
    name: 'fecha_revision',
    type: 'datetime',
    nullable: true,
  })
  fechaRevision!: Date | null;

  @Column({
    name: 'observacion_revision',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  observacionRevision!: string | null;

  @ManyToOne(() => Usuario, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'profesor_usuario_id',
  })
  profesor!: Usuario;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'revisado_por_usuario_id',
  })
  revisadoPor!: Usuario | null;

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
