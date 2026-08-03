import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
  Where,
} from 'payload'
import { checkCollectionEnabled } from '@/access/checkCollectionEnabled'
import { getTenantFromCookie } from '@payloadcms/plugin-multi-tenant/utilities'
import { getCollectionIDType } from '@/utilities/getCollectionIDType'

import { 
  lexicalEditor, 
  lexicalHTML, 
  HTMLConverterFeature 
} from '@payloadcms/richtext-lexical'

const triggerTenantDeployHook: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  // Trigger if post is currently published, was previously published (e.g. unpublished), or newly created
  const isPublished = doc.status === 'published'
  const wasPublished = previousDoc?.status === 'published'

  if (!isPublished && !wasPublished && operation !== 'create') {
    return doc
  }

  // Extract tenant ID
  const tenantId = typeof doc.tenant === 'object' ? doc.tenant?.id : doc.tenant
  if (!tenantId) return doc

  try {
    // Retrieve tenant's deployHookUrl
    let deployHookUrl =
      typeof doc.tenant === 'object' && doc.tenant !== null
        ? (doc.tenant as { deployHookUrl?: string }).deployHookUrl
        : undefined

    if (!deployHookUrl) {
      const tenant = await req.payload.findByID({
        collection: 'tenants',
        id: tenantId,
      })
      deployHookUrl = (tenant as { deployHookUrl?: string })?.deployHookUrl
    }

    // Trigger deploy hook asynchronously if present
    if (deployHookUrl) {
      let eventType = 'post.updated'
      if (operation === 'create') eventType = 'post.created'
      else if (!isPublished && wasPublished) eventType = 'post.unpublished'
      else if (isPublished && !wasPublished) eventType = 'post.published'

      req.payload.logger.info(
        `Triggering deploy hook (${eventType}) for tenant ${tenantId} on post: "${doc.title}"`,
      )

      void fetch(deployHookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: eventType,
          tenant: tenantId,
          post: {
            id: doc.id,
            slug: doc.slug,
            title: doc.title,
            status: doc.status,
          },
        }),
      }).catch((err) => {
        req.payload.logger.error(
          `Failed to trigger deploy hook for tenant ${tenantId}: ${err}`,
        )
      })
    }
  } catch (error) {
    req.payload.logger.error(`Error in post deploy hook: ${error}`)
  }

  return doc
}

const triggerTenantDeployHookOnDelete: CollectionAfterDeleteHook = async ({
  doc,
  req,
}) => {
  const tenantId = typeof doc.tenant === 'object' ? doc.tenant?.id : doc.tenant
  if (!tenantId) return doc

  try {
    let deployHookUrl =
      typeof doc.tenant === 'object' && doc.tenant !== null
        ? (doc.tenant as { deployHookUrl?: string }).deployHookUrl
        : undefined

    if (!deployHookUrl) {
      const tenant = await req.payload.findByID({
        collection: 'tenants',
        id: tenantId,
      })
      deployHookUrl = (tenant as { deployHookUrl?: string })?.deployHookUrl
    }

    if (deployHookUrl) {
      req.payload.logger.info(
        `Triggering deploy hook (post.deleted) for tenant ${tenantId} on post: "${doc.title}"`,
      )

      void fetch(deployHookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'post.deleted',
          tenant: tenantId,
          post: {
            id: doc.id,
            slug: doc.slug,
            title: doc.title,
          },
        }),
      }).catch((err) => {
        req.payload.logger.error(
          `Failed to trigger deploy hook on delete for tenant ${tenantId}: ${err}`,
        )
      })
    }
  } catch (error) {
    req.payload.logger.error(`Error in post delete deploy hook: ${error}`)
  }

  return doc
}

export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    create: async ({ req }) => {
      const isEnabled = await checkCollectionEnabled({ req, slug: 'posts' })
      if (!isEnabled) return false

      // Super admins can create posts without restriction
      if (req.user && req.user.roles?.includes('super-admin')) {
        return true
      }

      // For other users, we'll add the tenant automatically in beforeChange hook
      return true
    },
    read: async ({ req }) => {
      if (req.user) {
        const isEnabled = await checkCollectionEnabled({ req, slug: 'posts' })
        if (!isEnabled) return false
      }

      // Super admins can read all posts
      if (req.user && req.user.roles?.includes('super-admin')) {
        return true
      }

      // Base condition: Published posts are accessible to EVERYONE (Global Public Access)
      const conditions: Where[] = [
        {
          status: {
            equals: 'published',
          },
        },
      ]

      // If user is authenticated and has tenants, allow access to their tenant's posts (including Drafts/Archived)
      if (req.user) {
        const userTenantIds = req.user.tenants
          ?.map((t) => (typeof t.tenant === 'object' ? t.tenant.id : t.tenant))
          .filter((id) => id)

        if (userTenantIds && userTenantIds.length > 0) {
          conditions.push({
            tenant: {
              in: userTenantIds,
            },
          })
        }
      }

      // Combine with OR:
      // 1. Post is Published (Anyone)
      // OR
      // 2. Post belongs to User's Tenant (Authenticated)
      return {
        or: conditions,
      } as Where
    },
  },
  hooks: {
    beforeChange: [
      ({ req, data, operation }) => {
        // If the user is not a super admin and creating or updating a post
        if (req.user && !req.user.roles?.includes('super-admin')) {
          // Get the first tenant of the user (if any)
          const userTenant = req.user.tenants?.[0]?.tenant;

          // If user has a tenant, assign it to the post
          if (userTenant) {
            // Normalize tenant ID whether it's an object or ID
            const tenantId = typeof userTenant === 'object' ? userTenant.id : userTenant;
            return {
              ...data,
              tenant: tenantId
            };
          }
        }
        return data;
      }
    ],
    afterChange: [triggerTenantDeployHook],
    afterDelete: [triggerTenantDeployHookOnDelete],
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'category', 'publishedDate', 'status'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Used in URLs and API routes',
      },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
    },
    {
      name: 'publishedDate',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
      required: true,
    },
    {
      name: 'excerpt',
      type: 'textarea',
      required: true,
      localized: true,
    },
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
          // Now this will work because it is imported above
          HTMLConverterFeature({}),
        ],
      }),
      required: true,
      localized: true,
    },
    lexicalHTML('content', { name: 'contentHtml' }),
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        {
          label: 'Draft',
          value: 'draft',
        },
        {
          label: 'Published',
          value: 'published',
        },
        {
          label: 'Archived',
          value: 'archived',
        },
      ],
      defaultValue: 'draft',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'metaTitle',
      type: 'text',
      localized: true,
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'tags',
      type: 'text',
      hasMany: true,
      admin: {
        description: 'Enter tags for SEO and categorization',
      },
    },
    {
      name: 'readingTime',
      type: 'number',
      admin: {
        description: 'Estimated reading time in minutes',
      },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      defaultValue: ({ user }) => {
        // Auto-select the user's first tenant if they have one and are not a super admin
        if (user && !user.roles?.includes('super-admin')) {
          const firstTenant = user.tenants?.[0]?.tenant;
          if (firstTenant) {
            return typeof firstTenant === 'object' ? firstTenant.id : firstTenant;
          }
        }
        // Super admins or users without tenants will have no default
        return undefined;
      },
      admin: {
        description: 'Associate this post with a specific tenant',
      },
    },
  ],
}
