import {
  columnVisibilityFeature,
  constructTable,
  createColumnHelper,
  tableFeatures,
} from '@tanstack/table-core';
import { storeReactivityBindings } from '@tanstack/table-core/store-reactivity-bindings';

const THEME_STORAGE_KEY = 'quick-price-theme';
const COLUMN_VISIBILITY_STORAGE_KEY = 'quick-price-column-visibility';

const features = tableFeatures({
  coreReactivityFeature: storeReactivityBindings(),
  columnVisibilityFeature,
});

const columnHelper = createColumnHelper();

let hideMaterialCost = false;
let currentRows = [];
let tableStatus = 'idle'; // 'idle' | 'empty' | 'error'
const expandedRows = new Set();

function buildColumns(shouldHideMaterialCost) {
  const columns = [
    columnHelper.accessor('Description', {
      id: 'Description',
      header: 'Description',
      enableHiding: false,
      meta: {
        colClass: 'col-description',
        headerClass: 'text-left',
        cellClass: 'text-left',
        isPrice: false,
      },
    }),
  ];

  if (!shouldHideMaterialCost) {
    columns.push(
      columnHelper.accessor((row) => row['Material Cost'], {
        id: 'Material Cost',
        header: 'Material Cost',
        meta: {
          colClass: 'col-price',
          headerClass: 'text-right whitespace-nowrap',
          cellClass: 'text-right whitespace-nowrap',
          isPrice: true,
        },
      })
    );
  }

  columns.push(
    columnHelper.accessor('Wholesale', {
      id: 'Wholesale',
      header: 'Wholesale',
      meta: {
        colClass: 'col-price',
        headerClass: 'text-right whitespace-nowrap',
        cellClass: 'text-right whitespace-nowrap',
        isPrice: true,
      },
    }),
    columnHelper.accessor('Retail', {
      id: 'Retail',
      header: 'Retail',
      meta: {
        colClass: 'col-price',
        headerClass: 'text-right whitespace-nowrap',
        cellClass: 'text-right whitespace-nowrap',
        isPrice: true,
      },
    })
  );

  return columnHelper.columns(columns);
}

function loadSavedColumnVisibility() {
  try {
    const raw = localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      delete parsed.Description;
      return parsed;
    }
  } catch (error) {
    // Ignore invalid stored state
  }
  return {};
}

function saveColumnVisibility(columnVisibility) {
  try {
    const next = { ...(columnVisibility || {}) };
    delete next.Description;
    localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    // Ignore storage write errors
  }
}

const table = constructTable({
  features,
  columns: buildColumns(false),
  data: currentRows,
  initialState: {
    columnVisibility: loadSavedColumnVisibility(),
  },
});

function renderColumnControls() {
  const container = document.getElementById('columnControls');
  if (!container) return;

  const activeColumnId =
    document.activeElement && container.contains(document.activeElement)
      ? document.activeElement.dataset.columnId
      : null;

  container.innerHTML = '';

  for (const column of table.getAllLeafColumns()) {
    if (!column.getCanHide()) continue;

    const isVisible = column.getIsVisible();
    const labelText =
      typeof column.columnDef.header === 'string'
        ? column.columnDef.header
        : column.id;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `column-toggle${isVisible ? ' is-active' : ''}`;
    button.dataset.columnId = column.id;
    button.setAttribute('aria-pressed', String(isVisible));
    button.textContent = labelText;
    button.addEventListener('click', () => {
      column.toggleVisibility();
    });

    container.appendChild(button);

    if (activeColumnId === column.id) {
      button.focus();
    }
  }
}

function renderTable() {
  const tableEl = document.getElementById('resultTable');
  const tableColGroup = document.getElementById('resultTableColGroup');
  const tableHead = document.getElementById('resultTableHead');
  const tableBody = document.getElementById('resultTableBody');
  if (!tableHead || !tableBody) return;

  const visibleColumns = table.getVisibleLeafColumns();
  if (tableColGroup) tableColGroup.innerHTML = '';
  tableHead.innerHTML = '';
  tableBody.innerHTML = '';

  if (tableEl) {
    const visiblePriceCount = visibleColumns.filter(
      (column) => column.columnDef.meta?.isPrice
    ).length;
    tableEl.style.minWidth = `${220 + visiblePriceCount * 128}px`;
  }

  if (visibleColumns.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.className = 'text-center app-muted py-6 px-4';
    emptyCell.textContent = 'No columns selected. Toggle a column on above to view results.';
    emptyRow.appendChild(emptyCell);
    tableBody.appendChild(emptyRow);
    return;
  }

  if (tableColGroup) {
    for (const column of visibleColumns) {
      const col = document.createElement('col');
      const colClass = column.columnDef.meta?.colClass || '';
      if (colClass) col.className = colClass;
      tableColGroup.appendChild(col);
    }
  }

  for (const headerGroup of table.getHeaderGroups()) {
    const tr = document.createElement('tr');
    for (const header of headerGroup.headers) {
      const th = document.createElement('th');
      const headerClass = header.column.columnDef.meta?.headerClass || '';
      th.className = `px-4 py-3.5 text-xs font-semibold uppercase tracking-wider ${headerClass}`.trim();
      th.textContent = header.isPlaceholder
        ? ''
        : typeof header.column.columnDef.header === 'string'
          ? header.column.columnDef.header
          : header.column.id;
      tr.appendChild(th);
    }
    tableHead.appendChild(tr);
  }

  if (tableStatus === 'error') {
    const errorRow = document.createElement('tr');
    const errorCell = document.createElement('td');
    errorCell.colSpan = visibleColumns.length;
    errorCell.className = 'text-red-400 text-center py-4 px-4';
    errorCell.textContent = 'Error fetching data';
    errorRow.appendChild(errorCell);
    tableBody.appendChild(errorRow);
    return;
  }

  if (tableStatus === 'empty') {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = visibleColumns.length;
    emptyCell.className = 'text-center app-muted py-4 px-4';
    emptyCell.textContent = 'No matching results';
    emptyRow.appendChild(emptyCell);
    tableBody.appendChild(emptyRow);
    return;
  }

  const rows = table.getRowModel().rows;
  for (const row of rows) {
    const isExpanded = expandedRows.has(row.id);
    const tr = document.createElement('tr');
    tr.className = `data-row${isExpanded ? ' is-expanded' : ''}`;
    tr.setAttribute('aria-expanded', String(isExpanded));
    tr.addEventListener('click', () => {
      if (window.getSelection && window.getSelection().toString()) return;
      if (expandedRows.has(row.id)) {
        expandedRows.delete(row.id);
      } else {
        expandedRows.add(row.id);
      }
      renderTable();
    });

    for (const cell of row.getVisibleCells()) {
      const td = document.createElement('td');
      const baseCellClass = cell.column.columnDef.meta?.cellClass || '';
      const value = cell.getValue();
      const textValue = value == null ? '' : String(value);

      if (cell.column.id === 'Description') {
        const wrapClass = isExpanded ? 'whitespace-normal break-words' : 'truncate';
        td.className = `px-4 py-3.5 text-sm ${baseCellClass} ${wrapClass}`.trim();
        td.title = textValue;
      } else {
        td.className = `px-4 py-3.5 text-sm ${baseCellClass}`.trim();
      }

      td.textContent = textValue;
      tr.appendChild(td);
    }
    tableBody.appendChild(tr);
  }
}

function setTableData(rows, status = 'idle') {
  currentRows = rows;
  tableStatus = status;
  expandedRows.clear();
  table.setOptions((prev) => ({
    ...prev,
    data: currentRows,
  }));
  renderTable();
}

function applyMaterialCostVisibility(shouldHide) {
  hideMaterialCost = Boolean(shouldHide);
  table.setOptions((prev) => ({
    ...prev,
    columns: buildColumns(hideMaterialCost),
  }));
  renderColumnControls();
  renderTable();
}

table.store.subscribe((state) => {
  saveColumnVisibility(state.columnVisibility);
  renderColumnControls();
  renderTable();
});

function applyTheme(theme) {
  document.body.classList.toggle('theme-light', theme === 'light');

  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');

  if (themeToggle) {
    themeToggle.setAttribute('aria-pressed', String(theme === 'light'));
    const label = themeToggle.querySelector('span');
    if (label) {
      label.textContent = theme === 'light' ? 'Dark theme' : 'Light theme';
    }
  }

  if (themeIcon) {
    themeIcon.className = theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
  }
}

function toggleTheme() {
  const nextTheme = document.body.classList.contains('theme-light') ? 'dark' : 'light';
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
}

async function loadDatabaseInfo() {
  const dbCreatedAt = document.getElementById('dbCreatedAt');
  if (!dbCreatedAt) return;

  try {
    const response = await fetch('/db-info', { credentials: 'include' });
    const data = await response.json();
    dbCreatedAt.textContent = data.createdAt
      ? `Database created: ${data.createdAt}`
      : 'Database created date unavailable';
    dbCreatedAt.classList.remove('hidden');
  } catch (error) {
    dbCreatedAt.textContent = 'Database created date unavailable';
    dbCreatedAt.classList.remove('hidden');
  }
}

function setAuthView(isAuthenticated) {
  const loginForm = document.getElementById('loginForm');
  const mainUI = document.getElementById('mainUI');
  const loginError = document.getElementById('loginError');
  const dbCreatedAt = document.getElementById('dbCreatedAt');

  if (!loginForm || !mainUI || !loginError || !dbCreatedAt) return;

  loginForm.classList.toggle('hidden', isAuthenticated);
  mainUI.classList.toggle('hidden', !isAuthenticated);
  loginError.classList.add('hidden');

  if (isAuthenticated) {
    loadDatabaseInfo();
  } else {
    dbCreatedAt.classList.add('hidden');
    dbCreatedAt.textContent = 'Loading database date…';
  }
}

function showMainUI() {
  setAuthView(true);
}

function showLogin() {
  setAuthView(false);
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const themeToggle = document.getElementById('themeToggle');
  const passwordInput = document.getElementById('password');
  const loginError = document.getElementById('loginError');
  const searchInput = document.getElementById('searchInput');
  const clearSearchButton = document.getElementById('clearSearchButton');

  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  applyTheme(savedTheme || (prefersLight ? 'light' : 'dark'));

  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  renderColumnControls();
  renderTable();

  // Hide both UIs and error initially
  setAuthView(false);

  // Check auth status on load
  fetch('/check-auth', { credentials: 'include' })
    .then((res) => res.json())
    .then((data) => {
      applyMaterialCostVisibility(data.hideMaterialCost);
      if (data.authenticated) {
        showMainUI();
      } else {
        showLogin();
      }
    });

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loginError.classList.add('hidden');
    fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.value }),
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error('Invalid password');
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          applyMaterialCostVisibility(data.hideMaterialCost);
          showMainUI();
          loginError.classList.add('hidden');
        } else {
          loginError.textContent = data.message || 'Login failed';
          loginError.classList.remove('hidden');
        }
      })
      .catch(() => {
        loginError.textContent = 'Invalid password';
        loginError.classList.remove('hidden');
      });
  });

  function updateClearButtonVisibility() {
    if (clearSearchButton) {
      clearSearchButton.classList.toggle('hidden', searchInput.value.trim() === '');
    }
  }

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function handleSearch() {
    const searchTerm = searchInput.value.trim();

    if (searchTerm === '') {
      setTableData([], 'idle');
      return;
    }

    fetch(`/data?search=${encodeURIComponent(searchTerm)}`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Unauthorized');
        return response.json();
      })
      .then((data) => {
        if (data.length === 0) {
          setTableData([], 'empty');
          return;
        }
        setTableData(data, 'idle');
      })
      .catch((err) => {
        if (err.message === 'Unauthorized') {
          showLogin();
          loginError.textContent = 'Session expired. Please log in again.';
          loginError.classList.remove('hidden');
        } else {
          setTableData([], 'error');
        }
      });
  }

  const debouncedHandleSearch = debounce(handleSearch, 300);

  updateClearButtonVisibility();

  if (clearSearchButton) {
    clearSearchButton.addEventListener('click', () => {
      searchInput.value = '';
      updateClearButtonVisibility();
      setTableData([], 'idle');
      searchInput.focus();
    });
  }

  searchInput.addEventListener('input', () => {
    updateClearButtonVisibility();
    debouncedHandleSearch();
  });
});
