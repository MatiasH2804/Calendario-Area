const API_URL = 'https://script.google.com/macros/s/AKfycbyeQYf-dFDQrJ0NFK1bVO2ZY-_J3E49W65bHG3M4AGy1Vfi8BWjj9XdTBolDHBdxOF5/exec';
const CACHE_KEY = 'calendario_espi_team_cache_v2';

let state = {
  items: [],
  filtered: []
};

const $list = document.getElementById('calendarList');
const $status = document.getElementById('status');
const $search = document.getElementById('searchInput');
const $btnSync = document.getElementById('btnSync');
const $btnOpenAdmin = document.getElementById('btnOpenAdmin');
const $adminPanel = document.getElementById('adminPanel');
const $formCreate = document.getElementById('formCreate');
const $formEdit = document.getElementById('formEdit');
const $editSelect = document.getElementById('editSelect');
document.addEventListener('DOMContentLoaded', init);
const $yearButtons = document.getElementById('yearButtons');
const $filterMes = document.getElementById('filterMes');
const $btnClearDateFilter = document.getElementById('btnClearDateFilter');

let selectedYear = '';
let selectedMonth = '';

function init() {
  loadFromCache();
  syncData();

  $search.addEventListener('input', applyFilters);
  $filterMes.addEventListener('change', () => {
    selectedMonth = $filterMes.value;
    applyFilters();
  });

  $btnClearDateFilter.addEventListener('click', clearDateFilter);
  $btnSync.addEventListener('click', syncData);
  $btnOpenAdmin.addEventListener('click', toggleAdminPanel);
  $formCreate.addEventListener('submit', handleCreate);
  $formEdit.addEventListener('submit', handleEdit);
  $editSelect.addEventListener('change', fillEditForm);
}

function loadFromCache() {
  const cached = localStorage.getItem(CACHE_KEY);

  if (!cached) return;

  try {
    const parsed = JSON.parse(cached);
    state.items = normalizeItems(parsed.data || []);
    renderYearFilter();
    applyFilters();
    renderEditOptions();
    setStatus('Calendario cargado desde caché. Sincronizando...');
  } catch {
    localStorage.removeItem(CACHE_KEY);
  }
}

async function syncData() {
  setStatus('Actualizando calendario...');

  try {
    const res = await fetch(`${API_URL}?action=list&_=${Date.now()}`);
    const json = await res.json();

    if (!json.ok) throw new Error(json.error || 'Error desconocido');

    state.items = normalizeItems(json.data || []);

    localStorage.setItem(CACHE_KEY, JSON.stringify({
      updatedAt: json.updatedAt,
      data: state.items
    }));

    renderYearFilter();
    applyFilters();
    renderEditOptions();

    setStatus('');
  } catch (error) {
    console.error(error);

    if (state.items.length) {
      setStatus('Sin conexión o error de carga. Mostrando datos guardados.');
    } else {
      setStatus('No se pudo cargar el calendario.');
    }
  }
}

function normalizeItems(items) {
  return items
    .map(item => {
      const fechaObj = parseSheetDate(item.fecha);

      return {
        ...item,
        fechaObj,
        mesAnioKey: fechaObj ? `${fechaObj.getFullYear()}-${String(fechaObj.getMonth() + 1).padStart(2, '0')}` : 'sin-fecha',
        mesAnioLabel: fechaObj
          ? fechaObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
          : 'Sin fecha'
      };
    })
    .sort((a, b) => {
      const fa = a.fechaObj ? a.fechaObj.getTime() : 0;
      const fb = b.fechaObj ? b.fechaObj.getTime() : 0;
      return fa - fb;
    });
}

function parseSheetDate(value) {
  if (!value) return null;

  if (value instanceof Date) return value;

  const date = new Date(value);

  if (isNaN(date.getTime())) return null;

  return date;
}

function applyFilters() {
  const q = $search.value.toLowerCase().trim();

  state.filtered = state.items.filter(item => {
    const text = [
      item.titulo,
      item.descripcion,
      item.estructura,
      item.encargados,
      item.extra,
      item.mesAnioLabel
    ].join(' ').toLowerCase();

    const itemYear = item.fechaObj ? String(item.fechaObj.getFullYear()) : '';
    const itemMonth = item.fechaObj ? String(item.fechaObj.getMonth() + 1).padStart(2, '0') : '';

    const matchText = !q || text.includes(q);
    const matchYear = !selectedYear || itemYear === selectedYear;
    const matchMonth = !selectedMonth || itemMonth === selectedMonth;

    return matchText && matchYear && matchMonth;
  });

  renderListGroupedByMonth();
}

function renderListGroupedByMonth() {
  if (!state.filtered.length) {
    $list.innerHTML = `
      <div class="empty">
        No hay registros para mostrar.
      </div>
    `;
    return;
  }

  const groups = groupByMonthYear(state.filtered);

  $list.innerHTML = Object.entries(groups).map(([label, items]) => `
    <section class="month-group">
      <div class="month-heading">
        <span>${escapeHtml(capitalize(label))}</span>
        <small>${items.length} registro${items.length === 1 ? '' : 's'}</small>
      </div>

      <div class="cards-grid">
        ${items.map(renderCard).join('')}
      </div>
    </section>
  `).join('');
}

function groupByMonthYear(items) {
  return items.reduce((acc, item) => {
    const key = item.mesAnioLabel || 'Sin fecha';

    if (!acc[key]) acc[key] = [];

    acc[key].push(item);

    return acc;
  }, {});
}

function renderCard(item) {
  const fecha = formatDate(item.fechaObj);
  const estructura = item.estructura || 'Sin estructura';
  const descripcion = item.descripcion || item.extra || 'Sin descripción cargada.';
  const encargados = item.encargados || 'Sin encargados';
  const extra = item.extra || 'Sin información extra';

  return `
    <article class="card">
      <div class="card-pattern-grid"></div>
      <div class="card-overlay-dots"></div>
      <div class="bold-pattern"></div>

      <div class="card-title-area">
        <span>${escapeHtml(item.titulo || 'Sin título')}</span>
        <span class="card-tag">${escapeHtml(estructura)}</span>
      </div>

      <div class="card-body">
        <p class="card-description">${escapeHtml(descripcion)}</p>

        <div class="feature-grid">
          <div class="feature-item">
            <div class="feature-icon">📅</div>
            <div class="feature-text">${escapeHtml(fecha.completa)}</div>
          </div>

          <div class="feature-item">
            <div class="feature-icon">🧭</div>
            <div class="feature-text">${escapeHtml(estructura)}</div>
          </div>

          <div class="feature-item">
            <div class="feature-icon">👥</div>
            <div class="feature-text">${escapeHtml(encargados)}</div>
          </div>

          <div class="feature-item">
            <div class="feature-icon">ℹ️</div>
            <div class="feature-text">${escapeHtml(extra)}</div>
          </div>
        </div>

        <div class="card-actions">
          <div class="price">
            <span class="price-currency">${escapeHtml(fecha.dia)}</span>${escapeHtml(fecha.mes)}
            <span class="price-period">${escapeHtml(fecha.anio)}</span>
          </div>

          ${item.link ? `
            <a class="card-button" href="${escapeAttr(item.link)}" target="_blank" rel="noopener">
              Abrir
            </a>
          ` : `
            <span class="card-button card-button-disabled">
              Sin link
            </span>
          `}
        </div>
      </div>

      <div class="dots-pattern"></div>
      <div class="accent-shape"></div>
      <div class="stamp">
        <span class="stamp-text">Espi<br>Team</span>
      </div>
      <div class="corner-slice"></div>
    </article>
  `;
}

function formatDate(date) {
  if (!date || isNaN(date)) {
    return {
      dia: '--',
      mes: '---',
      anio: '',
      completa: 'Sin fecha'
    };
  }

  return {
    dia: String(date.getDate()).padStart(2, '0'),
    mes: date.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''),
    anio: String(date.getFullYear()),
    completa: date.toLocaleDateString('es-AR', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  };
}

function setStatus(text) {
  $status.textContent = text;
  const statusCard = $status.closest('.status-card');
  if (statusCard) {
    statusCard.classList.toggle('hidden-status', !text);
  }
}

function capitalize(value) {
  if (!value) return value;

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}
function toggleAdminPanel() {
  $adminPanel.classList.toggle('hidden');
}

function renderEditOptions() {
  if (!$editSelect) return;

  const current = $editSelect.value;

  $editSelect.innerHTML = '<option value="">Elegir oración</option>';

  state.items.forEach(item => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${formatDate(item.fechaObj).completa} - ${item.titulo || 'Sin título'}`;
    $editSelect.appendChild(option);
  });

  if ([...$editSelect.options].some(opt => opt.value === current)) {
    $editSelect.value = current;
  }
}

function fillEditForm() {
  const id = $editSelect.value;
  const item = state.items.find(x => x.id === id);

  if (!item) return;

  $formEdit.titulo.value = item.titulo || '';
  $formEdit.fecha.value = toInputDate(item.fechaObj);
  $formEdit.estructura.value = item.estructura || '';
  $formEdit.encargados.value = item.encargados || '';
  $formEdit.link.value = item.link || '';
  $formEdit.descripcion.value = item.descripcion || '';
  $formEdit.extra.value = item.extra || '';
}

async function handleCreate(event) {
  event.preventDefault();

  const payload = formToPayload($formCreate);
  payload.action = 'create';

  await savePrayer(payload);

  $formCreate.reset();
}

async function handleEdit(event) {
  event.preventDefault();

  const payload = formToPayload($formEdit);
  payload.action = 'update';
  payload.id = $editSelect.value;

  if (!payload.id) {
    alert('Elegí una oración para editar.');
    return;
  }

  await savePrayer(payload);
}

function formToPayload(form) {
  return {
    titulo: form.titulo.value.trim(),
    fecha: form.fecha.value,
    estructura: form.estructura.value.trim(),
    encargados: form.encargados.value.trim(),
    link: form.link.value.trim(),
    descripcion: form.descripcion.value.trim(),
    extra: form.extra.value.trim()
  };
}

async function savePrayer(payload) {
  setStatus('Guardando oración...');

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const json = await res.json();

    if (!json.ok) throw new Error(json.error || 'No se pudo guardar.');

    setStatus('Oración guardada correctamente. Actualizando calendario...');
    await syncData();
  } catch (error) {
    console.error(error);
    setStatus('Error al guardar la oración.');
    alert('No se pudo guardar. Revisá Apps Script o la implementación.');
  }
}

function toInputDate(date) {
  if (!date || isNaN(date)) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
function renderYearFilter() {
  if (!$yearButtons || !$filterMes) return;

  const years = [...new Set(
    state.items
      .map(item => item.fechaObj ? String(item.fechaObj.getFullYear()) : '')
      .filter(Boolean)
  )].sort();

  $yearButtons.innerHTML = years.map(year => `
    <button
      type="button"
      class="year-pill ${selectedYear === year ? 'active' : ''}"
      data-year="${year}"
    >
      ${year}
    </button>
  `).join('');

  $yearButtons.querySelectorAll('.year-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedYear = btn.dataset.year;
      selectedMonth = '';
      renderYearFilter();
      renderMonthFilter();
      applyFilters();
    });
  });

  renderMonthFilter();
}

function renderMonthFilter() {
  if (!$filterMes) return;

  const meses = [
    { value: '01', label: 'Enero' },
    { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' },
    { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' }
  ];

  if (!selectedYear) {
    $filterMes.disabled = true;
    $filterMes.innerHTML = '<option value="">Primero elegí un año</option>';
    return;
  }

  $filterMes.disabled = false;

  $filterMes.innerHTML = `
    <option value="">Todos los meses de ${selectedYear}</option>
    ${meses.map(mes => `
      <option value="${mes.value}" ${selectedMonth === mes.value ? 'selected' : ''}>
        ${mes.label}
      </option>
    `).join('')}
  `;
}

function clearDateFilter() {
  selectedYear = '';
  selectedMonth = '';
  renderYearFilter();
  applyFilters();
}
