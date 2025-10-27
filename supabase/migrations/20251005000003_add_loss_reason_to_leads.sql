-- Add loss_reason column to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS loss_reason TEXT;

-- Add comment to document the field
COMMENT ON COLUMN leads.loss_reason IS 'Reason why the lead was lost (e.g., "Precio muy alto", "No disponibilidad fechas", "Decidió otra agencia", "Canceló el viaje", "No respondió")';

-- Create index for better query performance on loss analysis
CREATE INDEX IF NOT EXISTS idx_leads_loss_reason ON leads(loss_reason) WHERE status = 'lost';
