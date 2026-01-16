import type { CollectionConfig } from 'payload'
import { checkCollectionEnabled } from '@/access/checkCollectionEnabled'

export const MediaWithPrefix: CollectionConfig = {
  slug: 'media-with-prefix',
  access: {
    read: async ({ req }) => {
      if (!req.user) return true
      return checkCollectionEnabled({ req, slug: 'media-with-prefix' })
    },
  },
  upload: {
    disableLocalStorage: true,
  },
  fields: [],
}
