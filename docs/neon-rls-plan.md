# Neon / PostgreSQL Row-Level Security Plan

GLV currently enforces staff/admin visibility in the application layer through
NextAuth, server components, server actions, and Prisma queries. PostgreSQL RLS
can add a database-level guard, but it must be introduced carefully because the
app currently connects through one Prisma database role.

## Practical RLS Direction

1. Keep the current Prisma app role as the owner/migration role.
2. Create a separate runtime database role without `BYPASSRLS`.
3. Change production runtime `DATABASE_URL` to use the runtime role, while
   migration/deploy commands continue using the owner role.
4. Before staff-scoped queries, set a transaction-local context value:

   ```sql
   select set_config('app.staff_id', '<staff-id>', true);
   select set_config('app.user_role', '<role>', true);
   ```

5. Enable RLS first on the most sensitive staff-scoped tables:
   `Customer`, `CustomerAccount`, `Payment`, and `CustomerCredit`.
6. Add policies that allow Admin/Super Admin full access, and Staff access only
   through their assigned `staffId`.
7. Test every staff dashboard, customer, account, payment, report, and export
   flow before enabling `FORCE ROW LEVEL SECURITY`.

## Example Policy Shape

```sql
alter table "Customer" enable row level security;

create policy customer_staff_scope on "Customer"
for select
using (
  current_setting('app.user_role', true) in ('ADMIN', 'SUPER_ADMIN')
  or "staffId" = current_setting('app.staff_id', true)
);
```

This should be expanded for insert/update/delete and for related tables. Do not
turn this on broadly until Prisma runtime connections consistently set the
required session context.
