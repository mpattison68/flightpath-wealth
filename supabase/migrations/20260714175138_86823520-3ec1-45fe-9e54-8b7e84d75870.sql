
-- Scenario Engine: extend scenarios with strategy metadata + cached projection.
ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS scenario_type TEXT NOT NULL DEFAULT 'retirement_timing',
  ADD COLUMN IF NOT EXISTS subtype TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS probability NUMERIC,
  ADD COLUMN IF NOT EXISTS is_baseline BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_details JSONB,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS projection JSONB;

-- Enforce a single baseline per user, when set.
CREATE UNIQUE INDEX IF NOT EXISTS scenarios_single_baseline_per_user
  ON public.scenarios (user_id) WHERE is_baseline;

-- New: named stress-test runs on top of a scenario.
CREATE TABLE IF NOT EXISTS public.scenario_stress_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scenario_id UUID NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  preset_key TEXT NOT NULL,
  label TEXT NOT NULL,
  overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenario_stress_tests TO authenticated;
GRANT ALL ON public.scenario_stress_tests TO service_role;

ALTER TABLE public.scenario_stress_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own stress tests"
  ON public.scenario_stress_tests FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_scenario_stress_tests_updated_at
  BEFORE UPDATE ON public.scenario_stress_tests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS scenario_stress_tests_scenario_idx
  ON public.scenario_stress_tests (scenario_id);
