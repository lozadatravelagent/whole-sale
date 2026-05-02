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
 *
 * Each item exposes `labelKey` so the rendering layout can resolve the label
 * via `t(common:nav.<key>)` and render it in the user's preferred language.
 */

export interface AvatarMenuItem {
  labelKey: 'dashboard' | 'settings' | 'users' | 'agencies' | 'tenants' | 'profile';
  href: string;
}

export function getAvatarMenuItems(role: string | null | undefined): AvatarMenuItem[] {
  switch (role) {
    case 'OWNER':
    case 'SUPERADMIN':
      return [
        { labelKey: 'settings', href: '/emilia/settings' },
        { labelKey: 'users', href: '/emilia/users' },
        { labelKey: 'agencies', href: '/emilia/agencies' },
        { labelKey: 'tenants', href: '/emilia/tenants' },
        { labelKey: 'dashboard', href: '/emilia/dashboard' },
      ];
    case 'ADMIN':
      return [
        { labelKey: 'settings', href: '/emilia/settings' },
        { labelKey: 'users', href: '/emilia/users' },
        { labelKey: 'dashboard', href: '/emilia/dashboard' },
      ];
    case 'SELLER':
      return [
        { labelKey: 'settings', href: '/emilia/settings' },
        { labelKey: 'dashboard', href: '/emilia/dashboard' },
      ];
    case 'CONSUMER':
      return [{ labelKey: 'profile', href: '/emilia/profile' }];
    default:
      return [];
  }
}
