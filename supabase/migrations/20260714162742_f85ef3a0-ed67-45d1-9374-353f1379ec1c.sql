
-- ============================================================
-- Stage A: Phase 2 architecture foundations
-- ============================================================

-- 1) financial_engines
CREATE TABLE public.financial_engines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('portfolio','property','state_pension','private_pension','consulting','rental','annuity')),
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','planned','future','retired')),
  starts_on DATE,
  ends_on DATE,
  sort_order INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_engines TO authenticated;
GRANT ALL ON public.financial_engines TO service_role;
ALTER TABLE public.financial_engines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engines_own" ON public.financial_engines FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_financial_engines_updated BEFORE UPDATE ON public.financial_engines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) retirement_income_sources
CREATE TABLE public.retirement_income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  engine_id UUID REFERENCES public.financial_engines(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  forecast_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP',
  start_date DATE,
  end_date DATE,
  indexation_method TEXT NOT NULL DEFAULT 'cpi' CHECK (indexation_method IN ('cpi','fixed','triple_lock','none','custom')),
  indexation_rate NUMERIC,
  confidence NUMERIC NOT NULL DEFAULT 80 CHECK (confidence BETWEEN 0 AND 100),
  probability NUMERIC NOT NULL DEFAULT 100 CHECK (probability BETWEEN 0 AND 100),
  country TEXT,
  review_date DATE,
  tax_status TEXT,
  notes TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retirement_income_sources TO authenticated;
GRANT ALL ON public.retirement_income_sources TO service_role;
ALTER TABLE public.retirement_income_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ris_own" ON public.retirement_income_sources FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_ris_updated BEFORE UPDATE ON public.retirement_income_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) spending_categories
CREATE TABLE public.spending_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  rollup TEXT NOT NULL CHECK (rollup IN ('core','lifestyle')),
  essential BOOLEAN NOT NULL DEFAULT false,
  annual_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP',
  inflation_key TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spending_categories TO authenticated;
GRANT ALL ON public.spending_categories TO service_role;
ALTER TABLE public.spending_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spend_own" ON public.spending_categories FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_spend_updated BEFORE UPDATE ON public.spending_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) planning_milestones
CREATE TABLE public.planning_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  target_date DATE,
  achieved_on DATE,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','derived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_milestones TO authenticated;
GRANT ALL ON public.planning_milestones TO service_role;
ALTER TABLE public.planning_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "milestones_own" ON public.planning_milestones FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_milestones_updated BEFORE UPDATE ON public.planning_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) property_assets extensions
ALTER TABLE public.property_assets
  ADD COLUMN IF NOT EXISTS property_type TEXT NOT NULL DEFAULT 'primary'
    CHECK (property_type IN ('primary','investment','holiday','rental','other')),
  ADD COLUMN IF NOT EXISTS selling_costs_pct NUMERIC NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS estimated_tax NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_sale_year INT;

-- 6) planning_assumptions extensions
ALTER TABLE public.planning_assumptions
  ADD COLUMN IF NOT EXISTS review_frequency TEXT NOT NULL DEFAULT 'annually'
    CHECK (review_frequency IN ('quarterly','six_monthly','annually','never')),
  ADD COLUMN IF NOT EXISTS depends_on TEXT[] NOT NULL DEFAULT '{}';

-- 7) income_sources: link to engines (transitional; nullable)
ALTER TABLE public.income_sources
  ADD COLUMN IF NOT EXISTS engine_id UUID REFERENCES public.financial_engines(id) ON DELETE SET NULL;
