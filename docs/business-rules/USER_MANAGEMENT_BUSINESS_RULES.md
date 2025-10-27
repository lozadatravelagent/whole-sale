# User Management - Business Rules Implementation

## Overview
This document outlines the business rules implemented for user management in the WholeSale Connect AI application, with special focus on the OWNER role restrictions.

## Role Hierarchy

```
OWNER (System Administrator)
├── SUPERADMIN (Tenant Administrator)
│   ├── ADMIN (Agency Manager)
│   │   └── SELLER (Sales Representative)
```

## Business Rules

### 1. OWNER Role Visibility and Management

#### Rule 1.1: OWNER Users Visibility
- **Only OWNER users can see other OWNER users**
- SUPERADMIN, ADMIN, and SELLER users **cannot see** OWNER users in the user list
- Implementation:
  - Frontend filter in [Users.tsx:63-67](src/pages/Users.tsx#L63-L67)
  - Backend RLS policy in database (users_select_policy)

#### Rule 1.2: OWNER User Creation
- **Only OWNER users can create new OWNER users**
- SUPERADMIN can create: SUPERADMIN, ADMIN, SELLER
- ADMIN can create: SELLER only
- Implementation:
  - Database function: `get_allowed_roles_for_creation()` in [20251005000002_user_management_helpers.sql:90-115](supabase/migrations/20251005000002_user_management_helpers.sql#L90-L115)
  - Hook fallback in [useUsers.ts:108-114](src/hooks/useUsers.ts#L108-L114)

#### Rule 1.3: OWNER User Editing
- **Only OWNER users can edit other OWNER users**
- Non-OWNER users cannot:
  - Change OWNER user's role
  - Edit OWNER user's tenant assignment
  - Modify OWNER user's agency
- Implementation:
  - Edit button hidden for non-OWNER in [Users.tsx:280-289](src/pages/Users.tsx#L280-L289)
  - Role selector disabled in [Users.tsx:466](src/pages/Users.tsx#L466)
  - Warning message shown in [Users.tsx:479-483](src/pages/Users.tsx#L479-L483)

#### Rule 1.4: OWNER User Deletion
- **Only OWNER users can delete users**
- OWNER users **cannot delete other OWNER users** (protection against accidental deletion)
- OWNER users **cannot delete themselves** (prevent lockout)
- Implementation:
  - Delete button logic in [Users.tsx:291-300](src/pages/Users.tsx#L291-L300)
  - Backend validation in [useUsers.ts:230-238](src/hooks/useUsers.ts#L230-L238)

### 2. User Management Permissions Matrix

| Action | OWNER | SUPERADMIN | ADMIN | SELLER |
|--------|-------|------------|-------|--------|
| View all users | ✅ | ❌ (tenant only) | ❌ (agency only) | ❌ |
| View OWNER users | ✅ | ❌ | ❌ | ❌ |
| Create OWNER | ✅ | ❌ | ❌ | ❌ |
| Create SUPERADMIN | ✅ | ✅ | ❌ | ❌ |
| Create ADMIN | ✅ | ✅ | ❌ | ❌ |
| Create SELLER | ✅ | ✅ | ✅ | ❌ |
| Edit OWNER | ✅ | ❌ | ❌ | ❌ |
| Edit SUPERADMIN | ✅ | ✅ (same tenant) | ❌ | ❌ |
| Edit ADMIN | ✅ | ✅ (same tenant) | ❌ | ❌ |
| Edit SELLER | ✅ | ✅ (same tenant) | ✅ (same agency) | ❌ |
| Delete OWNER | ❌ | ❌ | ❌ | ❌ |
| Delete SUPERADMIN | ✅ | ❌ | ❌ | ❌ |
| Delete ADMIN | ✅ | ❌ | ❌ | ❌ |
| Delete SELLER | ✅ | ❌ | ❌ | ❌ |

### 3. Database-Level Enforcement

All business rules are enforced at multiple levels:

#### Level 1: Database RLS Policies
Located in [20251005000002_user_management_helpers.sql](supabase/migrations/20251005000002_user_management_helpers.sql)

- **users_select_policy** (Line 194-209): Controls who can see which users
- **users_insert_policy** (Line 212-230): Controls user creation based on role
- **users_update_policy** (Line 233-241): Controls user editing permissions
- **users_delete_policy** (Line 244-247): Restricts deletion to OWNER only

#### Level 2: Database Functions
- **can_create_user_with_role(target_role)** (Line 8-41): Validates role creation permissions
- **can_manage_user(target_user_id)** (Line 44-87): Validates edit/delete permissions
- **get_allowed_roles_for_creation()** (Line 90-115): Returns allowed roles for UI

#### Level 3: Frontend Validation
- **useUsers hook** ([src/hooks/useUsers.ts](src/hooks/useUsers.ts)): Permission checks before API calls
- **Users page** ([src/pages/Users.tsx](src/pages/Users.tsx)): UI controls and visibility

## Implementation Details

### Frontend Implementation

#### 1. User List Filtering
```typescript
// BUSINESS RULE: Filter OWNER users - only OWNER can see other OWNERs
const visibleUsers = React.useMemo(() => {
  if (isOwner) return users; // OWNER sees all users
  return users.filter(u => u.role !== 'OWNER'); // Others don't see OWNER users
}, [users, isOwner]);
```

#### 2. Edit Button Visibility
```typescript
{/* BUSINESS RULE: Only OWNER can edit OWNER users */}
{(isOwner || user.role !== 'OWNER') && (
  <Button onClick={() => openEditDialog(user)}>
    <Pencil className="h-4 w-4" />
  </Button>
)}
```

#### 3. Delete Button Logic
```typescript
{/* BUSINESS RULE: Only OWNER can delete, but not themselves or other OWNERs */}
{isOwner && user.id !== currentUser?.id && user.role !== 'OWNER' && (
  <Button onClick={() => handleDelete(user.id)}>
    <Trash2 className="h-4 w-4 text-destructive" />
  </Button>
)}
```

#### 4. Role Selector Restriction
```typescript
<Select
  value={editRole}
  disabled={selectedUser?.role === 'OWNER' && !isOwner}
>
  {/* Role options */}
</Select>
{selectedUser?.role === 'OWNER' && !isOwner && (
  <p className="text-xs text-destructive">
    ⚠️ Solo usuarios con rol OWNER pueden cambiar el rol de otros OWNER
  </p>
)}
```

### Backend Implementation

#### Database Function Example: can_create_user_with_role
```sql
CREATE OR REPLACE FUNCTION public.can_create_user_with_role(target_role public.user_role)
RETURNS boolean AS $$
DECLARE
  current_user_role public.user_role;
BEGIN
  SELECT role INTO current_user_role FROM public.users WHERE id = auth.uid();

  -- OWNER can create any role
  IF current_user_role = 'OWNER' THEN RETURN true; END IF;

  -- SUPERADMIN can create SUPERADMIN, ADMIN, SELLER (not OWNER)
  IF current_user_role = 'SUPERADMIN' AND target_role IN ('SUPERADMIN', 'ADMIN', 'SELLER') THEN
    RETURN true;
  END IF;

  -- ADMIN can only create SELLER
  IF current_user_role = 'ADMIN' AND target_role = 'SELLER' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Security Considerations

### 1. Defense in Depth
Business rules are enforced at three layers:
- **Database**: RLS policies and functions (primary defense)
- **API**: Hook validations (secondary defense)
- **UI**: Button visibility and form controls (UX improvement)

### 2. Protection Against Privilege Escalation
- Non-OWNER users cannot:
  - Elevate their own role to OWNER
  - Elevate other users to OWNER
  - See or modify existing OWNER users
  - Delete any OWNER users

### 3. Protection Against Account Lockout
- OWNER users cannot delete themselves
- OWNER users cannot delete other OWNER users
- Ensures system always has at least one OWNER

## Testing Scenarios

### Test Case 1: SUPERADMIN Tries to See OWNER Users
**Expected**: OWNER users are filtered out from the list
**Verification**: Check visibleUsers array excludes role='OWNER'

### Test Case 2: ADMIN Tries to Edit OWNER User
**Expected**: Edit button is hidden, no way to access edit dialog
**Verification**: Edit button not rendered in UI

### Test Case 3: OWNER Creates New OWNER User
**Expected**: 'OWNER' appears in role dropdown, user can be created
**Verification**: allowedRoles includes 'OWNER'

### Test Case 4: OWNER Tries to Delete Another OWNER
**Expected**: Delete button is hidden
**Verification**: Delete button conditional check prevents rendering

### Test Case 5: Database Direct Access
**Expected**: RLS policies block unauthorized operations
**Verification**: Database returns permission denied errors

## Migration Status

✅ All business rules are implemented in:
- [20251005000002_user_management_helpers.sql](supabase/migrations/20251005000002_user_management_helpers.sql)

⚠️ **Migration needs to be applied to database**

Run the SQL in Supabase SQL Editor or via CLI:
```bash
npx supabase db push
```

## Files Modified

### Created Files
- `src/hooks/useUsers.ts` - User management hook
- `src/hooks/useAgencies.ts` - Agency management hook
- `src/hooks/useTenants.ts` - Tenant management hook
- `src/pages/Users.tsx` - User management UI
- `supabase/migrations/20251005000002_user_management_helpers.sql` - Database functions and RLS

### Updated Files
- `src/types/index.ts` - Added Role type and user interfaces

## Summary

The OWNER role is now properly protected with the following guarantees:

1. ✅ **Visibility**: Only OWNER users can see other OWNER users
2. ✅ **Creation**: Only OWNER users can create new OWNER users
3. ✅ **Editing**: Only OWNER users can edit OWNER users
4. ✅ **Deletion**: No one can delete OWNER users (including OWNERs themselves)
5. ✅ **Multi-layer Protection**: Enforced at Database, API, and UI levels
6. ✅ **Business Logic Compliance**: All rules follow the defined hierarchy

**The implementation uses proper business logic separation and is secure by design.**
