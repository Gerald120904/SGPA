import './index.css';

import {
  createIcons,
  User,
  LockKeyhole,
  Eye,
  EyeOff
} from 'lucide';


// ==========================================================
// CARGAR ICONOS LUCIDE
// ==========================================================

function renderizarIconos() {
  createIcons({
    icons: {
      User,
      LockKeyhole,
      Eye,
      EyeOff
    }
  });
}

renderizarIconos();


// ==========================================================
// ELEMENTOS DEL LOGIN
// ==========================================================

const loginForm =
  document.getElementById('loginForm');

const correoInput =
  document.getElementById('correo');

const passwordInput =
  document.getElementById('password');

const togglePassword =
  document.getElementById('togglePassword');

const loginError =
  document.getElementById('loginError');

const loginButton =
  document.getElementById('loginButton');

const loginButtonText =
  document.getElementById('loginButtonText');

const forgotPasswordButton =
  document.getElementById('forgotPasswordButton');


// ==========================================================
// MANEJO DE ERRORES
// ==========================================================

function ocultarError() {
  loginError.classList.add('hidden');
  loginError.textContent = '';
}


function mostrarError(mensaje) {
  loginError.textContent = mensaje;
  loginError.classList.remove('hidden');
}


// ==========================================================
// MOSTRAR / OCULTAR CONTRASEÑA
// ==========================================================

togglePassword.addEventListener(
  'click',
  () => {

    const passwordOculta =
      passwordInput.type === 'password';


    passwordInput.type =
      passwordOculta
        ? 'text'
        : 'password';


    togglePassword.innerHTML =
      passwordOculta
        ? '<i data-lucide="eye-off" aria-hidden="true"></i>'
        : '<i data-lucide="eye" aria-hidden="true"></i>';


    togglePassword.setAttribute(
      'aria-label',
      passwordOculta
        ? 'Ocultar contraseña'
        : 'Mostrar contraseña'
    );


    togglePassword.setAttribute(
      'title',
      passwordOculta
        ? 'Ocultar contraseña'
        : 'Mostrar contraseña'
    );


    renderizarIconos();

  }
);


// ==========================================================
// OCULTAR ERROR AL ESCRIBIR
// ==========================================================

correoInput.addEventListener(
  'input',
  ocultarError
);


passwordInput.addEventListener(
  'input',
  ocultarError
);


// ==========================================================
// LOGIN
// ==========================================================

loginForm.addEventListener(
  'submit',
  async (event) => {

    event.preventDefault();

    ocultarError();


    const correo =
      correoInput.value
        .trim();

    const password =
      passwordInput.value;


    // ------------------------------------------------------
    // VALIDACIÓN BÁSICA
    // ------------------------------------------------------

    if (!correo || !password) {

      mostrarError(
        'Debe completar usuario y contraseña.'
      );

      return;

    }


    try {

      // ----------------------------------------------------
      // ESTADO DE CARGA
      // ----------------------------------------------------

      loginButton.disabled = true;

      if (loginButtonText) {
        loginButtonText.textContent =
          'Accediendo...';
      } else {
        loginButton.textContent =
          'Accediendo...';
      }


      // ----------------------------------------------------
      // ENVIAR CREDENCIALES A ELECTRON
      // ----------------------------------------------------

      const resultado =
        await window.sgpa.login({
          correo,
          password
        });


      // ----------------------------------------------------
      // LOGIN INCORRECTO
      // ----------------------------------------------------

      if (!resultado?.ok) {

        mostrarError(
          resultado?.message ||
          'Credenciales incorrectas.'
        );

        return;

      }


      // ----------------------------------------------------
      // LOGIN CORRECTO
      // ----------------------------------------------------

      console.log(
        'Login correcto:',
        resultado.usuario
      );


      /*
       * Por ahora usamos alert.
       * Luego aquí cambiaremos al Dashboard real.
       */

      alert(
        `Bienvenido ${resultado.usuario.nombres}`
      );


    } catch (error) {

      console.error(
        'Error durante el login:',
        error
      );


      mostrarError(
        'No fue posible conectar con el servidor.'
      );


    } finally {

      // ----------------------------------------------------
      // RESTAURAR BOTÓN
      // ----------------------------------------------------

      loginButton.disabled = false;

      if (loginButtonText) {
        loginButtonText.textContent =
          'Acceder';
      } else {
        loginButton.textContent =
          'Acceder';
      }

    }

  }
);


// ==========================================================
// OLVIDÓ SU CONTRASEÑA
// ==========================================================

if (forgotPasswordButton) {

  forgotPasswordButton.addEventListener(
    'click',
    () => {

      alert(
        'La recuperación de contraseña se implementará posteriormente.'
      );

    }
  );

}