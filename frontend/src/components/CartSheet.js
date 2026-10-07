import { getCart, getCount, increment, decrement, removeItem, subscribe, clear } from '../services/cart.js'
import { notifyCartSelected } from '../services/atom.js'
import { getCustomerFromUrl } from '../utils/url.js'
import { incrementWaClicks } from '../services/catalogs.js'

export class CartSheet {
  constructor(catalog, onComplete) {
    this._catalog    = catalog
    this._onComplete = onComplete ?? (() => {})
    this._urlContact = getCustomerFromUrl()
    this._el = this._build()
    document.body.appendChild(this._el)
    this._el.addEventListener('click', (e) => {
      if (e.target === this._el) this.close()
    })
    subscribe(() => this._renderItems())
  }

  _build() {
    const el = document.createElement('div')
    el.className = 'modal-overlay cart-sheet-overlay'
    el.innerHTML = `
      <div class="modal cart-sheet">
        <div class="modal__handle"></div>
        <div class="cart-sheet__head">
          <div class="cart-sheet__title">Tu pedido</div>
          <button class="cart-sheet__clear" id="cs-clear">Vaciar</button>
        </div>

        <div class="cart-sheet__items" id="cs-items"></div>

        <div class="cart-sheet__footer">
          <div class="cart-sheet__total-row">
            <span>Total estimado</span>
            <span class="cart-sheet__total" id="cs-total">—</span>
          </div>

          <div class="cart-sheet__divider"></div>

          <p class="cart-sheet__contact-title">¿Cómo te contactamos?</p>

          <div class="cart-sheet__contact-form">
            <div class="cs-field">
              <label class="field-label" for="cs-name">Nombre</label>
              <input class="field-input" id="cs-name" type="text" placeholder="Tu nombre completo" autocomplete="name">
            </div>
            <div class="cs-field">
              <label class="field-label" for="cs-phone">WhatsApp (con código de país)</label>
              <div class="cs-phone-wrap">
                <span class="cs-phone-prefix">+</span>
                <input class="field-input cs-phone-input" id="cs-phone" type="tel"
                  placeholder="502 5555 1234" autocomplete="tel" inputmode="tel">
              </div>
              <span class="cs-field-hint">Ejemplo: 502 5555 1234 (Guatemala) · 52 1 55 1234 5678 (México)</span>
            </div>
          </div>

          <div class="cs-error" id="cs-error" hidden></div>

          <button class="btn btn--wa" id="cs-wa">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Continuar por WhatsApp
          </button>
          <p class="cart-sheet__hint" id="cs-hint">
            Tu agente de WhatsApp recibirá tu selección y continuará la conversación contigo.
          </p>
        </div>
      </div>
    `

    el.querySelector('#cs-clear').addEventListener('click', () => {
      if (confirm('¿Vaciar el carrito?')) clear()
    })

    el.querySelector('#cs-wa').addEventListener('click', () => this._goWhatsApp())

    // Remove error on input
    el.querySelector('#cs-name').addEventListener('input', () => this._hideError())
    el.querySelector('#cs-phone').addEventListener('input', () => this._hideError())

    return el
  }

  _renderItems() {
    const items   = getCart()
    const list    = this._el.querySelector('#cs-items')
    const totalEl = this._el.querySelector('#cs-total')
    if (!list) return // sheet in success state

    if (items.length === 0) {
      list.innerHTML = `<div class="cart-sheet__empty">Tu carrito está vacío.</div>`
      if (totalEl) totalEl.textContent = '—'
      return
    }

    list.innerHTML = items.map(({ product, qty }) => `
      <div class="cart-item" data-id="${product.id}">
        <div class="cart-item__img" style="background:${product._bg ?? '#F5F3FF'};">
          ${product.image
            ? `<img src="${product.image}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`
            : (product._emoji ?? '📦')}
        </div>
        <div class="cart-item__info">
          <div class="cart-item__name">${product.name}</div>
          <div class="cart-item__price">${product.price ?? ''}</div>
        </div>
        <div class="cart-item__controls">
          <button class="qty-btn qty-btn--minus" data-action="dec"    data-id="${product.id}">−</button>
          <span class="qty-count">${qty}</span>
          <button class="qty-btn qty-btn--plus"  data-action="inc"    data-id="${product.id}">+</button>
        </div>
        <button class="cart-item__remove" data-action="remove" data-id="${product.id}" aria-label="Eliminar">✕</button>
      </div>
    `).join('')

    list.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id
        if (btn.dataset.action === 'inc')    increment(id)
        if (btn.dataset.action === 'dec')    decrement(id)
        if (btn.dataset.action === 'remove') removeItem(id)
      })
    })

    const total = items.reduce((sum, { product, qty }) => {
      const n = parseFloat(String(product.price ?? '').replace(/[^0-9.]/g, ''))
      return isNaN(n) ? sum : sum + n * qty
    }, 0)

    if (totalEl) totalEl.textContent = total > 0
      ? new Intl.NumberFormat(navigator.language, {
          style: 'currency',
          currency: this._catalog.field_config?.currency ?? 'COP',
        }).format(total)
      : '—'
  }

  _validate() {
    const { name: urlName, phone: urlPhone } = this._urlContact

    if (urlName && urlPhone) {
      return { name: urlName, phone: urlPhone.replace(/^\+/, '') }
    }

    const name  = this._el.querySelector('#cs-name')?.value.trim() ?? ''
    const phone = this._el.querySelector('#cs-phone')?.value.trim().replace(/\s+/g, '') ?? ''

    if (!name) {
      this._showError('Por favor ingresa tu nombre.')
      this._el.querySelector('#cs-name').focus()
      return null
    }
    if (!phone || phone.length < 7) {
      this._showError('Por favor ingresa tu número de WhatsApp con código de país.')
      this._el.querySelector('#cs-phone').focus()
      return null
    }
    return { name, phone: phone.replace(/^\+/, '') }
  }

  _showError(msg) {
    const el = this._el.querySelector('#cs-error')
    el.textContent = msg
    el.hidden = false
  }

  _hideError() {
    this._el.querySelector('#cs-error').hidden = true
  }

  async _goWhatsApp() {
    const items = getCart()
    if (items.length === 0) return

    const contact = this._validate()
    if (!contact) return

    const waBtn = this._el.querySelector('#cs-wa')
    waBtn.disabled = true
    waBtn.textContent = 'Enviando pedido...'

    try {
      await notifyCartSelected(contact.name, contact.phone, items, this._catalog)
      incrementWaClicks(this._catalog.id)
      this._onComplete()
      this._showSuccess()
    } catch {
      this._showError('Ocurrió un error. Por favor intenta de nuevo.')
      waBtn.disabled = false
      waBtn.textContent = 'Continuar por WhatsApp'
    }
  }

  _showSuccess() {
    const footer = this._el.querySelector('.cart-sheet__footer')
    footer.innerHTML = `
      <div class="cart-success">
        <div class="cart-success__icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
        <div class="cart-success__title">¡Selección enviada!</div>
        <div class="cart-success__msg">
          Regresa al chat y presiona el botón <strong>Continuar</strong> para ver tus productos seleccionados.
        </div>
      </div>
    `
    clear()
    // Auto-close after 3 seconds and reset to default state
    setTimeout(() => this.close(), 3000)
  }

  _resetFooter() {
    const footer = this._el.querySelector('.cart-sheet__footer')
    if (!footer) return
    const { name, phone } = this._urlContact
    const fromUrl = !!(name && phone)

    footer.innerHTML = `
      <div class="cart-sheet__total-row">
        <span>Total estimado</span>
        <span class="cart-sheet__total" id="cs-total">—</span>
      </div>
      ${fromUrl ? '' : `
      <div class="cart-sheet__divider"></div>
      <p class="cart-sheet__contact-title">¿Cómo te contactamos?</p>
      <div class="cart-sheet__contact-form">
        <div class="cs-field">
          <label class="field-label" for="cs-name">Nombre</label>
          <input class="field-input" id="cs-name" type="text" placeholder="Tu nombre completo" autocomplete="name">
        </div>
        <div class="cs-field">
          <label class="field-label" for="cs-phone">WhatsApp (con código de país)</label>
          <div class="cs-phone-wrap">
            <span class="cs-phone-prefix">+</span>
            <input class="field-input cs-phone-input" id="cs-phone" type="tel"
              placeholder="502 5555 1234" autocomplete="tel" inputmode="tel">
          </div>
          <span class="cs-field-hint">Ejemplo: 502 5555 1234 (Guatemala) · 52 1 55 1234 5678 (México)</span>
        </div>
      </div>
      `}
      <div class="cs-error" id="cs-error" hidden></div>
      <button class="btn btn--wa" id="cs-wa">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        Continuar por WhatsApp
      </button>
      <p class="cart-sheet__hint">
        ${fromUrl
          ? 'Tu agente de WhatsApp recibirá tu selección y continuará la conversación contigo.'
          : 'Se abrirá WhatsApp con el resumen de tu pedido listo para enviar.'}
      </p>
    `
    footer.querySelector('#cs-wa').addEventListener('click', () => this._goWhatsApp())
    if (!fromUrl) {
      footer.querySelector('#cs-name').addEventListener('input', () => this._hideError())
      footer.querySelector('#cs-phone').addEventListener('input', () => this._hideError())
    }
  }

  open() {
    this._resetFooter()
    this._renderItems()

    this._el.classList.add('modal-overlay--open')
    document.body.style.overflow = 'hidden'
  }

  close() {
    this._el.classList.remove('modal-overlay--open')
    document.body.style.overflow = ''
  }

  destroy() {
    this._el.remove()
  }
}
