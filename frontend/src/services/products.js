import pb from './pb.js'

export async function getProducts(catalogId) {
  const products = await pb.collection('products').getFullList({
    filter: `catalog="${catalogId}"`,
    sort: 'order,name',
  })
  return products.map(expandFields)
}

function expandFields(p) {
  const f = p.fields && typeof p.fields === 'object' ? p.fields : {}
  const { description, category, ...extras } = f
  return {
    ...p,
    ...(description !== undefined ? { description } : {}),
    ...(category    !== undefined ? { category }    : {}),
    ...(Object.keys(extras).length ? { extras } : {}),
  }
}

export async function getProduct(id) {
  return await pb.collection('products').getOne(id, { expand: 'catalog' })
}

export async function upsertProducts(catalogId, rows) {
  const existing = await pb.collection('products').getFullList({
    filter: `catalog="${catalogId}"`,
    fields: 'id',
  })
  await Promise.all(existing.map(p => pb.collection('products').delete(p.id, { requestKey: null })))

  return await Promise.all(
    rows.map((row, i) => {
      const { name, image, price, sku, description, category, extras } = row

      // Pack description, category and extra columns into the fields JSON
      const fields = {}
      if (description) fields.description = description
      if (category)    fields.category    = category
      if (extras && typeof extras === 'object') Object.assign(fields, extras)

      const data = { catalog: catalogId, order: i }
      if (name)  data.name  = name
      if (image) data.image = image
      if (price) data.price = price
      if (sku)   data.sku   = sku
      if (Object.keys(fields).length) data.fields = fields

      return pb.collection('products').create(data, { requestKey: null })
    })
  )
}
