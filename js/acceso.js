import { pintarPedidos } from "./pedidos.js";
/* Acceso de clientes y administradores desde la cabecera del sitio. */
import { solicitarApi } from "./api.js";
import { borrarSesion, esAdmin, guardarSesion, leerSesion, restaurarSesion, primerNombre } from "./sesion.js";

function anunciar(elemento, mensaje) {
  if (!elemento) return;
  elemento.textContent = mensaje;
}

function deshabilitar(boton, activo, textoOriginal) {
  if (!boton) return;
  boton.disabled = activo;
  if (activo) {
    boton.dataset.texto = boton.textContent;
    boton.textContent = textoOriginal;
  } else if (boton.dataset.texto) {
    boton.textContent = boton.dataset.texto;
    delete boton.dataset.texto;
  }
}

export function actualizarBotonCuenta() {
  const boton = document.getElementById("abrir-acceso");
  const texto = document.getElementById("acceso-cuenta-texto");
  if (!boton) return;
  const sesion = leerSesion();
  if (esAdmin(sesion)) {
    if (texto) texto.textContent = "Panel admin";
    boton.setAttribute("aria-label", "Abrir el panel de administración");
  } else if (sesion) {
    if (texto) texto.textContent = primerNombre(sesion.usuario?.nombre);
    boton.setAttribute("aria-label", `Abrir tu cuenta, ${sesion.usuario?.nombre ?? "cliente"}`);
  } else {
    if (texto) texto.textContent = "Iniciar sesión";
    boton.setAttribute("aria-label", "Iniciar sesión o crear una cuenta");
  }
}

export async function inicializarAcceso() {
  try { await restaurarSesion(); } catch { /* Acceso disponible sin conexión. */ }
  const dialogo = document.getElementById("dialogo-acceso");
  const boton = document.getElementById("abrir-acceso");
  if (!dialogo || !boton) return;

  const vistas = {
    login: document.getElementById("vista-login"),
    registro: document.getElementById("vista-registro"),
    cuenta: document.getElementById("vista-cuenta"),
  };
  const formularioLogin = document.getElementById("formulario-login");
  const formularioRegistro = document.getElementById("formulario-registro");
  const errorLogin = document.getElementById("error-acceso");
  const errorRegistro = document.getElementById("error-registro");
  const estadoCuenta = document.getElementById("estado-cuenta");
  const listaSolicitudes = document.getElementById("cuenta-solicitudes");
  const cuentaCorreo = document.getElementById("cuenta-correo");
  const tituloCuenta = document.getElementById("titulo-cuenta");
  const enlaceAdmin = document.getElementById("cuenta-admin");
  let cargandoCuenta = false;

  function mostrarVista(nombre) {
    for (const [clave, vista] of Object.entries(vistas)) vista.hidden = clave !== nombre;
    dialogo.dataset.vista = nombre;
  }

  function abrir(nombre = "login") {
    if (dialogo.open) dialogo.close();
    mostrarVista(nombre);
    document.getElementById("acceso-correo")?.closest("form")?.reset();
    anunciar(errorLogin, "");
    anunciar(errorRegistro, "");
    errorLogin.hidden = true;
    errorRegistro.hidden = true;
    dialogo.showModal();
    if (nombre === "cuenta") {
      const sesion = leerSesion();
      if (sesion) {
        pintarCuenta(sesion);
        void cargarSolicitudes(sesion);
      } else {
        mostrarVista("login");
        document.getElementById("acceso-correo")?.focus();
      }
    } else if (nombre === "registro") {
      document.getElementById("registro-nombre")?.focus();
    } else {
      document.getElementById("acceso-correo")?.focus();
    }
  }

  function pintarCuenta(sesion) {
    const nombre = sesion.usuario?.nombre ?? "Cliente";
    if (tituloCuenta) tituloCuenta.textContent = `Hola, ${primerNombre(nombre)}`;
    if (cuentaCorreo) cuentaCorreo.textContent = sesion.usuario?.correo ?? "";
    if (enlaceAdmin) enlaceAdmin.hidden = !esAdmin(sesion);
  }

  async function cargarSolicitudes(sesion) {
    if (!listaSolicitudes || cargandoCuenta) return;
    cargandoCuenta = true;
    listaSolicitudes.replaceChildren();
    anunciar(estadoCuenta, "Cargando tus solicitudes…");
    try {
      const { solicitudes } = await solicitarApi("cuenta/solicitudes");
      anunciar(estadoCuenta, "");
      pintarPedidos(listaSolicitudes, solicitudes, { estado: estadoCuenta, recargar: () => cargarSolicitudes(sesion) });
    } catch (error) {
      if (error.estado === 401) {
        borrarSesion();
        actualizarBotonCuenta();
        mostrarVista("login");
        anunciar(errorLogin, "Tu sesión expiró. Inicia sesión nuevamente.");
        errorLogin.hidden = false;
      } else {
        anunciar(estadoCuenta, error.message || "No pudimos cargar tus solicitudes.");
      }
    } finally {
      cargandoCuenta = false;
    }
  }

  boton.addEventListener("click", () => {
    const sesion = leerSesion();
    if (esAdmin(sesion)) {
      window.location.assign("admin.html");
      return;
    }
    abrir(sesion ? "cuenta" : "login");
  });

  document.getElementById("cerrar-acceso")?.addEventListener("click", () => dialogo.close());
  dialogo.addEventListener("click", evento => {
    if (evento.target !== dialogo) return;
    const caja = dialogo.getBoundingClientRect();
    if (evento.clientX < caja.left || evento.clientX > caja.right ||
        evento.clientY < caja.top || evento.clientY > caja.bottom) dialogo.close();
  });
  dialogo.addEventListener("close", () => {
    if (dialogo.dataset.vista === "cuenta") {
      anunciar(estadoCuenta, "");
      listaSolicitudes?.replaceChildren();
    }
  });

  document.getElementById("ir-registro")?.addEventListener("click", () => {
    mostrarVista("registro");
    document.getElementById("registro-nombre")?.focus();
  });
  document.getElementById("ir-login")?.addEventListener("click", () => {
    mostrarVista("login");
    document.getElementById("acceso-correo")?.focus();
  });

  formularioLogin?.addEventListener("submit", async evento => {
    evento.preventDefault();
    const botonEnviar = formularioLogin.querySelector('button[type="submit"]');
    const datos = Object.fromEntries(new FormData(formularioLogin));
    errorLogin.hidden = true;
    deshabilitar(botonEnviar, true, "Entrando…");
    try {
      const sesion = await solicitarApi("auth/login", {
        metodo: "POST",
        cuerpo: { correo: datos.correo, password: datos.password },
      });
      guardarSesion(sesion);
      actualizarBotonCuenta();
      if (esAdmin(sesion)) {
        window.location.assign("admin.html");
        return;
      }
      formularioLogin.reset();
      mostrarVista("cuenta");
      pintarCuenta(sesion);
      void cargarSolicitudes(sesion);
    } catch (error) {
      errorLogin.textContent = error.message;
      errorLogin.hidden = false;
      document.getElementById("acceso-password").value = "";
      document.getElementById("acceso-password").focus();
    } finally {
      deshabilitar(botonEnviar, false);
    }
  });

  formularioRegistro?.addEventListener("submit", async evento => {
    evento.preventDefault();
    const botonEnviar = formularioRegistro.querySelector('button[type="submit"]');
    const datos = Object.fromEntries(new FormData(formularioRegistro));
    errorRegistro.hidden = true;
    if (datos.password !== datos.confirmar) {
      errorRegistro.textContent = "Las contraseñas no coinciden.";
      errorRegistro.hidden = false;
      document.getElementById("registro-confirmar").focus();
      return;
    }
    deshabilitar(botonEnviar, true, "Creando cuenta…");
    try {
      const sesion = await solicitarApi("auth/registro", {
        metodo: "POST",
        cuerpo: {
          nombre: datos.nombre,
          correo: datos.correo,
          telefono: datos.telefono,
          empresa: datos.empresa,
          password: datos.password,
        },
        token: null,
      });
      guardarSesion(sesion);
      actualizarBotonCuenta();
      formularioRegistro.reset();
      mostrarVista("cuenta");
      pintarCuenta(sesion);
      void cargarSolicitudes(sesion);
    } catch (error) {
      errorRegistro.textContent = error.message;
      errorRegistro.hidden = false;
    } finally {
      deshabilitar(botonEnviar, false);
    }
  });

  document.getElementById("cerrar-sesion-cliente")?.addEventListener("click", async () => {
    const sesion = leerSesion();
    try {
      await solicitarApi("auth/logout", { metodo: "POST", cuerpo: {} });
    } catch (error) {
      anunciar(estadoCuenta, error.message || "No pudimos cerrar la sesión. Inténtalo nuevamente.");
      return;
    }
    borrarSesion();
    actualizarBotonCuenta();
    mostrarVista("login");
    anunciar(errorLogin, "Sesión cerrada.");
    document.getElementById("acceso-correo")?.focus();
  });

  window.addEventListener("storage", evento => {
    if (evento.key === "valora-sesion-v1") actualizarBotonCuenta();
  });

  actualizarBotonCuenta();

  // Accesos directos: ?acceso=1 o #acceso abren el inicio de sesión.
  const parametros = new URLSearchParams(window.location.search);
  if (parametros.has("acceso") || window.location.hash === "#acceso") {
    if (parametros.has("acceso")) {
      const limpia = new URL(window.location.href);
      limpia.searchParams.delete("acceso");
      history.replaceState(null, "", limpia.pathname + limpia.search + "#inicio");
    }
    const sesion = leerSesion();
    abrir(esAdmin(sesion) ? "cuenta" : sesion ? "cuenta" : "login");
  }
}
