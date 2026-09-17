import {
  login,
  solicitarRecuperacion,
  restablecerPassword
} from '../../services/auth.service.js';

import {
  renderizarIconos
} from '../../utils/icons.js';


const CLAVE_CUENTAS_RECORDADAS =
  'sgpa-cuentas-recordadas';

const CLAVE_CORREO_ANTERIOR =
  'sgpa-correo-recordado';

const MAXIMO_CUENTAS_RECORDADAS = 8;


function obtenerCuentasRecordadas() {

  let cuentas = [];

  try {

    const guardadas = JSON.parse(
      localStorage.getItem(
        CLAVE_CUENTAS_RECORDADAS
      ) || '[]'
    );

    if (Array.isArray(guardadas)) {

      cuentas = guardadas;

    }

  } catch {

    cuentas = [];

  }


  const correoAnterior =
    localStorage.getItem(
      CLAVE_CORREO_ANTERIOR
    );

  if (correoAnterior) {

    cuentas.unshift(
      correoAnterior
    );

    localStorage.removeItem(
      CLAVE_CORREO_ANTERIOR
    );

  }


  return [...new Set(
    cuentas
      .filter(
        (cuenta) =>
          typeof cuenta === 'string'
      )
      .map(
        (cuenta) => cuenta.trim()
      )
      .filter(Boolean)
  )].slice(
    0,
    MAXIMO_CUENTAS_RECORDADAS
  );

}


function guardarCuentasRecordadas(
  cuentas
) {

  localStorage.setItem(
    CLAVE_CUENTAS_RECORDADAS,
    JSON.stringify(cuentas)
  );

}


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
              src="/Logo-UNA-Rojo_FondoTransparente.png"
              alt="Universidad Nacional"
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

            <header
              id="loginHeader"
              class="form-header"
            >

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

              <div class="form-group saved-accounts-group">

                <label for="correo">
                  Usuario
                </label>


                <div class="input-container account-input-container">

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
                    aria-autocomplete="list"
                    aria-controls="cuentasRecordadasMenu"
                    aria-expanded="false"
                    required
                  />

                  <button
                    id="cuentasRecordadasToggle"
                    type="button"
                    class="saved-accounts-toggle"
                    aria-label="Mostrar cuentas guardadas"
                    title="Mostrar cuentas guardadas"
                    aria-controls="cuentasRecordadasMenu"
                    aria-expanded="false"
                  >
                    <i
                      data-lucide="chevron-down"
                      aria-hidden="true"
                    ></i>
                  </button>

                  <div
                    id="cuentasRecordadasMenu"
                    class="saved-accounts-menu hidden"
                    role="listbox"
                    aria-label="Cuentas guardadas"
                  ></div>

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


            <section
              id="recoveryPanel"
              class="recovery-panel hidden"
            >

              <header class="form-header">

                <h2>
                  Recuperar acceso
                </h2>

                <p>
                  Restablezca la contraseña de su
                  cuenta institucional.
                </p>

              </header>


              <div
                id="recoveryMessage"
                class="recovery-message hidden"
                role="status"
                aria-live="polite"
              ></div>


              <div
                id="recoverySuccess"
                class="recovery-success hidden"
                role="status"
                aria-live="polite"
              ></div>


              <form
                id="recoveryRequestForm"
                class="recovery-form"
                novalidate
              >

                <div class="form-group">

                  <label for="recoveryEmail">
                    Correo institucional
                  </label>

                  <div class="input-container">

                    <i
                      data-lucide="mail"
                      class="input-icon"
                      aria-hidden="true"
                    ></i>

                    <input
                      id="recoveryEmail"
                      name="recoveryEmail"
                      type="email"
                      autocomplete="email"
                      placeholder="usuario@una.ac.cr"
                      spellcheck="false"
                      required
                    />

                  </div>

                </div>


                <div
                  id="recoveryRequestError"
                  class="login-error hidden"
                  role="alert"
                  aria-live="polite"
                ></div>


                <button
                  id="recoveryRequestButton"
                  type="submit"
                  class="login-button"
                >
                  <span id="recoveryRequestButtonText">
                    Enviar código
                  </span>
                </button>

              </form>


              <section
                id="recoveryResetSection"
                class="recovery-reset-section hidden"
              >

                <form
                  id="resetPasswordForm"
                  class="recovery-form"
                  novalidate
                >

                  <div class="form-group">

                    <label for="recoveryCode">
                      Código temporal
                    </label>

                    <div class="input-container">

                      <i
                        data-lucide="key-round"
                        class="input-icon"
                        aria-hidden="true"
                      ></i>

                      <input
                        id="recoveryCode"
                        name="recoveryCode"
                        type="text"
                        inputmode="numeric"
                        autocomplete="one-time-code"
                        maxlength="6"
                        pattern="[0-9]{6}"
                        placeholder="000000"
                        required
                      />

                    </div>

                  </div>


                  <div class="form-group">

                    <label for="newPassword">
                      Nueva contraseña
                    </label>

                    <div class="input-container">

                      <i
                        data-lucide="lock-keyhole"
                        class="input-icon"
                        aria-hidden="true"
                      ></i>

                      <input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        autocomplete="new-password"
                        minlength="8"
                        maxlength="128"
                        placeholder="Mínimo 8 caracteres"
                        required
                      />

                    </div>

                  </div>


                  <div class="form-group">

                    <label for="confirmPassword">
                      Confirmar contraseña
                    </label>

                    <div class="input-container">

                      <i
                        data-lucide="shield-check"
                        class="input-icon"
                        aria-hidden="true"
                      ></i>

                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autocomplete="new-password"
                        minlength="8"
                        maxlength="128"
                        placeholder="Repita la contraseña"
                        required
                      />

                    </div>

                  </div>


                  <div
                    id="resetPasswordError"
                    class="login-error hidden"
                    role="alert"
                    aria-live="polite"
                  ></div>


                  <button
                    id="resetPasswordButton"
                    type="submit"
                    class="login-button"
                  >
                    <span id="resetPasswordButtonText">
                      Cambiar contraseña
                    </span>
                  </button>

                </form>

              </section>


              <button
                id="backToLoginButton"
                type="button"
                class="recovery-back-button"
              >
                Volver al inicio de sesión
              </button>

            </section>

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


  const loginHeader =
    document.getElementById(
      'loginHeader'
    );

  const recoveryPanel =
    document.getElementById(
      'recoveryPanel'
    );

  const recoveryRequestForm =
    document.getElementById(
      'recoveryRequestForm'
    );

  const recoveryEmail =
    document.getElementById(
      'recoveryEmail'
    );

  const recoveryRequestError =
    document.getElementById(
      'recoveryRequestError'
    );

  const recoveryRequestButton =
    document.getElementById(
      'recoveryRequestButton'
    );

  const recoveryRequestButtonText =
    document.getElementById(
      'recoveryRequestButtonText'
    );

  const recoveryResetSection =
    document.getElementById(
      'recoveryResetSection'
    );

  const recoveryMessage =
    document.getElementById(
      'recoveryMessage'
    );

  const recoverySuccess =
    document.getElementById(
      'recoverySuccess'
    );

  const resetPasswordForm =
    document.getElementById(
      'resetPasswordForm'
    );

  const recoveryCode =
    document.getElementById(
      'recoveryCode'
    );

  const newPassword =
    document.getElementById(
      'newPassword'
    );

  const confirmPassword =
    document.getElementById(
      'confirmPassword'
    );

  const resetPasswordError =
    document.getElementById(
      'resetPasswordError'
    );

  const resetPasswordButton =
    document.getElementById(
      'resetPasswordButton'
    );

  const resetPasswordButtonText =
    document.getElementById(
      'resetPasswordButtonText'
    );

  const backToLoginButton =
    document.getElementById(
      'backToLoginButton'
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

  const accountInputContainer = correoInput.closest(".account-input-container");

  const loginView = document.getElementById("loginView");

  let cuentasRecordadas = obtenerCuentasRecordadas();

  function renderizarCuentasRecordadas() {
    cuentasRecordadasMenu.replaceChildren();

    cuentasRecordadasToggle.classList.toggle(
      "hidden",
      cuentasRecordadas.length === 0,
    );

    for (const correo of cuentasRecordadas) {
      const opcion = document.createElement("button");

      opcion.type = "button";
      opcion.className = "saved-account-option";
      opcion.setAttribute("role", "option");
      opcion.setAttribute("aria-label", `Usar la cuenta ${correo}`);

      const icono = document.createElement("span");

      icono.className = "saved-account-icon";
      icono.innerHTML = '<i data-lucide="mail" aria-hidden="true"></i>';

      const textos = document.createElement("span");

      textos.className = "saved-account-copy";

      const correoTexto = document.createElement("strong");

      correoTexto.textContent = correo;

      const detalle = document.createElement("small");

      detalle.textContent = "Cuenta guardada";

      textos.append(correoTexto, detalle);

      const indicador = document.createElement("span");

      indicador.className = "saved-account-indicator";
      indicador.innerHTML =
        '<i data-lucide="chevron-right" aria-hidden="true"></i>';

      opcion.append(icono, textos, indicador);

      opcion.addEventListener("click", () => {
        correoInput.value = correo;

        ocultarCuentasRecordadas();

        passwordInput.focus();
      });

      cuentasRecordadasMenu.appendChild(opcion);
    }

    renderizarIconos();
  }

  function mostrarCuentasRecordadas() {
    if (cuentasRecordadas.length === 0) {
      return;
    }

    cuentasRecordadasMenu.classList.remove("hidden");

    cuentasRecordadasToggle.classList.add("is-open");

    cuentasRecordadasToggle.setAttribute("aria-expanded", "true");

    correoInput.setAttribute("aria-expanded", "true");
  }

  function ocultarCuentasRecordadas() {
    cuentasRecordadasMenu.classList.add("hidden");

    cuentasRecordadasToggle.classList.remove("is-open");

    cuentasRecordadasToggle.setAttribute("aria-expanded", "false");

    correoInput.setAttribute("aria-expanded", "false");
  }

  renderizarCuentasRecordadas();

  cuentasRecordadasToggle.addEventListener("click", () => {
    if (cuentasRecordadasMenu.classList.contains("hidden")) {
      mostrarCuentasRecordadas();
    } else {
      ocultarCuentasRecordadas();
    }
  });

  correoInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && cuentasRecordadas.length > 0) {
      event.preventDefault();

      mostrarCuentasRecordadas();

      cuentasRecordadasMenu.querySelector(".saved-account-option")?.focus();
    }

    if (event.key === "Escape") {
      ocultarCuentasRecordadas();
    }
  });

  cuentasRecordadasMenu.addEventListener("keydown", (event) => {
    const opciones = [
      ...cuentasRecordadasMenu.querySelectorAll(".saved-account-option"),
    ];

    const indiceActual = opciones.indexOf(document.activeElement);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();

      const desplazamiento = event.key === "ArrowDown" ? 1 : -1;

      const siguienteIndice =
        (indiceActual + desplazamiento + opciones.length) % opciones.length;

      opciones[siguienteIndice]?.focus();
    }

    if (event.key === "Escape") {
      ocultarCuentasRecordadas();

      correoInput.focus();
    }
  });

  loginView.addEventListener("click", (event) => {
    if (!accountInputContainer.contains(event.target)) {
      ocultarCuentasRecordadas();
    }
  });

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

    ocultarCuentasRecordadas();
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


        if (rememberMe.checked) {

          cuentasRecordadas = [
            correo,
            ...cuentasRecordadas.filter(
              (cuentaGuardada) =>
                cuentaGuardada !== correo
            )
          ].slice(
            0,
            MAXIMO_CUENTAS_RECORDADAS
          );

          guardarCuentasRecordadas(
            cuentasRecordadas
          );

          renderizarCuentasRecordadas();

        }


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
    () => ocultarErrorRecuperacion(
      recoveryRequestError
    )
  );


  recoveryRequestForm.addEventListener(
    'submit',
    async (event) => {

      event.preventDefault();

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

        recoveryRequestButton.disabled =
          true;

        recoveryRequestButtonText.textContent =
          'Enviando...';

        const resultado =
          await solicitarRecuperacion(
            correo
          );

        if (!resultado?.ok) {

          mostrarErrorRecuperacion(
            recoveryRequestError,
            resultado?.message ||
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

        console.error(
          'Error de recuperación:',
          error
        );

        mostrarErrorRecuperacion(
          recoveryRequestError,
          'No fue posible conectar con el servidor.'
        );

      } finally {

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
      () => ocultarErrorRecuperacion(
        resetPasswordError
      )
    )
  );


  resetPasswordForm.addEventListener(
    'submit',
    async (event) => {

      event.preventDefault();

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

        resetPasswordButton.disabled =
          true;

        resetPasswordButtonText.textContent =
          'Actualizando...';

        const resultado =
          await restablecerPassword(
            correo,
            codigo,
            password
          );

        if (!resultado?.ok) {

          mostrarErrorRecuperacion(
            resetPasswordError,
            resultado?.message ||
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

        console.error(
          'Error cambiando contraseña:',
          error
        );

        mostrarErrorRecuperacion(
          resetPasswordError,
          'No fue posible conectar con el servidor.'
        );

      } finally {

        resetPasswordButton.disabled =
          false;

        resetPasswordButtonText.textContent =
          'Cambiar contraseña';

      }

    }
  );

}
