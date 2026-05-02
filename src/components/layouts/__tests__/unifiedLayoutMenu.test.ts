import { describe, it, expect } from 'vitest';
import { getAvatarMenuItems } from '../unifiedLayoutMenu';

describe('getAvatarMenuItems', () => {
  it('returns the full admin set for OWNER', () => {
    expect(getAvatarMenuItems('OWNER')).toEqual([
      { labelKey: 'settings', href: '/emilia/settings' },
      { labelKey: 'users', href: '/emilia/users' },
      { labelKey: 'agencies', href: '/emilia/agencies' },
      { labelKey: 'tenants', href: '/emilia/tenants' },
      { labelKey: 'dashboard', href: '/emilia/dashboard' },
    ]);
  });

  it('returns the full admin set for SUPERADMIN', () => {
    expect(getAvatarMenuItems('SUPERADMIN')).toEqual([
      { labelKey: 'settings', href: '/emilia/settings' },
      { labelKey: 'users', href: '/emilia/users' },
      { labelKey: 'agencies', href: '/emilia/agencies' },
      { labelKey: 'tenants', href: '/emilia/tenants' },
      { labelKey: 'dashboard', href: '/emilia/dashboard' },
    ]);
  });

  it('returns Settings + Users + Dashboard for ADMIN (no Agencies, no Tenants)', () => {
    expect(getAvatarMenuItems('ADMIN')).toEqual([
      { labelKey: 'settings', href: '/emilia/settings' },
      { labelKey: 'users', href: '/emilia/users' },
      { labelKey: 'dashboard', href: '/emilia/dashboard' },
    ]);
  });

  it('returns only Settings + Dashboard for SELLER', () => {
    expect(getAvatarMenuItems('SELLER')).toEqual([
      { labelKey: 'settings', href: '/emilia/settings' },
      { labelKey: 'dashboard', href: '/emilia/dashboard' },
    ]);
  });

  it('returns only Profile for CONSUMER', () => {
    expect(getAvatarMenuItems('CONSUMER')).toEqual([
      { labelKey: 'profile', href: '/emilia/profile' },
    ]);
  });

  it('returns an empty list for unknown / missing roles (defensive)', () => {
    expect(getAvatarMenuItems('UNKNOWN_ROLE')).toEqual([]);
    expect(getAvatarMenuItems(null)).toEqual([]);
    expect(getAvatarMenuItems(undefined)).toEqual([]);
    expect(getAvatarMenuItems('')).toEqual([]);
  });
});
