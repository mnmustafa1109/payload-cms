import { PayloadRequest } from 'payload'
import { isSuperAdminFunction } from './isSuperAdmin'
import { getUserTenantIDs } from '@/utilities/getUserTenantIDs'

export const checkCollectionEnabled = async ({
  req,
  slug,
}: {
  req: PayloadRequest
  slug: string
}): Promise<boolean> => {
  if (isSuperAdminFunction(req.user)) {
    return true
  }

  if (!req.user) {
    return false
  }

  const tenantIDs = getUserTenantIDs(req.user)

  if (tenantIDs.length === 0) {
    return false
  }

  const tenantsWithCollection = await req.payload.find({
    collection: 'tenants',
    where: {
      id: {
        in: tenantIDs,
      },
      enabledCollections: {
        equals: slug,
      },
    },
    depth: 0,
  })

  return tenantsWithCollection.totalDocs > 0
}
