import type { CollectionConfig } from 'payload'
import { checkCollectionEnabled } from '@/access/checkCollectionEnabled'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    read: async ({ req }) => {
      if (!req.user) return false
      return checkCollectionEnabled({ req, slug: 'categories' })
    },
  },
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
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
      name: 'description',
      type: 'textarea',
    },
  ],
}