-- Phase 1.1.a (Migration A): Add CONSUMER to user_role enum
-- Must be in a separate migration because PostgreSQL does not allow
-- a newly added enum value to be referenced in CHECK constraints,
-- casts, or comparisons within the same transaction.
-- Companion migration: 20260409000002_b2c_ownership.sql

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'CONSUMER';

-- ROLLBACK: Cannot remove an enum value in PostgreSQL.
-- The CONSUMER value remains as an inert, unreferenced label (harmless).
