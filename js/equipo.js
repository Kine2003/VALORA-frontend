import { solicitarApi } from './api.js';
import { nodo, boton, inicializarGestion } from './gestion.js';
import { inicializarCocina } from './cocina.js';

export function fechaTrabajo(valor) {
  if (!valor) return 'Fecha por confirmar';
  const fecha = new Date(String(valor).slice(0, 10) + 'T12:00:00');
  return Number.isNaN(fecha.getTime()) ? 'Fecha por confirmar' : new Intl.DateTimeFormat('es-EC', {day:'numeric',month:'long'}).format(fecha);
}

/** Renders only the operational projection supplied by the server. */
export function pintarTrabajo(contenedor, solicitudes = [], {entregas = false, confirmar} = {}) {
  if (!solicitudes.length) { contenedor.append(nodo('p','equipo-vacio', entregas ? 'No tienes entregas pendientes.' : 'No hay servicios programados para hoy.')); return; }
  const lista = nodo('div','equipo-servicios');
  for (const servicio of solicitudes) {
    const tarjeta = nodo('article','equipo-servicio');
    tarjeta.append(nodo('p','admin-etiqueta',servicio.estado.replaceAll('_',' ')), nodo('h3','',`Servicio #${servicio.id}`), nodo('p','',fechaTrabajo(servicio.fechaEvento) + (servicio.horaEvento ? ` · ${servicio.horaEvento}` : '')));
    if (entregas) {
      tarjeta.append(nodo('p','',servicio.direccion || 'Dirección pendiente'));
      if (servicio.cliente) tarjeta.append(nodo('p','',servicio.cliente));
      if (servicio.telefono) tarjeta.append(nodo('p','',`Teléfono: ${servicio.telefono}`));
      if (servicio.estado === 'EN_PROCESO') {
        const accion = boton('Confirmar entrega', async () => {
          if (!globalThis.confirm('¿Confirmar que este pedido fue entregado?')) return;
          accion.disabled = true;
          try { await confirmar(servicio.id); } finally { accion.disabled = false; }
        },'boton');
        tarjeta.append(accion);
      }
    } else {
      if (servicio.personas !== undefined) tarjeta.append(nodo('p','',`${servicio.personas} personas`));
      for (const linea of servicio.lineas ?? []) tarjeta.append(nodo('p','',`${linea.menu} · ${linea.personas} personas`));
    }
    lista.append(tarjeta);
  }
  contenedor.append(lista);
}

export async function inicializarEquipo({aviso}) {
  document.body.classList.add('panel-equipo');
  document.title = 'Equipo · Válora';
  document.getElementById('admin-eyebrow').textContent = 'Panel del equipo';
  document.querySelector('.admin-marca small').textContent = 'Equipo Válora';
  const contenido = document.getElementById('panel-contenido');
  const menu = document.querySelector('.admin-menu');
  contenido.replaceChildren(document.getElementById('aviso-admin'));
  menu.replaceChildren();
  let vistaActual = 'jornada';
  const toggle = document.getElementById('admin-menu-toggle');
  toggle.addEventListener('click', () => {
    const abierto = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(abierto));
    document.body.classList.toggle('menu-abierto', abierto);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.body.classList.contains('menu-abierto')) {
      document.body.classList.remove('menu-abierto'); toggle.setAttribute('aria-expanded','false'); toggle.focus();
    }
  });
  function mostrar(id) {
    vistaActual = id;
    for (const panel of contenido.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== id;
    for (const b of menu.children) b.setAttribute('aria-current', b.dataset.vista === id ? 'page' : 'false');
    document.getElementById('titulo-vista').textContent = [...menu.children].find(b => b.dataset.vista === id)?.textContent || 'Mi jornada';
    document.body.classList.remove('menu-abierto'); toggle.setAttribute('aria-expanded','false');
  }
  const registrar = (id, nombre, panel) => {
    panel.hidden = true; contenido.append(panel);
    const b = boton(nombre, () => mostrar(id)); b.dataset.vista = id; menu.append(b);
  };
  async function cargar() {
    const actualizar = document.getElementById('actualizar-panel'); actualizar.disabled = true;
    try {
      const datos = await solicitarApi('equipo/panel');
      contenido.replaceChildren(document.getElementById('aviso-admin')); menu.replaceChildren();
      const panel = nodo('section','vista-admin equipo-jornada'); panel.dataset.panel = 'jornada';
      const cabecera = nodo('div','equipo-cabecera');
      cabecera.append(nodo('p','admin-etiqueta','Mi espacio de trabajo'),nodo('h2','',datos.perfil.nombre),nodo('p','',datos.perfil.descripcion)); panel.append(cabecera);
      if (datos.resumen) {
        const metricas = nodo('div','equipo-metricas');
        for (const fila of datos.resumen.solicitudes) {
          const metrica = nodo('article','equipo-metrica'); metrica.append(nodo('strong','',fila.total),nodo('span','',fila.estado.replaceAll('_',' '))); metricas.append(metrica);
        }
        panel.append(nodo('h3','','Estado de la operación'), metricas);
      }
      if (datos.trabajo) { panel.append(nodo('h3','','Servicios de hoy')); pintarTrabajo(panel,datos.trabajo.solicitudes); }
      if (datos.entregas && datos.permisos.includes('entregas')) {
        panel.append(nodo('h3','','Entregas pendientes'));
        pintarTrabajo(panel,datos.entregas.solicitudes,{entregas:true, confirmar:async id => {
          try { await solicitarApi(`equipo/entregas/${encodeURIComponent(id)}`,{metodo:'PATCH',cuerpo:{estado:'ENTREGADA'}}); aviso('Entrega confirmada.'); await cargar(); }
          catch (error) { aviso(error.message,'error'); }
        }});
      }
      if (!datos.trabajo && !datos.entregas && !datos.resumen) panel.append(nodo('p','equipo-vacio','Selecciona una sección para consultar o actualizar tu trabajo.'));
      registrar('jornada','Mi jornada',panel);
      if (datos.cocina) await inicializarCocina({registrar,aviso,ruta:'equipo',permisos:datos.permisos,datosIniciales:datos.cocina});
      if (datos.permisos.includes('tablas')) await inicializarGestion({registrar,aviso});
      mostrar([...menu.children].some(b => b.dataset.vista === vistaActual) ? vistaActual : 'jornada');
    } catch (error) { aviso(error.message || 'No pudimos cargar tu panel. Usa Actualizar para reintentar.','error'); }
    finally { actualizar.disabled = false; }
  }
  document.getElementById('actualizar-panel').addEventListener('click', () => void cargar());
  await cargar();
}
