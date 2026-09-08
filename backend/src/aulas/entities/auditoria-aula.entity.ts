import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({
  name: 'auditorias_aulas',
})
@Index('IDX_auditorias_aulas_aula_fecha', ['aulaId', 'createdAt'])
export class AuditoriaAula {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'aula_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  aulaId!: number | null;

  @Column({
    name: 'usuario_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  usuarioId!: number | null;

  @Column({
    type: 'varchar',
    length: 50,
  })
  accion!: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  entidad!: string;

  @Column({
    name: 'entidad_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  entidadId!: number | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  detalle!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  createdAt!: Date;
}
