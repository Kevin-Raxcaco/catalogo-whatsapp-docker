// Atom clients integration
import { logAtomRequest } from './atomLogs.js'

const CLIENTS_URL = import.meta.env.VITE_ATOM_CLIENTS_URL

/**
 * Updates the Atom client record when the customer finalizes their cart.
 * @param {string} name    - Customer first name
 * @param {string} phone   - Customer phone with country code (digits only)
 * @param {Array}  items   - Cart items [{ product, qty }]
 */
export async function notifyCartSelected(name, phone, items, catalog) {
  if (!CLIENTS_URL) return

  const token     = catalog?.field_config?.atom_token
  const fieldCart = catalog?.field_config?.atom_field_cart ?? 'custom_carrito_de_compra'
  if (!token) return

  const PB_INTERNALS = new Set(['id', 'collectionId', 'collectionName', 'created', 'updated', 'extras',
    'catalog', 'order', 'category'])

  const carritoDeCompra = items
    .map(({ product, qty }) => {
      const campos = Object.entries(product)
        .filter(([key, val]) => !PB_INTERNALS.has(key) && val !== null && val !== undefined && val !== ''
          && typeof val !== 'object')
        .map(([, val]) => val)
        .join(' | ')
      return `(x${qty}) ${campos}`
    })
    .join(' / ')

  const itemsDetail = items.map(({ product, qty }) => ({
    name:  product.name  ?? '',
    qty,
    price: product.price ?? '',
    sku:   product.sku   ?? '',
  }))

  const logBase = {
    catalogId:     catalog?.id,
    type:          'cart_completed',
    customerName:  name,
    customerPhone: phone,
    atomField:     fieldCart,
    itemsCount:    items.length,
    itemsDetail,
  }

  try {
    await fetch(CLIENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        firstName: name, lastName: ' ', phone,
        optionals: { [fieldCart]: carritoDeCompra },
      }),
    })
    logAtomRequest({ ...logBase, status: 'success' })
  } catch (err) {
    logAtomRequest({ ...logBase, status: 'error', errorMsg: err?.message ?? String(err) })
    console.warn('Atom client update error:', err)
  }
}

/**
 * Notifies Atom when the customer abandons the cart without completing.
 */
export async function notifyAbandonedCart(name, phone, items, catalog) {
  if (!CLIENTS_URL) return

  const token          = catalog?.field_config?.atom_token
  const fieldAbandoned = catalog?.field_config?.atom_field_abandoned ?? 'custom_carrito_abandonado'
  if (!token) return

  const PB_INTERNALS = new Set(['id', 'collectionId', 'collectionName', 'created', 'updated', 'extras',
    'catalog', 'order', 'category'])

  const carritoAbandonado = items
    .map(({ product, qty }) => {
      const campos = Object.entries(product)
        .filter(([key, val]) => !PB_INTERNALS.has(key) && val !== null && val !== undefined && val !== ''
          && typeof val !== 'object')
        .map(([, val]) => val)
        .join(' | ')
      return `(x${qty}) ${campos}`
    })
    .join(' / ')

  const itemsDetail = items.map(({ product, qty }) => ({
    name:  product.name  ?? '',
    qty,
    price: product.price ?? '',
    sku:   product.sku   ?? '',
  }))

  const logBase = {
    catalogId:     catalog?.id,
    type:          'cart_abandoned',
    customerName:  name,
    customerPhone: phone,
    atomField:     fieldAbandoned,
    itemsCount:    items.length,
    itemsDetail,
  }

  try {
    await fetch(CLIENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        firstName: name, lastName: ' ', phone,
        optionals: { [fieldAbandoned]: carritoAbandonado },
      }),
    })
    logAtomRequest({ ...logBase, status: 'success' })
  } catch (err) {
    logAtomRequest({ ...logBase, status: 'error', errorMsg: err?.message ?? String(err) })
    console.warn('Atom abandoned cart error:', err)
  }
}

