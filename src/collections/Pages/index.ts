import type { CollectionConfig } from 'payload'

import { ensureUniqueSlug } from './hooks/ensureUniqueSlug'
import { isSuperAdmin } from '@/access/isSuperAdmin'

export const Pages: CollectionConfig = {
  slug: 'pages',
  access: {
    create: isSuperAdmin,
    delete: isSuperAdmin,
    read: isSuperAdmin,
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
