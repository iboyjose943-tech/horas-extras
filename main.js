// ============ AUTENTICACIÓN Y ROLES ============
let currentUser = null;
let esAdmin = false;

function cerrarSesion() {
  if (!confirm('¿Cerrar sesión?')) return;
  auth.signOut().then(() => window.location.href = 'login.html');
}

// Devuelve la fecha de HOY en formato YYYY-MM-DD usando la hora LOCAL del dispositivo
function fechaLocalHoy() {
  const d   = new Date();
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

const MESES_NOM = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

const SUELDO_BASE = 4300;
const VALOR_HORA  = SUELDO_BASE / 30 / 8;

const TARIFAS = {
  ds: +(VALOR_HORA * 1.5).toFixed(4),
  dd: +(VALOR_HORA * 2).toFixed(4),
  ns: +(VALOR_HORA * 2).toFixed(4),
  nd: +(VALOR_HORA * 2.6667).toFixed(4),
  ms: +(VALOR_HORA * 1.7143).toFixed(4),
  md: +(VALOR_HORA * 2.2857).toFixed(4),
};

let registros = [];
let usuariosMap = {}; // uid -> email, para mostrar en la tabla si eres admin

function calcularTotales(ds, dd, ns, nd, ms, md) {
  const totalDS = ds * TARIFAS.ds;
  const totalDD = dd * TARIFAS.dd;
  const totalNS = ns * TARIFAS.ns;
  const totalND = nd * TARIFAS.nd;
  const totalMS = ms * TARIFAS.ms;
  const totalMD = md * TARIFAS.md;

  const extras = totalDS + totalDD + totalNS + totalND + totalMS + totalMD;
  const total  = SUELDO_BASE + extras;
  const horasSimples = ds + ns + ms;
  const horasDobles  = dd + nd + md;

  return { horasSimples, horasDobles, extras, total };
}

// ============ CARGA INICIAL: SESIÓN, ROL Y REGISTROS EN TIEMPO REAL ============
document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = 'login.html'; return; }
    currentUser = user;
    await cargarRol();
    await cargarUsuarios();
    escucharRegistros();
  });
});

async function cargarRol() {
  try {
    const doc = await db.collection('usuarios').doc(currentUser.uid).get();
    esAdmin = doc.exists && doc.data().rol === 'admin';
  } catch (e) {
    esAdmin = false;
  }

  const badge = document.getElementById('admin-badge');
  if (badge) badge.style.display = esAdmin ? 'inline-block' : 'none';

  const campoUsuario = document.getElementById('campoUsuarioObjetivo');
  if (campoUsuario) campoUsuario.style.display = esAdmin ? 'block' : 'none';

  // Agrega la columna "Usuario" al encabezado de la tabla si es admin
  const encabezado = document.getElementById('tr-encabezado');
  if (esAdmin && encabezado && !document.getElementById('th-usuario')) {
    const th = document.createElement('th');
    th.id = 'th-usuario';
    th.textContent = 'Usuario';
    encabezado.insertBefore(th, encabezado.firstChild);
  }
}

// Carga la lista de usuarios (solo se usa si eres admin, para el selector y para mostrar nombres en la tabla)
async function cargarUsuarios() {
  try {
    const snap = await db.collection('usuarios').get();
    usuariosMap = {};
    snap.forEach(doc => { usuariosMap[doc.id] = doc.data().email || doc.id; });

    if (esAdmin) {
      const sel = document.getElementById('usuarioObjetivo');
      if (sel) {
        sel.innerHTML = Object.entries(usuariosMap)
          .map(([uid, email]) => `<option value="${uid}" ${uid === currentUser.uid ? 'selected' : ''}>${email}</option>`)
          .join('');
      }
    }
  } catch (e) {
    // si falla, no es crítico
  }
}

// Escucha los registros en tiempo real. Admin ve todos, usuario normal solo los suyos.
function escucharRegistros() {
  let query = db.collection('registros');
  if (!esAdmin) {
    query = query.where('uid', '==', currentUser.uid);
  }
  query.onSnapshot(snapshot => {
    registros = snapshot.docs.map(d => d.data());
    registros.sort((a, b) => b.fecha.localeCompare(a.fecha));
    actualizarFiltroMeses();
    renderTabla();
    actualizarStats();
  }, err => {
    toast('Error al cargar registros: ' + err.message, 'err');
  });
}

// ============ GUARDAR / ELIMINAR EN FIRESTORE ============
async function guardarRegistroFirestore(uid, registro) {
  const id = `${uid}_${registro.fecha}`;
  await db.collection('registros').doc(id).set({ ...registro, uid });
}

async function eliminarRegistroFirestore(uid, fecha) {
  const id = `${uid}_${fecha}`;
  await db.collection('registros').doc(id).delete();
}

// ============ UI: TABLA, FILTROS, ESTADÍSTICAS ============
function actualizarFiltroMeses() {
  const sel    = document.getElementById('filtroMes');
  const actual = sel.value;
  const meses  = [...new Set(registros.map(r => r.fecha.slice(0,7)))].sort().reverse();
  sel.innerHTML = '<option value="">Todos</option>' +
    meses.map(m => {
      const [y, mo] = m.split('-');
      return `<option value="${m}" ${m === actual ? 'selected' : ''}>${MESES_NOM[+mo - 1]} ${y}</option>`;
    }).join('');
}

function renderTabla() {
  const tbody  = document.getElementById('tbody');
  const filtro = document.getElementById('filtroMes').value;
  const datos  = filtro ? registros.filter(r => r.fecha.startsWith(filtro)) : registros;

  const colspan = esAdmin ? 13 : 12;

  if (datos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty">No hay registros para mostrar.</td></tr>`;
    return;
  }

  tbody.innerHTML = datos.map(r => `
    <tr>
      ${esAdmin ? `<td>${usuariosMap[r.uid] || r.uid}</td>` : ''}
      <td>${r.fecha}</td>
      <td>${r.horasSimples || 0}</td>
      <td>${r.horasDobles  || 0}</td>
      <td>${r.ds || 0}</td>
      <td>${r.dd || 0}</td>
      <td>${r.ns || 0}</td>
      <td>${r.nd || 0}</td>
      <td>${r.ms || 0}</td>
      <td>${r.md || 0}</td>
      <td>Q${Number(r.extras || 0).toFixed(2)}</td>
      <td>Q${Number(r.total  || 0).toFixed(2)}</td>
      <td>
        <button class="btn-edit" onclick="editarRegistro('${r.uid}', '${r.fecha}')">✎</button>
        <button class="btn-del" onclick="eliminar('${r.uid}', '${r.fecha}')">✕</button>
      </td>
    </tr>
  `).join('');
}

function actualizarStats() {
  const filtro = document.getElementById('filtroMes').value;
  const ahora  = fechaLocalHoy().slice(0, 7);
  const mesRef = filtro || ahora;

  const delMes   = registros.filter(r => r.fecha.startsWith(mesRef));
  const extMes   = delMes.reduce((a, r) => a + (r.extras || 0), 0);
  const extAcum  = registros.reduce((a, r) => a + (r.extras || 0), 0);
  const promedio = delMes.length ? extMes / delMes.length : 0;

  const [y, mo] = mesRef.split('-');
  document.getElementById('s-total').textContent     = registros.length;
  document.getElementById('s-mes').textContent       = `Q${extMes.toFixed(2)}`;
  document.getElementById('s-mes-label').textContent = `${MESES_NOM[+mo - 1]} ${y}`;
  document.getElementById('s-prom').textContent      = `Q${promedio.toFixed(2)}`;
  document.getElementById('s-acum').textContent      = `Q${extAcum.toFixed(2)}`;
}

async function eliminar(uid, fecha) {
  if (!confirm(`¿Eliminar el registro del ${fecha}?`)) return;
  try {
    await eliminarRegistroFirestore(uid, fecha);
    toast('Registro eliminado.', 'ok');
  } catch (e) {
    toast('Error al eliminar: ' + e.message, 'err');
  }
}

function limpiarFiltro() {
  document.getElementById('filtroMes').value = '';
  renderTabla();
  actualizarStats();
}

// ============ CALCULADORA RÁPIDA (HOY) ============
async function calcularPlanilla() {
  const ds = Number(document.getElementById('ds').value) || 0;
  const dd = Number(document.getElementById('dd').value) || 0;
  const ns = Number(document.getElementById('ns').value) || 0;
  const nd = Number(document.getElementById('nd').value) || 0;
  const ms = Number(document.getElementById('ms').value) || 0;
  const md = Number(document.getElementById('md').value) || 0;

  if (ds + dd + ns + nd + ms + md === 0) {
    toast('Ingresa al menos una hora.', 'err');
    return;
  }

  const hoy = fechaLocalHoy();
  const existe = registros.find(r => r.fecha === hoy && r.uid === currentUser.uid);

  const dsF = (existe?.ds || 0) + ds;
  const ddF = (existe?.dd || 0) + dd;
  const nsF = (existe?.ns || 0) + ns;
  const ndF = (existe?.nd || 0) + nd;
  const msF = (existe?.ms || 0) + ms;
  const mdF = (existe?.md || 0) + md;

  const totales = calcularTotales(dsF, ddF, nsF, ndF, msF, mdF);
  const registro = { fecha: hoy, ds: dsF, dd: ddF, ns: nsF, nd: ndF, ms: msF, md: mdF, ...totales, sueldoBase: SUELDO_BASE };

  try {
    await guardarRegistroFirestore(currentUser.uid, registro);
    toast(existe ? 'Horas sumadas al registro de hoy ✓' : 'Registro guardado ✓', 'ok');
  } catch (e) {
    toast('Error al guardar: ' + e.message, 'err');
    return;
  }

  ['ds','dd','ns','nd','ms','md'].forEach(id => document.getElementById(id).value = 0);

  const totalDS = dsF * TARIFAS.ds;
  const totalDD = ddF * TARIFAS.dd;
  const totalNS = nsF * TARIFAS.ns;
  const totalND = ndF * TARIFAS.nd;
  const totalMS = msF * TARIFAS.ms;
  const totalMD = mdF * TARIFAS.md;
  const totalExtras = totalDS + totalDD + totalNS + totalND + totalMS + totalMD;
  const totalPagar  = SUELDO_BASE + totalExtras;

  document.getElementById('resultadoPlanilla').innerHTML = `
    <table style="width:100%;border-collapse:collapse;margin-top:1.25rem;">
      <thead>
        <tr><th>Tipo</th><th>Tarifa/h</th><th>Horas (acumuladas hoy)</th><th>Total</th></tr>
      </thead>
      <tbody>
        <tr><td>DS</td><td>Q${TARIFAS.ds.toFixed(2)}</td><td>${dsF}</td><td>Q${totalDS.toFixed(2)}</td></tr>
        <tr><td>DD</td><td>Q${TARIFAS.dd.toFixed(2)}</td><td>${ddF}</td><td>Q${totalDD.toFixed(2)}</td></tr>
        <tr><td>NS</td><td>Q${TARIFAS.ns.toFixed(2)}</td><td>${nsF}</td><td>Q${totalNS.toFixed(2)}</td></tr>
        <tr><td>ND</td><td>Q${TARIFAS.nd.toFixed(2)}</td><td>${ndF}</td><td>Q${totalND.toFixed(2)}</td></tr>
        <tr><td>MS</td><td>Q${TARIFAS.ms.toFixed(2)}</td><td>${msF}</td><td>Q${totalMS.toFixed(2)}</td></tr>
        <tr><td>MD</td><td>Q${TARIFAS.md.toFixed(2)}</td><td>${mdF}</td><td>Q${totalMD.toFixed(2)}</td></tr>
        <tr><td colspan="3"><strong>Total Horas Extras</strong></td><td><strong>Q${totalExtras.toFixed(2)}</strong></td></tr>
        <tr><td colspan="3"><strong>Sueldo Base</strong></td><td><strong>Q${SUELDO_BASE.toFixed(2)}</strong></td></tr>
        <tr><td colspan="3"><strong>Total a Pagar</strong></td><td><strong style="color:#16a34a;font-size:1.1rem;">Q${totalPagar.toFixed(2)}</strong></td></tr>
      </tbody>
    </table>
  `;
}

// ============ AGREGAR / EDITAR REGISTRO DE CUALQUIER FECHA ============
function toggleAnterior() {
  const contenido = document.getElementById('contenidoAnterior');
  const icono = document.getElementById('iconoAnterior');
  const abierto = contenido.style.display !== 'none';
  contenido.style.display = abierto ? 'none' : 'block';
  icono.textContent = abierto ? '▸' : '▾';
}

async function agregarRegistroAnterior() {
  const fecha = document.getElementById('fechaAnterior').value;
  if (!fecha) { toast('Selecciona una fecha.', 'err'); return; }

  const ds = Number(document.getElementById('ds2').value) || 0;
  const dd = Number(document.getElementById('dd2').value) || 0;
  const ns = Number(document.getElementById('ns2').value) || 0;
  const nd = Number(document.getElementById('nd2').value) || 0;
  const ms = Number(document.getElementById('ms2').value) || 0;
  const md = Number(document.getElementById('md2').value) || 0;

  if (ds + dd + ns + nd + ms + md === 0) { toast('Ingresa al menos una hora.', 'err'); return; }

  const editandoFecha = document.getElementById('editandoFecha').value;
  const editandoUid   = document.getElementById('editandoUid').value;

  const selUsuario = document.getElementById('usuarioObjetivo');
  const targetUid  = editandoUid || (esAdmin && selUsuario ? selUsuario.value : currentUser.uid);

  try {
    if (editandoFecha) {
      // MODO EDICIÓN: reemplaza el registro completo
      if (editandoFecha !== fecha) {
        await eliminarRegistroFirestore(targetUid, editandoFecha);
      }
      const totales = calcularTotales(ds, dd, ns, nd, ms, md);
      await guardarRegistroFirestore(targetUid, { fecha, ds, dd, ns, nd, ms, md, ...totales, sueldoBase: SUELDO_BASE });
      toast('Registro editado ✓', 'ok');
      cancelarEdicion();
    } else {
      // MODO AGREGAR: si ya existe, suma las horas
      const existe = registros.find(r => r.fecha === fecha && r.uid === targetUid);
      const dsF = (existe?.ds || 0) + ds;
      const ddF = (existe?.dd || 0) + dd;
      const nsF = (existe?.ns || 0) + ns;
      const ndF = (existe?.nd || 0) + nd;
      const msF = (existe?.ms || 0) + ms;
      const mdF = (existe?.md || 0) + md;
      const totales = calcularTotales(dsF, ddF, nsF, ndF, msF, mdF);
      await guardarRegistroFirestore(targetUid, { fecha, ds: dsF, dd: ddF, ns: nsF, nd: ndF, ms: msF, md: mdF, ...totales, sueldoBase: SUELDO_BASE });
      toast(existe ? 'Horas sumadas al registro existente ✓' : 'Registro anterior guardado ✓', 'ok');
      document.getElementById('fechaAnterior').value = '';
    }
  } catch (e) {
    toast('Error al guardar: ' + e.message, 'err');
    return;
  }

  ['ds2','dd2','ns2','nd2','ms2','md2'].forEach(id => document.getElementById(id).value = 0);
}

function editarRegistro(uid, fecha) {
  const r = registros.find(x => x.fecha === fecha && x.uid === uid);
  if (!r) return;

  document.getElementById('fechaAnterior').value = fecha;
  document.getElementById('ds2').value = r.ds || 0;
  document.getElementById('dd2').value = r.dd || 0;
  document.getElementById('ns2').value = r.ns || 0;
  document.getElementById('nd2').value = r.nd || 0;
  document.getElementById('ms2').value = r.ms || 0;
  document.getElementById('md2').value = r.md || 0;
  document.getElementById('editandoFecha').value = fecha;
  document.getElementById('editandoUid').value = uid;

  document.getElementById('btnGuardarAnterior').textContent = 'Guardar Cambios';
  document.getElementById('btnCancelarEdicion').style.display = 'inline-block';

  document.getElementById('contenidoAnterior').style.display = 'block';
  document.getElementById('iconoAnterior').textContent = '▾';

  const card = document.getElementById('fechaAnterior').closest('.card');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelarEdicion() {
  document.getElementById('editandoFecha').value = '';
  document.getElementById('editandoUid').value = '';
  document.getElementById('fechaAnterior').value = '';
  ['ds2','dd2','ns2','nd2','ms2','md2'].forEach(id => document.getElementById(id).value = 0);
  document.getElementById('btnGuardarAnterior').textContent = 'Guardar Registro';
  document.getElementById('btnCancelarEdicion').style.display = 'none';
}

// ============ EXPORTAR EXCEL ============
async function exportarExcel() {
  if (registros.length === 0) { toast('No hay registros para exportar.', 'err'); return; }

  const datos = registros.map(r => ({
    Usuario:       esAdmin ? (usuariosMap[r.uid] || r.uid) : undefined,
    Fecha:         r.fecha,
    Horas_Simples: r.horasSimples || 0,
    Horas_Dobles:  r.horasDobles  || 0,
    DS: r.ds || 0, DD: r.dd || 0,
    NS: r.ns || 0, ND: r.nd || 0,
    MS: r.ms || 0, MD: r.md || 0,
    Total_Extras: +(r.extras || 0).toFixed(2),
    Total_Pagar:  +(r.total  || 0).toFixed(2)
  }));

  const ws = XLSX.utils.json_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Planilla');
  XLSX.writeFile(wb, 'Planilla_Horas_Extras.xlsx');
  toast('Excel exportado ✓', 'ok');
}

function toast(msg, tipo) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `show ${tipo}`;
  setTimeout(() => t.className = '', 3000);
}