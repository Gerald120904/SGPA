import { solicitarRecuperacion, restablecerPassword } from '../../services/auth.service.js';
import { renderizarIconos as renderizarIconosPorDefecto } from '../../utils/icons.js';

/** Coordina solicitud y restablecimiento de acceso sin mezclarlo con el formulario de login. */
export function inicializarRecuperacionLogin({ correoInput, loginForm, renderizarIconos = renderizarIconosPorDefecto, solicitarRecuperacionApi = solicitarRecuperacion, restablecerPasswordApi = restablecerPassword }) {
  const forgotPasswordButton = document.getElementById('forgotPasswordButton');
  const loginHeader = document.getElementById('loginHeader');
  const recoveryPanel = document.getElementById('recoveryPanel');
  const recoveryRequestForm = document.getElementById('recoveryRequestForm');
  const recoveryEmail = document.getElementById('recoveryEmail');
  const recoveryRequestError = document.getElementById('recoveryRequestError');
  const recoveryRequestButton = document.getElementById('recoveryRequestButton');
  const recoveryRequestButtonText = document.getElementById('recoveryRequestButtonText');
  const recoveryResetSection = document.getElementById('recoveryResetSection');
  const recoveryMessage = document.getElementById('recoveryMessage');
  const recoverySuccess = document.getElementById('recoverySuccess');
  const resetPasswordForm = document.getElementById('resetPasswordForm');
  const recoveryCode = document.getElementById('recoveryCode');
  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');
  const resetPasswordError = document.getElementById('resetPasswordError');
  const resetPasswordButton = document.getElementById('resetPasswordButton');
  const resetPasswordButtonText = document.getElementById('resetPasswordButtonText');
  const backToLoginButton = document.getElementById('backToLoginButton');
  const loginView = document.getElementById('loginView');
  const sigueActiva = () => document.getElementById('loginView') === loginView;
  let solicitudRecuperacion = 0;
  let recuperacionPendiente = false;
  let solicitudRestablecimiento = 0;
  let restablecimientoPendiente = false;

  function ocultarErrorRecuperacion(
    elemento
  ) {

    elemento.classList.add(
      'hidden'
    );

    elemento.textContent = '';

  }


  function mostrarErrorRecuperacion(
    elemento,
    mensaje
  ) {

    elemento.textContent =
      mensaje;

    elemento.classList.remove(
      'hidden'
    );

  }


  function abrirRecuperacion() {

    loginHeader.classList.add(
      'hidden'
    );

    loginForm.classList.add(
      'hidden'
    );

    recoveryPanel.classList.remove(
      'hidden'
    );

    recoveryRequestForm.classList.remove(
      'hidden'
    );

    resetPasswordForm.classList.remove(
      'hidden'
    );

    recoveryResetSection.classList.add(
      'hidden'
    );

    recoveryMessage.classList.add(
      'hidden'
    );

    recoverySuccess.classList.add(
      'hidden'
    );

    ocultarErrorRecuperacion(
      recoveryRequestError
    );

    ocultarErrorRecuperacion(
      resetPasswordError
    );

    recoveryEmail.value =
      correoInput.value.trim();

    recoveryCode.value = '';
    newPassword.value = '';
    confirmPassword.value = '';

    recoveryEmail.focus();

    renderizarIconos();

  }


  function volverAlLogin() {

    recoveryPanel.classList.add(
      'hidden'
    );

    loginHeader.classList.remove(
      'hidden'
    );

    loginForm.classList.remove(
      'hidden'
    );

    recoveryRequestForm.classList.remove(
      'hidden'
    );

    resetPasswordForm.classList.remove(
      'hidden'
    );

    recoveryResetSection.classList.add(
      'hidden'
    );

    recoveryMessage.classList.add(
      'hidden'
    );

    recoverySuccess.classList.add(
      'hidden'
    );

    ocultarErrorRecuperacion(
      recoveryRequestError
    );

    ocultarErrorRecuperacion(
      resetPasswordError
    );

    correoInput.focus();

  }

  forgotPasswordButton.addEventListener(
    'click',
    abrirRecuperacion
  );


  backToLoginButton.addEventListener(
    'click',
    volverAlLogin
  );


  recoveryEmail.addEventListener(
    'input',
    () => {
      solicitudRecuperacion += 1;
      ocultarErrorRecuperacion(recoveryRequestError);
    }
  );


  recoveryRequestForm.addEventListener(
    'submit',
    async (event) => {

      event.preventDefault();

      if (recuperacionPendiente) return;

      ocultarErrorRecuperacion(
        recoveryRequestError
      );

      recoveryMessage.classList.add(
        'hidden'
      );

      const correo =
        recoveryEmail.value.trim();

      if (!correo) {

        mostrarErrorRecuperacion(
          recoveryRequestError,
          'Debe ingresar su correo institucional.'
        );

        return;

      }

      try {

        recuperacionPendiente = true;
        const solicitud = ++solicitudRecuperacion;

        recoveryRequestButton.disabled =
          true;

        recoveryRequestButtonText.textContent =
          'Enviando...';

        const resultado =
          await solicitarRecuperacionApi(
            correo
          );

        if (!sigueActiva() || solicitud !== solicitudRecuperacion || recoveryEmail.value.trim() !== correo) return;

        if (!resultado?.ok) {

          mostrarErrorRecuperacion(
            recoveryRequestError,
            resultado?.status === 0
              ? 'No se pudo conectar con el sistema. Verifique que el servidor esté disponible.'
              : resultado?.message ||
            'No fue posible solicitar el código.'
          );

          return;

        }

        recoveryRequestForm.classList.add(
          'hidden'
        );

        recoveryResetSection.classList.remove(
          'hidden'
        );

        recoveryMessage.textContent =
          resultado.message ||
          'Si el correo está registrado, recibirás un código de recuperación.';

        recoveryMessage.classList.remove(
          'hidden'
        );

        recoveryCode.focus();

        renderizarIconos();

      } catch (error) {

        if (!sigueActiva()) return;

        console.error(
          'Error de recuperación:',
          error
        );

        mostrarErrorRecuperacion(
          recoveryRequestError,
          'No se pudo conectar con el sistema. Verifique que el servidor esté disponible.'
        );

      } finally {

        recuperacionPendiente = false;

        recoveryRequestButton.disabled =
          false;

        recoveryRequestButtonText.textContent =
          'Enviar código';

      }

    }
  );


  [
    recoveryCode,
    newPassword,
    confirmPassword
  ].forEach(
    (input) => input.addEventListener(
      'input',
      () => {
        solicitudRestablecimiento += 1;
        ocultarErrorRecuperacion(resetPasswordError);
      }
    )
  );


  resetPasswordForm.addEventListener(
    'submit',
    async (event) => {

      event.preventDefault();

      if (restablecimientoPendiente) return;

      ocultarErrorRecuperacion(
        resetPasswordError
      );

      const correo =
        recoveryEmail.value.trim();

      const codigo =
        recoveryCode.value.trim();

      const password =
        newPassword.value;

      const confirmacion =
        confirmPassword.value;

      if (!/^\d{6}$/.test(codigo)) {

        mostrarErrorRecuperacion(
          resetPasswordError,
          'El código debe contener 6 dígitos.'
        );

        return;

      }

      if (password.length < 8) {

        mostrarErrorRecuperacion(
          resetPasswordError,
          'La contraseña debe contener al menos 8 caracteres.'
        );

        return;

      }

      if (password !== confirmacion) {

        mostrarErrorRecuperacion(
          resetPasswordError,
          'Las contraseñas no coinciden.'
        );

        return;

      }

      try {

        restablecimientoPendiente = true;
        const solicitud = ++solicitudRestablecimiento;

        resetPasswordButton.disabled =
          true;

        resetPasswordButtonText.textContent =
          'Actualizando...';

        const resultado =
          await restablecerPasswordApi(
            correo,
            codigo,
            password
          );

        if (!sigueActiva() || solicitud !== solicitudRestablecimiento) return;

        if (!resultado?.ok) {

          mostrarErrorRecuperacion(
            resetPasswordError,
            resultado?.status === 0
              ? 'No se pudo conectar con el sistema. Verifique que el servidor esté disponible.'
              : resultado?.message ||
            'No fue posible cambiar la contraseña.'
          );

          return;

        }

        resetPasswordForm.classList.add(
          'hidden'
        );

        recoveryMessage.classList.add(
          'hidden'
        );

        recoverySuccess.textContent =
          'Contraseña actualizada correctamente. Ya puede iniciar sesión con su nueva contraseña.';

        recoverySuccess.classList.remove(
          'hidden'
        );

        correoInput.value =
          correo;

      } catch (error) {

        if (!sigueActiva()) return;

        console.error(
          'Error cambiando contraseña:',
          error
        );

        mostrarErrorRecuperacion(
          resetPasswordError,
          'No se pudo conectar con el sistema. Verifique que el servidor esté disponible.'
        );

      } finally {

        restablecimientoPendiente = false;

        resetPasswordButton.disabled =
          false;

        resetPasswordButtonText.textContent =
          'Cambiar contraseña';

      }

    }
  );
}
