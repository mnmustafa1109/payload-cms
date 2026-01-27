import type { PayloadRequest } from 'payload'

export const sitemapHandler = async (req: PayloadRequest): Promise<Response> => {
  const { payload } = req
  const url = new URL(req.url)
  const tenantSlug = url.searchParams.get('tenant')
  const host = req.headers.get('host')

  let tenant: any = null

  // 1. Identify Tenant
  if (tenantSlug) {
    const tenantRes = await payload.find({
      collection: 'tenants',
      where: {
        slug: { equals: tenantSlug },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (tenantRes.docs.length > 0) {
      tenant = tenantRes.docs[0]
    }
  } else if (host) {
    // Try to find tenant by domain
    const tenantRes = await payload.find({
      collection: 'tenants',
      where: {
        domain: { equals: host },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (tenantRes.docs.length > 0) {
      tenant = tenantRes.docs[0]
    }
  }

  if (!tenant) {
    return new Response('Tenant not found', { status: 404 })
  }

  // 2. Determine Base URL for links
  const protocol = req.headers.get('x-forwarded-proto') || 'https'
  let baseUrl = ''

  if (tenant.domain && host === tenant.domain) {
    baseUrl = `${protocol}://${tenant.domain}`
  } else if (tenant.domain && !tenantSlug) {
    baseUrl = `${protocol}://${tenant.domain}`
  } else {
    // Fallback to path-based routing if no domain match or tenant slug provided
    baseUrl = `${protocol}://${host}/tenant-slugs/${tenant.slug}`
  }

  const enabledCollections = (tenant.enabledCollections as string[]) || []
  const sitemapItems: string[] = []

  // Add Home page
  sitemapItems.push(`
  <url>
    <loc>${baseUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`)

  // 3. Fetch Pages
  if (enabledCollections.includes('pages')) {
    const pages = await payload.find({
      collection: 'pages',
      where: {
        tenant: { equals: tenant.id },
      },
      limit: 5000,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })

    pages.docs.forEach((page: any) => {
      if (page.slug === 'home' || !page.slug) return
      sitemapItems.push(`
  <url>
    <loc>${baseUrl}/${page.slug}</loc>
    <lastmod>${new Date(page.updatedAt).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`)
    })
  }

  // 4. Fetch Posts
  if (enabledCollections.includes('posts')) {
    const posts = await payload.find({
      collection: 'posts',
      where: {
        tenant: { equals: tenant.id },
        status: { equals: 'published' },
      },
      limit: 5000,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })

    posts.docs.forEach((post: any) => {
      // Adjust the path according to your frontend routing
      const postUrl = `${baseUrl}/blog/${post.slug}`
      sitemapItems.push(`
  <url>
    <loc>${postUrl}</loc>
    <lastmod>${new Date(post.updatedAt).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`)
    })
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapItems.join('')}
</urlset>`

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59',
    },
  })
}
