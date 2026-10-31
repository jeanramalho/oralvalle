-- NexoDent 256: obrigações financeiras laboratoriais, sem lançamentos duplicados.
-- Esta VIEW é derivada da fonte de verdade (nexodent_lab_orders): cada trabalho
-- aparece no máximo uma vez, inclusive depois de alterações de custo ou status.
-- Não cria pagamentos, despesas quitadas, nem modifica comissões.
-- SECURITY INVOKER preserva as políticas RLS da tabela de origem (PostgreSQL 15+).
CREATE OR REPLACE VIEW public.nexodent_lab_financial_obligations
WITH (security_invoker = true)
AS
SELECT
  id AS source_order_id,
  clinic_id,
  patient_id,
  treatment_id,
  laboratory,
  work_description,
  laboratory_cost AS amount,
  COALESCE(received_at, due_at) AS reference_date,
  status,
  updated_at,
  ('LAB-' || id::text) AS source_reference
FROM public.nexodent_lab_orders
WHERE COALESCE(laboratory_cost,0) > 0
  AND status IS DISTINCT FROM 'Cancelado';

REVOKE ALL ON public.nexodent_lab_financial_obligations FROM PUBLIC;
GRANT SELECT ON public.nexodent_lab_financial_obligations TO authenticated;
