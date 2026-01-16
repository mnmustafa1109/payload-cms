import type { CollectionConfig } from 'payload'

import { isSuperAdmin } from '@/access/isSuperAdmin'
import { updateAndDeleteAccess } from './access/updateAndDelete'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  access: {
    create: isSuperAdmin,
    delete: isSuperAdmin,
    read: ({ req }) => Boolean(req.user), // Allow any authenticated user to read tenants
    update: isSuperAdmin,
  },
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'domain',
      type: 'text',
      admin: {
        description: 'Used for domain-based tenant handling',
      },
    },
    {
      name: 'slug',
      type: 'text',
      admin: {
        description: 'Used for url paths, example: /tenant-slug/page-slug',
      },
      index: true,
      required: true,
    },
    {
      name: 'enabledCollections',
      type: 'select',
      hasMany: true,
      options: [
        {
          label: 'Media',
          value: 'media',
        },
        {
          label: 'Pages',
          value: 'pages',
        },
        {
          label: 'Posts',
          value: 'posts',
        },
        {
          label: 'Categories',
          value: 'categories',
        },
        {
          label: 'Media with Prefix',
          value: 'media-with-prefix',
        },
        {
          label: 'Media with Signed Downloads',
          value: 'media-with-signed-downloads',
        },
      ],
    },
    {
      name: 'allowPublicRead',
      type: 'checkbox',
      admin: {
        description:
          'If checked, logging in is not required to read. Useful for building public pages.',
        position: 'sidebar',
      },
      defaultValue: false,
      index: true,
    },
  ],
}
