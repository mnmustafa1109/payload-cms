import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
     ALTER TYPE "public"."enum_tenants_enabled_collections" ADD VALUE IF NOT EXISTS 'events';
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;

   DO $$ BEGIN
     CREATE TYPE "public"."enum_events_status" AS ENUM('draft', 'published', 'archived');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;

   CREATE TABLE IF NOT EXISTS "events" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"title" varchar NOT NULL,
   	"slug" varchar NOT NULL,
   	"start_date" timestamp(3) with time zone NOT NULL,
   	"end_date" timestamp(3) with time zone,
   	"excerpt" varchar,
   	"content" jsonb,
   	"content_html" varchar,
   	"featured_image_id" integer,
   	"website" varchar,
   	"phone" varchar,
   	"venue_name" varchar,
   	"venue_address" varchar,
   	"venue_city" varchar,
   	"venue_state" varchar,
   	"venue_zip" varchar,
   	"venue_country" varchar,
   	"author_id" integer,
   	"status" "enum_events_status" DEFAULT 'draft' NOT NULL,
   	"meta_title" varchar,
   	"meta_description" varchar,
   	"tenant_id" integer,
   	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
   	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );

   CREATE TABLE IF NOT EXISTS "events_texts" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"order" integer NOT NULL,
   	"parent_id" integer NOT NULL,
   	"path" varchar NOT NULL,
   	"text" varchar
   );

   CREATE TABLE IF NOT EXISTS "events_rels" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"order" integer,
   	"parent_id" integer NOT NULL,
   	"path" varchar NOT NULL,
   	"categories_id" integer,
   	"users_id" integer
   );

   ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "events_id" integer;

   DO $$ BEGIN
     ALTER TABLE "events" ADD CONSTRAINT "events_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;

   DO $$ BEGIN
     ALTER TABLE "events" ADD CONSTRAINT "events_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;

   DO $$ BEGIN
     ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;

   DO $$ BEGIN
     ALTER TABLE "events_texts" ADD CONSTRAINT "events_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;

   DO $$ BEGIN
     ALTER TABLE "events_rels" ADD CONSTRAINT "events_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;

   DO $$ BEGIN
     ALTER TABLE "events_rels" ADD CONSTRAINT "events_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;

   DO $$ BEGIN
     ALTER TABLE "events_rels" ADD CONSTRAINT "events_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;

   DO $$ BEGIN
     ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;

   CREATE UNIQUE INDEX IF NOT EXISTS "events_slug_idx" ON "events" USING btree ("slug");
   CREATE INDEX IF NOT EXISTS "events_start_date_idx" ON "events" USING btree ("start_date");
   CREATE INDEX IF NOT EXISTS "events_end_date_idx" ON "events" USING btree ("end_date");
   CREATE INDEX IF NOT EXISTS "events_featured_image_idx" ON "events" USING btree ("featured_image_id");
   CREATE INDEX IF NOT EXISTS "events_author_idx" ON "events" USING btree ("author_id");
   CREATE INDEX IF NOT EXISTS "events_tenant_idx" ON "events" USING btree ("tenant_id");
   CREATE INDEX IF NOT EXISTS "events_updated_at_idx" ON "events" USING btree ("updated_at");
   CREATE INDEX IF NOT EXISTS "events_created_at_idx" ON "events" USING btree ("created_at");
   CREATE INDEX IF NOT EXISTS "events_texts_order_parent" ON "events_texts" USING btree ("order","parent_id");
   CREATE INDEX IF NOT EXISTS "events_rels_order_idx" ON "events_rels" USING btree ("order");
   CREATE INDEX IF NOT EXISTS "events_rels_parent_idx" ON "events_rels" USING btree ("parent_id");
   CREATE INDEX IF NOT EXISTS "events_rels_path_idx" ON "events_rels" USING btree ("path");
   CREATE INDEX IF NOT EXISTS "events_rels_categories_id_idx" ON "events_rels" USING btree ("categories_id");
   CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE IF EXISTS "events_texts" CASCADE;
   DROP TABLE IF EXISTS "events_rels" CASCADE;
   DROP TABLE IF EXISTS "events" CASCADE;
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_events_fk";
   DROP INDEX IF EXISTS "payload_locked_documents_rels_events_id_idx";
   ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "events_id";
   DROP TYPE IF EXISTS "public"."enum_events_status";
  `)
}
