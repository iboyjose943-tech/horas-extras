(function protegerApp() {
  const raw = localStorage.getItem('he_session');
  if (!raw) { window.location.href = 'login.html'; return; }
  try {
    const sess = JSON.parse(raw);
    const SESSION_HORAS = 8;
    const expira = sess.ts + SESSION_HORAS * 60 * 60 * 1000;
    if (SESSION_HORAS !== 0 && Date.now() > expira) {
      localStorage.removeItem('he_session');
      window.location.href = 'login.html';
    }
  } catch (e) {
    localStorage.removeItem('he_session');
    window.location.href = 'login.html';
  }
})();

function cerrarSesion() {
  if (!confirm('¿Cerrar sesión?')) return;
  localStorage.removeItem('he_session');
  window.location.href = 'login.html';
}

// Devuelve la fecha de HOY en formato YYYY-MM-DD usando la hora LOCAL del dispositivo
// (evita el bug de toISOString() que usa UTC y adelanta el día en Guatemala)
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
const VALOR_HORA  = SUELDO_BASE / 30 / 8; // = 17.91

const TARIFAS = {
  ds: +(VALOR_HORA * 1.5).toFixed(4), // 26.87
  dd: +(VALOR_HORA * 2).toFixed(4), // 35.83
  ns: +(VALOR_HORA * 2).toFixed(4), //35.83
  nd: +(VALOR_HORA * 2.6667).toFixed(4), //47.78
  ms: +(VALOR_HORA * 1.7143).toFixed(4), //30.71
  md: +(VALOR_HORA * 2.2857).toFixed(4), //40.95
};

let registros = [];

function esNativo() {
  return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
}

// Calcula horasSimples, horasDobles, extras y total a partir de las 6 horas
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

async function guardar() {
  try {
    if (esNativo()) {
      await window.Capacitor.Plugins.Preferences.set({
        key: 'horas_extras',
        value: JSON.stringify(registros)
      });
    } else {
      localStorage.setItem('horas_extras', JSON.stringify(registros));
    }
  } catch(e) {
    localStorage.setItem('horas_extras', JSON.stringify(registros));
  }
  actualizarFiltroMeses();
  renderTabla();
  actualizarStats();
}

async function iniciar() {
  try {
    if (esNativo()) {
      const { value } = await window.Capacitor.Plugins.Preferences.get({ key: 'horas_extras' });
      registros = JSON.parse(value || '[]');
    } else {
      registros = JSON.parse(localStorage.getItem('horas_extras') || '[]');
    }
  } catch(e) {
    registros = JSON.parse(localStorage.getItem('horas_extras') || '[]');
  }
  document.getElementById('filtroMes').value = '';
  actualizarFiltroMeses();
  renderTabla();
  actualizarStats();
}

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

  if (datos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="empty">No hay registros para mostrar.</td></tr>`;
    return;
  }

  tbody.innerHTML = datos.map(r => `
    <tr>
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
        <button class="btn-edit" onclick="editarRegistro('${r.fecha}')">✎</button>
        <button class="btn-del" onclick="eliminar('${r.fecha}')">✕</button>
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

function eliminar(fecha) {
  if (!confirm(`¿Eliminar el registro del ${fecha}?`)) return;
  registros = registros.filter(r => r.fecha !== fecha);
  guardar();
  toast('Registro eliminado.', 'ok');
}

function limpiarFiltro() {
  document.getElementById('filtroMes').value = '';
  renderTabla();
  actualizarStats();
}

// Calculadora rápida para el día de HOY. Si ya existe registro de hoy, SUMA las horas.
function calcularPlanilla() {
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
  let existe = registros.find(r => r.fecha === hoy);

  let dsF = ds, ddF = dd, nsF = ns, ndF = nd, msF = ms, mdF = md;

  if (existe) {
    dsF = (existe.ds || 0) + ds;
    ddF = (existe.dd || 0) + dd;
    nsF = (existe.ns || 0) + ns;
    ndF = (existe.nd || 0) + nd;
    msF = (existe.ms || 0) + ms;
    mdF = (existe.md || 0) + md;
    const totales = calcularTotales(dsF, ddF, nsF, ndF, msF, mdF);
    Object.assign(existe, { ds: dsF, dd: ddF, ns: nsF, nd: ndF, ms: msF, md: mdF, ...totales });
    toast('Horas sumadas al registro de hoy ✓', 'ok');
  } else {
    const totales = calcularTotales(ds, dd, ns, nd, ms, md);
    registros.push({ fecha: hoy, ds, dd, ns, nd, ms, md, ...totales, sueldoBase: SUELDO_BASE });
    toast('Registro guardado ✓', 'ok');
  }

  registros.sort((a, b) => b.fecha.localeCompare(a.fecha));
  guardar();

  // Limpia los campos de la calculadora rápida
  ['ds','dd','ns','nd','ms','md'].forEach(id => document.getElementById(id).value = 0);

  // Muestra en el resumen el TOTAL acumulado del día (no solo lo recién ingresado)
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

// Agregar/editar un registro de una fecha específica (pasada o presente).
// Si NO se está editando y ya existe registro para esa fecha, SUMA las horas.
// Si SÍ se está editando (viene de "Editar" en la tabla), REEMPLAZA el registro completo.
function agregarRegistroAnterior() {
  const fecha = document.getElementById('fechaAnterior').value;

  if (!fecha) {
    toast('Selecciona una fecha.', 'err');
    return;
  }

  const ds = Number(document.getElementById('ds2').value) || 0;
  const dd = Number(document.getElementById('dd2').value) || 0;
  const ns = Number(document.getElementById('ns2').value) || 0;
  const nd = Number(document.getElementById('nd2').value) || 0;
  const ms = Number(document.getElementById('ms2').value) || 0;
  const md = Number(document.getElementById('md2').value) || 0;

  if (ds + dd + ns + nd + ms + md === 0) {
    toast('Ingresa al menos una hora.', 'err');
    return;
  }

  const editando = document.getElementById('editandoFecha').value;

  if (editando) {
    // MODO EDICIÓN: reemplaza el registro completo (no suma)
    if (editando !== fecha) {
      // El usuario también cambió la fecha: elimina el registro viejo
      registros = registros.filter(r => r.fecha !== editando);
    }
    let existe = registros.find(r => r.fecha === fecha);
    const totales = calcularTotales(ds, dd, ns, nd, ms, md);
    if (existe) {
      Object.assign(existe, { ds, dd, ns, nd, ms, md, ...totales });
    } else {
      registros.push({ fecha, ds, dd, ns, nd, ms, md, ...totales, sueldoBase: SUELDO_BASE });
    }
    toast('Registro editado ✓', 'ok');
    cancelarEdicion();
  } else {
    // MODO AGREGAR: si ya existe, SUMA las horas al registro existente
    const existe = registros.find(r => r.fecha === fecha);
    if (existe) {
      const dsF = (existe.ds || 0) + ds;
      const ddF = (existe.dd || 0) + dd;
      const nsF = (existe.ns || 0) + ns;
      const ndF = (existe.nd || 0) + nd;
      const msF = (existe.ms || 0) + ms;
      const mdF = (existe.md || 0) + md;
      const totales = calcularTotales(dsF, ddF, nsF, ndF, msF, mdF);
      Object.assign(existe, { ds: dsF, dd: ddF, ns: nsF, nd: ndF, ms: msF, md: mdF, ...totales });
      toast('Horas sumadas al registro existente ✓', 'ok');
    } else {
      const totales = calcularTotales(ds, dd, ns, nd, ms, md);
      registros.push({ fecha, ds, dd, ns, nd, ms, md, ...totales, sueldoBase: SUELDO_BASE });
      toast('Registro anterior guardado ✓', 'ok');
    }
    document.getElementById('fechaAnterior').value = '';
  }

  ['ds2','dd2','ns2','nd2','ms2','md2'].forEach(id => document.getElementById(id).value = 0);
  registros.sort((a, b) => b.fecha.localeCompare(a.fecha));
  guardar();
}

// Carga un registro existente en el formulario "Agregar Registro Anterior" para corregirlo
function editarRegistro(fecha) {
  const r = registros.find(x => x.fecha === fecha);
  if (!r) return;

  document.getElementById('fechaAnterior').value = fecha;
  document.getElementById('ds2').value = r.ds || 0;
  document.getElementById('dd2').value = r.dd || 0;
  document.getElementById('ns2').value = r.ns || 0;
  document.getElementById('nd2').value = r.nd || 0;
  document.getElementById('ms2').value = r.ms || 0;
  document.getElementById('md2').value = r.md || 0;
  document.getElementById('editandoFecha').value = fecha;

  document.getElementById('btnGuardarAnterior').textContent = 'Guardar Cambios';
  document.getElementById('btnCancelarEdicion').style.display = 'inline-block';

  const card = document.getElementById('fechaAnterior').closest('.card');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelarEdicion() {
  document.getElementById('editandoFecha').value = '';
  document.getElementById('fechaAnterior').value = '';
  ['ds2','dd2','ns2','nd2','ms2','md2'].forEach(id => document.getElementById(id).value = 0);
  document.getElementById('btnGuardarAnterior').textContent = 'Guardar Registro';
  document.getElementById('btnCancelarEdicion').style.display = 'none';
}

async function exportarExcel() {
  if (registros.length === 0) { toast('No hay registros para exportar.', 'err'); return; }

  const datos = registros.map(r => ({
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

  if (!esNativo()) {
    XLSX.writeFile(wb, 'Planilla_Horas_Extras.xlsx');
    toast('Excel exportado ✓', 'ok');
    return;
  }

  try {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    await window.Capacitor.Plugins.Filesystem.writeFile({
      path: 'Planilla_Horas_Extras.xlsx',
      data: wbout,
      directory: 'DOCUMENTS',
      recursive: true
    });
    toast('Excel guardado en Documentos ✓', 'ok');
  } catch(e) {
    toast('Error al guardar: ' + e.message, 'err');
  }
}

function toast(msg, tipo) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `show ${tipo}`;
  setTimeout(() => t.className = '', 3000);
}

document.addEventListener('DOMContentLoaded', () => iniciar());