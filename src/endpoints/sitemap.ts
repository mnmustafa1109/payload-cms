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
  
  // A. Frontend URL (Where the user clicks)
  // We assume tenant.domain is your Frontend (e.g. robins-c.webflow.io)
  // If tenant.domain is missing, we fallback to the request host (which might be the API, so be careful)
  let frontendBaseUrl = ''
  
  if (tenant.domain) {
    // Ensure we don't double-add protocol if it's stored in DB
    const domain = tenant.domain.replace(/^https?:\/\//, '')
    frontendBaseUrl = `${protocol}://${domain}`
  } else {
    // Fallback if no domain is set in DB
    frontendBaseUrl = `${protocol}://${host}`
  }

  // B. Media URL (Where images are hosted)
  // Usually this is your API domain or S3 bucket URL. 
  // Since we are running on the API, we can use the request host.
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
      
      // Standard Page URL
      sitemapItems.push(`
  <url>
    <loc>${frontendBaseUrl}/${page.slug}</loc>
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
      depth: 1, // Depth 1 needed to get Image object
      pagination: false,
      overrideAccess: true,
    })

    posts.docs.forEach((post: any) => {
      // FIX 1: Update URL structure to match your Webflow pattern
      // Old: /blog/slug
      // New: /blogpage?slug=slug
      const postUrl = `${frontendBaseUrl}/blogpage?slug=${post.slug}`
      
      // FIX 2: Add Image & Title Data
      // We use the Google Image Sitemap extension to include the title and featured image
      let imageXml = ''
      
      if (post.featuredImage && typeof post.featuredImage === 'object') {
         // Construct absolute image URL
         // Note: If using S3 with direct public URLs, post.featuredImage.url might already be full path. 
         // If relative, we prepend mediaBaseUrl.
         const imgUrl = post.featuredImage.url.startsWith('http') 
            ? post.featuredImage.url 
            : `${mediaBaseUrl}${post.featuredImage.url}`

         // Escape special characters in title for XML safety
         const safeTitle = (post.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

         imageXml = `
    <image:image>
      <image:loc>${imgUrl}</image:loc>
      <image:title>${safeTitle}</image:title>
    </image:image>`
      }

      sitemapItems.push(`
  <url>
    <loc>${postUrl}</loc>
    <lastmod>${new Date(post.updatedAt).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${imageXml}
  </url>`)
    })
  }

  // FIX 3: Add xmlns:image namespace to header
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
