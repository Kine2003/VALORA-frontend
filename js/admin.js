/* Controlador del panel administrativo de Válora. */
import { solicitarApi } from "./api.js";
import { borrarSesion, esAdmin, leerSesion } from "./sesion.js";

const ESTADOS = ["NUEVA", "EN_REVISION", "COTIZADA", "CONFIRMADA", "EN_PROCESO", "ENTREGADA", "RECHAZADA", "CANCELADA"];
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
const TITULOS = { resumen: "Resumen", solicitudes: "Solicitudes", clientes: "Clientes", catalogo: "Catálogo" };
const TIPOS_COMIDA = { DESAYUNO: "Desayuno", ALMUERZO: "Almuerzo", MERIENDA: "Merienda" };

const moneda = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const entero = new Intl.NumberFormat("es-EC");

const estadoApp = {
  resumen: null,
  solicitudes: [],
  clientes: [],
  productos: [],
  filtroTexto: "",
  filtroTipo: "",
  filtroEstado: "",
  filtroCliente: "",
  vista: "resumen",
  detalleId: null,
  cargando: false,
};

const $ = id => document.getElementById(id);

function crear(tag, clase, texto) {
  const elemento = document.createElement(tag);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function fechaHora(valor) {
  if (!valor) return "Sin fecha";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(fecha);
}

function fechaDia(valor) {
  if (!valor) return "Por definir";
  const fecha = new Date(String(valor).slice(0, 10) + "T12:00:00");
  if (Number.isNaN(fecha.getTime())) return "Por definir";
  return new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", year: "numeric" }).format(fecha);
}

function fechaEvento(solicitud) {
  if (!solicitud.fechaEvento) return "Por definir";
  return fechaDia(solicitud.fechaEvento) + (solicitud.horaEvento ? ` · ${solicitud.horaEvento}` : "");
}

function monto(centavos) {
  return moneda.format(Number(centavos ?? 0) / 100);
}

function pastillaEstado(estado) {
  const pastilla = crear("span", `pastilla-estado estado-${String(estado).toLowerCase()}`, ETIQUETAS_ESTADO[estado] ?? estado);
  return pastilla;
}

let temporizadorAviso;
function aviso(mensaje, tono = "") {
  const elemento = $("aviso-admin");
  if (!elemento) return;
  elemento.textContent = mensaje;
  elemento.dataset.tono = tono;
  window.clearTimeout(temporizadorAviso);
  if (tono !== "error") {
    temporizadorAviso = window.setTimeout(() => {
      elemento.textContent = "";
      delete elemento.dataset.tono;
    }, 6000);
  }
}

function manejarError(error) {
  if (error.estado === 401 || error.estado === 403) {
    borrarSesion();
    window.location.replace("index.html?acceso=1");
    return true;
  }
  aviso(error.message || "No pudimos completar la operación.", "error");
  return false;
}

function pintarUsuario(sesion) {
  const nombre = sesion.usuario?.nombre ?? "Administrador";
  $("admin-nombre").textContent = nombre;
  $("admin-correo").textContent = sesion.usuario?.correo ?? "";
  const iniciales = nombre.split(/\s+/u).filter(Boolean).slice(0, 2).map(parte => parte[0].toUpperCase()).join("");
  $("admin-avatar").textContent = iniciales || "AV";
}

function poblarEstados() {
  for (const id of ["filtro-estado", "detalle-estado"]) {
    const select = $(id);
    if (!select) continue;
    for (const estado of ESTADOS) {
      select.append(new Option(ETIQUETAS_ESTADO[estado], estado));
    }
  }
  $("fecha-panel").textContent = new Intl.DateTimeFormat("es-EC", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date());
}

/* ------------------------------ Resumen ------------------------------ */

function renderMetricas() {
  const resumen = estadoApp.resumen;
  if (!resumen) return;
  const valores = {
    solicitudes: entero.format(resumen.solicitudes),
    nuevas: entero.format(resumen.nuevas),
    ingreso: monto(resumen.ingresoConfirmadoCentavos),
    clientes: entero.format(resumen.clientes),
    proximos: entero.format(resumen.proximos),
    personas: entero.format(resumen.personas),
  };
  for (const [clave, valor] of Object.entries(valores)) {
    const nodo = document.querySelector(`[data-metrica="${clave}"]`);
    if (nodo) nodo.textContent = valor;
  }
  const detalles = {
    solicitudes: `${entero.format(resumen.pedidos)} pedidos · ${entero.format(resumen.cotizaciones)} cotizaciones`,
    nuevas: resumen.nuevas ? "Requieren revisión" : "Todo al día",
    ingreso: `${entero.format(resumen.confirmadas)} solicitudes confirmadas o en proceso`,
    clientes: "Con pedidos o cotizaciones registradas",
    proximos: "Eventos desde hoy",
    personas: "Suma de personas en los pedidos",
  };
  for (const [clave, valor] of Object.entries(detalles)) {
    const nodo = document.querySelector(`[data-detalle="${clave}"]`);
    if (nodo) nodo.textContent = valor;
  }
  const contador = $("contador-solicitudes");
  contador.textContent = entero.format(resumen.nuevas);
  contador.hidden = !resumen.nuevas;
}

function renderGrafico() {
  const contenedor = $("grafico-estados");
  if (!contenedor || !estadoApp.resumen) return;
  contenedor.replaceChildren();
  const datos = estadoApp.resumen.porEstado ?? [];
  if (!datos.some(fila => fila.cantidad > 0)) {
    contenedor.append(crear("p", "admin-ayuda", "Todavía no hay solicitudes registradas."));
    return;
  }
  const maximo = Math.max(1, ...datos.map(fila => fila.cantidad));
  for (const fila of datos) {
    const envoltura = crear("div", "grafico-fila");
    const etiqueta = crear("span", "", ETIQUETAS_ESTADO[fila.estado] ?? fila.estado);
    const barra = crear("span", "grafico-barra");
    const relleno = document.createElement("i");
    relleno.style.width = `${Math.round((fila.cantidad / maximo) * 100)}%`;
    barra.append(relleno);
    const cantidad = crear("b", "", entero.format(fila.cantidad));
    envoltura.append(etiqueta, barra, cantidad);
    contenedor.append(envoltura);
  }
}

function renderRecientes() {
  const contenedor = $("lista-recientes");
  if (!contenedor || !estadoApp.resumen) return;
  contenedor.replaceChildren();
  const recientes = estadoApp.resumen.recientes ?? [];
  if (!recientes.length) {
    contenedor.append(crear("p", "admin-ayuda", "Las nuevas solicitudes aparecerán aquí."));
    return;
  }
  for (const solicitud of recientes) {
    const fila = crear("div", "reciente");
    const principal = crear("div");
    principal.append(crear("strong", "", `${solicitud.tipo === "PEDIDO" ? "Pedido" : "Cotización"} #${solicitud.id} · ${solicitud.cliente}`));
    principal.append(crear("span", "", `${fechaHora(solicitud.creadoEn)} · ${monto(solicitud.totalCentavos)}`));
    fila.append(principal, pastillaEstado(solicitud.estado));
    contenedor.append(fila);
  }
}

/* ---------------------------- Solicitudes ---------------------------- */

function solicitudesFiltradas() {
  const texto = estadoApp.filtroTexto.trim().toLowerCase();
  return estadoApp.solicitudes.filter(solicitud => {
    if (estadoApp.filtroTipo && solicitud.tipo !== estadoApp.filtroTipo) return false;
    if (estadoApp.filtroEstado && solicitud.estado !== estadoApp.filtroEstado) return false;
    if (!texto) return true;
    return [solicitud.id, solicitud.cliente, solicitud.correo, solicitud.empresa]
      .some(valor => String(valor ?? "").toLowerCase().includes(texto));
  });
}

function crearSelectorEstado(solicitud) {
  const select = document.createElement("select");
  select.className = "selector-estado";
  select.dataset.id = solicitud.id;
  select.setAttribute("aria-label", `Estado de la solicitud ${solicitud.id}`);
  for (const estado of ESTADOS) {
    const opcion = new Option(ETIQUETAS_ESTADO[estado], estado, false, estado === solicitud.estado);
    select.append(opcion);
  }
  select.addEventListener("change", () => void actualizarEstado(solicitud, select));
  return select;
}

function renderSolicitudes() {
  const contenedor = $("tabla-solicitudes");
  const vacio = $("vacio-solicitudes");
  if (!contenedor) return;
  const filas = solicitudesFiltradas();
  contenedor.replaceChildren();
  $("resumen-filtro").textContent = `${entero.format(filas.length)} de ${entero.format(estadoApp.solicitudes.length)} solicitudes.`;
  if (!filas.length) {
    vacio.hidden = false;
    contenedor.hidden = true;
    return;
  }
  vacio.hidden = true;
  contenedor.hidden = false;

  const tabla = crear("table", "tabla-admin");
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  for (const titulo of ["Solicitud", "Cliente", "Evento", "Total", "Estado", ""]) {
    filaCabecera.append(crear("th", "", titulo));
  }
  thead.append(filaCabecera);
  const tbody = document.createElement("tbody");

  for (const solicitud of filas) {
    const fila = document.createElement("tr");

    const celdaSolicitud = crear("td", "celda-principal");
    celdaSolicitud.append(
      crear("strong", "", `${solicitud.tipo === "PEDIDO" ? "Pedido" : "Cotización"} #${solicitud.id}`),
      crear("small", "", `Registrada ${fechaHora(solicitud.creadoEn)}`),
    );

    const celdaCliente = crear("td", "celda-principal");
    celdaCliente.append(crear("strong", "", solicitud.cliente));
    const detalleCliente = [solicitud.empresa, solicitud.correo].filter(Boolean).join(" · ");
    if (detalleCliente) celdaCliente.append(crear("small", "", detalleCliente));

    const celdaEvento = crear("td", "celda-principal");
    celdaEvento.append(crear("strong", "", fechaEvento(solicitud)));
    const datosEvento = [
      solicitud.personas ? `${entero.format(solicitud.personas)} personas` : null,
      solicitud.entrega === "DOMICILIO" ? "Domicilio" : solicitud.entrega === "RETIRO" ? "Retiro" : null,
    ].filter(Boolean).join(" · ");
    if (datosEvento) celdaEvento.append(crear("small", "", datosEvento));

    const celdaTotal = crear("td", "numero", monto(solicitud.totalCentavos));
    const celdaEstado = crear("td");
    celdaEstado.append(crearSelectorEstado(solicitud));
    const celdaAccion = crear("td");
    const ver = crear("button", "boton-tabla", "Ver detalle");
    ver.type = "button";
    ver.addEventListener("click", () => abrirDetalle(solicitud.id));
    celdaAccion.append(ver);

    fila.append(celdaSolicitud, celdaCliente, celdaEvento, celdaTotal, celdaEstado, celdaAccion);
    tbody.append(fila);
  }
  tabla.append(thead, tbody);
  contenedor.append(tabla);
}

async function actualizarEstado(solicitud, select) {
  const anterior = solicitud.estado;
  const nuevo = select.value;
  if (nuevo === anterior) return;
  select.disabled = true;
  try {
    const resultado = await solicitarApi(`admin/solicitudes/${solicitud.id}`, {
      metodo: "PATCH",
      cuerpo: { estado: nuevo },
    });
    solicitud.estado = resultado.estado;
    aviso(`Solicitud #${solicitud.id} actualizada a ${ETIQUETAS_ESTADO[resultado.estado] ?? resultado.estado}.`);
    renderSolicitudes();
    const detalle = estadoApp.solicitudes.find(item => item.id === estadoApp.detalleId);
    if (detalle) renderDetalle(detalle);
    void actualizarResumen();
  } catch (error) {
    select.value = anterior;
    if (!manejarError(error)) aviso("No se pudo cambiar el estado. Inténtalo de nuevo.", "error");
  } finally {
    select.disabled = false;
  }
}

/* ------------------------------ Clientes ----------------------------- */

function renderClientes() {
  const contenedor = $("tabla-clientes");
  const vacio = $("vacio-clientes");
  if (!contenedor) return;
  const texto = estadoApp.filtroCliente.trim().toLowerCase();
  const filas = estadoApp.clientes.filter(cliente => !texto ||
    [cliente.nombre, cliente.empresa, cliente.correo].some(valor => String(valor ?? "").toLowerCase().includes(texto)));
  contenedor.replaceChildren();
  if (!filas.length) {
    vacio.hidden = false;
    contenedor.hidden = true;
    return;
  }
  vacio.hidden = true;
  contenedor.hidden = false;

  const tabla = crear("table", "tabla-admin");
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  for (const titulo of ["Cliente", "Contacto", "Solicitudes", "Total histórico", "Última actividad"]) {
    filaCabecera.append(crear("th", "", titulo));
  }
  thead.append(filaCabecera);
  const tbody = document.createElement("tbody");
  for (const cliente of filas) {
    const fila = document.createElement("tr");
    const celdaCliente = crear("td", "celda-principal");
    celdaCliente.append(crear("strong", "", cliente.nombre));
    if (cliente.empresa) celdaCliente.append(crear("small", "", cliente.empresa));
    const celdaContacto = crear("td", "celda-principal");
    celdaContacto.append(crear("small", "", cliente.correo), crear("small", "", cliente.telefono));
    const celdaSolicitudes = crear("td", "numero", entero.format(cliente.solicitudes));
    const celdaTotal = crear("td", "numero", monto(cliente.totalCentavos));
    const celdaUltima = crear("td", "celda-principal");
    celdaUltima.append(crear("small", "", cliente.ultimaSolicitud ? fechaHora(cliente.ultimaSolicitud) : "Sin solicitudes"));
    fila.append(celdaCliente, celdaContacto, celdaSolicitudes, celdaTotal, celdaUltima);
    tbody.append(fila);
  }
  tabla.append(thead, tbody);
  contenedor.append(tabla);
}

/* ------------------------------ Catálogo ----------------------------- */

function renderCatalogo() {
  const contenedor = $("grid-catalogo");
  if (!contenedor) return;
  contenedor.replaceChildren();
  if (!estadoApp.productos.length) {
    contenedor.append(crear("p", "admin-ayuda", "No se pudo cargar el catálogo."));
    return;
  }
  for (const producto of estadoApp.productos) {
    const tarjeta = crear("article", "catalogo-tarjeta");
    const imagen = document.createElement("img");
    imagen.src = producto.imagen;
    imagen.alt = producto.imagenAlt ?? "";
    imagen.loading = "lazy";
    imagen.width = 960;
    imagen.height = 600;
    const cuerpo = crear("div", "catalogo-cuerpo");
    cuerpo.append(crear("h3", "", producto.nombre));
    cuerpo.append(crear("p", "", producto.descripcion));

    const datos = crear("div", "catalogo-datos");
    const comidas = [...new Set((producto.ofertas ?? []).map(oferta => TIPOS_COMIDA[oferta.tipoComida] ?? oferta.tipoComida))];
    for (const comida of comidas) datos.append(crear("span", "", comida));
    datos.append(crear("span", "", producto.etiqueta));
    cuerpo.append(datos);

    const precios = (producto.ofertas ?? []).map(oferta => oferta.precioCentavos);
    const desde = precios.length ? Math.min(...precios) : 0;
    const precio = crear("p", "catalogo-precio");
    precio.append(document.createTextNode(`Desde ${monto(desde)} `), crear("small", "", "por persona"));
    cuerpo.append(precio);

    const estados = crear("div", "catalogo-estados");
    estados.append(crear("span", producto.activo ? "estado-publicacion disponible" : "estado-publicacion oculto",
      producto.activo ? "Disponible" : "No disponible"));
    estados.append(crear("span", producto.mostrarInicio ? "estado-publicacion portada" : "estado-publicacion oculto",
      producto.mostrarInicio ? "En inicio" : "Fuera de inicio"));
    cuerpo.append(estados);

    const acciones = crear("div", "catalogo-acciones");
    const editar = crear("button", "boton-tabla", "Editar");
    editar.type = "button";
    editar.addEventListener("click", () => abrirProducto(producto));
    const disponibilidad = crear("button", "boton-tabla", producto.activo ? "Ocultar" : "Activar");
    disponibilidad.type = "button";
    disponibilidad.addEventListener("click", () => actualizarDisponibilidadProducto(producto, !producto.activo));
    const eliminar = crear("button", "boton-tabla boton-peligro", "Eliminar");
    eliminar.type = "button";
    eliminar.addEventListener("click", () => eliminarProducto(producto));
    acciones.append(editar, disponibilidad, eliminar);
    cuerpo.append(acciones);

    tarjeta.append(imagen, cuerpo);
    contenedor.append(tarjeta);
  }
}

function abrirProducto(producto = null) {
  const dialogo = $("dialogo-producto");
  const formulario = $("formulario-producto");
  if (!dialogo || !formulario) return;
  formulario.reset();
  $("producto-modo").textContent = producto ? "Editar producto" : "Nuevo producto";
  $("titulo-producto").textContent = producto ? "Editar producto" : "Crear producto";
  formulario.elements.idActual.value = producto?.id ?? "";
  formulario.elements.id.value = producto?.id ?? "";
  formulario.elements.id.disabled = Boolean(producto);
  formulario.elements.nombre.value = producto?.nombre ?? "";
  formulario.elements.descripcion.value = producto?.descripcion ?? "";
  formulario.elements.servicioId.value = producto?.servicioId ?? "alimentacion-equipos";
  formulario.elements.etiqueta.value = producto?.etiqueta ?? "Menú del día";
  formulario.elements.imagen.value = producto?.imagen ?? "";
  formulario.elements.imagenAlt.value = producto?.imagenAlt ?? "";
  formulario.elements.tipoComida.value = producto?.ofertas?.[0]?.tipoComida ?? "ALMUERZO";
  formulario.elements.precioCentavos.value = producto?.ofertas?.[0]?.precioCentavos ?? 1000;
  formulario.elements.minPersonas.value = producto?.ofertas?.[0]?.minPersonas ?? 10;
  formulario.elements.maxPersonas.value = producto?.ofertas?.[0]?.maxPersonas ?? 500;
  formulario.elements.ordenInicio.value = producto?.ordenInicio ?? 100;
  formulario.elements.activo.checked = producto ? producto.activo : true;
  formulario.elements.mostrarInicio.checked = producto ? producto.mostrarInicio : true;
  dialogo.showModal();
  formulario.elements.nombre.focus();
}

function cerrarProducto() {
  const dialogo = $("dialogo-producto");
  if (dialogo?.open) dialogo.close();
}

async function actualizarDisponibilidadProducto(producto, activo) {
  try {
    await solicitarApi(`admin/catalogo/${encodeURIComponent(producto.id)}`, {
      metodo: "PATCH",
      cuerpo: { ...producto, activo, mostrarInicio: activo ? producto.mostrarInicio : false },
    });
    aviso(activo ? "Producto disponible nuevamente." : "Producto retirado de la venta.");
    await cargarCatalogo();
  } catch (error) {
    manejarError(error);
  }
}

async function eliminarProducto(producto) {
  if (!window.confirm(`¿Eliminar “${producto.nombre}” del catálogo publicado?`)) return;
  try {
    await solicitarApi(`admin/catalogo/${encodeURIComponent(producto.id)}`, { metodo: "DELETE" });
    aviso("Producto eliminado del catálogo publicado.");
    await cargarCatalogo();
  } catch (error) {
    manejarError(error);
  }
}

function prepararCatalogoAdmin() {
  $("nuevo-producto")?.addEventListener("click", () => abrirProducto());
  $("cerrar-producto")?.addEventListener("click", cerrarProducto);
  $("cancelar-producto")?.addEventListener("click", cerrarProducto);
  $("dialogo-producto")?.addEventListener("click", evento => {
    if (evento.target === $("dialogo-producto")) cerrarProducto();
  });
  $("formulario-producto")?.addEventListener("submit", async evento => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datosCrudos = new FormData(formulario);
    const idActual = String(datosCrudos.get("idActual") ?? "");
    const datos = {
      id: idActual || String(datosCrudos.get("id") ?? "").trim(),
      nombre: String(datosCrudos.get("nombre") ?? "").trim(),
      descripcion: String(datosCrudos.get("descripcion") ?? "").trim(),
      servicioId: String(datosCrudos.get("servicioId") ?? "").trim(),
      etiqueta: String(datosCrudos.get("etiqueta") ?? "").trim(),
      imagen: String(datosCrudos.get("imagen") ?? "").trim(),
      imagenAlt: String(datosCrudos.get("imagenAlt") ?? "").trim(),
      tipoComida: String(datosCrudos.get("tipoComida") ?? ""),
      precioCentavos: Number(datosCrudos.get("precioCentavos")),
      minPersonas: Number(datosCrudos.get("minPersonas")),
      maxPersonas: Number(datosCrudos.get("maxPersonas")),
      ordenInicio: Number(datosCrudos.get("ordenInicio") || 100),
      activo: datosCrudos.has("activo"),
      mostrarInicio: datosCrudos.has("mostrarInicio"),
    };
    const boton = formulario.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      if (idActual) {
        await solicitarApi(`admin/catalogo/${encodeURIComponent(idActual)}`, { metodo: "PATCH", cuerpo: datos });
        aviso("Producto actualizado.");
      } else {
        await solicitarApi("admin/catalogo", { metodo: "POST", cuerpo: datos });
        aviso("Producto agregado al catálogo.");
      }
      cerrarProducto();
      await cargarCatalogo();
    } catch (error) {
      manejarError(error);
    } finally {
      boton.disabled = false;
    }
  });
}

/* ------------------------------- Detalle ----------------------------- */

function abrirDetalle(id) {
  const solicitud = estadoApp.solicitudes.find(item => item.id === id);
  if (!solicitud) return;
  estadoApp.detalleId = id;
  renderDetalle(solicitud);
  const dialogo = $("detalle-solicitud");
  if (dialogo && !dialogo.open) dialogo.showModal();
  $("cerrar-detalle")?.focus();
}

function renderDetalle(solicitud) {
  $("detalle-codigo").textContent = `Solicitud #${solicitud.id}`;
  $("detalle-titulo").textContent = `${solicitud.tipo === "PEDIDO" ? "Pedido" : "Cotización"} de ${solicitud.cliente}`;
  const cuerpo = $("detalle-cuerpo");
  cuerpo.replaceChildren();

  const meta = crear("div", "detalle-meta");
  const datos = [
    ["Cliente", solicitud.cliente],
    ["Empresa", solicitud.empresa || "—"],
    ["Correo", solicitud.correo],
    ["Teléfono", solicitud.telefono],
    ["Evento", fechaEvento(solicitud)],
    ["Personas", solicitud.personas ? entero.format(solicitud.personas) : "Por definir"],
    ["Entrega", solicitud.entrega === "DOMICILIO" ? `Domicilio · ${solicitud.direccion ?? ""}` : solicitud.entrega === "RETIRO" ? "Retiro coordinado" : "Por definir"],
    ["Registrada", fechaHora(solicitud.creadoEn)],
  ];
  for (const [titulo, valor] of datos) {
    const bloque = document.createElement("p");
    bloque.append(crear("small", "", titulo), document.createTextNode(valor || "—"));
    meta.append(bloque);
  }
  cuerpo.append(meta);

  if (solicitud.mensaje) {
    const mensaje = crear("p", "detalle-mensaje");
    mensaje.append(crear("strong", "", "Mensaje del cliente: "), document.createTextNode(solicitud.mensaje));
    cuerpo.append(mensaje);
  }

  if (solicitud.lineas?.length) {
    const lineas = crear("div", "detalle-lineas");
    for (const linea of solicitud.lineas) {
      const bloque = crear("div", "detalle-linea");
      const total = crear("b", "", monto(linea.totalCentavos));
      bloque.append(crear("strong", "", linea.paquete));
      bloque.append(crear("span", "", `Menú: ${linea.menu}`));
      bloque.append(crear("small", "", `${entero.format(linea.personas)} personas${linea.extras.length ? " · " + linea.extras.map(extra => extra.nombre).join(", ") : ""}`));
      if (linea.notas) bloque.append(crear("small", "", `Preferencias: ${linea.notas}`));
      bloque.append(total);
      lineas.append(bloque);
    }
    cuerpo.append(lineas);
  }

  const total = crear("div", "detalle-total");
  total.append(crear("span", "", "Total de referencia"), crear("span", "", monto(solicitud.totalCentavos)));
  cuerpo.append(total);

  $("detalle-estado").value = solicitud.estado;
  $("detalle-estado").onchange = evento => {
    const select = evento.currentTarget;
    void actualizarEstado(solicitud, select);
  };
}

/* ------------------------------ Navegación --------------------------- */

function cambiarVista(vista, actualizarHash = true) {
  if (!TITULOS[vista]) return;
  estadoApp.vista = vista;
  for (const boton of document.querySelectorAll("[data-vista]")) {
    if (boton.dataset.vista === vista) boton.setAttribute("aria-current", "page");
    else boton.removeAttribute("aria-current");
  }
  for (const panel of document.querySelectorAll("[data-panel]")) {
    panel.hidden = panel.dataset.panel !== vista;
  }
  $("titulo-vista").textContent = TITULOS[vista];
  if (actualizarHash) history.replaceState(null, "", "#" + vista);
  cerrarMenu();
  $("panel-contenido").scrollIntoView({ block: "start", behavior: "smooth" });
}

function cerrarMenu() {
  document.body.classList.remove("menu-abierto");
  const boton = $("admin-menu-toggle");
  boton?.setAttribute("aria-expanded", "false");
}

function prepararNavegacion() {
  for (const boton of document.querySelectorAll("[data-vista]")) {
    boton.addEventListener("click", () => cambiarVista(boton.dataset.vista));
  }
  for (const boton of document.querySelectorAll("[data-ir]")) {
    boton.addEventListener("click", () => cambiarVista(boton.dataset.ir));
  }
  const toggle = $("admin-menu-toggle");
  toggle?.addEventListener("click", () => {
    const abierto = !document.body.classList.contains("menu-abierto");
    document.body.classList.toggle("menu-abierto", abierto);
    toggle.setAttribute("aria-expanded", String(abierto));
  });
  document.addEventListener("click", evento => {
    if (!document.body.classList.contains("menu-abierto")) return;
    if (evento.target.closest(".admin-lateral") || evento.target.closest("#admin-menu-toggle")) return;
    cerrarMenu();
  });
  document.addEventListener("keydown", evento => {
    if (evento.key === "Escape" && document.body.classList.contains("menu-abierto")) {
      cerrarMenu();
      toggle?.focus();
    }
  });
  window.matchMedia("(min-width: 1024px)").addEventListener("change", evento => {
    if (evento.matches) cerrarMenu();
  });
}

function prepararFiltros() {
  $("buscar-solicitud").addEventListener("input", evento => {
    estadoApp.filtroTexto = evento.currentTarget.value;
    renderSolicitudes();
  });
  $("filtro-tipo").addEventListener("change", evento => {
    estadoApp.filtroTipo = evento.currentTarget.value;
    renderSolicitudes();
  });
  $("filtro-estado").addEventListener("change", evento => {
    estadoApp.filtroEstado = evento.currentTarget.value;
    renderSolicitudes();
  });
  $("limpiar-filtros").addEventListener("click", () => {
    estadoApp.filtroTexto = "";
    estadoApp.filtroTipo = "";
    estadoApp.filtroEstado = "";
    $("buscar-solicitud").value = "";
    $("filtro-tipo").value = "";
    $("filtro-estado").value = "";
    renderSolicitudes();
  });
  $("buscar-cliente").addEventListener("input", evento => {
    estadoApp.filtroCliente = evento.currentTarget.value;
    renderClientes();
  });
}

function prepararDetalle() {
  const dialogo = $("detalle-solicitud");
  $("cerrar-detalle").addEventListener("click", () => dialogo.close());
  dialogo.addEventListener("click", evento => {
    if (evento.target !== dialogo) return;
    const caja = dialogo.getBoundingClientRect();
    if (evento.clientX < caja.left || evento.clientX > caja.right ||
        evento.clientY < caja.top || evento.clientY > caja.bottom) dialogo.close();
  });
  dialogo.addEventListener("close", () => {
    estadoApp.detalleId = null;
  });
}

function prepararSesion() {
  $("cerrar-sesion-admin").addEventListener("click", async () => {
    const sesion = leerSesion();
    try {
      if (sesion?.token) {
        await solicitarApi("auth/logout", { metodo: "POST", cuerpo: {}, token: sesion.token });
      }
    } catch {
      /* Se cierra la copia local aunque el servidor no responda. */
    }
    borrarSesion();
    window.location.replace("index.html");
  });
}

/* ------------------------------- Carga ------------------------------- */

async function actualizarResumen() {
  try {
    estadoApp.resumen = await solicitarApi("admin/resumen");
    renderMetricas();
    renderGrafico();
    renderRecientes();
  } catch (error) {
    manejarError(error);
  }
}

async function cargarTodo() {
  if (estadoApp.cargando) return;
  estadoApp.cargando = true;
  const boton = $("actualizar-panel");
  boton.disabled = true;
  aviso("Actualizando el panel…");
  try {
    const [resumen, solicitudes, clientes] = await Promise.all([
      solicitarApi("admin/resumen"),
      solicitarApi("admin/solicitudes"),
      solicitarApi("admin/clientes"),
    ]);
    estadoApp.resumen = resumen;
    estadoApp.solicitudes = solicitudes.solicitudes ?? [];
    estadoApp.clientes = clientes.clientes ?? [];
    renderMetricas();
    renderGrafico();
    renderRecientes();
    renderSolicitudes();
    renderClientes();
    aviso(`Panel actualizado · ${fechaHora(new Date().toISOString())}`);
  } catch (error) {
    manejarError(error);
  } finally {
    estadoApp.cargando = false;
    boton.disabled = false;
  }
}

async function cargarCatalogo() {
  try {
    const catalogo = await solicitarApi("admin/catalogo");
    estadoApp.productos = Array.isArray(catalogo.productos) ? catalogo.productos : [];
    renderCatalogo();
  } catch (error) {
    manejarError(error);
    renderCatalogo();
  }
}

function iniciar() {
  const sesion = leerSesion();
  if (!esAdmin(sesion)) {
    window.location.replace("index.html?acceso=1");
    return;
  }
  pintarUsuario(sesion);
  poblarEstados();
  prepararNavegacion();
  prepararFiltros();
  prepararDetalle();
  prepararCatalogoAdmin();
  prepararSesion();
  $("actualizar-panel").addEventListener("click", () => void cargarTodo());

  const vistaInicial = location.hash.slice(1);
  cambiarVista(TITULOS[vistaInicial] ? vistaInicial : "resumen", false);

  void cargarTodo();
  void cargarCatalogo();
}

iniciar();
