/**
 * Pure logic for the UnifiedLayout avatar menu — extracted for unit testing.
 * Returns the per-role list of navigation items shown inside the avatar
 * popover. The Logout button is rendered separately by the layout component
 * (it is not configurable per role).
 *
 * `role` is typed as `string` because the project's `Role` union does not
 * include `'CONSUMER'`, even though that value reaches client code via
 * `useAuth().user?.role`. Defensive default returns an empty list for any
 * unknown role.
 */

export interface AvatarMenuItem {
  label: string;
  href: string;
}

export function getAvatarMenuItems(role: string | null | undefined): AvatarMenuItem[] {
  switch (role) {
    case 'OWNER':
    case 'SUPERADMIN':
      return [
        { label: 'Settings', href: '/emilia/settings' },
        { label: 'Users', href: '/emilia/users' },
        { label: 'Agencies', href: '/emilia/agencies' },
        { label: 'Tenants', href: '/emilia/tenants' },
        { label: 'Dashboard', href: '/emilia/dashboard' },
      ];
    case 'ADMIN':
      return [
        { label: 'Settings', href: '/emilia/settings' },
        { label: 'Users', href: '/emilia/users' },
        { label: 'Dashboard', href: '/emilia/dashboard' },
      ];
    case 'SELLER':
      return [
        { label: 'Settings', href: '/emilia/settings' },
        { label: 'Dashboard', href: '/emilia/dashboard' },
      ];
    case 'CONSUMER':
      return [{ label: 'Profile', href: '/emilia/profile' }];
    default:
      return [];
  }
}
