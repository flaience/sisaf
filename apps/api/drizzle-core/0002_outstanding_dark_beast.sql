CREATE TABLE "sisaf_core"."person_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"unit_type" "sisaf_core"."unit_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_units_type_chk" CHECK (
      "sisaf_core"."person_units"."unit_type" IN ('headquarters', 'branch')
    )
);
--> statement-breakpoint
ALTER TABLE "sisaf_core"."people" ADD COLUMN "responsible_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "sisaf_core"."people" ADD COLUMN "responsible_unit_type" "sisaf_core"."unit_type";--> statement-breakpoint
ALTER TABLE "sisaf_core"."person_units" ADD CONSTRAINT "person_units_person_same_tenant_fk" FOREIGN KEY ("tenant_id","person_id") REFERENCES "sisaf_core"."people"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sisaf_core"."person_units" ADD CONSTRAINT "person_units_unit_same_tenant_fk" FOREIGN KEY ("tenant_id","unit_id","unit_type") REFERENCES "sisaf_core"."people"("tenant_id","id","unit_type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "person_units_unique_uq" ON "sisaf_core"."person_units" USING btree ("tenant_id","person_id","unit_id");--> statement-breakpoint
CREATE INDEX "person_units_unit_idx" ON "sisaf_core"."person_units" USING btree ("tenant_id","unit_id");--> statement-breakpoint
ALTER TABLE "sisaf_core"."people" ADD CONSTRAINT "people_responsible_unit_same_tenant_fk" FOREIGN KEY ("tenant_id","responsible_unit_id","responsible_unit_type") REFERENCES "sisaf_core"."people"("tenant_id","id","unit_type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sisaf_core"."people" ADD CONSTRAINT "people_responsible_unit_pair_chk" CHECK (
    (
      "sisaf_core"."people"."responsible_unit_id" IS NULL
      AND "sisaf_core"."people"."responsible_unit_type" IS NULL
    )
    OR
    (
      "sisaf_core"."people"."responsible_unit_id" IS NOT NULL
      AND "sisaf_core"."people"."responsible_unit_type" IS NOT NULL
      AND "sisaf_core"."people"."responsible_unit_type"
        IN ('headquarters', 'branch')
    )
  );