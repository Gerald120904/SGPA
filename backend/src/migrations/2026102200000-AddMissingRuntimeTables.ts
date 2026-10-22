import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { assertTableCompatible, ExpectedCheck, inspectChecks } from './schema-compatibility';

export function missingRuntimeTables(): Array<{ table: Table; checks?: ExpectedCheck[] }> {
  return [
    { table: new Table({ name: 'usuario_permiso_excepciones', columns: [
      { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'usuario_id', type: 'int', unsigned: true }, { name: 'permiso', type: 'varchar', length: '80' },
      { name: 'tipo', type: 'enum', enum: ['CONCEDER', 'DENEGAR'] }, { name: 'motivo', type: 'varchar', length: '255', isNullable: true },
      { name: 'asignado_por_usuario_id', type: 'int', unsigned: true, isNullable: true },
      { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
      { name: 'updated_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' },
    ], indices: [{ name: 'UQ_usuario_permiso_excepcion', columnNames: ['usuario_id', 'permiso'], isUnique: true }], foreignKeys: [
      { name: 'FK_excepcion_usuario', columnNames: ['usuario_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      { name: 'FK_excepcion_asignador', columnNames: ['asignado_por_usuario_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'SET NULL', onUpdate: 'CASCADE' },
    ] }) },
    { table: new Table({ name: 'grupos', columns: [
      { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'curso_id', type: 'int', unsigned: true }, { name: 'periodo_id', type: 'int', unsigned: true },
      { name: 'profesor_id', type: 'int', unsigned: true, isNullable: true }, { name: 'numero_grupo', type: 'varchar', length: '20' },
      { name: 'tipo_grupo', type: 'varchar', length: '30' }, { name: 'cupo_maximo', type: 'smallint', unsigned: true },
      { name: 'estado', type: 'varchar', length: '30' }, { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
      { name: 'updated_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' },
    ], indices: [
      { name: 'uq_grupo_curso_periodo', columnNames: ['curso_id', 'periodo_id', 'numero_grupo'], isUnique: true },
      { name: 'idx_grupo_periodo', columnNames: ['periodo_id'] }, { name: 'fk_grupo_profesor', columnNames: ['profesor_id'] },
    ], foreignKeys: [
      { name: 'FK_grupo_curso', columnNames: ['curso_id'], referencedTableName: 'cursos', referencedColumnNames: ['id'], onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
      { name: 'FK_grupo_periodo', columnNames: ['periodo_id'], referencedTableName: 'periodos_academicos', referencedColumnNames: ['id'], onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    ] }), checks: [{ name: 'chk_grupo_cupo', expression: 'cupo_maximo > 0' }] },
    { table: new Table({ name: 'horarios_grupo', columns: [
      { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'grupo_id', type: 'int', unsigned: true }, { name: 'aula_id', type: 'int', unsigned: true, isNullable: true },
      { name: 'dia_semana', type: 'tinyint', unsigned: true }, { name: 'hora_inicio', type: 'time' }, { name: 'hora_fin', type: 'time' },
      { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
      { name: 'updated_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' },
    ], indices: [{ name: 'fk_horario_grupo_grupo', columnNames: ['grupo_id'] }, { name: 'fk_horario_grupo_aula', columnNames: ['aula_id'] }], foreignKeys: [
      { name: 'FK_horario_grupo', columnNames: ['grupo_id'], referencedTableName: 'grupos', referencedColumnNames: ['id'], onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      { name: 'FK_horario_aula', columnNames: ['aula_id'], referencedTableName: 'aulas', referencedColumnNames: ['id'], onDelete: 'SET NULL', onUpdate: 'CASCADE' },
    ] }), checks: [
      { name: 'chk_horario_grupo_dia', expression: 'dia_semana BETWEEN 1 AND 7' },
      { name: 'chk_horario_grupo_horas', expression: 'hora_inicio < hora_fin' },
    ] },
  ];
}

export class AddMissingRuntimeTables2026102200000 implements MigrationInterface {
  name = 'AddMissingRuntimeTables2026102200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const name of ['usuarios', 'cursos', 'periodos_academicos', 'aulas']) {
      if (!(await queryRunner.hasTable(name))) throw new Error(`Falta la tabla requerida ${name}; no es un instalador inicial.`);
    }
    const definitions = missingRuntimeTables();
    const existing = new Set<string>();
    const missingChecks = new Set<string>();
    for (const definition of definitions) {
      if (!(await queryRunner.hasTable(definition.table.name))) continue;
      await assertTableCompatible(queryRunner, definition.table);
      for (const name of await inspectChecks(queryRunner, definition.table.name, definition.checks ?? [], true)) missingChecks.add(name);
      existing.add(definition.table.name);
    }
    const checkData = async (table: string, expression: string, constraint: string) => {
      if (!missingChecks.has(constraint)) return;
      const [row] = (await queryRunner.query(
        `SELECT COUNT(*) AS total FROM \`${table}\` WHERE NOT (${expression})`,
      )) as Array<{ total: number | string }>;
      if (Number(row?.total) > 0) throw new Error(`No se puede agregar ${constraint}: existen registros que incumplen ${expression}.`);
    };
    await checkData('grupos', 'cupo_maximo > 0', 'chk_grupo_cupo');
    await checkData('horarios_grupo', 'dia_semana BETWEEN 1 AND 7', 'chk_horario_grupo_dia');
    await checkData('horarios_grupo', 'hora_inicio < hora_fin', 'chk_horario_grupo_horas');
    for (const definition of definitions) {
      if (!existing.has(definition.table.name)) await queryRunner.createTable(definition.table);
    }
    if (!existing.has('grupos') || missingChecks.has('chk_grupo_cupo')) await queryRunner.query('ALTER TABLE `grupos` ADD CONSTRAINT `chk_grupo_cupo` CHECK (cupo_maximo > 0)');
    if (!existing.has('horarios_grupo') || missingChecks.has('chk_horario_grupo_dia')) {
      await queryRunner.query('ALTER TABLE `horarios_grupo` ADD CONSTRAINT `chk_horario_grupo_dia` CHECK (dia_semana BETWEEN 1 AND 7)');
    }
    if (!existing.has('horarios_grupo') || missingChecks.has('chk_horario_grupo_horas')) {
      await queryRunner.query('ALTER TABLE `horarios_grupo` ADD CONSTRAINT `chk_horario_grupo_horas` CHECK (hora_inicio < hora_fin)');
    }
  }

  async down(): Promise<void> {
    throw new Error('No se eliminan tablas que pueden contener datos; prepare una recuperación controlada desde el respaldo verificado.');
  }
}
