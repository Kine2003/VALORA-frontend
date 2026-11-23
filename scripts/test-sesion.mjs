import { fechaPedido, pintarPedidos } from '../js/pedidos.js';
import { campo, campoTabla } from '../js/gestion.js';
import { estadoReceta } from '../js/cocina.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { solicitarApi, urlApi } from '../js/api.js';
import { leerSesion, guardarSesion, borrarSesion, restaurarSesion } from '../js/sesion.js';
globalThis.location = { origin: 'https://valora.test', href: 'https://valora.test/admin.html' };
globalThis.document = { querySelector: () => ({ content: '/' }) };
const respuesta = (status, cuerpo) => ({ status, ok: status < 400, json: async () => cuerpo });
test('las bajas sin campos envían JSON para el control CSRF',async()=>{
 const anterior=globalThis.fetch;
 globalThis.fetch=async(_url,opciones)=>{assert.equal(opciones.method,'DELETE');assert.equal(opciones.headers['Content-Type'],'application/json');assert.equal(opciones.body,'{}');return respuesta(200,{retirado:true});};
 try{assert.deepEqual(await solicitarApi('admin/catalogo/prueba',{metodo:'DELETE'}),{retirado:true});}finally{globalThis.fetch=anterior;}
});
test('sesión y transporte de cookies', async t => {
 await t.test('resuelve configuración relativa bajo el mismo origen', () => assert.equal(urlApi('auth/sesion').href, 'https://valora.test/api/v1/auth/sesion'));
 await t.test('descarta el token de la respuesta y conserva usuario solo en memoria', () => { guardarSesion({ usuario: {nombre:'Ana'}, token:'secreto'}); assert.deepEqual(leerSesion(), {usuario:{nombre:'Ana'}}); borrarSesion();assert.equal(leerSesion(),null); });
 await t.test('renueva una vez para peticiones concurrentes y reintenta con cookies', async () => {
  let renovaciones=0;const intentos=new Map();globalThis.fetch=async(url,opciones)=>{assert.equal(opciones.credentials,'include');assert.equal(opciones.headers.Authorization,undefined);if(url.pathname.endsWith('/renovar')){renovaciones++;await new Promise(resolve=>setTimeout(resolve,5));return respuesta(200,{usuario:{nombre:'Ana'}});}const n=intentos.get(url.href)||0;intentos.set(url.href,n+1);return respuesta(n?200:401,n?{ok:true}:{error:'Caducada'});};
  const valores=await Promise.all([solicitarApi('admin/gestion'),solicitarApi('cuenta/solicitudes')]);assert.equal(renovaciones,1);assert.ok(valores.every(v=>v.ok));
 });
 await t.test('detiene la renovación fallida sin bucles y borra la sesión', async () => {let peticiones=0;globalThis.fetch=async()=>{peticiones++;return respuesta(401,{error:'Sesión expirada'});};await assert.rejects(solicitarApi('admin/gestion'),error=>error.estado===401);assert.equal(peticiones,2);assert.equal(leerSesion(),null);});
 await t.test('no renueva un acceso rechazado', async () => {let peticiones=0;globalThis.fetch=async()=>{peticiones++;return respuesta(401,{error:'Credenciales inválidas'});};await assert.rejects(solicitarApi('auth/login',{metodo:'POST',cuerpo:{}}),error=>error.estado===401);assert.equal(peticiones,1);});
 await t.test('restaura usuario directo y renueva cuando sesión devuelve null',async()=>{globalThis.fetch=async url=>respuesta(200,url.pathname.endsWith('/sesion')?null:{usuario:{nombre:'Ana',roles:['USUARIO']}});assert.deepEqual(await restaurarSesion(),{usuario:{nombre:'Ana',roles:['USUARIO']}});});
});

test('receta sin stock conserva el estado completo y diferencia una receta pendiente', () => {
 assert.equal(estadoReceta({capacidad: '0'}), 'Sin existencias suficientes');
 assert.equal(estadoReceta({capacidad: null}), 'Receta pendiente');
 assert.equal(estadoReceta({capacidad: '8'}), 'Receta completa');
});

test('metadatos sin opciones crean entradas editables y CHECK crea selector', async t => {
 const documentoAnterior = globalThis.document;
 const opcionAnterior = globalThis.Option;
 class Elemento {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; }
  append(...hijos) { this.children.push(...hijos); }
 }
 globalThis.document = { createElement: tag => new Elemento(tag) };
 globalThis.Option = class {
  constructor(text, value) { this.text = text; this.value = value; }
 };
 try {
  const metadatos = [
   {nombre:'nombre', tipo:'character varying', inputType:'text', valor:'Ana', opciones:[], tag:'INPUT'},
   {nombre:'precio', tipo:'numeric', inputType:'number', valor:'12.50', opciones:[], tag:'INPUT'},
   {nombre:'estado', tipo:'text', valor:'ACTIVO', opciones:['ACTIVO','INACTIVO'], tag:'SELECT'},
  ];
  for (const meta of metadatos) await t.test(meta.nombre, () => {
   const {input, label} = campoTabla(meta,meta.valor);
   assert.equal(input.tagName,meta.tag);
   assert.equal(input.value,meta.valor);
   assert.equal(label.children[0],input);
   if(meta.tag==='INPUT') assert.equal(input.type,meta.inputType || meta.tipo);
   else assert.deepEqual(input.children.map(op=>op.value),['','ACTIVO','INACTIVO']);
  });
  await t.test('lista sin proveedores sigue siendo selector vacío', () => {
   const {input} = campo('idProveedor','text','',[]);
   assert.equal(input.tagName,'SELECT');
   assert.equal(input.children.length,1);
   assert.equal(input.children[0].value,'');
  });
 } finally { globalThis.document = documentoAnterior; globalThis.Option = opcionAnterior; }
});

test('fecha de pedido válida, ausente o malformada no interrumpe las tarjetas', () => {
 assert.match(fechaPedido('2026-11-23'), /23.*2026/);
 assert.equal(fechaPedido(null), 'Fecha por confirmar');
 assert.equal(fechaPedido('Thu Nov nonsense'), 'Fecha por confirmar');
 const documentoAnterior = globalThis.document, opcionAnterior = globalThis.Option;
 class Elemento {
  constructor(tag) { this.tagName=tag.toUpperCase(); this.children=[]; this.value=''; this.attributes={}; }
  append(...hijos) { this.children.push(...hijos); }
  replaceChildren(...hijos) { this.children=[...hijos]; }
  setAttribute(nombre,valor) { this.attributes[nombre]=valor; }
  addEventListener() {}
  get options() { return this.children; }
 }
 globalThis.document={createElement:tag=>new Elemento(tag),createTextNode:text=>({textContent:text})};
 globalThis.Option=class { constructor(text,value) { this.textContent=text;this.value=value; } };
 try {
  const lista=new Elemento('ul');
  pintarPedidos(lista,['2026-11-23',null,'Thu Nov nonsense'].map((fechaEvento,i)=>({id:i+1,tipo:'COTIZACION',estado:'NUEVA',fechaEvento,totalCentavos:1000})),{estado:new Elemento('p'),recargar:async()=>{}});
  const tarjetas=lista.children.find(el=>el.className==='pedidos-tarjetas');
  assert.equal(tarjetas.children.length,3);
  const textos=el=>[el.textContent||'',...(el.children||[]).map(textos)].join(' ');
  assert.equal((textos(tarjetas).match(/Fecha por confirmar/g)||[]).length,2);
  assert.match(textos(tarjetas),/23.*2026/);
 } finally { globalThis.document=documentoAnterior;globalThis.Option=opcionAnterior; }
});
