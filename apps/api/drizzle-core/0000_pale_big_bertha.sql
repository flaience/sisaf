CREATE SCHEMA "sisaf_core";
--> statement-breakpoint
CREATE TYPE "sisaf_core"."person_type" AS ENUM('individual', 'organization');--> statement-breakpoint
CREATE TYPE "sisaf_core"."unit_type" AS ENUM('none', 'headquarters', 'branch');--> statement-breakpoint
CREATE TABLE "sisaf_core"."addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"type" varchar(30) NOT NULL,
	"street" varchar(255) NOT NULL,
	"number" varchar(20),
	"complement" varchar(150),
	"district" varchar(150),
	"city" varchar(150) NOT NULL,
	"state" varchar(100),
	"postal_code" varchar(20),
	"country_code" varchar(2) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sisaf_core"."people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" bigint NOT NULL,
	"unit_type" "sisaf_core"."unit_type" DEFAULT 'none' NOT NULL,
	"parent_person_id" uuid,
	"parent_unit_type" "sisaf_core"."unit_type",
	"type" "sisaf_core"."person_type" NOT NULL,
	"name" varchar(250) NOT NULL,
	"tax_id" varchar(14),
	"nickname" varchar(255),
	"phone" varchar(30),
	"email" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "people_parent_lookup_uq" UNIQUE("tenant_id","id","unit_type"),
	CONSTRAINT "people_unit_consistency_chk" CHECK (
    (
      unit_type = 'branch'
      AND parent_person_id IS NOT NULL
      AND type = 'organization'
    )
    OR
    (
      unit_type IN ('none', 'headquarters')
      AND parent_person_id IS NULL
      AND (
        unit_type = 'none'
        OR type = 'organization'
      )
    )
  ),
	CONSTRAINT "people_no_self_parent_chk" CHECK (
    parent_person_id IS NULL OR parent_person_id <> id
  ),
	CONSTRAINT "people_parent_type_chk" CHECK (
    (
      "sisaf_core"."people"."parent_person_id" IS NULL
      AND "sisaf_core"."people"."parent_unit_type" IS NULL
    )
    OR
    (
      "sisaf_core"."people"."parent_person_id" IS NOT NULL
      AND "sisaf_core"."people"."parent_unit_type" IS NOT NULL
      AND "sisaf_core"."people"."parent_unit_type" = 'headquarters'
    )
  )
);
--> statement-breakpoint
CREATE TABLE "sisaf_core"."person_code_counters" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"last_code" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "person_code_counters_nonnegative_chk" CHECK ("sisaf_core"."person_code_counters"."last_code" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sisaf_core"."person_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sisaf_core"."tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sisaf_core"."addresses" ADD CONSTRAINT "addresses_person_same_tenant_fk" FOREIGN KEY ("tenant_id","person_id") REFERENCES "sisaf_core"."people"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sisaf_core"."people" ADD CONSTRAINT "people_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "sisaf_core"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sisaf_core"."people" ADD CONSTRAINT "people_parent_same_tenant_fk" FOREIGN KEY ("tenant_id","parent_person_id","parent_unit_type") REFERENCES "sisaf_core"."people"("tenant_id","id","unit_type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sisaf_core"."person_code_counters" ADD CONSTRAINT "person_code_counters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "sisaf_core"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sisaf_core"."person_roles" ADD CONSTRAINT "person_roles_person_same_tenant_fk" FOREIGN KEY ("tenant_id","person_id") REFERENCES "sisaf_core"."people"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_person_idx" ON "sisaf_core"."addresses" USING btree ("tenant_id","person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "addresses_one_primary_uq" ON "sisaf_core"."addresses" USING btree ("tenant_id","person_id") WHERE "sisaf_core"."addresses"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "people_tenant_idx" ON "sisaf_core"."people" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "people_parent_idx" ON "sisaf_core"."people" USING btree ("tenant_id","parent_person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "people_tenant_code_uq" ON "sisaf_core"."people" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "people_tenant_tax_id_uq" ON "sisaf_core"."people" USING btree ("tenant_id","tax_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_roles_unique_uq" ON "sisaf_core"."person_roles" USING btree ("tenant_id","person_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_uq" ON "sisaf_core"."tenants" USING btree ("slug");