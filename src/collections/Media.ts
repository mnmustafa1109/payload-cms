import type { CollectionConfig } from 'payload'
import { checkCollectionEnabled } from '@/access/checkCollectionEnabled'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: async ({ req }) => {
      if (!req.user) return true
      return checkCollectionEnabled({ req, slug: 'media' })
    },
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: true,
}
