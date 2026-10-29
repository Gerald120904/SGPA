<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Compilación incremental y limpieza de `dist`

`nest-cli.json` conserva `dist/tsconfig.build.tsbuildinfo` entre compilaciones.
`scripts/dist-guard.js` elimina de `dist` los archivos `.js`, `.d.ts` y sus
mapas cuando ya no existe el archivo TypeScript correspondiente. Los comandos
`build`, `start` y `start:prod` ejecutan esa comprobación antes de usar `dist`.
`start:dev` y `start:debug` la mantienen activa durante la vigilancia de `src`.

Para una compilación completamente nueva:

```bash
npm run build:clean
```

Para borrar únicamente los artefactos de compilación:

```bash
npm run clean
```

El archivo `package.json` define esos comandos y mantiene los comandos de
arranque existentes. Esta fase no cambia entidades, migraciones ni el API.

## Sincronización segura del esquema en desarrollo

Cada desarrollador configura su propio `backend/.env` a partir de `.env.example`.
Mantenga `DB_SYNCHRONIZE=false`, `NODE_ENV=development` y
`SGPA_RUNTIME_ENV=development`. Consulte la identidad del servidor local:

```sql
SELECT DATABASE(), @@port, @@datadir, @@server_uuid, @@read_only;
```

Copie los valores de base, host, puerto, directorio y UUID a las variables
`SGPA_AUTO_MIGRATE_*` del ejemplo. Establezca `SGPA_AUTO_MIGRATE_DEV=true`
para las migraciones oficiales y `SGPA_AUTO_SCHEMA_SYNC_DEV=true` para los
cambios aditivos de entidades. Configure `SGPA_SCHEMA_BACKUP_DIR` como un
directorio privado fuera del repositorio, con espacio para una copia completa
de la base. `mysqldump` debe estar en `PATH` o indicado con
`SGPA_MYSQLDUMP_PATH`.

Con esa autorización inicial, `npm run start:dev` resuelve primero las
migraciones oficiales, comprueba el esquema, crea un respaldo si hay cambios y
aplica únicamente tablas, columnas, índices y claves foráneas aditivos que
superan las comprobaciones de datos. El servidor HTTP comienza a escuchar al
terminar. Si no hay cambios, no crea respaldo ni modifica la base.

Los cambios de tipo, eliminaciones, renombramientos, columnas obligatorias sin
valor inicial en tablas pobladas y restricciones que incumplen datos existentes
requieren una migración revisada. Ante un fallo de DDL, el mensaje indica el
respaldo SQL para restauración manual; MySQL no garantiza rollback de DDL.
La única ampliación de tipo admitida es `datetime(0)` a `datetime(6)` cuando
TypeORM confirma que no cambian nulabilidad, valores por defecto ni `ON UPDATE`,
y el esquema real vuelve a comprobarse antes de escribir. Las fechas existentes
conservan sus segundos y reciben una fracción de seis ceros.

La prueba de integración `npm run test:integration:schema-sync` utiliza y
elimina solo una base temporal cuyo nombre comienza con `sgpa_sync_codex_`.
Requiere MySQL local y `mysqldump`; nunca apunta a `DB_DATABASE`.
`npm run test:integration:restored-schema` hace un dump de solo lectura de
`sgpa`, lo restaura en una base temporal `sgpa_sync_codex_copy_*`, comprueba
registros, FK e índices, ejecuta dos arranques HTTP y elimina la copia.

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
