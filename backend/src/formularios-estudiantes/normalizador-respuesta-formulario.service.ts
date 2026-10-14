import { BadRequestException, Injectable } from '@nestjs/common';
import { forms_v1 } from 'googleapis';
import { DatosNormalizadosFormulario } from './types/datos-normalizados-formulario.type';
import {
  MapaPreguntasFormulario,
  MapaPreguntasFormularioV1,
  MapaPreguntasFormularioV2,
  OpcionAsignaturaFormulario,
} from './types/mapa-preguntas-formulario.type';

@Injectable()
export class NormalizadorRespuestaFormularioService {
  normalizar(
    respuesta: forms_v1.Schema$FormResponse,
    mapa: MapaPreguntasFormulario,
  ): DatosNormalizadosFormulario {
    const primerNombre = this.obtenerValor(
      respuesta,
      mapa.primerNombre.questionId,
    );
    const segundoNombre = this.obtenerValor(
      respuesta,
      mapa.segundoNombre.questionId,
    );
    const primerApellido = this.obtenerValor(
      respuesta,
      mapa.primerApellido.questionId,
    );
    const segundoApellido = this.obtenerValor(
      respuesta,
      mapa.segundoApellido.questionId,
    );
    const identificacion = this.obtenerValor(
      respuesta,
      mapa.identificacion.questionId,
    );
    const correoEstudiantil = this.obtenerValor(
      respuesta,
      mapa.correoEstudiantil.questionId,
    );
    const contacto = this.obtenerValor(respuesta, mapa.contacto.questionId);
    const optativasRaw = this.obtenerValor(
      respuesta,
      mapa.optativasNoDisciplinarias.questionId,
    );
    const optativasNoDisciplinarias = this.normalizarOptativas(optativasRaw);

    if (
      !primerNombre ||
      !primerApellido ||
      !identificacion ||
      !correoEstudiantil
    ) {
      throw new BadRequestException(
        'La respuesta no contiene todos los datos obligatorios',
      );
    }

    const datosAcademicos =
      mapa.version === 2
        ? this.normalizarAcademicosV2(respuesta, mapa)
        : this.normalizarAcademicosV1(respuesta, mapa);

    return {
      primerNombre,
      segundoNombre,
      primerApellido,
      segundoApellido,
      identificacion,
      correoEstudiantil,
      contacto,
      ...datosAcademicos,
      optativasNoDisciplinarias,
      requiereRevisionOptativas: optativasNoDisciplinarias !== null,
    };
  }

  private normalizarAcademicosV1(
    respuesta: forms_v1.Schema$FormResponse,
    mapa: MapaPreguntasFormularioV1,
  ): Pick<
    DatosNormalizadosFormulario,
    'periodoIngresoId' | 'asignaturasAprobadas'
  > {
    const periodoSeleccionado = this.obtenerValor(
      respuesta,
      mapa.periodoIngreso.questionId,
    );

    if (!periodoSeleccionado) {
      throw new BadRequestException(
        'La respuesta no contiene todos los datos obligatorios',
      );
    }

    const periodoIngresoId = mapa.periodoIngreso.opciones[periodoSeleccionado];

    if (!periodoIngresoId) {
      throw new BadRequestException(
        `El período "${periodoSeleccionado}" no pertenece al formulario original`,
      );
    }

    return {
      periodoIngresoId,
      asignaturasAprobadas: this.resolverAsignaturas(
        this.obtenerValores(respuesta, mapa.asignaturasAprobadas.questionId),
        mapa.asignaturasAprobadas.opciones,
      ),
    };
  }

  private normalizarAcademicosV2(
    respuesta: forms_v1.Schema$FormResponse,
    mapa: MapaPreguntasFormularioV2,
  ): Pick<
    DatosNormalizadosFormulario,
    'periodoIngresoId' | 'asignaturasAprobadas'
  > {
    const anioRaw = this.obtenerValor(respuesta, mapa.ingreso.anio.questionId);
    const cicloRaw = this.obtenerValor(
      respuesta,
      mapa.ingreso.ciclo.questionId,
    );

    if (!anioRaw || !cicloRaw) {
      throw new BadRequestException(
        'La respuesta no contiene el año y ciclo de ingreso obligatorios',
      );
    }

    const anio = Number(anioRaw.trim());
    const coincidenciaCiclo = cicloRaw.match(/\d+/);
    const ciclo = coincidenciaCiclo ? Number(coincidenciaCiclo[0]) : NaN;
    const periodoIngresoId = mapa.ingreso.periodos[`${anio}:${ciclo}`];

    if (
      !Number.isInteger(anio) ||
      !Number.isInteger(ciclo) ||
      !periodoIngresoId
    ) {
      throw new BadRequestException(
        `La combinación de año ${anioRaw} y ciclo ${cicloRaw} no corresponde a un período académico válido del formulario.`,
      );
    }

    const asignaturasAprobadas: OpcionAsignaturaFormulario[] = [];
    const vistas = new Map<number, OpcionAsignaturaFormulario>();

    for (const grupo of mapa.asignaturasAprobadas.grupos) {
      const seleccionadas = this.resolverAsignaturas(
        this.obtenerValores(respuesta, grupo.questionId),
        grupo.opciones,
      );

      for (const asignatura of seleccionadas) {
        const existente = vistas.get(asignatura.planAsignaturaId);

        if (existente) {
          if (
            existente.cursoId !== asignatura.cursoId ||
            existente.codigo !== asignatura.codigo
          ) {
            throw new BadRequestException(
              `La asignatura ${asignatura.planAsignaturaId} posee datos contradictorios en el formulario original`,
            );
          }
          continue;
        }

        vistas.set(asignatura.planAsignaturaId, asignatura);
        asignaturasAprobadas.push(asignatura);
      }
    }

    return { periodoIngresoId, asignaturasAprobadas };
  }

  private resolverAsignaturas(
    etiquetas: string[],
    opciones: Record<string, OpcionAsignaturaFormulario>,
  ): OpcionAsignaturaFormulario[] {
    return etiquetas.map((etiqueta) => {
      const asignatura = opciones[etiqueta];

      if (!asignatura) {
        throw new BadRequestException(
          `La asignatura "${etiqueta}" no pertenece al formulario original`,
        );
      }

      return {
        planAsignaturaId: asignatura.planAsignaturaId,
        cursoId: asignatura.cursoId,
        codigo: asignatura.codigo,
      };
    });
  }

  private normalizarOptativas(valor: string | null): string | null {
    if (!valor) return null;

    const limpio = valor.trim();
    if (!limpio) return null;

    const sinContenido = new Set([
      'ninguna',
      'ninguno',
      'no',
      'n/a',
      'na',
      'no aplica',
      'no aplica.',
    ]);

    return sinContenido.has(limpio.toLowerCase()) ? null : limpio;
  }

  private obtenerValores(
    respuesta: forms_v1.Schema$FormResponse,
    questionId: string,
  ): string[] {
    const answer = respuesta.answers?.[questionId];

    return (
      answer?.textAnswers?.answers
        ?.map((item) => item.value?.trim())
        .filter((value): value is string => Boolean(value)) ?? []
    );
  }

  private obtenerValor(
    respuesta: forms_v1.Schema$FormResponse,
    questionId: string,
  ): string | null {
    return this.obtenerValores(respuesta, questionId)[0] ?? null;
  }
}
