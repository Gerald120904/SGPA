import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { rolActivoDePeticion } from '../auth/active-role-context';
import { EstadoPeriodoAcademico } from './constants/estado-periodo-academico.constant';
import { ActualizarPeriodoAcademicoDto } from './dto/actualizar-periodo-academico.dto';
import { CrearPeriodoAcademicoDto } from './dto/crear-periodo-academico.dto';
import { CorregirPeriodoCerradoDto } from './dto/corregir-periodo-cerrado.dto';
import { PeriodoAcademico } from './entities/periodo-academico.entity';

@Injectable()
export class PeriodosAcademicosService implements OnApplicationBootstrap, OnModuleDestroy {
  private timerTransiciones: NodeJS.Timeout | null = null;
  constructor(
    @InjectRepository(PeriodoAcademico)
    private readonly periodoRepository: Repository<PeriodoAcademico>,
    private readonly dataSource: DataSource,
  ) {}

  private generarCodigo(anio: number, ciclo: number): string {
    return `${anio}-C${ciclo}`;
  }

  private generarNombre(anio: number, ciclo: number): string {
    const nombresCiclo: Record<number, string> = {
      1: 'I Ciclo',
      2: 'II Ciclo',
      3: 'Verano',
    };

    return `${nombresCiclo[ciclo] ?? `Ciclo ${ciclo}`} ${anio}`;
  }

  private validarFechas(
    fechaInicio: string,
    fechaFin: string,
    fechaLimiteDisponibilidad: string,
  ): void {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const limiteDisponibilidad = new Date(fechaLimiteDisponibilidad);

    if (
      Number.isNaN(inicio.getTime()) ||
      Number.isNaN(fin.getTime()) ||
      Number.isNaN(limiteDisponibilidad.getTime())
    ) {
      throw new BadRequestException(
        'Las fechas del periodo académico no son válidas.',
      );
    }

    if (fin.getTime() <= inicio.getTime()) {
      throw new BadRequestException(
        'La fecha de finalización debe ser posterior a la fecha de inicio.',
      );
    }

    if (limiteDisponibilidad.getTime() >= inicio.getTime()) {
      throw new BadRequestException(
        'La fecha límite de disponibilidad docente debe ser anterior al inicio del periodo académico.',
      );
    }
  }

  private async obtenerEntidadPorId(id: number): Promise<PeriodoAcademico> {
    const periodo = await this.periodoRepository.findOne({
      where: {
        id,
      },
    });

    if (!periodo) {
      throw new NotFoundException('Periodo académico no encontrado.');
    }

    return periodo;
  }

  private async validarDuplicado(
    anio: number,
    ciclo: number,
    excluirId?: number,
  ): Promise<void> {
    const existente = await this.periodoRepository.findOne({
      where: {
        anio,
        ciclo,
      },
    });

    if (existente && existente.id !== excluirId) {
      const nombresCiclo: Record<number, string> = {
        1: 'I Ciclo',
        2: 'II Ciclo',
        3: 'Verano',
      };

      const nombreCiclo = nombresCiclo[ciclo] ?? `Ciclo ${ciclo}`;

      throw new ConflictException(
        `Ya existe el ${nombreCiclo} del año ${anio}.`,
      );
    }
  }

  private async validarUnicoPeriodoEnEstado(
    estado: EstadoPeriodoAcademico,
    excluirId?: number,
  ): Promise<void> {
    const existente = await this.periodoRepository.findOne({
      where: {
        estado,
      },
    });

    if (!existente || existente.id === excluirId) {
      return;
    }

    if (estado === EstadoPeriodoAcademico.EN_PREPARACION) {
      throw new ConflictException(
        `Ya existe un periodo académico en preparación: ${existente.codigo}.`,
      );
    }

    if (estado === EstadoPeriodoAcademico.EN_CURSO) {
      throw new ConflictException(
        `Ya existe un periodo académico en curso: ${existente.codigo}.`,
      );
    }
  }

  private validarPeriodoEditable(periodo: PeriodoAcademico): void {
    if (periodo.estado === EstadoPeriodoAcademico.EN_CURSO) {
      throw new BadRequestException(
        'No se puede modificar un periodo académico que ya está en curso.',
      );
    }

    if (periodo.estado === EstadoPeriodoAcademico.CERRADO) {
      throw new BadRequestException(
        'No se puede modificar un periodo académico cerrado.',
      );
    }

    if (periodo.estado === EstadoPeriodoAcademico.CANCELADO) {
      throw new BadRequestException(
        'No se puede modificar un periodo académico cancelado.',
      );
    }
  }

  private validarCambiosEnPreparacion(
    periodo: PeriodoAcademico,
    dto: ActualizarPeriodoAcademicoDto,
  ): void {
    if (periodo.estado !== EstadoPeriodoAcademico.EN_PREPARACION) {
      return;
    }

    const modificaEstructura =
      dto.anio !== undefined ||
      dto.ciclo !== undefined ||
      dto.fechaInicio !== undefined ||
      dto.fechaFin !== undefined ||
      dto.fechaLimiteDisponibilidad !== undefined;

    if (modificaEstructura) {
      throw new BadRequestException(
        'Cuando el periodo académico está en preparación únicamente pueden modificarse las observaciones.',
      );
    }
  }

  private validarTransicionEstado(
    estadoActual: EstadoPeriodoAcademico,
    nuevoEstado: EstadoPeriodoAcademico,
  ): void {
    if (estadoActual === nuevoEstado) {
      return;
    }

    const transicionesPermitidas: Record<
      EstadoPeriodoAcademico,
      EstadoPeriodoAcademico[]
    > = {
      [EstadoPeriodoAcademico.BORRADOR]: [
        EstadoPeriodoAcademico.EN_PREPARACION,
        EstadoPeriodoAcademico.CANCELADO,
      ],
      [EstadoPeriodoAcademico.EN_PREPARACION]: [
        EstadoPeriodoAcademico.EN_CURSO,
        EstadoPeriodoAcademico.CANCELADO,
      ],
      [EstadoPeriodoAcademico.EN_CURSO]: [EstadoPeriodoAcademico.CERRADO],
      [EstadoPeriodoAcademico.CERRADO]: [],
      [EstadoPeriodoAcademico.CANCELADO]: [],
    };

    const permitidos = transicionesPermitidas[estadoActual];

    if (!permitidos.includes(nuevoEstado)) {
      throw new BadRequestException(
        `No se puede cambiar el periodo de ${estadoActual} a ${nuevoEstado}.`,
      );
    }
  }

  private obtenerFechaActualLocal(): string {
    // No depender del timezone de la PC del profesor ni del servidor.
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const fecha = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value;
    return `${fecha('year')}-${fecha('month')}-${fecha('day')}`;
  }

  private validarFechaParaTransicion(
    periodo: PeriodoAcademico,
    nuevoEstado: EstadoPeriodoAcademico,
  ): void {
    const motivo = this.obtenerMotivoBloqueoFecha(periodo, nuevoEstado);

    if (!motivo) {
      return;
    }

    if (
      nuevoEstado === EstadoPeriodoAcademico.EN_PREPARACION
    ) {
      throw new BadRequestException(
        'No se puede pasar el periodo a preparación porque la fecha límite de disponibilidad docente ya venció.',
      );
    }

    if (
      nuevoEstado === EstadoPeriodoAcademico.EN_CURSO
    ) {
      throw new BadRequestException(
        'No se puede iniciar el periodo académico antes de su fecha de inicio.',
      );
    }

    throw new BadRequestException(
      'No se puede cerrar el periodo académico antes de su fecha de finalización.',
    );
  }

  private obtenerMotivoBloqueoFecha(
    periodo: PeriodoAcademico,
    nuevoEstado: EstadoPeriodoAcademico,
  ): string | null {
    const hoy = this.obtenerFechaActualLocal();

    if (
      nuevoEstado === EstadoPeriodoAcademico.EN_PREPARACION &&
      hoy > periodo.fechaLimiteDisponibilidad
    ) {
      return 'La fecha límite de disponibilidad docente ya venció.';
    }

    if (
      nuevoEstado === EstadoPeriodoAcademico.EN_CURSO &&
      hoy < periodo.fechaInicio
    ) {
      return `El periodo podrá iniciarse a partir del ${periodo.fechaInicio}.`;
    }

    if (
      nuevoEstado === EstadoPeriodoAcademico.CERRADO &&
      hoy < periodo.fechaFin
    ) {
      return `El periodo podrá cerrarse a partir del ${periodo.fechaFin}.`;
    }

    return null;
  }

  private obtenerTransicionesInterfaz(periodo: PeriodoAcademico) {
    const transiciones: Record<
      EstadoPeriodoAcademico,
      EstadoPeriodoAcademico[]
    > = {
      [EstadoPeriodoAcademico.BORRADOR]: [
        EstadoPeriodoAcademico.EN_PREPARACION,
        EstadoPeriodoAcademico.CANCELADO,
      ],
      [EstadoPeriodoAcademico.EN_PREPARACION]: [
        EstadoPeriodoAcademico.EN_CURSO,
        EstadoPeriodoAcademico.CANCELADO,
      ],
      [EstadoPeriodoAcademico.EN_CURSO]: [
        EstadoPeriodoAcademico.CERRADO,
      ],
      [EstadoPeriodoAcademico.CERRADO]: [],
      [EstadoPeriodoAcademico.CANCELADO]: [],
    };

    return (transiciones[periodo.estado] ?? []).map((estado) => {
      const motivo = this.obtenerMotivoBloqueoFecha(periodo, estado);

      return {
        estado,
        disponible: motivo === null,
        motivo,
      };
    });
  }

  private relanzarErrorPersistencia(error: unknown): never {
    const codigo =
      (
        error as {
          driverError?: {
            code?: string;
          };
        }
      )?.driverError?.code ?? (error as { code?: string })?.code;

    if (codigo === 'ER_DUP_ENTRY') {
      throw new ConflictException(
        'Ya existe un periodo académico para ese año y ciclo.',
      );
    }

    throw error;
  }

  async listar() {
    const periodos = await this.periodoRepository.find({
      order: {
        anio: 'DESC',
        ciclo: 'DESC',
      },
    });

    return periodos.map((periodo) => ({
      ...periodo,
      transicionesEstado: this.obtenerTransicionesInterfaz(periodo),
    }));
  }

  async obtenerPorId(id: number): Promise<PeriodoAcademico> {
    return this.obtenerEntidadPorId(id);
  }

  async crear(dto: CrearPeriodoAcademicoDto): Promise<PeriodoAcademico> {
    await this.validarDuplicado(dto.anio, dto.ciclo);

    this.validarFechas(
      dto.fechaInicio,
      dto.fechaFin,
      dto.fechaLimiteDisponibilidad,
    );

    const periodo = this.periodoRepository.create({
      codigo: this.generarCodigo(dto.anio, dto.ciclo),
      nombre: this.generarNombre(dto.anio, dto.ciclo),
      anio: dto.anio,
      ciclo: dto.ciclo,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      fechaLimiteDisponibilidad: dto.fechaLimiteDisponibilidad,
      ...(dto.fechaAperturaActualizacionDocente ? { fechaAperturaActualizacionDocente: dto.fechaAperturaActualizacionDocente } : {}),
      ...(dto.fechaLimiteEntregaDocente ? { fechaLimiteEntregaDocente: dto.fechaLimiteEntregaDocente } : {}),
      ...(dto.fechaLimiteRevisionDocente ? { fechaLimiteRevisionDocente: dto.fechaLimiteRevisionDocente } : {}),
      estado: EstadoPeriodoAcademico.BORRADOR,
      observaciones: dto.observaciones?.trim() || null,
    });

    try {
      return await this.periodoRepository.save(periodo);
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }
  }

  async actualizar(
    id: number,
    dto: ActualizarPeriodoAcademicoDto,
  ): Promise<PeriodoAcademico> {
    const periodo = await this.obtenerEntidadPorId(id);

    this.validarPeriodoEditable(periodo);
    this.validarCambiosEnPreparacion(periodo, dto);

    const nuevoAnio = dto.anio ?? periodo.anio;
    const nuevoCiclo = dto.ciclo ?? periodo.ciclo;
    const nuevaFechaInicio = dto.fechaInicio ?? periodo.fechaInicio;
    const nuevaFechaFin = dto.fechaFin ?? periodo.fechaFin;
    const nuevaFechaLimiteDisponibilidad =
      dto.fechaLimiteDisponibilidad ?? periodo.fechaLimiteDisponibilidad;

    await this.validarDuplicado(nuevoAnio, nuevoCiclo, periodo.id);

    this.validarFechas(
      nuevaFechaInicio,
      nuevaFechaFin,
      nuevaFechaLimiteDisponibilidad,
    );

    periodo.anio = nuevoAnio;
    periodo.ciclo = nuevoCiclo;
    periodo.codigo = this.generarCodigo(nuevoAnio, nuevoCiclo);
    periodo.nombre = this.generarNombre(nuevoAnio, nuevoCiclo);
    periodo.fechaInicio = nuevaFechaInicio;
    periodo.fechaFin = nuevaFechaFin;
    periodo.fechaLimiteDisponibilidad = nuevaFechaLimiteDisponibilidad;

    if (dto.observaciones !== undefined) {
      periodo.observaciones = dto.observaciones?.trim() || null;
    }
    if (dto.fechaAperturaActualizacionDocente !== undefined) {
      periodo.fechaAperturaActualizacionDocente = dto.fechaAperturaActualizacionDocente || null;
    }
    if (dto.fechaLimiteEntregaDocente !== undefined) {
      periodo.fechaLimiteEntregaDocente = dto.fechaLimiteEntregaDocente || null;
    }
    if (dto.fechaLimiteRevisionDocente !== undefined) {
      periodo.fechaLimiteRevisionDocente = dto.fechaLimiteRevisionDocente || null;
    }

    try {
      return await this.periodoRepository.save(periodo);
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }
  }

  async corregirCerradoExcepcionalmente(
    usuarioId: number,
    id: number,
    dto: CorregirPeriodoCerradoDto,
  ): Promise<PeriodoAcademico> {
    if (rolActivoDePeticion(usuarioId) !== RolSistema.ADMIN_GLOBAL) {
      throw new ForbiddenException('Solo el administrador global puede corregir un período cerrado.');
    }
    const motivo = dto.motivo?.trim();
    if (!motivo || motivo.length < 10 || motivo.length > 500) {
      throw new BadRequestException('Debe indicar un motivo de al menos 10 caracteres.');
    }
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(PeriodoAcademico);
        const periodo = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        if (!periodo) throw new NotFoundException('Período académico no encontrado.');
        if (periodo.estado !== EstadoPeriodoAcademico.CERRADO) {
          throw new BadRequestException('La corrección excepcional solo corresponde a períodos cerrados.');
        }
        if (rolActivoDePeticion(usuarioId) !== RolSistema.ADMIN_GLOBAL) {
          throw new ForbiddenException('La autoridad global ya no está vigente.');
        }
        const campos = [
          'anio', 'ciclo', 'fechaInicio', 'fechaFin', 'fechaLimiteDisponibilidad',
          'fechaAperturaActualizacionDocente', 'fechaLimiteEntregaDocente',
          'fechaLimiteRevisionDocente', 'observaciones',
        ] as const;
        const cambios: Record<string, { anterior: unknown; nuevo: unknown }> = {};
        for (const campo of campos) {
          const solicitado = dto[campo];
          if (solicitado === undefined) continue;
          const nuevo = campo === 'observaciones'
            ? solicitado == null ? null : String(solicitado).trim() || null
            : solicitado;
          if (periodo[campo] !== nuevo) {
            cambios[campo] = { anterior: periodo[campo], nuevo };
            (periodo as unknown as Record<string, unknown>)[campo] = nuevo;
          }
        }
        if (Object.keys(cambios).length === 0) {
          throw new BadRequestException('Indique al menos un cambio efectivo para el período cerrado.');
        }
        this.validarFechas(periodo.fechaInicio, periodo.fechaFin, periodo.fechaLimiteDisponibilidad);
        const codigo = this.generarCodigo(periodo.anio, periodo.ciclo);
        const nombre = this.generarNombre(periodo.anio, periodo.ciclo);
        if (periodo.codigo !== codigo) cambios.codigo = { anterior: periodo.codigo, nuevo: codigo };
        if (periodo.nombre !== nombre) cambios.nombre = { anterior: periodo.nombre, nuevo: nombre };
        periodo.codigo = codigo;
        periodo.nombre = nombre;
        await repo.save(periodo);
        await manager.query(`INSERT INTO auditoria_periodos_excepcionales
          (periodo_id, usuario_id, motivo, cambios_json, created_at) VALUES (?, ?, ?, ?, NOW(6))`,
        [id, usuarioId, motivo, JSON.stringify(cambios)]);
        return periodo;
      });
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }
  }

  async cambiarEstado(
    id: number,
    nuevoEstado: EstadoPeriodoAcademico,
  ): Promise<PeriodoAcademico> {
    const periodo = await this.obtenerEntidadPorId(id);

    this.validarTransicionEstado(periodo.estado, nuevoEstado);

    if (
      periodo.estado !== nuevoEstado &&
      (nuevoEstado === EstadoPeriodoAcademico.EN_PREPARACION ||
        nuevoEstado === EstadoPeriodoAcademico.EN_CURSO)
    ) {
      await this.validarUnicoPeriodoEnEstado(nuevoEstado, periodo.id);
    }

    if (periodo.estado !== nuevoEstado) {
      this.validarFechaParaTransicion(periodo, nuevoEstado);
    }

    periodo.estado = nuevoEstado;

    return this.periodoRepository.save(periodo);
  }

  async ejecutarTransicionesAutomaticas(): Promise<{
    cerrados: string[];
    iniciados: string[];
  }> {
    const hoy = this.obtenerFechaActualLocal();
    const cerrados: string[] = [];
    const iniciados: string[] = [];

    // 1. Cerrar período EN_CURSO si hoy > fechaFin
    const periodoEnCurso = await this.periodoRepository.findOne({
      where: { estado: EstadoPeriodoAcademico.EN_CURSO },
    });
    if (periodoEnCurso && hoy > periodoEnCurso.fechaFin) {
      periodoEnCurso.estado = EstadoPeriodoAcademico.CERRADO;
      await this.periodoRepository.save(periodoEnCurso);
      cerrados.push(periodoEnCurso.codigo);
    }

    // 2. Si no hay período EN_CURSO (o se cerró), iniciar período EN_PREPARACION si hoy >= fechaInicio
    const cursoActivo = await this.periodoRepository.findOne({
      where: { estado: EstadoPeriodoAcademico.EN_CURSO },
    });
    if (!cursoActivo) {
      const periodoEnPrep = await this.periodoRepository.findOne({
        where: { estado: EstadoPeriodoAcademico.EN_PREPARACION },
      });
      if (periodoEnPrep && hoy >= periodoEnPrep.fechaInicio && hoy <= periodoEnPrep.fechaFin) {
        periodoEnPrep.estado = EstadoPeriodoAcademico.EN_CURSO;
        await this.periodoRepository.save(periodoEnPrep);
        iniciados.push(periodoEnPrep.codigo);
      }
    }

    return { cerrados, iniciados };
  }

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.SGPA_TEST_MODE?.trim().toLowerCase() === 'true' || process.env.NODE_ENV === 'test' ||
        ['sgpa_test', 'sgpa_isolated_audit'].includes(process.env.DB_DATABASE ?? '')) {
      return;
    }
    try {
      await this.ejecutarTransicionesAutomaticas();
    } catch {
      // Ignorar excepciones al arranque para no impedir inicio del servicio
    }
    this.timerTransiciones = setInterval(async () => {
      try {
        await this.ejecutarTransicionesAutomaticas();
      } catch {
        // Ignorar errores transitorios de temporizador
      }
    }, 60 * 60 * 1000);
    if (typeof this.timerTransiciones.unref === 'function') {
      this.timerTransiciones.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.timerTransiciones) {
      clearInterval(this.timerTransiciones);
      this.timerTransiciones = null;
    }
  }
}
