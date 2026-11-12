CREATE TABLE "sisaf_core"."identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issuer" varchar(500) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"actor_type" varchar(20) DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identities_actor_type_chk" CHECK ("sisaf_core"."identities"."actor_type" IN ('user', 'service'))
);
--> statement-breakpoint
CREATE TABLE "sisaf_core"."membership_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"permission" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sisaf_core"."membership_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"unit_type" "sisaf_core"."unit_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_units_type_chk" CHECK ("sisaf_core"."membership_units"."unit_type" IN ('headquarters', 'branch'))
);
--> statement-breakpoint
CREATE TABLE "sisaf_core"."tenant_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"identity_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_memberships_id_tenant_uq" UNIQUE("id","tenant_id")
);
--> statement-breakpoint
ALTER TABLE "sisaf_core"."membership_permissions" ADD CONSTRAINT "membership_permissions_same_tenant_fk" FOREIGN KEY ("membership_id","tenant_id") REFERENCES "sisaf_core"."tenant_memberships"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sisaf_core"."membership_units" ADD CONSTRAINT "membership_units_membership_same_tenant_fk" FOREIGN KEY ("membership_id","tenant_id") REFERENCES "sisaf_core"."tenant_memberships"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sisaf_core"."membership_units" ADD CONSTRAINT "membership_units_person_same_tenant_fk" FOREIGN KEY ("tenant_id","person_id","unit_type") REFERENCES "sisaf_core"."people"("tenant_id","id","unit_type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sisaf_core"."tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "sisaf_core"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sisaf_core"."tenant_memberships" ADD CONSTRAINT "tenant_memberships_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "sisaf_core"."identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "identities_issuer_subject_uq" ON "sisaf_core"."identities" USING btree ("issuer","subject");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_permissions_unique_uq" ON "sisaf_core"."membership_permissions" USING btree ("tenant_id","membership_id","permission");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_units_unique_uq" ON "sisaf_core"."membership_units" USING btree ("tenant_id","membership_id","person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_memberships_identity_tenant_uq" ON "sisaf_core"."tenant_memberships" USING btree ("identity_id","tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_memberships_tenant_idx" ON "sisaf_core"."tenant_memberships" USING btree ("tenant_id");