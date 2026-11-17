import { login } from '../../services/auth.service.js';

import {
  renderizarIconos
} from '../../utils/icons.js';

import { inicializarSelectorCuentas } from './login.cuentas.js';
import { inicializarRecuperacionLogin } from './LoginRecuperacion.js';
import { LoginPage } from './LoginView.js';
export { LoginPage };

/* =========================================================
   EVENTOS LOGIN
   ========================================================= */

export function iniciarLoginPage({
  onLoginSuccess
}) {

  const loginForm =
    document.getElementById(
      'loginForm'
    );

  const correoInput =
    document.getElementById(
      'correo'
    );

  const passwordInput =
    document.getElementById(
      'password'
    );

  const togglePassword =
    document.getElementById(
      'togglePassword'
    );

  const loginError =
    document.getElementById(
      'loginError'
    );

  const loginButton =
    document.getElementById(
      'loginButton'
    );

  const loginButtonText =
    document.getElementById(
      'loginButtonText'
    );

  const rememberMe =
    document.getElementById(
      'rememberMe'
    );


  const cuentasRecordadasToggle = document.getElementById(
    "cuentasRecordadasToggle",
  );

  const cuentasRecordadasMenu = document.getElementById(
    "cuentasRecordadasMenu",
  );

  const loginView = document.getElementById("loginView");

  const selectorCuentas = inicializarSelectorCuentas({
    correoInput,
    passwordInput,
    toggle: cuentasRecordadasToggle,
    menu: cuentasRecordadasMenu,
    loginView,
    renderizarIconos,
  });
  const sigueActiva = () => document.getElementById('loginView') === loginView;
  let loginPendiente = false;
  let secuenciaIntentoLogin = 0;

  function ocultarError() {

    loginError.classList.add(
      'hidden'
    );

    loginError.textContent = '';

  }


  function mostrarError(
    mensaje
  ) {

    loginError.textContent =
      mensaje;

    loginError.classList.remove(
      'hidden'
    );

  }


  togglePassword.addEventListener(
    'click',
    () => {

      const oculta =
        passwordInput.type ===
        'password';


      passwordInput.type =
        oculta
          ? 'text'
          : 'password';


      togglePassword.innerHTML =
        oculta
          ? '<i data-lucide="eye-off"></i>'
          : '<i data-lucide="eye"></i>';


      togglePassword.setAttribute(
        'title',
        oculta
          ? 'Ocultar contraseña'
          : 'Mostrar contraseña'
      );


      renderizarIconos();

    }
  );


  correoInput.addEventListener("input", () => {
    ocultarError();

    selectorCuentas.ocultar();
  });

  passwordInput.addEventListener(
    'input',
    ocultarError
  );


  loginForm.addEventListener(
    'submit',
    async (event) => {

      event.preventDefault();

      ocultarError();

      if (loginPendiente) return;


      const correo =
        correoInput.value.trim();

      const password =
        passwordInput.value;


      if (
        !correo ||
        !password
      ) {

        mostrarError(
          'Debe completar usuario y contraseña.'
        );

        return;

      }

      const intento = {
        id: ++secuenciaIntentoLogin,
        correo,
        recordar: rememberMe.checked,
      };

      try {

        loginPendiente = true;

        correoInput.disabled = true;
        passwordInput.disabled = true;
        togglePassword.disabled = true;
        rememberMe.disabled = true;
        selectorCuentas.establecerHabilitado(false);

        loginButton.disabled =
          true;

        loginButtonText.textContent =
          'Accediendo...';


        const resultado =
          await login(
            intento.correo,
            password
          );

        if (!resultado?.ok) {

          if (!sigueActiva() || intento.id !== secuenciaIntentoLogin) return;

          mostrarError(
            resultado?.status === 0
              ? 'No se pudo conectar con el sistema. Verifique que el servidor esté disponible.'
              : resultado?.message ||
            'Credenciales incorrectas.'
          );

          return;

        }


        // Un ok significa que el proceso principal ya confirmó esta sesión.
        // Consumirlo aunque la vista haya cambiado o el campo se haya alterado.
        correoInput.value = intento.correo;

        console.log(
          'Login correcto:',
          resultado.usuario
        );


        if (intento.recordar) {
          try {
            selectorCuentas.agregar(intento.correo);
          } catch {
            // La persistencia local es opcional y no debe ocultar una sesión ya confirmada.
          }

        }


        onLoginSuccess(
          resultado
        );


      } catch (error) {

        if (!sigueActiva()) return;

        console.error(
          'Error durante el login:',
          error
        );


        mostrarError(
          'No se pudo conectar con el sistema. Verifique que el servidor esté disponible.'
        );


      } finally {

        loginPendiente = false;

        correoInput.disabled = false;
        passwordInput.disabled = false;
        togglePassword.disabled = false;
        rememberMe.disabled = false;
        selectorCuentas.establecerHabilitado(true);

        loginButton.disabled =
          false;

        loginButtonText.textContent =
          'Acceder';

      }

    }
  );


  inicializarRecuperacionLogin({ correoInput, loginForm, renderizarIconos });


}
