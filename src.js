import {createClient} from '@supabase/supabase-js';
import QRCode from 'qrcode';
import {Html5Qrcode} from 'html5-qrcode';
import './style.css';

const SUPABASE_URL='https://ldnxjysbdtgzrrckixpt.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_g3YlYLl8kfb7yDqLYXhGsQ_Ps3sah8g';
const sb=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const app=document.querySelector('#app');
app.innerHTML=`<section id="login" class="card"><h2>🔐 Acceso de administrador</h2><input id="loginEmail" type="email" placeholder="Correo"><div style="display:flex;gap:6px"><input id="loginPassword" type="password" placeholder="Contraseña" style="flex:1"><button id="togglePassword" type="button">👁️</button></div><button id="loginBtn">🔓 Ingresar</button><div id="loginResult"></div></section><div id="adminApp" style="display:none"><header><h1>RAVE & ROLL 2.0</h1><p>4 de octubre de 2026 · 500 entradas</p></header>
<nav><button data-t="dashboard">Panel</button><button data-t="training">🎓 Capacitación</button><button data-t="scan">Escanear</button><button data-t="tickets">Entradas</button><button data-t="print">Pulseras</button></nav>
<main>
<section id="dashboard" class="tab"><div id="stats" class="grid"></div><div class="card"><b>Preventa 1:</b> 125 × S/15 &nbsp; <b>Preventa 2:</b> 175 × S/20 &nbsp; <b>General:</b> 200 × S/30</div></section>
<section id="scan" class="tab hidden"><div class="card"><h2>Control de acceso</h2><div id="reader"></div><input id="manual" placeholder="RR2-0001"><div class="actions"><button id="validate">Validar QR</button><button id="exit">🚪 Registrar salida</button><button id="reentry" style="display:none">🔄 Reingreso</button><button id="stop">Detener cámara</button></div><div id="result"></div></div></section>
<section id="tickets" class="tab hidden"><div class="card"><h2>Buscar entradas</h2><input id="search" placeholder="Código o tipo"><div id="list"></div></div></section>
<section id="print" class="tab hidden"><div class="card"><h2>Pulseras con QR</h2><p>Genera una plantilla con un QR único por entrada.</p><button id="loadPrint">Generar 500</button> <button onclick="window.print()">Imprimir</button><div id="printArea"></div></div></section>
<section id="training" class="tab hidden">
<div class="card">
<h2>🎓 Modo Capacitación</h2>
<p>Entrena al personal usando estas entradas. No afectan las 500 entradas reales.</p>
<div class="card"><b>🟢 TEST-RR-001</b><br>Entrada válida de práctica.</div>
<div class="card"><b>🔴 TEST-RR-002</b><br>Entrada no vendida de práctica.</div>
<button id="resetTraining">🔄 Reiniciar capacitación</button>
<div id="trainingResult"></div>
</div>
</section>
</main>`;

let scanner=null;
async function resetTraining(){
  const ok=confirm('¿Reiniciar las 2 entradas de capacitación? No se modificará ninguna entrada real.');
  if(!ok)return;

  const {error}=await sb.from('test_tickets')
    .update({
      status:'available',
      sold:true,
      entry_count:0,
      first_entry_at:null,
      last_action_at:null,
      last_action:null
    })
    .eq('code','TEST-RR-001');

  if(error){
    document.querySelector('#trainingResult').innerHTML='<div class="card red">❌ No se pudo reiniciar TEST-RR-001.</div>';
    return;
  }

  const {error:error2}=await sb.from('test_tickets')
    .update({
      status:'available',
      sold:false,
      entry_count:0,
      first_entry_at:null,
      last_action_at:null,
      last_action:null
    })
    .eq('code','TEST-RR-002');

  if(error2){
    document.querySelector('#trainingResult').innerHTML='<div class="card red">❌ No se pudo reiniciar TEST-RR-002.</div>';
    return;
  }

  document.querySelector('#trainingResult').innerHTML='<div class="card green"><b>✅ Capacitación reiniciada</b><br>TEST-RR-001 está lista para una entrada válida y TEST-RR-002 para una entrada rechazada.</div>';
}
document.querySelector('#resetTraining').onclick=resetTraining;
function show(id){document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('hidden',x.id!==id)); if(scanner){scanner.stop().catch(()=>{});scanner=null;} if(id==='dashboard')stats(); if(id==='tickets')list(); if(id==='scan')startScan();}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.t));
async function stats(){
 const {data,error}=await sb.from('tickets').select('status,price,sold,entry_count');
 if(error){
  document.querySelector('#stats').innerHTML='<div class="card red">No conectado a Supabase.</div>';
  return;
 }

 const total=data.length;
 const sold=data.filter(x=>x.sold===true).length;
 const availableToSell=total-sold;
 const inside=data.filter(x=>x.status==='inside').length;
 const outside=data.filter(x=>x.status==='outside').length;
 const pending=data.filter(x=>x.sold===true && x.status==='available').length;
 const revenue=data.filter(x=>x.sold===true).reduce((s,x)=>s+Number(x.price),0);
 const reentries=data.reduce((s,x)=>s+Math.max((x.entry_count||0)-1,0),0);

 document.querySelector('#stats').innerHTML=`
 <div class="card"><b>Total</b><strong>${total}</strong></div>
 <div class="card"><b>Vendidas</b><strong class="green">${sold}</strong></div>
 <div class="card"><b>Disponibles para vender</b><strong>${availableToSell}</strong></div>
 <div class="card"><b>Dentro</b><strong class="green">${inside}</strong></div>
 <div class="card"><b>Fuera temporalmente</b><strong>${outside}</strong></div>
 <div class="card"><b>Vendidas sin ingresar</b><strong>${pending}</strong></div>
 <div class="card"><b>Reingresos</b><strong>${reentries}</strong></div>
 <div class="card"><b>Recaudación</b><strong>S/ ${revenue.toLocaleString('es-PE')}</strong></div>
 `;
}
async function getTicket(code){return (await sb.from('tickets').select('*').eq('code',code.trim().toUpperCase()).maybeSingle()).data;}
async function getTestTicket(code){
  return (await sb.from('test_tickets')
    .select('*')
    .eq('code',code.trim().toUpperCase())
    .maybeSingle()).data;
}
async function control(code){
  const r=document.querySelector('#result');
  const cleanCode=(code||'').trim().toUpperCase();
  const isTest=cleanCode.startsWith('TEST-RR-');

  const t=isTest
    ? await getTestTicket(cleanCode)
    : await getTicket(cleanCode);

  if(!t){
    r.innerHTML='<div class="card red"><b>❌ QR NO ENCONTRADO</b></div>';
    return;
  }

  if(!t.sold){
    r.innerHTML=`<div class="card red"><b>🚫 ENTRADA NO VENDIDA</b><br>${t.code} · ${t.type}<br>Esta entrada no está autorizada para ingresar al evento.</div>`;
    document.querySelector('#reentry').style.display='none';
    return;
  }

  if(t.status==='available'){
    const now=new Date().toISOString();

    const {error}=await sb
      .from(isTest?'test_tickets':'tickets')
      .update({
        status:'inside',
        first_entry_at:t.first_entry_at||now,
        last_action_at:now,
        entry_count:(t.entry_count||0)+1
      })
      .eq('id',t.id)
      .eq('status','available')
      .eq('sold',true);

    r.innerHTML=error
      ? '<div class="card red">❌ Error al registrar.</div>'
      : `<div class="card green"><b>✅ PRIMER INGRESO</b><br>${t.code} · ${t.type}<br>Coloca la pulsera y permite el ingreso.</div>`;

  }else if(t.status==='outside'){

    document.querySelector('#reentry').style.display='inline-block';

    r.innerHTML=`<div class="card"><b>🔄 REINGRESO DISPONIBLE</b><br>${t.code} · ${t.type}<br>La persona salió anteriormente. Confirma el reingreso.</div>`;

  }else{

    r.innerHTML=`<div class="card red"><b>⚠️ PERSONA YA ESTÁ DENTRO</b><br>${t.code} · ${t.type}<br>No vuelvas a validar: si la persona está intentando entrar otra vez, verifica físicamente su pulsera.</div>`;

  }

  stats();
}
async function reentry(code){
  const r=document.querySelector('#result');
  const cleanCode=(code||'').trim().toUpperCase();
  const isTest=cleanCode.startsWith('TEST-RR-');
  const t=isTest
    ? await getTestTicket(cleanCode)
    : await getTicket(cleanCode);

  if(!t){
    r.innerHTML='<div class="card red">❌ QR NO ENCONTRADO</div>';
    return;
  }

  if(t.status!=='outside'){
    r.innerHTML='<div class="card red">❌ No figura fuera temporalmente.</div>';
    return;
  }

  const now=new Date().toISOString();

  const {error}=await sb
    .from(isTest?'test_tickets':'tickets')
    .update({
      status:'inside',
      last_action_at:now,
      entry_count:(t.entry_count||0)+1
    })
    .eq('id',t.id)
    .eq('status','outside')
    .eq('sold',true);

  document.querySelector('#reentry').style.display='none';

  r.innerHTML=error
    ? '<div class="card red">❌ Error al registrar reingreso.</div>'
    : `<div class="card green"><b>🔄 REINGRESO AUTORIZADO</b><br>${t.code} · ${t.type}</div>`;

  stats();
}
async function exit(code){
  const r=document.querySelector('#result');
  const cleanCode=(code||'').trim().toUpperCase();
  const isTest=cleanCode.startsWith('TEST-RR-');

  const t=isTest
    ? await getTestTicket(cleanCode)
    : await getTicket(cleanCode);

  if(!t){
    r.innerHTML='<div class="card red"><b>❌ QR NO ENCONTRADO</b></div>';
    return;
  }

  if(!t.sold){
    r.innerHTML='<div class="card red"><b>🚫 ENTRADA NO VENDIDA</b><br>Esta entrada no está autorizada.</div>';
    return;
  }

  if(t.status!=='inside'){
    r.innerHTML='<div class="card red">❌ No figura como dentro.</div>';
    return;
  }

  const {error}=await sb
    .from(isTest?'test_tickets':'tickets')
    .update({
      status:'outside',
      last_action_at:new Date().toISOString(),
      last_action:'exit'
    })
    .eq('id',t.id)
    .eq('status','inside')
    .eq('sold',true);

  r.innerHTML=error
    ? '<div class="card red">❌ Error al registrar salida.</div>'
    : `<div class="card"><b>🚪 SALIDA REGISTRADA</b><br>${t.code}<br>Conserva su pulsera para permitir el reingreso.</div>`;

  stats();
}
document.querySelector('#validate').onclick=()=>control(document.querySelector('#manual').value);
document.querySelector('#exit').onclick=()=>exit(document.querySelector('#manual').value);
document.querySelector('#reentry').onclick=()=>reentry(document.querySelector('#manual').value);
document.querySelector('#manual').addEventListener('keydown',e=>{if(e.key==='Enter')control(e.target.value)});
async function startScan(){
 scanner=new Html5Qrcode('reader');
 try{await scanner.start({facingMode:'environment'},{fps:10,qrbox:240},txt=>{if(scanner){scanner.stop().catch(()=>{});scanner=null;}control(txt);});}
 catch(e){document.querySelector('#result').innerHTML='<div class="card">No se pudo abrir la cámara. Puedes introducir el código manualmente.</div>';}
}
document.querySelector('#stop').onclick=()=>{if(scanner){scanner.stop().catch(()=>{});scanner=null;}};
async function vender(id){
  const {data,error}=await sb.from('tickets')
    .update({sold:true})
    .eq('id',id)
    .eq('sold',false)
    .eq('status','available')
    .eq('entry_count',0)
    .select('id')
    .maybeSingle();

  if(error || !data){
    alert('⚠️ Esta entrada ya fue vendida o utilizada.');
    await list();
    return;
  }

  alert('✅ Venta registrada correctamente.');
  await list();
  stats();
}

async function reembolsar(id){
  const ok=confirm('¿Confirmas el reembolso de esta entrada?');
  if(!ok)return;

  const {data,error}=await sb.from('tickets')
    .update({sold:false})
    .eq('id',id)
    .eq('sold',true)
    .eq('status','available')
    .eq('entry_count',0)
    .select('id')
    .maybeSingle();

  if(error || !data){
    alert('⚠️ Esta entrada ya no puede ser reembolsada.');
    await list();
    return;
  }

  alert('↩️ Reembolso registrado correctamente.');
  await list();
  stats();
}

async function list(){
 const q=(document.querySelector('#search').value||'').trim();
 let query=sb.from('tickets').select('*').order('number').limit(100);
 if(q) query=query.or(`code.ilike.%${q}%,type.ilike.%${q}%`);
 const {data,error}=await query;

 if(error){
   document.querySelector('#list').innerHTML='<p>Error.</p>';
   return;
 }

 document.querySelector('#list').innerHTML=
'<table><tr><th>Código</th><th>Tipo</th><th>Precio</th><th>Estado</th><th>Ingresos</th><th>Venta</th></tr>'+
data.map(t=>'<tr>'+
'<td>'+t.code+'</td>'+
'<td>'+t.type+'</td>'+
'<td>S/ '+t.price+'</td>'+
'<td>'+t.status+'</td>'+
'<td>'+t.entry_count+'</td>'+
'<td>'+
(!t.sold && t.status==='available' && Number(t.entry_count||0)===0
? '<button class="sellBtn" data-id="'+t.id+'">🟢 Vender</button>'
: (t.sold && t.status==='available' && Number(t.entry_count||0)===0
? '<button class="refundBtn" data-id="'+t.id+'">↩️ Reembolsar</button>'
: '🔒 Vendida / utilizada'))+
'</td>'+
'</tr>').join('')+
'</table>';
 document.querySelectorAll('.sellBtn').forEach(b=>{
   b.onclick=()=>vender(b.dataset.id);
 });
document.querySelectorAll('.refundBtn').forEach(b=>{
  b.onclick=()=>reembolsar(b.dataset.id);
});
document.querySelector('#search').oninput=list;
}
document.querySelector('#loadPrint').onclick=async()=>{
 const {data,error}=await sb.from('tickets').select('*').order('number'); const area=document.querySelector('#printArea');area.innerHTML='';
 if(error){area.textContent='Error';return;}
 for(const t of data){const d=document.createElement('div');d.className='ticket';d.innerHTML=`<b>RAVE & ROLL 2.0</b><br><small>27 SEPTIEMBRE 2026</small><br><strong>${t.type}</strong><div class="q"></div><b>${t.code}</b>`;area.appendChild(d);d.querySelector('.q').innerHTML=`<img src="${await QRCode.toDataURL(t.code,{width:150,margin:1})}">`;}
};
// LOGIN DE ADMINISTRADOR
document.querySelector('#loginBtn').onclick = async () => {
  const email = document.querySelector('#loginEmail').value.trim();
  const password = document.querySelector('#loginPassword').value;
  const result = document.querySelector('#loginResult');

  result.innerHTML = '⏳ Ingresando...';

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    result.innerHTML = '❌ ' + error.message;
    return;
  }

  if (data.session) {
    document.querySelector('#login').style.display = 'none';
    document.querySelector('#adminApp').style.display = 'block';
    result.innerHTML = '';
    show('dashboard');
    await stats();
  }
};
show('dashboard');
document.querySelector('#togglePassword').onclick=()=>{
  const p=document.querySelector('#loginPassword');
  const b=document.querySelector('#togglePassword');

  if(p.type==='password'){
    p.type='text';
    b.textContent='🙈';
  }else{
    p.type='password';
    b.textContent='👁️';
  }
};
