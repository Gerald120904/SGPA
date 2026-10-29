import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { classifySchemaPlan, synchronizeDevelopmentSchemaSafely } from './development-schema-sync';

describe('sincronización segura de desarrollo', () => {
  it('conserva un índice único equivalente con nombre legado', () => {
    const plan = classifySchemaPlan([
      { query: 'DROP INDEX `UQ_legado` ON `usuarios`' },
      { query: 'ALTER TABLE `usuarios` ADD UNIQUE INDEX `IDX_actual` (`correo`)' },
    ], [
      { query: 'CREATE UNIQUE INDEX `UQ_legado` ON `usuarios` (`correo`)' },
    ]);
    expect(plan.blocked).toEqual([]);
    expect(plan.executable).toEqual([]);
    expect(plan.preserved).toEqual(['usuarios.UQ_legado']);
  });

  it('bloquea una sustitución de índice si cambia la unicidad', () => {
    const plan = classifySchemaPlan([
      { query: 'DROP INDEX `UQ_legado` ON `usuarios`' },
      { query: 'CREATE INDEX `IDX_actual` ON `usuarios` (`correo`)' },
    ], [
      { query: 'CREATE UNIQUE INDEX `UQ_legado` ON `usuarios` (`correo`)' },
    ]);
    expect(plan.blocked).toContain('DROP INDEX `UQ_legado` ON `usuarios`');
  });

  it('permite solo ampliar datetime(0) a datetime(6) con las mismas reglas', () => {
    const up = 'ALTER TABLE `eventos` CHANGE `created_at` `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)';
    const down = 'ALTER TABLE `eventos` CHANGE `created_at` `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP';
    expect(classifySchemaPlan([{ query: up }], [{ query: down }]).executable).toEqual([{ query: up }]);
    expect(classifySchemaPlan([{ query: up }], []).blocked).toEqual([up]);
    expect(classifySchemaPlan([{ query: 'ALTER TABLE `eventos` CHANGE `created_at` `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)' }], [{ query: down }]).blocked).toHaveLength(1);
  });
  it('conserva una FK equivalente aunque TypeORM quiera cambiarle el nombre', () => {
    const old = 'ALTER TABLE `hijos` ADD CONSTRAINT `FK_anterior` FOREIGN KEY (`padre_id`) REFERENCES `padres`(`id`) ON DELETE CASCADE';
    const plan = classifySchemaPlan([
      { query: 'ALTER TABLE `hijos` DROP FOREIGN KEY `FK_anterior`' },
      { query: 'CREATE INDEX `IDX_hijos_estado` ON `hijos` (`estado`)' },
      { query: 'ALTER TABLE `hijos` ADD CONSTRAINT `FK_nueva` FOREIGN KEY (`padre_id`) REFERENCES `padres`(`id`) ON DELETE CASCADE' },
    ], [
      { query: old },
      { query: 'DROP INDEX `IDX_hijos_estado` ON `hijos`' },
      { query: 'ALTER TABLE `hijos` DROP FOREIGN KEY `FK_nueva`' },
    ]);

    expect(plan.blocked).toEqual([]);
    expect(plan.executable.map((item) => item.query)).toEqual([
      'CREATE INDEX `IDX_hijos_estado` ON `hijos` (`estado`)',
    ]);
    expect(plan.preserved).toEqual(['hijos.FK_anterior']);
  });

  it('bloquea un cambio en ON DELETE aunque las columnas coincidan', () => {
    const plan = classifySchemaPlan([
      { query: 'ALTER TABLE `hijos` DROP FOREIGN KEY `FK_anterior`' },
      { query: 'ALTER TABLE `hijos` ADD CONSTRAINT `FK_nueva` FOREIGN KEY (`padre_id`) REFERENCES `padres`(`id`) ON DELETE CASCADE' },
    ], [
      { query: 'ALTER TABLE `hijos` ADD CONSTRAINT `FK_anterior` FOREIGN KEY (`padre_id`) REFERENCES `padres`(`id`) ON DELETE RESTRICT' },
    ]);
    expect(plan.blocked).toContain('ALTER TABLE `hijos` DROP FOREIGN KEY `FK_anterior`');
  });

  it('bloquea un cambio en ON UPDATE aunque las columnas coincidan', () => {
    const plan = classifySchemaPlan([
      { query: 'ALTER TABLE `hijos` DROP FOREIGN KEY `FK_anterior`' },
      { query: 'ALTER TABLE `hijos` ADD CONSTRAINT `FK_nueva` FOREIGN KEY (`padre_id`) REFERENCES `padres`(`id`) ON UPDATE CASCADE' },
    ], [
      { query: 'ALTER TABLE `hijos` ADD CONSTRAINT `FK_anterior` FOREIGN KEY (`padre_id`) REFERENCES `padres`(`id`) ON UPDATE RESTRICT' },
    ]);
    expect(plan.blocked).toContain('ALTER TABLE `hijos` DROP FOREIGN KEY `FK_anterior`');
  });

  it('permite crear tablas, columnas, índices y relaciones faltantes', () => {
    const queries = [
      { query: 'CREATE TABLE `nueva` (`id` int NOT NULL) ENGINE=InnoDB' },
      { query: 'ALTER TABLE `existente` ADD `codigo` varchar(20) NULL' },
      { query: 'CREATE UNIQUE INDEX `UQ_codigo` ON `existente` (`codigo`)' },
      { query: 'ALTER TABLE `existente` ADD UNIQUE INDEX `UQ_otro` (`codigo`)' },
      { query: 'ALTER TABLE `existente` ADD CONSTRAINT `FK_x` FOREIGN KEY (`x_id`) REFERENCES `x`(`id`)' },
    ];
    expect(classifySchemaPlan(queries, []).executable).toEqual(queries);
  });

  it.each([
    'DROP TABLE `usuarios`',
    'ALTER TABLE `usuarios` DROP COLUMN `correo`',
    'ALTER TABLE `usuarios` CHANGE `correo` `email` varchar(150)',
    'ALTER TABLE `usuarios` MODIFY `correo` varchar(200)',
    'RENAME TABLE `usuarios` TO `personas`',
  ])('bloquea operación destructiva: %s', (query) => {
    const plan = classifySchemaPlan([{ query }], []);
    expect(plan.executable).toEqual([]);
    expect(plan.blocked).toEqual([query]);
  });

  it('permanece desactivada fuera de start:dev y en producción', async () => {
    const dataSource = { isInitialized: true } as DataSource;
    const production = { get: (name: string) => ({ SGPA_START_PROFILE: 'development', NODE_ENV: 'production' })[name] } as ConfigService;
    const normalStart = { get: (name: string) => ({ NODE_ENV: 'development' })[name] } as ConfigService;
    await expect(synchronizeDevelopmentSchemaSafely(dataSource, production)).resolves.toEqual([]);
    await expect(synchronizeDevelopmentSchemaSafely(dataSource, normalStart)).resolves.toEqual([]);
  });

  it('permanece desactivada en QA aunque alguien use start:dev', async () => {
    const dataSource = { isInitialized: true } as DataSource;
    const qa = { get: (name: string) => ({ SGPA_START_PROFILE: 'development', SGPA_RUNTIME_ENV: 'development', NODE_ENV: 'qa' })[name] } as ConfigService;
    await expect(synchronizeDevelopmentSchemaSafely(dataSource, qa)).resolves.toEqual([]);
  });
});
