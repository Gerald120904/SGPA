import {
  login
} from '../../services/auth.service.js';

import {
  renderizarIconos
} from '../../utils/icons.js';


export function LoginPage() {

  return `
    <main
      id="loginView"
      class="login-screen"
    >

      <section class="login-card">

        <div
          class="login-red-line"
          aria-hidden="true"
        ></div>


        <section class="login-left">

          <div class="brand-area">

            <img
              src="/AVI_horizontal.png"
              alt="AVI Universidad Nacional"
              class="brand-logo"
              draggable="false"
            />

          </div>


          <div class="welcome-area">

            <h1>
              Bienvenido
            </h1>

            <p>
              Acceda con sus credenciales
              institucionales.
            </p>

          </div>


          <div class="left-footer">

            <p>
              Campus Nicoya
            </p>

            <span>
              Universidad Nacional
            </span>

          </div>

        </section>


        <section class="login-right">

          <div class="form-container">

            <header class="form-header">

              <h2>
                Iniciar sesión
              </h2>

              <p>
                Ingrese sus datos para continuar.
              </p>

            </header>


            <form
              id="loginForm"
              novalidate
            >

              <div class="form-group">

                <label for="correo">
                  Usuario
                </label>


                <div class="input-container">

                  <i
                    data-lucide="user"
                    class="input-icon"
                    aria-hidden="true"
                  ></i>


                  <input
                    id="correo"
                    name="correo"
                    type="text"
                    autocomplete="username"
                    placeholder="Ingrese su usuario"
                    spellcheck="false"
                    required
                  />

                </div>

              </div>


              <div class="form-group">

                <label for="password">
                  Contraseña
                </label>


                <div
                  class="input-container password-wrap"
                >

                  <i
                    data-lucide="lock-keyhole"
                    class="input-icon"
                    aria-hidden="true"
                  ></i>


                  <input
                    id="password"
                    name="password"
                    type="password"
                    autocomplete="current-password"
                    placeholder="••••••••"
                    required
                  />


                  <button
                    id="togglePassword"
                    type="button"
                    class="eye-button"
                    aria-label="Mostrar contraseña"
                    title="Mostrar contraseña"
                  >

                    <i
                      data-lucide="eye"
                      aria-hidden="true"
                    ></i>

                  </button>

                </div>

              </div>


              <div
                id="loginError"
                class="login-error hidden"
                role="alert"
                aria-live="polite"
              ></div>


              <div class="form-extra">

                <label
                  class="remember-wrap"
                  for="rememberMe"
                >

                  <input
                    id="rememberMe"
                    type="checkbox"
                  />

                  <span>
                    Recordarme
                  </span>

                </label>


                <button
                  id="forgotPasswordButton"
                  type="button"
                  class="forgot-button"
                >
                  ¿Olvidó su contraseña?
                </button>

              </div>


              <button
                id="loginButton"
                type="submit"
                class="login-button"
              >

                <span id="loginButtonText">
                  Acceder
                </span>

              </button>

            </form>

          </div>

        </section>

      </section>

    </main>
  `;

}


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

  const forgotPasswordButton =
    document.getElementById(
      'forgotPasswordButton'
    );


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


  correoInput.addEventListener(
    'input',
    ocultarError
  );


  passwordInput.addEventListener(
    'input',
    ocultarError
  );


  loginForm.addEventListener(
    'submit',
    async (event) => {

      event.preventDefault();

      ocultarError();


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


      try {

        loginButton.disabled =
          true;

        loginButtonText.textContent =
          'Accediendo...';


        const resultado =
          await login(
            correo,
            password
          );


        if (!resultado?.ok) {

          mostrarError(
            resultado?.message ||
            'Credenciales incorrectas.'
          );

          return;

        }


        console.log(
          'Login correcto:',
          resultado.usuario
        );


        onLoginSuccess(
          resultado
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

        loginButton.disabled =
          false;

        loginButtonText.textContent =
          'Acceder';

      }

    }
  );


  if (
    forgotPasswordButton
  ) {

    forgotPasswordButton.addEventListener(
      'click',
      () => {

        alert(
          'La recuperación de contraseña se implementará posteriormente.'
        );

      }
    );

  }

}