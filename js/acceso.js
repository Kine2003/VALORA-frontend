/* Acceso de clientes y administradores desde la cabecera del sitio. */
import { solicitarApi } from "./api.js";
import { borrarSesion, esAdmin, guardarSesion, leerSesion, primerNombre } from "./sesion.js";

const ETIQUETAS_ESTADO = {
  NUEVA: "Nueva",
  EN_REVISION: "En revisión",
  COTIZADA: "Cotizada",
  CONFIRMADA: "Confirmada",
  EN_PROCESO: "En proceso",
  ENTREGADA: "Entregada",
  RECHAZADA: "Rechazada",
  CANCELADA: "Cancelada",
};

const moneda = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

function fechaCorta(valor) {
  if (!valor) return "Fecha por confirmar";
  const fecha = new Date(String(valor).slice(0, 10) + "T12:00:00");
  if (Number.isNaN(fecha.getTime())) return "Fecha por confirmar";
  return new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", year: "numeric" }).format(fecha);
}

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

export function inicializarAcceso() {
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
      if (!solicitudes.length) {
        const vacio = document.createElement("li");
        vacio.className = "cuenta-vacia";
        vacio.textContent = "Todavía no tienes pedidos ni cotizaciones. Cuando registres uno, aparecerá aquí.";
        listaSolicitudes.append(vacio);
        return;
      }
      const fragmento = document.createDocumentFragment();
      for (const solicitud of solicitudes) {
        const item = document.createElement("li");
        item.className = "cuenta-solicitud";

        const principal = document.createElement("div");
        const codigo = document.createElement("strong");
        codigo.textContent = `${solicitud.tipo === "PEDIDO" ? "Pedido" : "Cotización"} #${solicitud.id}`;
        const detalle = document.createElement("span");
        detalle.textContent = `${fechaCorta(solicitud.fechaEvento)} · ${moneda.format(solicitud.totalCentavos / 100)}`;
        principal.append(codigo, detalle);

        const pastilla = document.createElement("span");
        pastilla.className = `pastilla-estado estado-${String(solicitud.estado).toLowerCase()}`;
        pastilla.textContent = ETIQUETAS_ESTADO[solicitud.estado] ?? solicitud.estado;

        if (solicitud.tipo === "PEDIDO") {
          const pago = document.createElement("span");
          pago.className = solicitud.estadoPago === "PAGADO"
            ? "orden-activa"
            : "orden-pendiente";
          pago.textContent = solicitud.estadoPago === "PAGADO" ? "Orden activa" : "Pendiente de pago";
          principal.append(pago);

          if (solicitud.estadoPago !== "PAGADO") {
            const acciones = document.createElement("div");
            acciones.className = "orden-pago-acciones";
            const metodo = document.createElement("select");
            metodo.setAttribute("aria-label", `Método de pago de la orden ${solicitud.id}`);
            for (const [valor, texto] of [["TRANSFERENCIA","Transferencia"],["TARJETA","Tarjeta"],["EFECTIVO","Efectivo"]]) {
              metodo.append(new Option(texto, valor));
            }
            const pagar = document.createElement("button");
            pagar.type = "button";
            pagar.className = "boton boton-borde";
            pagar.textContent = "Pagar ahora";
            pagar.addEventListener("click", async () => {
              try {
                await solicitarApi(`cuenta/ordenes/${solicitud.id}/pago`, {
                  metodo: "POST",
                  cuerpo: { metodo: metodo.value },
                });
                if (metodo.value === "EFECTIVO") {
                  const texto = encodeURIComponent(`Hola, quiero pagar en efectivo la orden #${solicitud.id}.`);
                  window.open(`https://wa.me/593995883856?text=${texto}`, "_blank", "noopener,noreferrer");
                }
                await cargarSolicitudes(sesion);
              } catch (error) {
                anunciar(estadoCuenta, error.message);
              }
            });
            acciones.append(metodo, pagar);
            item.append(principal, acciones, pastilla);
            fragmento.append(item);
            continue;
          }
        }
        item.append(principal, pastilla);
        fragmento.append(item);
      }
      listaSolicitudes.append(fragmento);
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
        token: null,
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
      if (sesion?.token) {
        await solicitarApi("auth/logout", { metodo: "POST", cuerpo: {}, token: sesion.token });
      }
    } catch {
      /* La copia local se elimina aunque el servidor no responda. */
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
