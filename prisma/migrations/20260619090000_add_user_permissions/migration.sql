CREATE TYPE "UserPermission" AS ENUM (
  'MANAGE_CUSTOMERS',
  'MANAGE_ACCOUNTS',
  'MANAGE_PAYMENTS',
  'VIEW_REPORTS',
  'MANAGE_PRODUCTS',
  'MANAGE_STAFF',
  'VIEW_AUDIT_LOGS'
);

ALTER TABLE "User"
ADD COLUMN "permissions" "UserPermission"[] NOT NULL DEFAULT ARRAY[]::"UserPermission"[];

UPDATE "User"
SET "role" = 'SUPER_ADMIN'
WHERE "email" = 'admin@glv.com';
