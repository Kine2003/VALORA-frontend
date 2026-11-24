import { solicitarApi } from './api.js';
import { nodo, boton, campo } from './gestion.js';
export function estadoReceta(r) { return r.capacidad === null ? 'Receta pendiente' : Number(r.capacidad) === 0 ? 'Sin existencias suficientes' : 'Receta completa'; }
export async function inicializarCocina({registrar,aviso, ruta = 'admin/cocina', permisos = null, datosIniciales = null}) {
 const rutaBase = ruta;
 const permite = capacidad => !permisos || permisos.includes(capacidad);
 let vistaActual = 'Ingredientes';
 const panel=nodo('section','vista-admin');panel.dataset.panel='cocina-operacion';panel.hidden=true;panel.append(nodo('h2','','Cocina e inventario'),nodo('p','admin-descripcion',permisos ? 'Consulta las recetas y existencias para organizar tu trabajo.' : 'Recetas por porción, compras y capacidad según las existencias disponibles.'));const contenido=nodo('div','cocina-contenido');panel.append(contenido);registrar('cocina-operacion','Cocina e inventario',panel);
 async function cargar(){contenido.replaceChildren(nodo('p','admin-ayuda','Cargando cocina…'));try{const datos=datosIniciales ?? await solicitarApi(ruta === 'equipo' ? 'equipo/panel' : ruta);datosIniciales=null;render(datos.cocina ?? datos);}catch(e){contenido.replaceChildren(nodo('p','admin-ayuda',e.message),boton('Reintentar',()=>void cargar()));}}
 function tabla(titulos,filas){const scroll=nodo('div','tabla-scroll'),t=nodo('table','tabla-admin'),head=document.createElement('thead'),tr=document.createElement('tr');for(const titulo of titulos)tr.append(nodo('th','',titulo));head.append(tr);t.append(head);const body=document.createElement('tbody');for(const fila of filas){const r=document.createElement('tr');for(const valor of fila){const td=document.createElement('td');td.append(valor instanceof Node?valor:document.createTextNode(String(valor??'Pendiente')));r.append(td);}body.append(r);}t.append(body);scroll.append(t);return scroll;}
 function nombrePlato(r) { return [r.nombre, r.paquete, r.tipoComida, r.tipo].filter(Boolean).join(' · '); }
 function render(datos){contenido.replaceChildren();const tabs=nodo('div','gestion-tabs'),zona=nodo('div','cocina-zona');contenido.append(tabs,zona);
  const ingredientes=datos.ingredientes.map(i=>({id:i.id,nombre:`${i.nombre} (${i.unidad})`})),platos=datos.recetas.map(r=>({id:r.idOpcion,nombre:nombrePlato(r)}));
  function formulario(titulo,campos,ruta,extra={}){const form=nodo('form','gestion-form');form.append(nodo('h3','',titulo));const grid=nodo('div','gestion-grid'),inputs={};for(const [nombre,tipo,opciones,requerido=true]of campos){const f=campo(nombre,tipo,'',opciones);f.input.required=requerido;if(tipo==='number'){f.input.min=['precioUnitario','precioAdicionalCentavos'].includes(nombre)?'0':'0.000001';}grid.append(f.label);inputs[nombre]=f.input;}const error=nodo('p','gestion-error');error.setAttribute('role','alert');const guardar=nodo('button','boton','Guardar '+titulo.toLowerCase());guardar.type='submit';form.append(grid,error,guardar);let referencia=globalThis.crypto.randomUUID();form.addEventListener('submit',async e=>{e.preventDefault();guardar.disabled=true;try{const cuerpo={...extra};for(const [nombre,input]of Object.entries(inputs))if(input.value!=='')cuerpo[nombre]=['porciones','precioAdicionalCentavos'].includes(nombre)?Number(input.value):input.value;if(ruta==='compras'||ruta==='produccion')cuerpo.referencia=referencia;await solicitarApi(rutaBase+'/'+ruta,{metodo:'POST',cuerpo});referencia=globalThis.crypto.randomUUID();aviso('Operación guardada.');await cargar();}catch(e){error.textContent=e.message;}finally{guardar.disabled=false;}});return {form,inputs};}
  function existencias(){zona.replaceChildren(nodo('h3','','Ingredientes disponibles'),tabla(['Ingrediente','Unidad base','Stock disponible','Estado'],datos.ingredientes.map(i=>[i.nombre,i.unidad,i.stock,i.activo?'Activo':'Inactivo'])),nodo('p','admin-ayuda',permisos ? 'Las cantidades se expresan en gramos, mililitros o unidades, según cada ingrediente.' : 'Las cantidades se expresan en la unidad base de cada ingrediente. Para crear o editar ingredientes utiliza la pestaña de tablas de inventario.'));}
  function platosNuevos() {
    const {form,inputs} = formulario('Plato', [
      ['nombre','text'],
      ['idPaquete','text',datos.paquetes || []],
      ['idTipoComida','text',datos.tiposComida || []],
      ['tipo','text',[{id:'MENU',nombre:'Menú'},{id:'EXTRA',nombre:'Extra'}]],
      ['precioAdicionalCentavos','number'],
      ['alergenos','text',null,false],
    ], 'platos');
    inputs.tipo.value = 'MENU';
    inputs.precioAdicionalCentavos.value = '0';
    inputs.precioAdicionalCentavos.step = '1';
    inputs.nombre.maxLength = 200;
    inputs.alergenos.maxLength = 500;
    zona.replaceChildren(nodo('h3','','Añadir un plato'), nodo('p','admin-ayuda','Selecciona el paquete y el tipo de comida. Su oferta debe estar activa. El código del plato se asigna al guardar.'), form, nodo('p','admin-ayuda','100 centavos equivalen a USD 1,00. Usa 0 si el plato no tiene un precio adicional. Puedes editar o dar de baja los platos existentes en Tablas avanzadas, dentro de Opciones de paquete.'));
  }
  function recetas(){zona.replaceChildren();if(!platos.length){zona.append(nodo('p','admin-ayuda','Todavía no hay platos registrados para consultar sus recetas.'));return;}const selector=campo('Plato','text','',platos);zona.append(selector.label);const editor=nodo('div');zona.append(editor);function mostrar(){const receta=datos.recetas.find(r=>String(r.idOpcion)===selector.input.value);editor.replaceChildren();if(!receta)return;editor.append(nodo('p','admin-ayuda',receta.capacidad !== null ? `Capacidad individual: ${receta.capacidad} porciones. ${estadoReceta(receta)}.` : 'Receta pendiente.'));if (!permite('recetas')) { editor.append(tabla(['Ingrediente','Cantidad por porción'],receta.ingredientes.map(i=>[i.nombre || ingredientes.find(x=>String(x.id)===String(i.idInsumo))?.nombre || i.idInsumo,i.cantidad]))); return; }const form=nodo('form','gestion-form'),filas=nodo('div','receta-filas'),entradas=[];
    function agregar(valor={}){const fila=nodo('div','receta-fila'),insumo=campo('Ingrediente','text',valor.idInsumo,ingredientes),cantidad=campo('Cantidad por porción','number',valor.cantidad);insumo.input.required=true;cantidad.input.required=true;cantidad.input.min='0.000001';const entrada={fila,insumo:insumo.input,cantidad:cantidad.input};entradas.push(entrada);fila.append(insumo.label,cantidad.label,boton('Quitar',()=>{entradas.splice(entradas.indexOf(entrada),1);fila.remove();}));filas.append(fila);}
    for(const i of receta.ingredientes)agregar(i);if(!entradas.length)agregar();const error=nodo('p','gestion-error');error.setAttribute('role','alert');const guardar=nodo('button','boton','Guardar receta');guardar.type='submit';form.append(filas,boton('Añadir ingrediente',()=>agregar()),error,guardar);form.addEventListener('submit',async e=>{e.preventDefault();guardar.disabled=true;try{await solicitarApi(rutaBase+'/recetas',{metodo:'POST',cuerpo:{idOpcion:receta.idOpcion,ingredientes:entradas.map(i=>({idInsumo:i.insumo.value,cantidad:i.cantidad.value}))}});aviso('Receta guardada.');await cargar();}catch(e){error.textContent=e.message;}finally{guardar.disabled=false;}});editor.append(form);}selector.input.addEventListener('change',mostrar);if(platos.length){selector.input.value=String(platos[0].id);mostrar();}}
  function compras(){const {form}=formulario('Compra',[['idProveedor','text',datos.proveedores],['idInsumo','text',ingredientes],['cantidad','number'],['precioUnitario','number'],['codigoLote','text'],['fechaVencimiento','date',null,false]],'compras');zona.replaceChildren(form,nodo('p','admin-ayuda','La compra registra la recepción y actualiza las existencias. El costo es por unidad base.'));}
  function capacidad() {
    zona.replaceChildren(nodo('h3', '', 'Capacidad por plato'));
    const buscar = campo('Buscar plato', 'search');
    const resumen = nodo('div');
    zona.append(buscar.label, resumen);
    let pagina = 1;
    function mostrarCapacidades() {
      const texto = buscar.input.value.trim().toLocaleLowerCase('es');
      const filas = datos.recetas.filter(r => nombrePlato(r).toLocaleLowerCase('es').includes(texto));
      const totalPaginas = Math.max(1, Math.ceil(filas.length / 15));
      pagina = Math.min(pagina, totalPaginas);
      const anterior = boton('Anterior', () => { pagina--; mostrarCapacidades(); });
      const siguiente = boton('Siguiente', () => { pagina++; mostrarCapacidades(); });
      anterior.disabled = pagina === 1;
      siguiente.disabled = pagina === totalPaginas;
      const pie = nodo('div', 'gestion-barra');
      pie.append(anterior, nodo('span', '', filas.length + ' platos · Página ' + pagina + ' de ' + totalPaginas), siguiente);
      resumen.replaceChildren(tabla(['Plato', 'Porciones disponibles', 'Receta'], filas.slice((pagina - 1) * 15, pagina * 15).map(r => [nombrePlato(r), r.capacidad ?? 'Sin calcular', estadoReceta(r)])), pie);
    }
    buscar.input.addEventListener('input', () => { pagina = 1; mostrarCapacidades(); });
    mostrarCapacidades();
    const form = nodo('form', 'gestion-form');
    form.append(nodo('h3', '', 'Planificar varios platos'), nodo('p', 'admin-ayuda', 'Añade los platos y las porciones del mismo servicio para comprobar los ingredientes compartidos.'));
    const filas = nodo('div', 'receta-filas'), entradas = [];
    function agregar() {
      const fila = nodo('div', 'receta-fila');
      const plato = campo('Plato', 'text', '', platos), porciones = campo('porciones', 'number', 1);
      plato.input.required = true;
      porciones.input.required = true;
      porciones.input.min = '1';
      porciones.input.step = '1';
      const entrada = { plato: plato.input, porciones: porciones.input };
      entradas.push(entrada);
      fila.append(plato.label, porciones.label, boton('Quitar', () => { entradas.splice(entradas.indexOf(entrada), 1); fila.remove(); }));
      filas.append(fila);
    }
    agregar();
    const resultado = nodo('div');
    resultado.setAttribute('aria-live', 'polite');
    const enviar = nodo('button', 'boton', 'Calcular ingredientes');
    enviar.type = 'submit';
    form.append(filas, boton('Añadir plato', agregar), enviar, resultado);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!entradas.length) { resultado.textContent = 'Añade al menos un plato al plan.'; return; }
      enviar.disabled = true;
      try {
        const plan = await solicitarApi(rutaBase+'/planificar', { metodo: 'POST', cuerpo: { platos: entradas.map(i => ({ idOpcion: i.plato.value, porciones: Number(i.porciones.value) })) } });
        resultado.replaceChildren(nodo('p', 'admin-ayuda', plan.listo ? 'Hay ingredientes para este plan.' : plan.advertencia || 'Faltan ingredientes para este plan.'), tabla(['Ingrediente', 'Necesario', 'Disponible', 'Faltante', 'Unidad'], plan.ingredientes.map(i => [i.nombre, i.necesario, i.stock, i.faltante, i.unidad])));
      } catch (error) { resultado.textContent = error.message; }
      finally { enviar.disabled = false; }
    });
    if (permite('planificar')) zona.append(form);
    const produccion = formulario('Producción', [['idOpcion', 'text', platos], ['porciones', 'number']], 'produccion');
    produccion.inputs.porciones.step = '1';
    if (permite('produccion')) zona.append(produccion.form, nodo('p', 'admin-ayuda', 'Registrar producción descuenta los ingredientes de los lotes disponibles.'));
  }
  for(const[nombre,accion]of [['Ingredientes',existencias],['Platos',platosNuevos],['Recetas',recetas],['Compras',compras],['Capacidad y producción',capacidad]]){if (nombre !== 'Recetas' && !permite({'Ingredientes':'ingredientes','Platos':'platos','Recetas':'recetas','Compras':'compras','Capacidad y producción':permite('planificar')?'planificar':'produccion'}[nombre])) continue;const b=boton(nombre,()=>{vistaActual=nombre;for(const t of tabs.children)t.setAttribute('aria-pressed',String(t===b));accion();});tabs.append(b);if(nombre===vistaActual)b.dataset.activa='true';}const seleccionada=[...tabs.children].find(b=>b.dataset.activa==='true')||tabs.firstChild;seleccionada?.click();
 }
 await cargar();
}
