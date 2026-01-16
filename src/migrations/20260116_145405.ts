import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_tenants_enabled_collections" ADD VALUE 'media-with-prefix';
  ALTER TYPE "public"."enum_tenants_enabled_collections" ADD VALUE 'media-with-signed-downloads';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants_enabled_collections" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_tenants_enabled_collections";
  CREATE TYPE "public"."enum_tenants_enabled_collections" AS ENUM('media', 'pages', 'posts', 'categories');
  ALTER TABLE "tenants_enabled_collections" ALTER COLUMN "value" SET DATA TYPE "public"."enum_tenants_enabled_collections" USING "value"::"public"."enum_tenants_enabled_collections";`)
}
