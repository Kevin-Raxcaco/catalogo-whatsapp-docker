import pb from './pb.js'

export async function getProducts(catalogId) {
  return await pb.collection('products').getFullList({
    filter: `catalog="${catalogId}"`,
    sort: 'order,name',
  })
}

export async function getProduct(id) {
  return await pb.collection('products').getOne(id, { expand: 'catalog' })
}

export async function upsertProducts(catalogId, rows) {
  // Replaces all products in a catalog with a new batch from an imported file.
  // rows: array of raw objects from SheetJS parsing, already mapped through config.
  const existing = await pb.collection('products').getFullList({
    filter: `catalog="${catalogId}"`,
    fields: 'id',
  })
  await Promise.all(existing.map(p => pb.collection('products').delete(p.id, { requestKey: null })))

  return await Promise.all(
    rows.map((row, i) => {
      const data = { catalog: catalogId, order: i }
      for (const [k, v] of Object.entries(row)) {
        // Omit empty strings for URL-type fields to avoid validation errors
        if (v !== '') data[k] = v
      }
      return pb.collection('products').create(data, { requestKey: null })
    })
  )
}
