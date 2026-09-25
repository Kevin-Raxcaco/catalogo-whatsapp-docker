import { getCatalogById, updateCatalog, deleteCatalog } from '../../services/catalogs.js'
import { getProducts, upsertProducts } from '../../services/products.js'
import { requireAuth } from '../../services/auth.js'
import { ColumnMapper } from '../../components/ColumnMapper.js'
import { parseFile, getColumns, applyMapping } from '../../utils/excel.js'
import { getAtomLogs } from '../../services/atomLogs.js'

const CURRENCY_OPTIONS = `
  <option value="COP">COP — Peso colombiano</option>
  <option value="USD">USD — Dólar americano</option>
  <option value="MXN">MXN — Peso mexicano</option>
  <option value="GTQ">GTQ — Quetzal guatemalteco</option>
  <option value="PEN">PEN — Sol peruano</option>
  <option value="CRC">CRC — Colón costarricense</option>
  <option value="HNL">HNL — Lempira hondureño</option>
  <option value="NIO">NIO — Córdoba nicaragüense</option>
  <option value="DOP">DOP — Peso dominicano</option>
  <option value="ARS">ARS — Peso argentino</option>
  <option value="CLP">CLP — Peso chileno</option>
  <option value="BRL">BRL — Real brasileño</option>
  <option value="BOB">BOB — Boliviano</option>
  <option value="PYG">PYG — Guaraní paraguayo</option>
  <option value="UYU">UYU — Peso uruguayo</option>
`

const EMOJI_CATEGORIES = [
  { label: 'General',      emojis: ['🛍️','🛒','🏷️','💳','💰','🤑','🎁','📦','🎀','🏪','🏬','🔖'] },
  { label: 'Comida',       emojis: ['🍕','🍔','🌮','🍜','🍣','🥗','🍰','☕','🍷','🥤','🍦','🧁'] },
  { label: 'Moda',         emojis: ['👗','👠','👜','💄','💍','👒','🧴','👔','👕','🧢','🕶️','👟'] },
  { label: 'Hogar',        emojis: ['🏠','🛋️','🪑','🛏️','🪞','🏺','🧹','🔑','🪴','🕯️','🖼️','🪟'] },
  { label: 'Auto',         emojis: ['🚗','🔧','⚙️','🛞','🚙','🏎️','🛻','🔩','🪛','⛽','🚕','🛠️'] },
  { label: 'Electrónica',  emojis: ['💻','📱','🖥️','⌨️','🎮','📷','📺','🎧','🖨️','💾','📡','🔋'] },
  { label: 'Salud',        emojis: ['💊','🩺','🧴','💆','🧘','🏋️','🩹','🌿','🧬','🩻','💉','🫀'] },
  { label: 'Deportes',     emojis: ['⚽','🏀','🎾','🏊','🚴','🥊','🧗','🎯','🏆','🥇','🎽','🏄'] },
]

// ─── Emoji picker ─────────────────────────────────────────────────────────────

function createEmojiPicker(inputEl) {
  let activeCat = 0
  let popover   = null

  function open() {
    if (popover) { close(); return }
    popover = document.createElement('div')
    popover.className = 'emoji-popover'
    popover.innerHTML = `
      <div class="emoji-popover__tabs" id="ep-tabs"></div>
      <div class="emoji-popover__grid" id="ep-grid"></div>
    `

    const tabs = popover.querySelector('#ep-tabs')
    const grid = popover.querySelector('#ep-grid')

    function renderCat(idx) {
      activeCat = idx
      tabs.querySelectorAll('.emoji-popover__tab').forEach((t, i) => {
        t.classList.toggle('active', i === idx)
      })
      grid.innerHTML = EMOJI_CATEGORIES[idx].emojis.map(e =>
        `<button class="emoji-popover__btn" data-emoji="${e}">${e}</button>`
      ).join('')
      grid.querySelectorAll('[data-emoji]').forEach(btn => {
        btn.addEventListener('click', () => {
          inputEl.value = btn.dataset.emoji
          inputEl.dispatchEvent(new Event('input'))
          close()
        })
      })
    }

    EMOJI_CATEGORIES.forEach((cat, i) => {
      const t = document.createElement('button')
      t.className = 'emoji-popover__tab' + (i === activeCat ? ' active' : '')
      t.type = 'button'
      t.textContent = cat.label
      t.addEventListener('click', () => renderCat(i))
      tabs.appendChild(t)
    })
    renderCat(activeCat)

    inputEl.parentElement.style.position = 'relative'
    inputEl.parentElement.appendChild(popover)

    setTimeout(() => document.addEventListener('click', outsideClick), 0)
  }

  function close() {
    popover?.remove()
    popover = null
    document.removeEventListener('click', outsideClick)
  }

  function outsideClick(e) {
    if (!popover?.contains(e.target) && e.target !== inputEl) close()
  }

  inputEl.addEventListener('click', (e) => { e.stopPropagation(); open() })
  inputEl.readOnly = true
  inputEl.style.cursor = 'pointer'
  inputEl.title = 'Haz clic para elegir un emoji'
}

export async function CatalogDetailPage(container) {
  requireAuth()

  const catalogId = window.location.pathname.split('/').pop()
  const isNew = catalogId === 'new'

  if (isNew) {
    renderNewCatalogForm(container)
    return
  }

  let catalog, products
  try {
    const [cat, prods] = await Promise.all([
      getCatalogById(catalogId),
      getProducts(catalogId),
    ])
    catalog  = cat
    products = prods
    if (!catalog) throw new Error('not found')
  } catch {
    container.innerHTML = `<p style="color:var(--color-text-muted);padding:40px;">Catálogo no encontrado.</p>`
    return
  }

  renderDetail(container, catalog, products)
}

// ─── New catalog form ────────────────────────────────────────────────────────

function renderNewCatalogForm(container) {
  container.innerHTML = `
    <div style="max-width:560px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px;">
        <button class="btn btn--ghost btn--sm" id="btn-back">← Volver</button>
        <div>
          <h2 style="margin:0 0 2px;">Nuevo catálogo</h2>
          <p style="margin:0;font-size:13px;color:var(--color-text-muted);">Completa la información para crear tu catálogo</p>
        </div>
      </div>

      <form id="new-catalog-form" style="display:flex;flex-direction:column;gap:20px;">

        <!-- Información básica -->
        <div class="card" style="padding:24px;display:flex;flex-direction:column;gap:16px;">
          <p class="section-label">Información básica</p>

          <div>
            <label class="field-label" for="nc-name">Nombre del catálogo *</label>
            <input id="nc-name" class="field" placeholder="Ej: Calzado temporada 2025" required>
          </div>

          <div>
            <label class="field-label" for="nc-slug">URL del catálogo</label>
            <div style="display:flex;align-items:center;border:1.5px solid var(--color-border);
              border-radius:12px;overflow:hidden;background:var(--color-bg);">
              <span style="padding:10px 12px;font-size:13px;color:var(--color-text-muted);
                background:var(--color-bg-subtle);border-right:1.5px solid var(--color-border);
                white-space:nowrap;">/catalog/</span>
              <input id="nc-slug" placeholder="calzado-temporada"
                style="flex:1;border:none;outline:none;padding:10px 14px;font-size:14px;
                background:transparent;color:var(--color-text);">
            </div>
          </div>

          <div>
            <label class="field-label" for="nc-desc">Descripción</label>
            <textarea id="nc-desc" class="field" placeholder="Breve descripción que verá el cliente" rows="2"></textarea>
          </div>
        </div>

        <!-- Apariencia y estado -->
        <div class="card" style="padding:24px;display:flex;flex-direction:column;gap:16px;">
          <p class="section-label">Apariencia y estado</p>
          <div style="display:grid;grid-template-columns:90px 1fr 1fr;gap:12px;">
            <div>
              <label class="field-label">Emoji</label>
              <input id="nc-emoji" class="field" placeholder="🛍️" maxlength="4"
                style="text-align:center;font-size:22px;padding:8px 4px;">
            </div>
            <div>
              <label class="field-label" for="nc-currency">Moneda</label>
              <select id="nc-currency" class="field">${CURRENCY_OPTIONS}</select>
            </div>
            <div>
              <label class="field-label" for="nc-status">Estado inicial</label>
              <select id="nc-status" class="field">
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Integración Atom -->
        <div class="card" style="padding:24px;display:flex;flex-direction:column;gap:16px;">
          <div>
            <p class="section-label" style="margin-bottom:2px;">Integración Atom</p>
            <p style="font-size:13px;color:var(--color-text-muted);margin:0;">
              Opcional — configura cómo se actualiza el cliente en Atom.
            </p>
          </div>

          <div>
            <label class="field-label" for="nc-timeout">Tiempo de carrito abandonado</label>
            <div style="display:flex;align-items:center;border:1.5px solid var(--color-border);
              border-radius:12px;overflow:hidden;background:var(--color-bg);width:180px;">
              <input id="nc-timeout" type="number" min="1" value="30"
                style="flex:1;border:none;outline:none;padding:10px 14px;font-size:14px;
                background:transparent;color:var(--color-text);width:80px;">
              <span style="padding:10px 12px;font-size:13px;color:var(--color-text-muted);
                background:var(--color-bg-subtle);border-left:1.5px solid var(--color-border);
                white-space:nowrap;">min</span>
            </div>
          </div>

          <div>
            <label class="field-label" for="nc-atom-token">Token de Atom</label>
            <div style="display:flex;gap:8px;">
              <input id="nc-atom-token" class="field" type="password"
                placeholder="Bearer token de tu empresa" style="flex:1;">
              <button type="button" id="nc-toggle-token" class="btn btn--ghost btn--sm"
                style="flex-shrink:0;padding:0 12px;height:42px;" title="Mostrar/ocultar">👁</button>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label class="field-label" for="nc-field-cart">Campo carrito completado</label>
              <input id="nc-field-cart" class="field" placeholder="custom_carrito_de_compra">
            </div>
            <div>
              <label class="field-label" for="nc-field-abandoned">Campo carrito abandonado</label>
              <input id="nc-field-abandoned" class="field" placeholder="custom_carrito_abandonado">
            </div>
          </div>
        </div>

        <div id="nc-error" style="display:none;padding:12px 16px;border-radius:12px;
          background:rgba(255,70,70,0.08);color:#d32f2f;font-size:13px;"></div>

        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
          <button type="submit" class="btn btn--primary" id="btn-create">Crear catálogo</button>
        </div>
      </form>
    </div>
  `

  const nameInput = container.querySelector('#nc-name')
  const slugInput = container.querySelector('#nc-slug')
  const errBox    = container.querySelector('#nc-error')

  createEmojiPicker(container.querySelector('#nc-emoji'))

  nameInput.addEventListener('input', () => {
    slugInput.value = nameInput.value.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  })

  container.querySelector('#nc-toggle-token').addEventListener('click', () => {
    const inp = container.querySelector('#nc-atom-token')
    inp.type = inp.type === 'password' ? 'text' : 'password'
  })

  container.querySelector('#btn-back').addEventListener('click', () => history.back())
  container.querySelector('#btn-cancel').addEventListener('click', () => history.back())

  container.querySelector('#new-catalog-form').addEventListener('submit', async (ev) => {
    ev.preventDefault()
    errBox.style.display = 'none'
    const btn = container.querySelector('#btn-create')
    btn.disabled = true
    btn.textContent = 'Creando…'

    try {
      const { createCatalog } = await import('../../services/catalogs.js')
      const atomToken  = container.querySelector('#nc-atom-token').value.trim()
      const fieldCart  = container.querySelector('#nc-field-cart').value.trim()
      const fieldAband = container.querySelector('#nc-field-abandoned').value.trim()
      const cat = await createCatalog({
        name:        nameInput.value.trim(),
        slug:        slugInput.value.trim(),
        description: container.querySelector('#nc-desc').value.trim(),
        emoji:       container.querySelector('#nc-emoji').value.trim() || '🛍️',
        status:      container.querySelector('#nc-status').value,
        field_config: {
          currency:              container.querySelector('#nc-currency').value,
          abandoned_timeout_min: parseInt(container.querySelector('#nc-timeout').value, 10) || 30,
          ...(atomToken  ? { atom_token:          atomToken  } : {}),
          ...(fieldCart  ? { atom_field_cart:      fieldCart  } : {}),
          ...(fieldAband ? { atom_field_abandoned: fieldAband } : {}),
        },
      })
      window.location.href = `/admin/catalogs/${cat.id}`
    } catch (err) {
      errBox.textContent = err?.data?.message ?? 'Error al crear el catálogo.'
      errBox.style.display = 'block'
      btn.disabled = false
      btn.textContent = 'Crear catálogo'
    }
  })
}

// ─── Existing catalog detail ─────────────────────────────────────────────────

function renderDetail(container, catalog, products) {
  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
      <button class="btn btn--ghost btn--sm" id="btn-back">← Catálogos</button>
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <span style="font-size:28px;flex-shrink:0;">${catalog.emoji ?? '🛍️'}</span>
        <div style="min-width:0;">
          <h2 style="margin:0 0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${catalog.name}</h2>
          <span style="font-size:12px;color:var(--color-text-muted);">/catalog/${catalog.slug}</span>
        </div>
        <span class="badge ${catalog.status === 'active' ? 'badge--active' : 'badge--draft'}" style="margin-left:4px;flex-shrink:0;">
          ${catalog.status === 'active' ? 'Activo' : 'Borrador'}
        </span>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <a class="btn btn--ghost btn--sm" href="/catalog/${catalog.slug}" target="_blank">Ver →</a>
        <button class="btn btn--primary btn--sm" id="btn-toggle-status">
          ${catalog.status === 'active' ? 'Pausar' : 'Activar'}
        </button>
      </div>
    </div>

    <div class="detail-tabs" style="margin-bottom:24px;">
      <button class="detail-tabs__tab active" data-tab="products">
        Productos <span class="badge" style="background:var(--color-bg-subtle);color:var(--color-text);">${products.length}</span>
      </button>
      <button class="detail-tabs__tab" data-tab="upload">Subir archivo</button>
      <button class="detail-tabs__tab" data-tab="settings">Configuración</button>
      <button class="detail-tabs__tab" data-tab="logs">Registros</button>
    </div>

    <div id="tab-products"></div>
    <div id="tab-upload"   style="display:none;"></div>
    <div id="tab-settings" style="display:none;"></div>
    <div id="tab-logs"     style="display:none;"></div>
  `

  container.querySelector('#btn-back').addEventListener('click', () => {
    window.location.href = '/admin'
  })

  container.querySelector('#btn-toggle-status').addEventListener('click', async (e) => {
    const newStatus = catalog.status === 'active' ? 'draft' : 'active'
    e.target.disabled = true
    try {
      await updateCatalog(catalog.id, { status: newStatus })
      catalog.status = newStatus
      e.target.textContent = newStatus === 'active' ? 'Pausar' : 'Activar'
      const badge = container.querySelector('.badge.badge--active, .badge.badge--draft')
      badge.className = `badge ${newStatus === 'active' ? 'badge--active' : 'badge--draft'}`
      badge.textContent = newStatus === 'active' ? 'Activo' : 'Borrador'
      // Sync settings form select
      const statusSelect = container.querySelector('#s-status')
      if (statusSelect) statusSelect.value = newStatus
    } catch { /* ignore */ }
    e.target.disabled = false
  })

  const tabs = container.querySelectorAll('.detail-tabs__tab')
  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    container.querySelectorAll('[id^="tab-"]').forEach(p => p.style.display = 'none')
    container.querySelector(`#tab-${tab.dataset.tab}`).style.display = ''
  }))

  renderProductsTab(container.querySelector('#tab-products'), products)
  renderUploadTab(container.querySelector('#tab-upload'), catalog, (newProducts) => {
    products = newProducts
    renderProductsTab(container.querySelector('#tab-products'), products)
    container.querySelector('.detail-tabs__tab[data-tab="products"] .badge').textContent = products.length
  })
  renderSettingsTab(container.querySelector('#tab-settings'), catalog)

  // Logs tab — carga cuando el usuario hace clic
  let logsLoaded = false
  const logsTab = container.querySelector('.detail-tabs__tab[data-tab="logs"]')
  logsTab.addEventListener('click', () => {
    if (!logsLoaded) {
      logsLoaded = true
      renderLogsTab(container.querySelector('#tab-logs'), catalog.id)
    }
  })
}

// ─── Tab: Products ───────────────────────────────────────────────────────────

function renderProductsTab(el, products) {
  if (!products.length) {
    el.innerHTML = `
      <div style="text-align:center;padding:72px 20px;">
        <div style="font-size:48px;margin-bottom:16px;">📦</div>
        <p style="font-weight:600;font-size:15px;margin:0 0 6px;">Sin productos aún</p>
        <p style="color:var(--color-text-muted);font-size:14px;margin:0 0 20px;">
          Sube un archivo Excel o CSV para importar tu catálogo.
        </p>
        <button class="btn btn--primary btn--sm" id="go-upload">Subir archivo →</button>
      </div>`
    el.querySelector('#go-upload').addEventListener('click', () => {
      document.querySelector('.detail-tabs__tab[data-tab="upload"]')?.click()
    })
    return
  }

  const hasCategory    = products.some(p => p.category)
  const hasDescription = products.some(p => p.description)
  const PER_PAGE       = 50
  let searchQuery      = ''
  let currentPage      = 1

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
      <input id="admin-product-search" type="search" placeholder="Buscar productos…"
        style="flex:1;min-width:200px;padding:8px 14px;border-radius:10px;
        border:1.5px solid var(--color-border);background:var(--color-bg);
        color:var(--color-text);font-size:13px;outline:none;">
      <button class="btn btn--ghost btn--sm" id="go-upload-refresh">Reimportar →</button>
    </div>
    <div id="products-table-wrap" style="overflow-x:auto;border-radius:14px;border:1.5px solid var(--color-border);">
      <table class="table" style="margin:0;">
        <thead>
          <tr>
            <th style="width:52px;"></th>
            <th>Nombre</th>
            <th>SKU</th>
            ${hasCategory ? '<th>Categoría</th>' : ''}
            ${hasDescription ? '<th>Descripción</th>' : ''}
            <th>Precio</th>
          </tr>
        </thead>
        <tbody id="products-tbody"></tbody>
      </table>
    </div>
    <div id="admin-pagination" style="margin-top:12px;"></div>
  `

  el.querySelector('#go-upload-refresh').addEventListener('click', () => {
    document.querySelector('.detail-tabs__tab[data-tab="upload"]')?.click()
  })

  function getFiltered() {
    if (!searchQuery) return products
    const q = searchQuery.toLowerCase()
    return products.filter(p =>
      (p.name        ?? '').toLowerCase().includes(q) ||
      (p.category    ?? '').toLowerCase().includes(q) ||
      (p.sku         ?? '').toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q)
    )
  }

  function renderTable() {
    const filtered   = getFiltered()
    const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1
    const page       = Math.min(currentPage, totalPages)
    const slice      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

    const tbody = el.querySelector('#products-tbody')
    if (!slice.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:32px;
        color:var(--color-text-muted);">Sin resultados para "${escHtml(searchQuery)}"</td></tr>`
    } else {
      tbody.innerHTML = slice.map(p => `
        <tr>
          <td style="padding:8px 12px;">
            ${p.image
              ? `<img src="${p.image}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:10px;display:block;">`
              : `<div style="width:44px;height:44px;border-radius:10px;background:var(--color-bg-subtle);
                  display:flex;align-items:center;justify-content:center;font-size:20px;">📦</div>`
            }
          </td>
          <td style="font-weight:600;">${escHtml(p.name ?? '')}</td>
          <td style="color:var(--color-text-muted);font-size:13px;">${escHtml(p.sku ?? '') || '—'}</td>
          ${hasCategory ? `<td><span style="font-size:12px;padding:3px 10px;border-radius:20px;
            background:var(--color-bg-subtle);color:var(--color-text-muted);">${escHtml(p.category ?? '') || '—'}</span></td>` : ''}
          ${hasDescription ? `<td style="font-size:13px;color:var(--color-text-muted);max-width:200px;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(p.description ?? '') || '—'}</td>` : ''}
          <td style="font-weight:600;">${escHtml(p.price ?? '') || '—'}</td>
        </tr>`).join('')
    }

    const pager = el.querySelector('#admin-pagination')
    if (totalPages <= 1) {
      pager.innerHTML = `<p style="font-size:12px;color:var(--color-text-muted);margin:0;">
        ${filtered.length} producto${filtered.length !== 1 ? 's' : ''}</p>`
    } else {
      const start = (page - 1) * PER_PAGE + 1
      const end   = Math.min(page * PER_PAGE, filtered.length)
      pager.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="font-size:12px;color:var(--color-text-muted);">
            ${start}–${end} de ${filtered.length} productos
          </span>
          <div style="display:flex;gap:6px;margin-left:auto;">
            <button class="btn btn--ghost btn--sm" id="ap-prev" ${page <= 1 ? 'disabled' : ''}>← Anterior</button>
            <button class="btn btn--ghost btn--sm" id="ap-next" ${page >= totalPages ? 'disabled' : ''}>Siguiente →</button>
          </div>
        </div>`
      pager.querySelector('#ap-prev')?.addEventListener('click', () => { currentPage--; renderTable() })
      pager.querySelector('#ap-next')?.addEventListener('click', () => { currentPage++; renderTable() })
    }
  }

  el.querySelector('#admin-product-search').addEventListener('input', (e) => {
    searchQuery = e.target.value.trim()
    currentPage = 1
    renderTable()
  })

  renderTable()
}

// ─── Tab: Upload ─────────────────────────────────────────────────────────────

function renderUploadTab(el, catalog, onImported) {
  el.innerHTML = `
    <div style="max-width:640px;">
      <div class="drop-zone" id="drop-zone">
        <div id="dz-idle">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
            style="color:var(--color-text-muted);margin-bottom:12px;">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
          </svg>
          <p style="font-size:14px;font-weight:600;color:var(--color-text);margin:0 0 4px;">
            Arrastra tu archivo aquí
          </p>
          <p style="font-size:13px;color:var(--color-text-muted);margin:0 0 16px;">
            Excel (.xlsx) o CSV — máx. 5 MB
          </p>
          <button type="button" class="btn btn--ghost btn--sm" id="btn-browse">Seleccionar archivo</button>
        </div>
        <div id="dz-selected" style="display:none;align-items:center;gap:12px;">
          <span style="font-size:28px;">📄</span>
          <div style="text-align:left;">
            <p id="dz-filename" style="font-weight:600;font-size:14px;margin:0 0 2px;"></p>
            <p id="dz-filesize" style="font-size:12px;color:var(--color-text-muted);margin:0;"></p>
          </div>
          <button type="button" class="btn btn--ghost btn--sm" id="btn-change" style="margin-left:auto;">Cambiar</button>
        </div>
        <input type="file" id="file-input" accept=".xlsx,.xls,.csv" style="display:none;">
      </div>
      <div id="mapper-area" style="display:none;margin-top:24px;"></div>
    </div>
  `

  const dropZone  = el.querySelector('#drop-zone')
  const fileInput = el.querySelector('#file-input')
  const mapArea   = el.querySelector('#mapper-area')
  const dzIdle    = el.querySelector('#dz-idle')
  const dzSel     = el.querySelector('#dz-selected')

  function showFileSelected(file) {
    dzIdle.style.display = 'none'
    dzSel.style.display  = 'flex'
    el.querySelector('#dz-filename').textContent = file.name
    el.querySelector('#dz-filesize').textContent = (file.size / 1024).toFixed(1) + ' KB'
  }

  el.querySelector('#btn-browse').addEventListener('click', () => fileInput.click())
  el.querySelector('#btn-change').addEventListener('click', () => {
    dzIdle.style.display = ''
    dzSel.style.display  = 'none'
    mapArea.style.display = 'none'
    fileInput.value = ''
  })

  dropZone.addEventListener('click', (e) => {
    if (e.target.closest('#btn-change')) return
    if (dzIdle.offsetParent !== null) fileInput.click()
  })
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) { showFileSelected(fileInput.files[0]); handleFile(fileInput.files[0]) }
  })
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover') })
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'))
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault()
    dropZone.classList.remove('dragover')
    if (e.dataTransfer.files[0]) { showFileSelected(e.dataTransfer.files[0]); handleFile(e.dataTransfer.files[0]) }
  })

  async function handleFile(file) {
    mapArea.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:16px;border-radius:12px;
        background:var(--color-bg-subtle);font-size:13px;color:var(--color-text-muted);">
        ⏳ Leyendo archivo…
      </div>`
    mapArea.style.display = ''
    let rows
    try {
      rows = await parseFile(file)
    } catch {
      mapArea.innerHTML = `<div style="padding:16px;border-radius:12px;background:rgba(255,70,70,0.07);
        color:#d32f2f;font-size:13px;">✕ No se pudo leer el archivo. Verifica que sea Excel o CSV válido.</div>`
      return
    }
    if (!rows.length) {
      mapArea.innerHTML = `<div style="padding:16px;border-radius:12px;background:rgba(255,70,70,0.07);
        color:#d32f2f;font-size:13px;">✕ El archivo está vacío.</div>`
      return
    }

    const columns = getColumns(rows)
    mapArea.innerHTML = `
      <div style="margin-bottom:16px;">
        <p style="font-weight:600;font-size:14px;margin:0 0 4px;">Mapeo de columnas</p>
        <p style="font-size:13px;color:var(--color-text-muted);margin:0;">
          ${rows.length} filas encontradas · Asigna cada columna al campo correspondiente
        </p>
      </div>`

    const mapper = new ColumnMapper({
      columns,
      initial: catalog.field_config?.mapping ?? {},
      onSave: async ({ mapping }) => {
        btn.disabled = true
        btn.textContent = 'Importando…'
        try {
          const mapped = applyMapping(rows, mapping)
          const saved  = await upsertProducts(catalog.id, mapped)
          await updateCatalog(catalog.id, { field_config: { ...catalog.field_config, mapping } })
          catalog.field_config = { ...catalog.field_config, mapping }
          onImported(saved)
          mapArea.innerHTML = `
            <div style="padding:20px 24px;background:rgba(6,223,115,0.08);border-radius:14px;
              border:1.5px solid rgba(6,223,115,0.2);display:flex;align-items:center;gap:12px;">
              <span style="font-size:24px;">✅</span>
              <div>
                <p style="font-weight:700;color:#0c7c47;margin:0 0 2px;">
                  ${saved.length} productos importados correctamente
                </p>
                <p style="font-size:13px;color:var(--color-text-muted);margin:0;">
                  Ve a la pestaña Productos para revisar el resultado.
                </p>
              </div>
            </div>`
        } catch (err) {
          btn.textContent = 'Importar productos'
          btn.disabled = false
          mapArea.querySelector('#import-error').textContent = 'Error al importar: ' + (err?.message ?? '')
        }
      },
    })
    mapArea.appendChild(mapper.el)

    const btn = document.createElement('button')
    btn.className = 'btn btn--primary'
    btn.style.marginTop = '20px'
    btn.textContent = 'Importar productos'
    const errEl = document.createElement('p')
    errEl.id = 'import-error'
    errEl.style.cssText = 'color:#d32f2f;font-size:13px;margin-top:8px;'
    btn.addEventListener('click', () => mapper.triggerSave())
    mapArea.appendChild(btn)
    mapArea.appendChild(errEl)
  }
}

// ─── Tab: Settings ───────────────────────────────────────────────────────────

function renderSettingsTab(el, catalog) {
  const fc = catalog.field_config ?? {}

  el.innerHTML = `
    <div style="max-width:540px;display:flex;flex-direction:column;gap:20px;">
      <form id="settings-form" style="display:contents;">

        <!-- General -->
        <div class="card" style="padding:24px;display:flex;flex-direction:column;gap:16px;">
          <p class="section-label">General</p>
          <div>
            <label class="field-label" for="s-name">Nombre</label>
            <input id="s-name" class="field" value="${escHtml(catalog.name)}">
          </div>
          <div>
            <label class="field-label" for="s-desc">Descripción</label>
            <textarea id="s-desc" class="field" rows="2">${escHtml(catalog.description ?? '')}</textarea>
          </div>
          <div style="display:grid;grid-template-columns:90px 1fr 1fr;gap:12px;">
            <div>
              <label class="field-label">Emoji</label>
              <input id="s-emoji" class="field" value="${escHtml(catalog.emoji ?? '')}" maxlength="4"
                style="text-align:center;font-size:22px;padding:8px 4px;">
            </div>
            <div>
              <label class="field-label" for="s-currency">Moneda</label>
              <select id="s-currency" class="field">
                ${CURRENCY_OPTIONS.replace(
                    `value="${escHtml(fc.currency ?? 'COP')}"`,
                    `value="${escHtml(fc.currency ?? 'COP')}" selected`
                  )}
              </select>
            </div>
            <div>
              <label class="field-label" for="s-status">Estado</label>
              <select id="s-status" class="field">
                <option value="draft"  ${catalog.status !== 'active' ? 'selected' : ''}>Borrador</option>
                <option value="active" ${catalog.status === 'active' ? 'selected' : ''}>Activo</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Integración Atom -->
        <div class="card" style="padding:24px;display:flex;flex-direction:column;gap:16px;">
          <div>
            <p class="section-label" style="margin-bottom:2px;">Integración Atom</p>
            <p style="font-size:13px;color:var(--color-text-muted);margin:0;">
              Configura cómo se actualiza el cliente en Atom cuando interactúa con este catálogo.
            </p>
          </div>
          <div>
            <label class="field-label" for="s-timeout">Tiempo de carrito abandonado</label>
            <div style="display:flex;align-items:center;border:1.5px solid var(--color-border);
              border-radius:12px;overflow:hidden;background:var(--color-bg);width:180px;">
              <input id="s-timeout" type="number" min="1" value="${escHtml(String(fc.abandoned_timeout_min ?? 30))}"
                style="flex:1;border:none;outline:none;padding:10px 14px;font-size:14px;
                background:transparent;color:var(--color-text);">
              <span style="padding:10px 12px;font-size:13px;color:var(--color-text-muted);
                background:var(--color-bg-subtle);border-left:1.5px solid var(--color-border);
                white-space:nowrap;">min</span>
            </div>
          </div>
          <div>
            <label class="field-label" for="s-atom-token">Token de Atom</label>
            <div style="display:flex;gap:8px;">
              <input id="s-atom-token" class="field" type="password"
                value="${escHtml(fc.atom_token ?? '')}"
                placeholder="Bearer token de tu empresa" style="flex:1;">
              <button type="button" id="btn-toggle-token" class="btn btn--ghost btn--sm"
                style="flex-shrink:0;padding:0 12px;height:42px;" title="Mostrar/ocultar">👁</button>
            </div>
            <p style="font-size:12px;color:var(--color-text-muted);margin:6px 0 0;">
              Sin token configurado no se enviarán notificaciones a Atom.
            </p>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label class="field-label" for="s-field-cart">Campo carrito completado</label>
              <input id="s-field-cart" class="field"
                value="${escHtml(fc.atom_field_cart ?? '')}"
                placeholder="custom_carrito_de_compra">
            </div>
            <div>
              <label class="field-label" for="s-field-abandoned">Campo carrito abandonado</label>
              <input id="s-field-abandoned" class="field"
                value="${escHtml(fc.atom_field_abandoned ?? '')}"
                placeholder="custom_carrito_abandonado">
            </div>
          </div>
          <p style="font-size:12px;color:var(--color-text-muted);margin:0;">
            Deja vacío para usar los valores por defecto.
          </p>
        </div>

        <div id="s-msg" style="display:none;padding:12px 16px;border-radius:12px;font-size:13px;"></div>

        <div style="display:flex;gap:10px;justify-content:space-between;align-items:center;">
          <button type="button" class="btn btn--ghost btn--sm" id="btn-delete"
            style="color:#d32f2f;border-color:rgba(211,47,47,0.3);">
            Eliminar catálogo
          </button>
          <button type="submit" class="btn btn--primary" id="btn-save">Guardar cambios</button>
        </div>
      </form>
    </div>
  `

  createEmojiPicker(el.querySelector('#s-emoji'))

  el.querySelector('#btn-toggle-token').addEventListener('click', () => {
    const inp = el.querySelector('#s-atom-token')
    inp.type = inp.type === 'password' ? 'text' : 'password'
  })

  const msg = el.querySelector('#s-msg')

  el.querySelector('#settings-form').addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const btn = el.querySelector('#btn-save')
    btn.disabled = true
    btn.textContent = 'Guardando…'
    msg.style.display = 'none'
    try {
      const timeoutVal = parseInt(el.querySelector('#s-timeout').value, 10) || 30
      const atomToken  = el.querySelector('#s-atom-token').value.trim()
      const fieldCart  = el.querySelector('#s-field-cart').value.trim()
      const fieldAband = el.querySelector('#s-field-abandoned').value.trim()
      const newConfig  = {
        ...fc,
        currency:              el.querySelector('#s-currency').value,
        abandoned_timeout_min: timeoutVal,
        ...(atomToken  ? { atom_token:          atomToken  } : {}),
        ...(fieldCart  ? { atom_field_cart:      fieldCart  } : {}),
        ...(fieldAband ? { atom_field_abandoned: fieldAband } : {}),
      }
      await updateCatalog(catalog.id, {
        name:        el.querySelector('#s-name').value.trim(),
        description: el.querySelector('#s-desc').value.trim(),
        emoji:       el.querySelector('#s-emoji').value.trim(),
        status:      el.querySelector('#s-status').value,
        field_config: newConfig,
      })
      catalog.field_config = newConfig
      msg.style.cssText = 'display:block;padding:12px 16px;border-radius:12px;font-size:13px;background:rgba(6,223,115,0.1);color:#0c7c47;'
      msg.textContent = '✓ Cambios guardados correctamente'
    } catch {
      msg.style.cssText = 'display:block;padding:12px 16px;border-radius:12px;font-size:13px;background:rgba(255,70,70,0.08);color:#d32f2f;'
      msg.textContent = 'Error al guardar. Intenta de nuevo.'
    }
    btn.disabled = false
    btn.textContent = 'Guardar cambios'
  })

  el.querySelector('#btn-delete').addEventListener('click', async () => {
    if (!confirm(`¿Eliminar el catálogo "${catalog.name}" y todos sus productos? Esta acción no se puede deshacer.`)) return
    try {
      await deleteCatalog(catalog.id)
      window.location.href = '/admin'
    } catch {
      msg.style.cssText = 'display:block;padding:12px 16px;border-radius:12px;font-size:13px;background:rgba(255,70,70,0.08);color:#d32f2f;'
      msg.textContent = 'Error al eliminar el catálogo.'
    }
  })
}

// ─── Tab: Logs ───────────────────────────────────────────────────────────────

async function renderLogsTab(el, catalogId) {
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
      <p style="margin:0;font-size:13px;color:var(--color-text-muted);">Últimas 50 peticiones enviadas a Atom</p>
      <div style="display:flex;gap:8px;">
        <button class="btn btn--ghost btn--sm" id="logs-export">⬇ Exportar CSV</button>
        <button class="btn btn--ghost btn--sm" id="logs-refresh">↺ Actualizar</button>
      </div>
    </div>
    <div id="logs-content">
      <p style="font-size:13px;color:var(--color-text-muted);">Cargando…</p>
    </div>`

  let currentLogs = []

  el.querySelector('#logs-refresh').addEventListener('click', () => loadLogs())
  el.querySelector('#logs-export').addEventListener('click', () => exportCsv(currentLogs))

  async function loadLogs() {
    const content = el.querySelector('#logs-content')
    content.innerHTML = `<p style="font-size:13px;color:var(--color-text-muted);">Cargando…</p>`
    try {
      const result = await getAtomLogs(catalogId)
      currentLogs  = result.items

      if (!currentLogs.length) {
        content.innerHTML = `
          <div style="text-align:center;padding:48px 20px;">
            <div style="font-size:36px;margin-bottom:12px;">📋</div>
            <p style="color:var(--color-text-muted);font-size:14px;margin:0;">
              Sin registros aún. Los logs aparecerán aquí cuando se envíen notificaciones a Atom.
            </p>
          </div>`
        return
      }

      const tbody = currentLogs.map((log, idx) => {
        const date     = new Date(log.created)
        const dateStr  = date.toLocaleDateString('es', { day:'2-digit', month:'short' })
          + ' ' + date.toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' })
        const isSuccess  = log.status === 'success'
        const typeLabel  = log.type === 'cart_completed' ? '🛒 Completado' : '⏳ Abandonado'
        const typeBg     = log.type === 'cart_completed'
          ? 'rgba(6,223,115,0.1);color:#0c7c47'
          : 'rgba(245,158,11,0.12);color:#b45309'

        let items = []
        try {
          const raw = log.items_detail
          items = !raw ? []
            : Array.isArray(raw) ? raw
            : typeof raw === 'string' ? JSON.parse(raw)
            : []
        } catch { items = [] }
        const hasItems = items.length > 0

        const productsCell = hasItems
          ? `<button class="btn btn--ghost btn--sm" data-log-idx="${idx}"
              style="font-size:12px;padding:2px 10px;height:auto;line-height:1.6;">
              ${log.items_count ?? items.length} ver →
            </button>`
          : `<span style="font-weight:600;">${log.items_count ?? '—'}</span>`

        const detailRow = hasItems ? `
          <tr class="log-detail-row" id="log-detail-${idx}" style="display:none;background:var(--color-bg-subtle);">
            <td colspan="8" style="padding:12px 16px;">
              <div style="display:flex;flex-wrap:wrap;gap:8px;">
                ${items.map(item => `
                  <div style="background:var(--color-bg);border:1.5px solid var(--color-border);
                    border-radius:10px;padding:8px 12px;font-size:12px;min-width:140px;">
                    <p style="font-weight:600;margin:0 0 2px;">${escHtml(item.name || '—')}</p>
                    <p style="color:var(--color-text-muted);margin:0;">
                      Cant: ${escHtml(String(item.qty ?? 1))}
                      ${item.price ? ` · ${escHtml(String(item.price))}` : ''}
                      ${item.sku  ? ` · SKU: ${escHtml(item.sku)}`    : ''}
                    </p>
                  </div>`).join('')}
              </div>
            </td>
          </tr>` : ''

        return `
          <tr data-main-idx="${idx}" style="cursor:${hasItems ? 'pointer' : 'default'};">
            <td style="font-size:12px;color:var(--color-text-muted);white-space:nowrap;">${escHtml(dateStr)}</td>
            <td>
              <span style="font-size:12px;padding:3px 10px;border-radius:20px;
                background:${typeBg};white-space:nowrap;">${typeLabel}</span>
            </td>
            <td style="font-weight:600;">${escHtml(log.customer_name || '—')}</td>
            <td style="font-size:13px;color:var(--color-text-muted);font-family:var(--font-mono);">${escHtml(log.customer_phone || '—')}</td>
            <td style="font-size:12px;color:var(--color-text-muted);font-family:var(--font-mono);">${escHtml(log.atom_field || '—')}</td>
            <td style="text-align:center;">${productsCell}</td>
            <td style="text-align:center;">
              <span style="font-size:12px;padding:3px 10px;border-radius:20px;
                background:${isSuccess ? 'rgba(6,223,115,0.1);color:#0c7c47' : 'rgba(255,70,70,0.08);color:#d32f2f'};">
                ${isSuccess ? '✓ OK' : '✕ Error'}
              </span>
            </td>
            <td style="font-size:12px;color:#d32f2f;max-width:180px;overflow:hidden;
              text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(log.error_msg || '')}">
              ${escHtml(log.error_msg || '')}
            </td>
          </tr>
          ${detailRow}`
      }).join('')

      content.innerHTML = `
        <div style="overflow-x:auto;border-radius:14px;border:1.5px solid var(--color-border);">
          <table class="table" style="margin:0;">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Campo Atom</th>
                <th style="text-align:center;">Productos</th>
                <th style="text-align:center;">Estado</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
        <p style="font-size:12px;color:var(--color-text-muted);margin-top:10px;">
          Mostrando ${currentLogs.length} de ${result.totalItems} registros
          · Haz clic en "ver →" para ver los productos de cada pedido
        </p>`

      // Toggle product detail rows
      content.querySelectorAll('[data-log-idx]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          const idx    = btn.dataset.logIdx
          const detail = content.querySelector(`#log-detail-${idx}`)
          if (!detail) return
          const isOpen = detail.style.display !== 'none'
          detail.style.display = isOpen ? 'none' : ''
          btn.textContent = isOpen
            ? `${currentLogs[idx]?.items_count ?? ''} ver →`
            : `${currentLogs[idx]?.items_count ?? ''} ▲`
        })
      })

    } catch {
      content.innerHTML = `<p style="color:#d32f2f;font-size:13px;">Error al cargar los registros.</p>`
    }
  }

  function exportCsv(logs) {
    if (!logs.length) return

    const headers = ['Fecha', 'Tipo', 'Cliente', 'Teléfono', 'Campo Atom', 'Nº Productos', 'Productos', 'Estado', 'Error']

    const rows = logs.map(log => {
      const date = new Date(log.created)
      const dateStr = date.toLocaleDateString('es') + ' ' + date.toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' })
      const type = log.type === 'cart_completed' ? 'Completado' : 'Abandonado'

      let itemsText = ''
      try {
        const raw = log.items_detail
        const items = !raw ? []
          : Array.isArray(raw) ? raw
          : typeof raw === 'string' ? JSON.parse(raw)
          : []
        itemsText = items.map(i => `${i.qty}x ${i.name}${i.price ? ' (' + i.price + ')' : ''}`).join('; ')
      } catch { itemsText = '' }

      return [
        dateStr,
        type,
        log.customer_name  || '',
        log.customer_phone || '',
        log.atom_field     || '',
        log.items_count    ?? 0,
        itemsText,
        log.status === 'success' ? 'OK' : 'Error',
        log.error_msg || '',
      ]
    })

    const csvContent = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `registros-atom-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  loadLogs()
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
