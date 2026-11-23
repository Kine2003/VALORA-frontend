import { solicitarApi } from './api.js';
export function nodo(tag, clase, texto) { const el = document.createElement(tag); if (clase) el.className = clase; if (texto !== undefined) el.textContent = texto; return el; }
export function boton(texto, accion, clase = 'boton-tabla') { const el = nodo('button', clase, texto); el.type = 'button'; el.addEventListener('click', accion); return el; }
export function campo(nombre, tipo = 'text', valor = '', opciones) {
  const etiquetas = {idPaquete:'Paquete', idTipoComida:'Tipo de comida', tipo:'Tipo de plato', alergenos:'Alérgenos (opcional)', precioAdicionalCentavos:'Precio adicional por persona (centavos USD)', idOpcion:'Plato', idInsumo:'Ingrediente', idProveedor:'Proveedor', precioUnitario:'Costo por unidad base (USD)', codigoLote:'Código de lote', fechaVencimiento:'Fecha de vencimiento', porciones:'Porciones', cantidad:'Cantidad', password:'Contraseña', correo:'Correo o usuario', nombre:'Nombre'};
  const label = nodo('label', 'gestion-campo', etiquetas[nombre] || nombre.replaceAll('_', ' '));
  const input = opciones ? document.createElement('select') : document.createElement('input');
  if (opciones) { input.append(new Option('Seleccionar', '')); for (const op of opciones) input.append(new Option(op.etiqueta ?? op.nombre ?? op, op.valor ?? op.id ?? op)); }
  else { input.type = tipo; if (tipo === 'number') input.step = 'any'; }
  input.name = nombre; input.value = valor ?? ''; label.append(input); return { label, input };
}
export function campoTabla(c, original = '') {
  const tipo = /date/.test(c.tipo) && !c.tipo.includes('timestamp') ? 'date' : /timestamp/.test(c.tipo) ? 'datetime-local' : /int|numeric|decimal|real|double/.test(c.tipo) ? 'number' : 'text';
  const valor = original && tipo === 'date' ? String(original).slice(0, 10) : original && tipo === 'datetime-local' ? String(original).slice(0, 16) : original;
  const f = campo(c.nombre, tipo, valor, c.opciones?.length ? c.opciones : undefined);
  if (/int/.test(c.tipo) && f.input.type === 'number') f.input.step = '1';
  f.input.required = Boolean(c.requerido);
  if (c.longitud) f.input.maxLength = c.longitud;
  return f;
}
export async function inicializarGestion({ registrar, aviso }) {
 const { secciones } = await solicitarApi('admin/gestion');
 for (const seccion of secciones) {
  const panel = nodo('section', 'vista-admin gestion-seccion'); panel.dataset.panel = seccion.id; panel.hidden = true;
  const titulo = nodo('h2', '', seccion.nombre), ayuda = nodo('p', 'admin-descripcion', 'Consulta y administra los registros de esta sección.');
  const tabs = nodo('div', 'gestion-tabs'); tabs.setAttribute('aria-label', 'Tablas de ' + seccion.nombre);
  const contenido = nodo('div', 'gestion-contenido'); panel.append(titulo, ayuda, tabs, contenido); registrar(seccion.id, seccion.nombre, panel);
  let tablaActual, pagina = 1, buscar = '', turno = 0;
  async function cargar(tabla = tablaActual) {
   tablaActual = tabla; const actual = ++turno;
   for (const b of tabs.children) b.setAttribute('aria-pressed', String(b.dataset.tabla === tabla.nombre));
   contenido.replaceChildren(nodo('p', 'admin-ayuda', 'Cargando registros…'));
   try {
    const datos = await solicitarApi(`admin/tablas/${encodeURIComponent(tabla.nombre)}?pagina=${pagina}&buscar=${encodeURIComponent(buscar)}`); if(actual !== turno) return;
    contenido.replaceChildren(); const barra = nodo('div', 'gestion-barra'); const busqueda = campo('Buscar registros', 'search', buscar); busqueda.input.maxLength = 120;
    const formulario = nodo('form', 'gestion-busqueda'); formulario.append(busqueda.label, boton('Buscar', () => { buscar = busqueda.input.value; pagina = 1; void cargar(); })); formulario.addEventListener('submit', e => {e.preventDefault();buscar=busqueda.input.value;pagina=1;void cargar();}); barra.append(formulario);
    if(tabla.crear) barra.append(boton('Crear registro', () => editar(tabla)));
    if(tabla.nombre==='usuario') barra.append(boton('Crear cuenta',()=>crearCuenta()));
    contenido.append(barra); if(tabla.motivo) contenido.append(nodo('p','admin-ayuda',tabla.motivo));
    const envoltura = nodo('div', 'tabla-scroll'); const t = nodo('table', 'tabla-admin'); const head = document.createElement('thead'), fila = document.createElement('tr');
    for(const c of tabla.campos) fila.append(nodo('th','',c.nombre.replaceAll('_',' '))); fila.append(nodo('th','','Acciones')); head.append(fila);t.append(head);
    const body = document.createElement('tbody');
    for(const registro of datos.filas) { const tr = document.createElement('tr');for(const c of tabla.campos) tr.append(nodo('td','',registro[c.nombre] === null ? 'Sin valor' : String(registro[c.nombre] ?? '')));
      const acciones=nodo('td','gestion-acciones');
      const operar = async (ruta, mensaje) => { if(!confirm(mensaje))return;try{await solicitarApi(ruta,{metodo:'POST',cuerpo:{}});await cargar();aviso('Operación guardada.');}catch(e){aviso(e.message,'error');} };
      if(tabla.nombre==='sesion_usuario') acciones.append(boton('Revocar sesión',()=>operar('admin/sesiones/'+encodeURIComponent(registro[tabla.claves[0]])+'/revocar','¿Revocar esta sesión?')));
      if(tabla.nombre==='factura') for(const accion of ['emitir','anular'])acciones.append(boton(accion==='emitir'?'Emitir factura':'Anular factura',()=>operar('admin/facturas/'+encodeURIComponent(registro[tabla.claves[0]])+'/'+accion,'¿'+(accion==='emitir'?'Emitir':'Anular')+' esta factura?')));
      if(tabla.editar)acciones.append(boton('Editar',()=>editar(tabla,registro)));if(tabla.eliminar)acciones.append(boton('Eliminar',async()=>{if(!confirm('¿Eliminar este registro? Esta acción puede afectar relaciones.'))return;try{await solicitarApi('admin/tablas/'+encodeURIComponent(tabla.nombre),{metodo:'DELETE',cuerpo:{clave:clave(tabla,registro)}});await cargar();aviso('Registro eliminado.');}catch(e){aviso(e.message,'error');}}));tr.append(acciones);body.append(tr); }
    t.append(body);envoltura.append(t);contenido.append(envoltura);if(!datos.filas.length)contenido.append(nodo('p','admin-ayuda','No se encontraron registros.'));
    const pie=nodo('div','gestion-barra');const anterior=boton('Anterior',()=>{pagina--;void cargar();});anterior.disabled=pagina<=1;const siguiente=boton('Siguiente',()=>{pagina++;void cargar();});siguiente.disabled=pagina*(datos.tamano||25)>=datos.total;pie.append(anterior,nodo('span','',`${datos.total} registros · Página ${pagina}`),siguiente);contenido.append(pie);
   }catch(e){if(actual!==turno)return;contenido.replaceChildren(nodo('p','admin-ayuda',e.message),boton('Reintentar',()=>void cargar()));}
  }
  function crearCuenta(){
   const dialogo=nodo('dialog','dialogo-gestion'),form=nodo('form','gestion-form');form.append(nodo('h2','','Crear cuenta'));const entradas={};for(const [nombre,tipo]of [['nombre','text'],['correo','text'],['password','password']]){const f=campo(nombre,tipo);f.input.required=true;if(nombre==='password'){f.input.minLength=15;f.input.maxLength=128;f.input.autocomplete='new-password';}else f.input.maxLength=200;entradas[nombre]=f.input;form.append(f.label);}const roles=nodo('fieldset');roles.append(nodo('legend','','Permisos'));const checks=[];for(const rol of ['USUARIO','CATALOGO','OPERACIONES','FINANZAS','ADMINISTRADOR']){const label=nodo('label','gestion-rol',rol),input=document.createElement('input');input.type='checkbox';input.value=rol;input.checked=rol==='USUARIO';label.prepend(input);roles.append(label);checks.push(input);}const error=nodo('p','gestion-error');error.setAttribute('role','alert');const enviar=nodo('button','boton','Crear cuenta');enviar.type='submit';form.append(roles,error,enviar,boton('Cancelar',()=>dialogo.close()));dialogo.append(form);document.body.append(dialogo);dialogo.addEventListener('close',()=>dialogo.remove());form.addEventListener('submit',async e=>{e.preventDefault();enviar.disabled=true;try{await solicitarApi('admin/usuarios',{metodo:'POST',cuerpo:{...Object.fromEntries(Object.entries(entradas).map(([k,v])=>[k,v.value])),roles:checks.filter(c=>c.checked).map(c=>c.value)}});dialogo.close();await cargar();aviso('Cuenta creada.');}catch(e){error.textContent=e.message;}finally{enviar.disabled=false;}});dialogo.showModal();entradas.nombre.focus();
  }
  function clave(tabla,fila){return Object.fromEntries(tabla.claves.map(c=>[c,fila[c]]));}
  function editar(tabla,registro){const dialogo=nodo('dialog','dialogo-gestion');const form=nodo('form','gestion-form');form.append(nodo('h2','',`${registro?'Editar':'Crear'} ${tabla.etiqueta}`));const grid=nodo('div','gestion-grid'),entradas=[];
   for(const c of tabla.campos){if(c.editable===false || (registro && tabla.claves.includes(c.nombre)) || (!registro && c.identidad))continue;
    const f=campoTabla(c,registro?.[c.nombre]);grid.append(f.label);entradas.push({c,input:f.input});}
   const error=nodo('p','gestion-error');error.setAttribute('role','alert');const enviar=nodo('button','boton','Guardar registro');enviar.type='submit';form.append(grid,error,enviar,boton('Cancelar',()=>dialogo.close()));dialogo.append(form);document.body.append(dialogo);dialogo.addEventListener('close',()=>dialogo.remove());form.addEventListener('submit',async e=>{e.preventDefault();enviar.disabled=true;try{const valores={};for(const{c,input}of entradas){if(!registro && input.value==='' && !c.requerido)continue;if (/int/.test(c.tipo) && input.value!=='' && !Number.isSafeInteger(Number(input.value))) throw new Error('El campo '+c.nombre+' requiere un entero válido.');valores[c.nombre]=input.value===''?null:/int/.test(c.tipo)?Number(input.value):input.value;}await solicitarApi('admin/tablas/'+encodeURIComponent(tabla.nombre),{metodo:registro?'PATCH':'POST',cuerpo:{...(registro?{clave:clave(tabla,registro)}:{}),valores}});dialogo.close();await cargar();aviso('Registro guardado.');}catch(e){error.textContent=e.message;}finally{enviar.disabled=false;}});dialogo.showModal();form.querySelector('input,select')?.focus();
  }
  for(const tabla of seccion.tablas){const b=boton(tabla.etiqueta,()=>{pagina=1;buscar='';void cargar(tabla);});b.dataset.tabla=tabla.nombre;tabs.append(b);}
  if(seccion.tablas.length)void cargar(seccion.tablas[0]);
 }
}
