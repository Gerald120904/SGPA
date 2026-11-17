/**
 * SGPA — Controles compactos de hora y fecha/hora para formularios de Aulas.
 */

import { escapeHtml } from '../../utils/html.js';
import {
  normalizarHoraFormulario,
  separarFechaHoraFormulario,
} from './aulas.helpers.js';

export function renderizarControlHoraCompacto(id, valor = '') {
  const horaNormalizada = normalizarHoraFormulario(valor);
  const [hora = '', minuto = ''] = horaNormalizada
    ? horaNormalizada.split(':')
    : ['', ''];

  return `
    <div
      class="aulas-time-compact"
      data-aulas-time-control
      data-target-id="${id}"
    >
      <div class="aulas-time-part">
        <input
          type="text"
          inputmode="numeric"
          maxlength="2"
          value="${escapeHtml(hora)}"
          placeholder="HH"
          aria-label="Hora"
          data-time-hour
          autocomplete="off"
        >
        <small>Hora</small>
      </div>

      <span
        class="aulas-time-separator"
        aria-hidden="true"
      >:</span>

      <div class="aulas-time-part">
        <input
          type="text"
          inputmode="numeric"
          maxlength="2"
          value="${escapeHtml(minuto)}"
          placeholder="MM"
          aria-label="Minutos"
          data-time-minute
          autocomplete="off"
        >
        <small>Min</small>
      </div>

      <input
        id="${id}"
        type="hidden"
        value="${escapeHtml(horaNormalizada)}"
      >
    </div>

    <small class="aulas-time-help">
      Formato de 24 horas. Ejemplo: 07:30 o 18:45.
    </small>
  `;
}

export function renderizarControlFechaHoraCompacto(id, valor = '') {
  const partes = separarFechaHoraFormulario(valor);
  const [hora = '', minuto = ''] = partes.hora
    ? partes.hora.split(':')
    : ['', ''];

  return `
    <div
      class="aulas-datetime-compact"
      data-aulas-datetime-control
      data-target-id="${id}"
    >
      <input
        type="date"
        value="${escapeHtml(partes.fecha)}"
        aria-label="Fecha"
        data-datetime-date
      >

      <div class="aulas-time-compact is-inline">
        <div class="aulas-time-part">
          <input
            type="text"
            inputmode="numeric"
            maxlength="2"
            value="${escapeHtml(hora)}"
            placeholder="HH"
            aria-label="Hora"
            data-time-hour
            autocomplete="off"
          >
          <small>Hora</small>
        </div>

        <span
          class="aulas-time-separator"
          aria-hidden="true"
        >:</span>

        <div class="aulas-time-part">
          <input
            type="text"
            inputmode="numeric"
            maxlength="2"
            value="${escapeHtml(minuto)}"
            placeholder="MM"
            aria-label="Minutos"
            data-time-minute
            autocomplete="off"
          >
          <small>Min</small>
        </div>
      </div>

      <input
        id="${id}"
        type="hidden"
        value="${escapeHtml(
          partes.fecha && partes.hora ? `${partes.fecha}T${partes.hora}` : '',
        )}"
      >
    </div>
  `;
}

export function prepararParteHora(input, maximo) {
  if (!input) {
    return '';
  }

  const valor = String(input.value || '')
    .replace(/\D/g, '')
    .slice(0, 2);

  input.value = valor;

  if (!valor) {
    input.classList.remove('is-invalid');
    return '';
  }

  const numero = Number(valor);
  const valido =
    Number.isInteger(numero) && numero >= 0 && numero <= maximo;

  input.classList.toggle('is-invalid', !valido);

  if (!valido) {
    return '';
  }

  return String(numero).padStart(2, '0');
}

export function sincronizarControlHoraCompacto(control) {
  const targetId = control?.dataset?.targetId;

  if (!targetId) {
    return;
  }

  const hidden = document.getElementById(targetId);
  const horaInput = control.querySelector('[data-time-hour]');
  const minutoInput = control.querySelector('[data-time-minute]');

  if (!hidden || !horaInput || !minutoInput) {
    return;
  }

  const hora = prepararParteHora(horaInput, 23);
  const minuto = prepararParteHora(minutoInput, 59);

  hidden.value = hora && minuto ? `${hora}:${minuto}` : '';
}

export function sincronizarControlFechaHoraCompacto(control) {
  const targetId = control?.dataset?.targetId;

  if (!targetId) {
    return;
  }

  const hidden = document.getElementById(targetId);
  const fechaInput = control.querySelector('[data-datetime-date]');
  const horaInput = control.querySelector('[data-time-hour]');
  const minutoInput = control.querySelector('[data-time-minute]');

  if (!hidden || !fechaInput || !horaInput || !minutoInput) {
    return;
  }

  const hora = prepararParteHora(horaInput, 23);
  const minuto = prepararParteHora(minutoInput, 59);

  hidden.value =
    fechaInput.value && hora && minuto
      ? `${fechaInput.value}T${hora}:${minuto}`
      : '';
}

export function inicializarControlesHorario(root = document) {
  root.querySelectorAll('[data-aulas-time-control]').forEach((control) => {
    if (control.dataset?.aulasHorarioInicializado === '1') {
      sincronizarControlHoraCompacto(control);
      return;
    }

    if (control.dataset) {
      control.dataset.aulasHorarioInicializado = '1';
    }

    const sincronizar = () => sincronizarControlHoraCompacto(control);

    control
      .querySelectorAll('[data-time-hour], [data-time-minute]')
      .forEach((input) => {
        input.addEventListener('input', sincronizar);

        input.addEventListener('blur', () => {
          sincronizar();

          if (input.value && !input.classList.contains('is-invalid')) {
            input.value = String(Number(input.value)).padStart(2, '0');
            sincronizar();
          }
        });
      });

    sincronizar();
  });

  root
    .querySelectorAll('[data-aulas-datetime-control]')
    .forEach((control) => {
      if (control.dataset?.aulasHorarioInicializado === '1') {
        sincronizarControlFechaHoraCompacto(control);
        return;
      }

      if (control.dataset) {
        control.dataset.aulasHorarioInicializado = '1';
      }

      const sincronizar = () => sincronizarControlFechaHoraCompacto(control);

      control
        .querySelectorAll(
          '[data-datetime-date], [data-time-hour], [data-time-minute]',
        )
        .forEach((input) => {
          input.addEventListener('input', sincronizar);
          input.addEventListener('change', sincronizar);

          input.addEventListener('blur', () => {
            sincronizar();

            if (
              input.matches('[data-time-hour], [data-time-minute]') &&
              input.value &&
              !input.classList.contains('is-invalid')
            ) {
              input.value = String(Number(input.value)).padStart(2, '0');
              sincronizar();
            }
          });
        });

      sincronizar();
    });
}
