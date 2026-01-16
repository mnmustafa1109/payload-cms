import type { CollectionConfig } from 'payload'

import { ensureUniqueSlug } from './hooks/ensureUniqueSlug'
import { isSuperAdmin } from '@/access/isSuperAdmin'
import { checkCollectionEnabled } from '@/access/checkCollectionEnabled'

export const Pages: CollectionConfig = {
  slug: 'pages',
  access: {
    create: isSuperAdmin,
    delete: isSuperAdmin,
    read: async ({ req }) => {
      if (!req.user) return false
      return checkCollectionEnabled({ req, slug: 'pages' })
    },
    update: isSuperAdmin,
  },
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
    },
    {
      name: 'slug',
      type: 'text',
      defaultValue: 'home',
      hooks: {
        beforeValidate: [ensureUniqueSlug],
      },
      index: true,
    },
  ],
}
