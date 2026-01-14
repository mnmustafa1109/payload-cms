import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" ADD COLUMN "tenant_id" integer;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "posts_tenant_idx" ON "posts" USING btree ("tenant_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" DROP CONSTRAINT "posts_tenant_id_tenants_id_fk";
  
  DROP INDEX "posts_tenant_idx";
  ALTER TABLE "posts" DROP COLUMN "tenant_id";`)
}
