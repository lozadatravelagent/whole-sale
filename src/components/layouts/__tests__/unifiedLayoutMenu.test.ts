import { describe, it, expect } from 'vitest';
import { getAvatarMenuItems } from '../unifiedLayoutMenu';

describe('getAvatarMenuItems', () => {
  it('returns the full admin set for OWNER', () => {
    expect(getAvatarMenuItems('OWNER')).toEqual([
      { label: 'Settings', href: '/emilia/settings' },
      { label: 'Users', href: '/emilia/users' },
      { label: 'Agencies', href: '/emilia/agencies' },
      { label: 'Tenants', href: '/emilia/tenants' },
      { label: 'Dashboard', href: '/emilia/dashboard' },
    ]);
  });

  it('returns the full admin set for SUPERADMIN', () => {
    expect(getAvatarMenuItems('SUPERADMIN')).toEqual([
      { label: 'Settings', href: '/emilia/settings' },
      { label: 'Users', href: '/emilia/users' },
      { label: 'Agencies', href: '/emilia/agencies' },
      { label: 'Tenants', href: '/emilia/tenants' },
      { label: 'Dashboard', href: '/emilia/dashboard' },
    ]);
  });

  it('returns Settings + Users + Dashboard for ADMIN (no Agencies, no Tenants)', () => {
    expect(getAvatarMenuItems('ADMIN')).toEqual([
      { label: 'Settings', href: '/emilia/settings' },
      { label: 'Users', href: '/emilia/users' },
      { label: 'Dashboard', href: '/emilia/dashboard' },
    ]);
  });

  it('returns only Settings + Dashboard for SELLER', () => {
    expect(getAvatarMenuItems('SELLER')).toEqual([
      { label: 'Settings', href: '/emilia/settings' },
      { label: 'Dashboard', href: '/emilia/dashboard' },
    ]);
  });

  it('returns only Profile for CONSUMER', () => {
    expect(getAvatarMenuItems('CONSUMER')).toEqual([
      { label: 'Profile', href: '/emilia/profile' },
    ]);
  });

  it('returns an empty list for unknown / missing roles (defensive)', () => {
    expect(getAvatarMenuItems('UNKNOWN_ROLE')).toEqual([]);
    expect(getAvatarMenuItems(null)).toEqual([]);
    expect(getAvatarMenuItems(undefined)).toEqual([]);
    expect(getAvatarMenuItems('')).toEqual([]);
  });
});
