import type { CollectionConfig } from 'payload'
import { checkCollectionEnabled } from '@/access/checkCollectionEnabled'
// 1. IMPORT ADDED HERE

import { 
  lexicalEditor, 
  lexicalHTML, 
  HTMLConverterFeature 
} from '@payloadcms/richtext-lexical'

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
      const isEnabled = await checkCollectionEnabled({ req, slug: 'posts' })
      if (!isEnabled) return false

      // Super admins can read all posts
      if (req.user && req.user.roles?.includes('super-admin')) {
        return true
      }

      // For authenticated users who are not super admins, apply tenant filtering
      if (req.user) {
        // If the user belongs to specific tenants, only show posts from those tenants
        const userTenantIds = req.user.tenants
          ?.map((t) => (typeof t.tenant === 'object' ? t.tenant.id : t.tenant))
          .filter((id) => id)

        if (userTenantIds && userTenantIds.length > 0) {
          // Show posts from the user's tenants
          return {
            tenant: {
              in: userTenantIds,
            },
          }
        } else {
          // If user has no tenant associations, show no posts
          return false
        }
      } else {
        // For unauthenticated users, deny access
        return false
      }
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
    ]
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
