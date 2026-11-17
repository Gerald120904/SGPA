import { logoUnaUrl } from '../../utils/brand-assets.js';

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
              src="${logoUnaUrl}"
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
