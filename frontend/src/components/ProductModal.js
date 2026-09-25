import { addItem } from '../services/cart.js'

function formatPrice(raw, currency) {
  const n = parseFloat(String(raw ?? '').replace(/[^0-9.]/g, ''))
  if (isNaN(n) || !currency) return raw ?? ''
  return new Intl.NumberFormat(navigator.language, { style: 'currency', currency }).format(n)
}

const HIDDEN_FIELDS = new Set([
  'id','collectionId','collectionName','created','updated',
  'catalog','order','name','price','image','sku','description','category',
  'extras','_bg','_emoji',
])

export class ProductModal {
  constructor(currency) {
    this._currency = currency
    this._el = this._build()
    document.body.appendChild(this._el)
    this._el.addEventListener('click', (e) => { if (e.target === this._el) this.close() })
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close() })
  }

  _build() {
    const el = document.createElement('div')
    el.className = 'modal-overlay'
    el.innerHTML = `
      <div class="modal">
        <div class="modal__handle"></div>
        <button class="modal__close" id="pm-close" aria-label="Cerrar">✕</button>
        <div class="modal__image" id="pm-img"></div>
        <div class="modal__body">
          <div class="modal__meta" id="pm-meta"></div>
          <div class="modal__name"  id="pm-name"></div>
          <div class="modal__price" id="pm-price"></div>
          <div class="modal__desc"  id="pm-desc"></div>
          <div class="modal__sku"   id="pm-sku"></div>
          <div class="modal__attrs" id="pm-attrs"></div>
          <div class="modal__divider"></div>
          <button class="btn btn--primary" id="pm-cta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Agregar al carrito
          </button>
        </div>
      </div>
    `
    el.querySelector('#pm-close').addEventListener('click', () => this.close())
    return el
  }

  open(product) {
    this._product = product

    // Imagen
    const imgEl = this._el.querySelector('#pm-img')
    if (product.image) {
      imgEl.innerHTML = `<img src="${product.image}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;">`
      imgEl.style.background = ''
    } else {
      imgEl.innerHTML = product._emoji ?? '📦'
      imgEl.style.background = product._bg ?? '#F5F3FF'
    }

    // Categoría badge
    const metaEl = this._el.querySelector('#pm-meta')
    metaEl.innerHTML = product.category
      ? `<span class="modal__category-badge">${product.category}</span>`
      : ''

    // Nombre, precio, descripción, SKU
    this._el.querySelector('#pm-name').textContent = product.name

    const priceEl = this._el.querySelector('#pm-price')
    priceEl.textContent = product.price
      ? `${formatPrice(product.price, this._currency)} c/IVA` : ''

    const descEl = this._el.querySelector('#pm-desc')
    if (product.description) {
      descEl.innerHTML = `<span style="font-size:11px;font-weight:500;color:var(--color-text-muted);display:block;margin-bottom:2px;">Descripción</span>${product.description}`
      descEl.hidden = false
    } else {
      descEl.hidden = true
    }

    const skuEl = this._el.querySelector('#pm-sku')
    skuEl.textContent = product.sku ? `SKU: ${product.sku}` : ''

    // Extras — campos adicionales del producto en grid
    const extras = product.extras && typeof product.extras === 'object' ? product.extras : {}

    // También mostrar campos del nivel raíz que no estén ocultos (por si extras está vacío)
    const rootFields = Object.entries(product)
      .filter(([key, val]) => !HIDDEN_FIELDS.has(key) && val !== null && val !== undefined && val !== '')

    const allAttrs = [
      ...Object.entries(extras).filter(([, val]) => val !== null && val !== undefined && val !== ''),
      ...rootFields,
    ]

    const attrsEl = this._el.querySelector('#pm-attrs')
    if (allAttrs.length) {
      attrsEl.innerHTML = `
        <div class="modal__attrs-grid">
          ${allAttrs.map(([key, val]) => `
            <div class="modal__attr">
              <span class="modal__attr-label">${key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g,' ')}</span>
              <span class="modal__attr-value">${val}</span>
            </div>`).join('')}
        </div>`
      attrsEl.hidden = false
    } else {
      attrsEl.hidden = true
    }

    this._el.querySelector('#pm-cta').onclick = () => {
      addItem(product)
      this.close()
    }

    this._el.classList.add('modal-overlay--open')
    document.body.style.overflow = 'hidden'
  }

  close() {
    this._el.classList.remove('modal-overlay--open')
    document.body.style.overflow = ''
  }
}
