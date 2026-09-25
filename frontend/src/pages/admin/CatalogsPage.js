import { getCatalogs, createCatalog } from '../../services/catalogs.js'
import { requireAuth } from '../../services/auth.js'

export async function CatalogsPage(container) {
  requireAuth()

  const catalogs = await getCatalogs()

  container.innerHTML = `
    <div class="flex items-center justify-between gap-16" style="margin-bottom:28px;flex-wrap:wrap;">
      <div>
        <h1 style="margin-bottom:4px;">Mis catálogos</h1>
        <p style="font-size:14px;color:var(--color-text-muted);">Gestiona tus catálogos de productos para WhatsApp</p>
      </div>
      <button class="btn btn--primary" id="btn-new">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M7.5 2v11M2 7.5h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        Nuevo catálogo
      </button>
    </div>
    <div class="grid auto-fill-280 gap-16" id="catalogs-grid"></div>
  `

  const grid = container.querySelector('#catalogs-grid')

  catalogs.forEach(cat => {
    const card = document.createElement('div')
    card.className = 'card catalog-card'
    card.innerHTML = `
      <div class="catalog-card__header">
        <div class="catalog-card__icon" style="background:${cat.icon_bg ?? 'var(--grad-soft)'};">
          ${cat.emoji ?? '🛍️'}
        </div>
        <div style="flex:1;">
          <div class="catalog-card__name">${cat.name}</div>
          <div class="catalog-card__slug">${cat.slug}</div>
        </div>
        <span class="badge ${cat.status === 'active' ? 'badge--active' : 'badge--draft'}">
          ${cat.status === 'active' ? 'Activo' : 'Borrador'}
        </span>
      </div>
      <div class="catalog-card__stats">
        <div>
          <div class="catalog-card__stat-label">Productos</div>
          <div class="catalog-card__stat-value">${cat.product_count ?? 0}</div>
        </div>
        <div>
          <div class="catalog-card__stat-label">Vistas</div>
          <div class="catalog-card__stat-value">${cat.views ?? '—'}</div>
        </div>
        <div>
          <div class="catalog-card__stat-label">Continuaciones WA</div>
          <div class="catalog-card__stat-value">${cat.wa_clicks ?? '—'}</div>
        </div>
        <div>
          <div class="catalog-card__stat-label">Actualizado</div>
          <div class="catalog-card__stat-value" style="font-size:13px;">
            ${(() => { const raw = (cat.updated ?? '').replace(' ', 'T').replace(/(\.\d+)$/, '$1Z').replace(/Z+$/, 'Z'); const d = new Date(raw); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) })()}
          </div>
        </div>
      </div>
      <div class="catalog-card__actions">
        <button class="btn btn--ghost btn--sm" data-action="manage" data-id="${cat.id}">Gestionar</button>
        <a class="btn btn--primary btn--sm" href="/catalog/${cat.slug}" target="_blank">Ver catálogo →</a>
      </div>
    `
    card.querySelector('[data-action="manage"]').addEventListener('click', () => {
      window.location.href = `/admin/catalogs/${cat.id}`
    })
    grid.appendChild(card)
  })

  // New catalog placeholder
  const newCard = document.createElement('div')
  newCard.className = 'card catalog-card catalog-card--new'
  newCard.innerHTML = `
    <div style="width:44px;height:44px;border-radius:12px;background:rgba(128,35,255,0.09);
      display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--color-violet);">+</div>
    <div style="font-size:14px;font-weight:700;color:var(--color-text-muted);">Crear nuevo catálogo</div>
    <div style="font-size:12px;color:var(--color-text-light);text-align:center;max-width:180px;">
      Sube tu archivo Excel o CSV y configura en minutos
    </div>
  `
  newCard.addEventListener('click', () => { window.location.href = '/admin/catalogs/new' })
  grid.appendChild(newCard)

  container.querySelector('#btn-new').addEventListener('click', () => {
    window.location.href = '/admin/catalogs/new'
  })
}
