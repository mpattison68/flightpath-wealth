
-- 1. planning_assumptions
CREATE TABLE public.planning_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  value_numeric NUMERIC,
  value_json JSONB,
  unit TEXT,
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high','medium','low')),
  source TEXT,
  description TEXT,
  ai_commentary TEXT,
  last_reviewed_at TIMESTAMPTZ,
  review_due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_assumptions TO authenticated;
GRANT ALL ON public.planning_assumptions TO service_role;
ALTER TABLE public.planning_assumptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own planning_assumptions" ON public.planning_assumptions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_planning_assumptions_updated_at BEFORE UPDATE ON public.planning_assumptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_planning_assumptions_user ON public.planning_assumptions(user_id);
CREATE INDEX idx_planning_assumptions_category ON public.planning_assumptions(user_id, category);

-- 2. planning_assumption_history
CREATE TABLE public.planning_assumption_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assumption_id UUID REFERENCES public.planning_assumptions(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  note TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.planning_assumption_history TO authenticated;
GRANT ALL ON public.planning_assumption_history TO service_role;
ALTER TABLE public.planning_assumption_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own assumption history read" ON public.planning_assumption_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own assumption history insert" ON public.planning_assumption_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_assumption_history_user_key ON public.planning_assumption_history(user_id, key, changed_at DESC);

-- 3. scenario_overrides (sparse diffs on baseline)
CREATE TABLE public.scenario_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  assumption_key TEXT NOT NULL,
  value_numeric NUMERIC,
  value_json JSONB,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scenario_id, assumption_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenario_overrides TO authenticated;
GRANT ALL ON public.scenario_overrides TO service_role;
ALTER TABLE public.scenario_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scenario_overrides" ON public.scenario_overrides
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_scenario_overrides_updated_at BEFORE UPDATE ON public.scenario_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_scenario_overrides_scenario ON public.scenario_overrides(scenario_id);

-- 4. Extend user_settings with primary spending currency
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS primary_spending_currency TEXT DEFAULT 'GBP';

-- 5. Backfill starter planning assumptions from existing user_settings.assumptions + retirement_plans
-- Each row is inserted only if a matching key doesn't already exist for the user.
INSERT INTO public.planning_assumptions (user_id, key, category, label, value_numeric, unit, confidence, description)
SELECT
  s.user_id,
  v.key,
  v.category,
  v.label,
  v.value_numeric,
  v.unit,
  'medium',
  v.description
FROM public.user_settings s
CROSS JOIN LATERAL (VALUES
  ('inflation.uk',            'Inflation',   'UK Inflation',                COALESCE((s.assumptions->>'inflation_pct')::numeric, 2.5),    '%',   'Expected long-run annual UK CPI. Used to discount future values to today''s money.'),
  ('growth.equity_real',      'Investment',  'Equity Real Return',          COALESCE((s.assumptions->>'real_growth_pct')::numeric, 4),    '%',   'Expected annual portfolio return above inflation.'),
  ('withdrawal.swr',          'Retirement',  'Safe Withdrawal Rate',        COALESCE((s.assumptions->>'swr_pct')::numeric, 3.5),          '%',   'Assumed sustainable annual withdrawal rate from the portfolio.'),
  ('retirement.life_expectancy','Retirement','Life Expectancy',             COALESCE((s.assumptions->>'life_expectancy')::numeric, 92),   'age', 'Age the portfolio must last until.'),
  ('fire.target_total',       'Retirement',  'FIRE Target (Total)',         COALESCE((s.assumptions->>'fire_target')::numeric, 1500000),  'GBP', 'Total net worth at which you are considered financially independent.'),
  ('fire.target_liquid',      'Retirement',  'FIRE Target (Liquid)',        COALESCE((s.assumptions->>'liquid_fire_target')::numeric, 900000), 'GBP', 'Liquid, drawable assets at which you could retire today.')
) AS v(key, category, label, value_numeric, unit, description)
ON CONFLICT (user_id, key) DO NOTHING;

-- Preserve prior JSON blob into history so nothing is lost
INSERT INTO public.planning_assumption_history (user_id, key, new_value, note)
SELECT user_id, '__migration_snapshot__', to_jsonb(assumptions), 'Pre-consolidation snapshot of user_settings.assumptions'
FROM public.user_settings
WHERE assumptions IS NOT NULL AND assumptions <> '{}'::jsonb;
