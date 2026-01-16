import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tenants_enabled_collections" AS ENUM('media', 'pages', 'posts', 'categories');
  CREATE TABLE "tenants_enabled_collections" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_tenants_enabled_collections",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "tenants_enabled_collections" ADD CONSTRAINT "tenants_enabled_collections_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "tenants_enabled_collections_order_idx" ON "tenants_enabled_collections" USING btree ("order");
  CREATE INDEX "tenants_enabled_collections_parent_idx" ON "tenants_enabled_collections" USING btree ("parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "tenants_enabled_collections" CASCADE;
  DROP TYPE "public"."enum_tenants_enabled_collections";`)
}
