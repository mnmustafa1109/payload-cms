import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
  Where,
} from 'payload'
import { checkCollectionEnabled } from '@/access/checkCollectionEnabled'

import {
  lexicalEditor,
  lexicalHTML,
  HTMLConverterFeature,
} from '@payloadcms/richtext-lexical'

const triggerTenantDeployHook: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  // Trigger if event is currently published, was previously published (e.g. unpublished), or newly created
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
      let eventType = 'event.updated'
      if (operation === 'create') eventType = 'event.created'
      else if (!isPublished && wasPublished) eventType = 'event.unpublished'
      else if (isPublished && !wasPublished) eventType = 'event.published'

      req.payload.logger.info(
        `Triggering deploy hook (${eventType}) for tenant ${tenantId} on event: "${doc.title}"`,
      )

      void fetch(deployHookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: eventType,
          collection: 'events',
          tenant: tenantId,
          eventItem: {
            id: doc.id,
            slug: doc.slug,
            title: doc.title,
            status: doc.status,
            startDate: doc.startDate,
            endDate: doc.endDate,
          },
        }),
      }).catch((err) => {
        req.payload.logger.error(
          `Failed to trigger deploy hook for tenant ${tenantId}: ${err}`,
        )
      })
    }
  } catch (error) {
    req.payload.logger.error(`Error in event deploy hook: ${error}`)
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
        `Triggering deploy hook (event.deleted) for tenant ${tenantId} on event: "${doc.title}"`,
      )

      void fetch(deployHookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'event.deleted',
          collection: 'events',
          tenant: tenantId,
          eventItem: {
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
    req.payload.logger.error(`Error in event delete deploy hook: ${error}`)
  }

  return doc
}

export const Events: CollectionConfig = {
  slug: 'events',
  access: {
    create: async ({ req }) => {
      const isEnabled = await checkCollectionEnabled({ req, slug: 'events' })
      if (!isEnabled) return false

      // Super admins can create events without restriction
      if (req.user && req.user.roles?.includes('super-admin')) {
        return true
      }

      // For other users, tenant is automatically assigned in beforeChange hook
      return true
    },
    read: async ({ req }) => {
      if (req.user) {
        const isEnabled = await checkCollectionEnabled({ req, slug: 'events' })
        if (!isEnabled) return false
      }

      // Super admins can read all events
      if (req.user && req.user.roles?.includes('super-admin')) {
        return true
      }

      // Base condition: Published events are accessible to EVERYONE (Global Public Access for SSG)
      const conditions: Where[] = [
        {
          status: {
            equals: 'published',
          },
        },
      ]

      // If user is authenticated and has tenants, allow access to their tenant's events (including Drafts/Archived)
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
      // 1. Event is Published (Public / SSG)
      // OR
      // 2. Event belongs to User's Tenant (Authenticated)
      return {
        or: conditions,
      } as Where
    },
  },
  hooks: {
    beforeChange: [
      ({ req, data }) => {
        // If the user is not a super admin and creating or updating an event
        if (req.user && !req.user.roles?.includes('super-admin')) {
          const userTenant = req.user.tenants?.[0]?.tenant
          if (userTenant) {
            const tenantId =
              typeof userTenant === 'object' ? userTenant.id : userTenant
            return {
              ...data,
              tenant: tenantId,
            }
          }
        }
        return data
      },
    ],
    afterChange: [triggerTenantDeployHook],
    afterDelete: [triggerTenantDeployHookOnDelete],
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'startDate', 'endDate', 'status'],
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
      name: 'startDate',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'Event start date and time',
      },
    },
    {
      name: 'endDate',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'Event end date and time',
      },
    },
    {
      name: 'category',
      label: 'Event Category',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: {
        description: 'Select event categories (e.g. Conventions)',
      },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      localized: true,
      admin: {
        description: 'Short summary or teaser for the event',
      },
    },
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
          HTMLConverterFeature({}),
        ],
      }),
      localized: true,
      admin: {
        description: 'Full event description and information',
      },
    },
    lexicalHTML('content', { name: 'contentHtml' }),
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'website',
      type: 'text',
      admin: {
        description: 'Official event website URL (e.g. https://www.deliver.events/america)',
      },
    },
    {
      name: 'phone',
      type: 'text',
      admin: {
        description: 'Contact phone number (e.g. 877-603-4390)',
      },
    },
    {
      name: 'venue',
      type: 'group',
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Venue Name',
          admin: {
            description: 'e.g. The Horseshoe Hotel',
          },
        },
        {
          name: 'address',
          type: 'text',
          label: 'Street Address',
          admin: {
            description: 'e.g. 3645 Las Vegas Blvd S',
          },
        },
        {
          name: 'city',
          type: 'text',
          label: 'City',
          admin: {
            description: 'e.g. Las Vegas',
          },
        },
        {
          name: 'state',
          type: 'text',
          label: 'State / Province',
          admin: {
            description: 'e.g. NV',
          },
        },
        {
          name: 'zip',
          type: 'text',
          label: 'Postal / Zip Code',
          admin: {
            description: 'e.g. 89109',
          },
        },
        {
          name: 'country',
          type: 'text',
          label: 'Country',
          admin: {
            description: 'e.g. United States',
          },
        },
      ],
    },
    {
      name: 'author',
      label: 'Organizer / Author',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      defaultValue: ({ user }) => user?.id,
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
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      defaultValue: ({ user }) => {
        if (user && !user.roles?.includes('super-admin')) {
          const firstTenant = user.tenants?.[0]?.tenant
          if (firstTenant) {
            return typeof firstTenant === 'object' ? firstTenant.id : firstTenant
          }
        }
        return undefined
      },
      admin: {
        description: 'Associate this event with a specific tenant',
      },
    },
  ],
}
