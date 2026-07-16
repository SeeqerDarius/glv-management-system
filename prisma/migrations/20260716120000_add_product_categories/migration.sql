CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductCategory_name_key" ON "ProductCategory"("name");

INSERT INTO "ProductCategory" ("id", "name", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('cat_refrigerators', 'Refrigerators', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_air_conditioners', 'Air Conditioners', 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_tvs', 'TVs', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_phones', 'Phones', 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_kitchenware', 'Kitchenware', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_washing_machines', 'Washing Machines', 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_home_appliances', 'Home Appliances', 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_home_accessories', 'Home Accessories', 80, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_furniture', 'Furniture', 90, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_salon_equipment', 'Salon Equipment', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_sewing_machines', 'Sewing Machines', 110, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_electronics', 'Electronics', 120, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_combos', 'Combos', 130, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_other', 'Other', 999, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "ProductCategory" ("id", "name", "sortOrder", "createdAt", "updatedAt")
SELECT
  'cat_existing_' || md5("category"),
  "category",
  500,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "category" FROM "Product" WHERE "category" IS NOT NULL AND "category" <> '') existing_categories
ON CONFLICT ("name") DO NOTHING;
