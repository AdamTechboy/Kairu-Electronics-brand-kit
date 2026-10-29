ALTER TABLE "BrandSettings"
  ADD COLUMN "logoApplyToSite" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "logoApplyToNewDesigns" BOOLEAN NOT NULL DEFAULT true;
