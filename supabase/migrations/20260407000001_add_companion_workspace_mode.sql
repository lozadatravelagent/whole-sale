-- Add 'companion' value to conversation_workspace_mode enum
-- for B2C companion-first mode (Phase 0: no behavior change, value only)
ALTER TYPE conversation_workspace_mode ADD VALUE IF NOT EXISTS 'companion';
