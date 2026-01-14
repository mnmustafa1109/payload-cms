import type { Access } from 'payload'
import { User } from '../payload-types'

export const isSuperAdmin: Access = ({ req }): boolean => {
  return Boolean(req.user?.roles?.includes('super-admin'))
}

export const isSuperAdminFunction = (user: User | null): boolean => {
  return Boolean(user?.roles?.includes('super-admin'))
}
