const SECTIONS = [
  'Spices', 'Vegetables and fruit', 'Dairy and eggs', 'Meat and seafood',
  'Grains and dry goods', 'Prepared sauces and dishes', 'Beverages',
  'Cutlery', 'Crockery and glassware', 'Kitchen equipment',
  'Cleaning supplies', 'Packaging and takeaway'
];

const state = { section: 'All items', query: '', items: [], token: localStorage.getItem('pantryToken') || '', socket: null };
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const statusOf = item => Number(item.quantity ?? item.qty ?? 0) <= 0 ? 'out' : Number(item.quantity ?? item.qty ?? 0) <= Number(item.minimumStock ?? item.min ?? 0) ? 'low' : 'ok';
const statusLabel = { ok: 'In stock', low: 'Low stock', out: 'Out of stock' };

const normalizeItem = item => ({
  id: String(item.id),
  itemId: item.itemId || item.id,
  name: item.name,
  category: item.category || 'Spices',
  quantity: Number(item.quantity ?? item.qty ?? 0),
  unit: item.unit || 'kg',
  minimumStock: Number(item.minimumStock ?? item.min ?? 0),
  reorderQuantity: Number(item.reorderQuantity ?? 0),
  maxStockLevel: Number(item.maxStockLevel ?? 0),
  purchasePrice: Number(item.purchasePrice ?? 0),
  supplier: item.supplier || 'N/A',
  storageLocation: item.storageLocation || 'Main storage',
  description: item.description || '',
  status: item.status || statusOf(item)
});

const api = {
  async request(path, options = {}) {
    const token = state.token || localStorage.getItem('pantryToken') || '';
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(path, {
      ...options,
      headers
    });

    if (response.status === 204) return null;

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || 'Request failed');
      error.status = response.status;
      throw error;
    }

    return payload;
  },

  async login(email, password) {
    const payload = await this.request('/api/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' }
    });
    state.token = payload.token;
    localStorage.setItem('pantryToken', payload.token);
  },

  async list() {
    const payload = await this.request('/api/inventory');
    state.items = (payload.items || []).map(normalizeItem);
    return state.items;
  },

  async save(item) {
    const payload = { ...item, quantity: Number(item.quantity ?? item.qty ?? 0), minimumStock: Number(item.minimumStock ?? item.min ?? 0), unit: item.unit || 'kg', category: item.category || 'Spices' };

    if (item.id && String(item.id).length > 0) {
      return this.request(`/api/inventory/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    }

    return this.request('/api/inventory', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async remove(id) {
    return this.request(`/api/inventory/${id}`, { method: 'DELETE' });
  },

  async adjust(id, delta, reason) {
    return this.request(`/api/inventory/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ delta, reason })
    });
  }
};

function loadLocalSocketClient() {
  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return Promise.resolve();

  return new Promise(resolve => {
    const socketScript = document.createElement('script');
    socketScript.src = '/socket.io/socket.io.js';
    socketScript.onload = resolve;
    socketScript.onerror = resolve;
    document.head.append(socketScript);
  });
}

function connectRealtime() {
  if (!window.io || state.socket) return;

  state.socket = window.io();
  state.socket.on('inventory:updated', async () => {
    await api.list();
    render();
  });
}

function renderSections() {
  const all = ['All items', ...SECTIONS];
  $('sectionList').innerHTML = all.map(name => {
    const list = name === 'All items' ? state.items : state.items.filter(i => i.category === name);
    const needsAttention = list.some(i => statusOf(i) !== 'ok');
    return `<button class="section-btn ${name === state.section ? 'active' : ''}" data-section="${esc(name)}">
      <span>${needsAttention ? '<i class="alert" title="Has low or missing items"></i>' : ''}${esc(name)}</span>
      <span class="count">${list.length}</span></button>`;
  }).join('');
}

function renderSummary(list) {
  const low = list.filter(i => statusOf(i) === 'low').length;
  const out = list.filter(i => statusOf(i) === 'out').length;
  $('summary').innerHTML = `
    <div><strong>${list.length}</strong><span>Items listed</span></div>
    <div class="low"><strong>${low}</strong><span>Running low</span></div>
    <div class="out"><strong>${out}</strong><span>Out of stock</span></div>`;
}

function renderRows() {
  const q = state.query.trim().toLowerCase();
  const inSection = state.section === 'All items' ? state.items : state.items.filter(i => i.category === state.section);
  const list = inSection.filter(i => i.name.toLowerCase().includes(q));

  $('sectionTitle').textContent = state.section;
  renderSummary(inSection);
  $('empty').hidden = list.length > 0;
  $('rows').innerHTML = list.map(i => {
    const s = statusOf(i);
    const pct = Math.min(100, Math.round((Number(i.quantity) / (Number(i.minimumStock) * 2 || 1)) * 100));
    return `<tr data-id="${esc(String(i.id))}">
      <td class="name">${esc(i.name)}<small>${esc(i.category)}</small></td>
      <td><div class="bar ${s}" title="Reorder at ${Number(i.minimumStock)} ${esc(i.unit)}"><i style="width:${pct}%"></i></div></td>
      <td><div class="stepper">
        <button data-act="dec" aria-label="Remove one ${esc(i.name)}">−</button>
        <span>${Number(i.quantity)} ${esc(i.unit)}</span>
        <button data-act="inc" aria-label="Add one ${esc(i.name)}">+</button></div></td>
      <td><span class="badge ${s}">${statusLabel[s]}</span></td>
      <td><div class="row-actions">
        <button class="btn" data-act="edit">Edit</button>
        <button class="btn danger" data-act="delete">Delete</button></div></td>
    </tr>`;
  }).join('');
}

function render() {
  renderSections();
  renderRows();
}

$('sectionList').addEventListener('click', e => {
  const btn = e.target.closest('[data-section]');
  if (!btn) return;
  state.section = btn.dataset.section;
  render();
});

$('search').addEventListener('input', e => {
  state.query = e.target.value;
  renderRows();
});

$('rows').addEventListener('click', async e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;

  const row = btn.closest('tr');
  const id = row.dataset.id;
  const item = state.items.find(i => String(i.id) === String(id));
  const act = btn.dataset.act;

  try {
    if (act === 'inc' || act === 'dec') {
      await api.adjust(id, act === 'inc' ? 1 : -1, act === 'inc' ? 'Added through inventory UI' : 'Reduced through inventory UI');
      await api.list();
      render();
    } else if (act === 'edit') {
      openDialog(item);
    } else if (act === 'delete' && confirm(`Delete "${item.name}" from stock?`)) {
      await api.remove(id);
      await api.list();
      render();
    }
  } catch (err) {
    alert(err.message || 'Could not update inventory');
  }
});

const dialog = $('itemDialog');
$('fCategory').innerHTML = SECTIONS.map(s => `<option>${esc(s)}</option>`).join('');

function openDialog(item) {
  $('dialogTitle').textContent = item ? 'Edit item' : 'Add item';
  $('itemId').value = item ? item.id : '';
  $('fName').value = item ? item.name : '';
  $('fCategory').value = item ? item.category : (SECTIONS.includes(state.section) ? state.section : SECTIONS[0]);
  $('fQty').value = item ? item.quantity : '';
  $('fUnit').value = item ? item.unit : '';
  $('fMin').value = item ? item.minimumStock : '';
  dialog.showModal();
}

$('addBtn').addEventListener('click', () => openDialog(null));
$('cancelBtn').addEventListener('click', () => dialog.close());

$('itemForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = {
    id: $('itemId').value || undefined,
    name: $('fName').value.trim(),
    category: $('fCategory').value,
    quantity: Number($('fQty').value),
    unit: $('fUnit').value.trim(),
    minimumStock: Number($('fMin').value),
    supplier: 'N/A'
  };

  try {
    await api.save(form);
    await api.list();
    render();
    dialog.close();
  } catch (err) {
    alert(err.message || 'Failed to save item');
  }
});

const loginDialog = $('loginDialog');
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const errorMessage = $('loginError');
  const submitButton = $('loginSubmit');
  errorMessage.hidden = true;
  submitButton.disabled = true;

  try {
    await api.login($('loginEmail').value.trim(), $('loginPassword').value);
    await api.list();
    render();
    connectRealtime();
    $('loginPassword').value = '';
    loginDialog.close();
  } catch (err) {
    errorMessage.textContent = err.message || 'Sign-in failed';
    errorMessage.hidden = false;
  } finally {
    submitButton.disabled = false;
  }
});

async function init() {
  try {
    await loadLocalSocketClient();

    if (state.token) {
      try {
        await api.request('/api/auth/me');
      } catch (err) {
        if (err.status !== 401) throw err;
        state.token = '';
        localStorage.removeItem('pantryToken');
      }
    }

    if (!state.token) {
      loginDialog.showModal();
      return;
    }

    await api.list();
    render();
    connectRealtime();
  } catch (err) {
    console.error(err);
    alert('Could not connect to the pantry API. Make sure the backend server is running.');
  }
}

init();