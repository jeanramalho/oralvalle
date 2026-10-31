-- NexoDent 250: vínculo e custo do laboratório por trabalho, por clínica.
-- Execute no SQL Editor do Supabase ANTES de instalar laboratory.js.
-- Não altera comissões ou lançamentos financeiros existentes.
ALTER TABLE public.nexodent_lab_orders
  ADD COLUMN IF NOT EXISTS treatment_id text,
  ADD COLUMN IF NOT EXISTS laboratory_cost numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.nexodent_lab_orders
  DROP CONSTRAINT IF EXISTS nexodent_lab_orders_laboratory_cost_nonnegative;
ALTER TABLE public.nexodent_lab_orders
  ADD CONSTRAINT nexodent_lab_orders_laboratory_cost_nonnegative CHECK (laboratory_cost >= 0);

CREATE INDEX IF NOT EXISTS idx_nexodent_lab_orders_clinic_treatment
  ON public.nexodent_lab_orders (clinic_id, treatment_id);
