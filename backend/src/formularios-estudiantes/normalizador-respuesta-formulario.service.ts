import { BadRequestException, Injectable } from '@nestjs/common';
import { forms_v1 } from 'googleapis';
import { DatosNormalizadosFormulario } from './types/datos-normalizados-formulario.type';
import { MapaPreguntasFormulario } from './types/mapa-preguntas-formulario.type';

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

    const contacto = this.obtenerValor(
      respuesta,
      mapa.contacto.questionId,
    );

    const periodoSeleccionado = this.obtenerValor(
      respuesta,
      mapa.periodoIngreso.questionId,
    );

    const asignaturasSeleccionadas = this.obtenerValores(
      respuesta,
      mapa.asignaturasAprobadas.questionId,
    );

    const optativasNoDisciplinarias = this.obtenerValor(
      respuesta,
      mapa.optativasNoDisciplinarias.questionId,
    );

    if (
      !primerNombre ||
      !primerApellido ||
      !identificacion ||
      !correoEstudiantil ||
      !periodoSeleccionado
    ) {
      throw new BadRequestException(
        'La respuesta no contiene todos los datos obligatorios',
      );
    }

    const periodoIngresoId =
      mapa.periodoIngreso.opciones[periodoSeleccionado];

    if (!periodoIngresoId) {
      throw new BadRequestException(
        `El período "${periodoSeleccionado}" no pertenece al formulario original`,
      );
    }

    const asignaturasAprobadas = asignaturasSeleccionadas.map(
      (etiqueta) => {
        const asignatura =
          mapa.asignaturasAprobadas.opciones[etiqueta];

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
      },
    );

    const requiereRevisionOptativas =
      Boolean(optativasNoDisciplinarias?.trim());

    return {
      primerNombre,
      segundoNombre,
      primerApellido,
      segundoApellido,
      identificacion,
      correoEstudiantil,
      contacto,
      periodoIngresoId,
      asignaturasAprobadas,
      optativasNoDisciplinarias,
      requiereRevisionOptativas,
    };
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
