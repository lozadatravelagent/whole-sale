# SQL Scripts - Documentation

This folder contains SQL scripts organized by purpose. These are supplementary scripts for migrations, fixes, and debugging.

## ⚠️ Important Notes

- **Primary migrations** are in `supabase/migrations/` (version controlled)
- These scripts are **one-time fixes** or **manual execution** scripts
- Always backup before running fix scripts
- Debug scripts are for investigation, not production changes

## Folder Structure

### 📦 [migrations/](./migrations/)
One-time migration scripts to apply features:

- `apply_cache_migration.sql` - Apply caching system to search functions
- `apply_async_migration.sql` - Apply async search jobs system
- `apply_rate_limiting.sql` - Apply rate limiting to Edge Functions
- `apply_new_migrations.sql` - Batch migration application script
- `EXECUTE_THIS_IN_SUPABASE.sql` - Initial setup script
- `CONVERT_ROLE_ENUM_TO_TEXT.sql` - Convert role enum to text type
- `RECONFIGURE_REALTIME_AFTER_ENUM_FIX.sql` - Fix Realtime after enum change

**Usage**: Run once in Supabase SQL Editor when setting up features.

### 🔧 [fixes/](./fixes/)
Fix scripts for resolved issues:

- `FIX_REALTIME.sql` - Realtime subscription fixes
- `FIX_REALTIME_BINDINGS.sql` - Realtime binding configuration
- `ENABLE_REALTIME_FREE_PLAN.sql` - Enable Realtime on free plan
- `FIX_SUPERADMIN_RLS_URGENTE.sql` - SUPERADMIN RLS policy fix
- `FIX_SIMPLE.sql` - Simple fixes collection
- `FIX_ASIGNAR_AGENCY.sql` - Agency assignment fix
- `FIX_SUPERADMIN_TENANT_MODEL.sql` - Tenant model correction
- `FIX_TENANT_INCONSISTENCIES.sql` - Tenant data cleanup
- `FIX_SUPERADMIN_USERS_POLICY.sql` - Users RLS policy fix
- `FIX_CHAT_ROLE_BASED.sql` - Chat role-based access fix
- `FIX_CONVERSATIONS_VIEW_RLS.sql` - Conversations view RLS fix
- `FIX_CONVERSATIONS_TAG_BY_ROLE.sql` - Conversation tagging fix

**Usage**: Historical fixes. Most issues are now resolved in primary migrations.

### 🐛 [debug/](./debug/)
Investigation and debugging scripts:

- `debug-conversation.sql` - Debug conversation data and permissions
- `query_users_hierarchy.sql` - Query user/agency/tenant relationships
- `fix_superadmin_agency_assignments.sql` - Debug SUPERADMIN assignments
- `CHECK_MESSAGES_SCHEMA.sql` - Verify messages table schema

**Usage**: Run when investigating issues. Safe to execute (read-only queries).

## Migration Strategy

### For New Features
1. Create migration in `supabase/migrations/YYYYMMDDHHMMSS_feature_name.sql`
2. Test locally with `npx supabase db reset`
3. Apply to production with `npx supabase db push`

### For One-Time Fixes
1. Create script in `docs/sql/fixes/`
2. Test in development environment
3. Execute in Supabase SQL Editor
4. Document in migration notes

### For Debugging
1. Use scripts in `docs/sql/debug/`
2. Copy/modify as needed for investigation
3. Do NOT run UPDATE/DELETE without backup

## Common Tasks

### Check Current Schema
```sql
-- Run: docs/sql/debug/CHECK_MESSAGES_SCHEMA.sql
```

### Debug User Permissions
```sql
-- Run: docs/sql/debug/query_users_hierarchy.sql
```

### Debug Conversations
```sql
-- Run: docs/sql/debug/debug-conversation.sql
```

## Best Practices

1. ✅ **Always backup** before running fix scripts
2. ✅ **Test in dev** before production
3. ✅ **Version control** migrations in `supabase/migrations/`
4. ✅ **Document** why a fix was needed
5. ❌ **Don't** run fix scripts multiple times
6. ❌ **Don't** modify these files (create new ones)

## Related Documentation

- [../../supabase/migrations/](../../supabase/migrations/) - Primary migration files
- [../implementation/IMPLEMENTATION_SUMMARY.md](../implementation/IMPLEMENTATION_SUMMARY.md) - What's implemented
- [../architecture/ASYNC_SEARCH_GUIDE.md](../architecture/ASYNC_SEARCH_GUIDE.md) - Async system setup

