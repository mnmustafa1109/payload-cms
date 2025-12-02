// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { migrations } from './migrations'
import sharp from 'sharp'
import { s3Storage } from '@payloadcms/storage-s3'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'

import { Media } from './collections/Media'
import { MediaWithPrefix } from './collections/MediaWithPrefix'
import { MediaWithSignedDownloads } from './collections/MediaWithSignedDownloads'

import { Pages } from './collections/Pages'
import { Tenants } from './collections/Tenants'
import Users from './collections/Users'

import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { isSuperAdmin } from './access/isSuperAdmin'
import type { Config } from './payload-types'
import { getUserTenantIDs } from './utilities/getUserTenantIDs'

import { mediaSlug, mediaWithPrefixSlug, mediaWithSignedDownloadsSlug, prefix } from './shared.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const bucket = process.env.S3_BUCKET;
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const region = process.env.S3_REGION;
const endpoint = process.env.S3_ENDPOINT;

if (!bucket || !accessKeyId || !secretAccessKey || !region) {
  throw new Error("Missing required S3 environment variables.");
}

const smtpHost = process.env.SMTP_HOST;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

if (!smtpHost || !smtpUser || !smtpPass) {
  throw new Error("Missing required SMTP/Email environment variables. Please check your .env or docker-compose file.");
}


export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Media, MediaWithPrefix, MediaWithSignedDownloads, Pages, Users, Tenants],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    prodMigrations: migrations,
  }),
  graphQL: {
    schemaOutputFile: path.resolve(dirname, 'generated-schema.graphql'),
  },
  sharp,
  plugins: [
    s3Storage({
      collections: {
        [mediaSlug]: true,
        [mediaWithPrefixSlug]: {
          prefix,
        },
        [mediaWithSignedDownloadsSlug]: {
          signedDownloads: {
            shouldUseSignedURL: (args) => {
              return args.req.headers.get('X-Disable-Signed-URL') !== 'true'
            },
          },
        },
      },
      bucket,
      config: {
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        region,
	forcePathStyle: true,
        endpoint,
      },
    }),
    multiTenantPlugin<Config>({
      collections: {
        pages: {},
      },
      tenantField: {
        access: {
          read: () => true,
          update: ({ req }) => {
            if (isSuperAdmin(req.user)) {
              return true
            }
            return getUserTenantIDs(req.user).length > 0
          },
        },
      },
      tenantsArrayField: {
        includeDefaultField: false,
      },
      userHasAccessToAllTenants: (user) => isSuperAdmin(user),
    }),
  ],
  email: nodemailerAdapter({
    defaultFromAddress: 'contact@lyoko.studio',
    defaultFromName: 'Lyoko Studio Payload',
    
    // Nodemailer transportOptions
    transportOptions: {
      // Use the validated variables here
      host: smtpHost,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      port: 587,
      secure: false, // true for 465, false for other ports
      requireTLS: true, // forces STARTTLS on port 587
    },
  }),
})
