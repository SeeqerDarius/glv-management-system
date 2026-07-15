UPDATE "User"
SET "permissions" = array_append(
  array_remove("permissions", 'MANAGE_STAFF'::"UserPermission"),
  'VIEW_STAFF'::"UserPermission"
)
WHERE
  'MANAGE_STAFF'::"UserPermission" = ANY("permissions")
  AND NOT 'VIEW_STAFF'::"UserPermission" = ANY("permissions");

UPDATE "User"
SET "permissions" = array_remove("permissions", 'MANAGE_STAFF'::"UserPermission")
WHERE 'MANAGE_STAFF'::"UserPermission" = ANY("permissions");
