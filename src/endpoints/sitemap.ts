import type { PayloadRequest } from 'payload'

export const sitemapHandler = async (req: PayloadRequest): Promise<Response> => {
  const { payload } = req

  if (!req.url) {
    return new Response('Bad Request', { status: 400 })
  }

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

  // 2. Determine Base URLs
  const protocol = req.headers.get('x-forwarded-proto') || 'https'
  
  // A. Frontend URL
  // Logic: Strip 'https://' then strip 'payload.' to get the root domain
  let frontendBaseUrl = ''
  
  if (tenant.domain) {
    // 1. Remove protocol if exists
    let domain = tenant.domain.replace(/^https?:\/\//, '')
    
    // 2. Remove 'payload.' prefix (e.g. payload.robinsconsulting.com -> robinsconsulting.com)
    domain = domain.replace(/^payload\./, '')
    
    frontendBaseUrl = `${protocol}://${domain}`
  } else {
    // Fallback if no domain is set
    frontendBaseUrl = `${protocol}://${host}`
  }

  // B. Media URL (Used for the <image:loc> tag)
  const mediaBaseUrl = `${protocol}://${host}`

  const enabledCollections = (tenant.enabledCollections as string[]) || []
  const sitemapItems: string[] = []

  // Add Home page
  sitemapItems.push(`
  <url>
    <loc>${frontendBaseUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`)

  // --- HELPER: Escape XML Characters ---
  const safeXml = (str: string) => {
    if (!str) return ''
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  // --- HELPER: Generate Image XML Block ---
  const generateImageXml = (doc: any) => {
    if (doc.featuredImage && typeof doc.featuredImage === 'object') {
       // Handle absolute vs relative URLs
       const imgUrl = doc.featuredImage.url.startsWith('http') 
          ? doc.featuredImage.url 
          : `${mediaBaseUrl}${doc.featuredImage.url}`

       const title = safeXml(doc.title || doc.metaTitle || '')
       // Use Meta Description or Excerpt as the Image Caption
       const caption = safeXml(doc.metaDescription || doc.excerpt || '')

       return `
    <image:image>
      <image:loc>${imgUrl}</image:loc>
      <image:title>${title}</image:title>${caption ? `
      <image:caption>${caption}</image:caption>` : ''}
    </image:image>`
    }
    return ''
  }

  // 3. Fetch Pages
  if (enabledCollections.includes('pages')) {
    const pages = await payload.find({
      collection: 'pages',
      where: {
        tenant: { equals: tenant.id },
      },
      limit: 5000,
      depth: 1, // Depth 1 to get featuredImage data
      pagination: false,
      overrideAccess: true,
    })

    pages.docs.forEach((page: any) => {
      if (page.slug === 'home' || !page.slug) return
      
      const pageUrl = `${frontendBaseUrl}/${page.slug}`
      const imageXml = generateImageXml(page)

      sitemapItems.push(`
  <url>
    <loc>${pageUrl}</loc>
    <lastmod>${new Date(page.updatedAt).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${imageXml}
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
      depth: 1, // Depth 1 to get featuredImage data
      pagination: false,
      overrideAccess: true,
    })

    posts.docs.forEach((post: any) => {
      // FIX: URL Structure -> /blogpage?slug=
      const postUrl = `${frontendBaseUrl}/blogpage?slug=${post.slug}`
      const imageXml = generateImageXml(post)

      sitemapItems.push(`
  <url>
    <loc>${postUrl}</loc>
    <lastmod>${new Date(post.updatedAt).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${imageXml}
  </url>`)
    })
  }

  // 5. XML Envelope
  // Note: Standard Sitemaps don't support <title> tags. 
  // We use the Google Image extension to include Titles/Captions validly.
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sitemapItems.join('')}
</urlset>`

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59',
    },
  })
}
