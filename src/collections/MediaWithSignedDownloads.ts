import type { CollectionConfig } from 'payload'
import { checkCollectionEnabled } from '@/access/checkCollectionEnabled'

import { mediaWithSignedDownloadsSlug } from '../shared.js'

export const MediaWithSignedDownloads: CollectionConfig = {
  slug: mediaWithSignedDownloadsSlug,
  access: {
    read: async ({ req }) => {
      if (!req.user) return true
      return checkCollectionEnabled({ req, slug: mediaWithSignedDownloadsSlug })
    },
  },
  upload: true,
  fields: [],
}
