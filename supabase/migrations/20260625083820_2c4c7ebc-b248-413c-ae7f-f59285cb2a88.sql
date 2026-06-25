
-- ============================================================
-- ROLES
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============================================================
-- SHARED HELPERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  base_currency TEXT NOT NULL DEFAULT 'GBP',
  locale TEXT NOT NULL DEFAULT 'en-GB',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self profile read"   ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "self profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "self profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SETTINGS (assumptions / preferences)
-- ============================================================
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  assumptions JSONB NOT NULL DEFAULT '{
    "inflation_pct": 2.5,
    "real_growth_pct": 4.0,
    "swr_pct": 3.5,
    "life_expectancy": 92,
    "fire_target": 1500000,
    "liquid_fire_target": 900000
  }'::jsonb,
  notifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings rw" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- PLATFORMS
-- ============================================================
CREATE TABLE public.platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT,
  wrapper TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platforms TO authenticated;
GRANT ALL ON public.platforms TO service_role;
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platforms rw" ON public.platforms FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX platforms_user_idx ON public.platforms(user_id);

-- ============================================================
-- HOLDINGS
-- ============================================================
CREATE TABLE public.holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_id UUID REFERENCES public.platforms(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  ticker TEXT,
  asset_class TEXT,         -- equity / bond / cash / alt / property
  region TEXT,              -- uk / us / eu / em / global
  currency TEXT NOT NULL DEFAULT 'GBP',
  units NUMERIC(18,6),
  price NUMERIC(18,6),
  value NUMERIC(18,2) NOT NULL,
  wrapper TEXT,             -- isa / sipp / gia / pension
  liquidity TEXT,           -- liquid / illiquid
  role TEXT,                -- growth / income / defensive
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holdings TO authenticated;
GRANT ALL ON public.holdings TO service_role;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holdings rw" ON public.holdings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_holdings_updated BEFORE UPDATE ON public.holdings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX holdings_user_idx ON public.holdings(user_id);

-- ============================================================
-- VALUATION SNAPSHOTS + LINE ITEMS
-- ============================================================
CREATE TABLE public.valuation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL DEFAULT 'manual', -- manual / upload / scheduled
  total_value NUMERIC(18,2) NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'GBP',
  fx_rates JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.valuation_snapshots TO authenticated;
GRANT ALL ON public.valuation_snapshots TO service_role;
ALTER TABLE public.valuation_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshots rw" ON public.valuation_snapshots FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX snapshots_user_date_idx ON public.valuation_snapshots(user_id, snapshot_date DESC);

CREATE TABLE public.snapshot_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES public.valuation_snapshots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ticker TEXT,
  asset_class TEXT,
  region TEXT,
  currency TEXT,
  units NUMERIC(18,6),
  price NUMERIC(18,6),
  value NUMERIC(18,2) NOT NULL,
  wrapper TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.snapshot_holdings TO authenticated;
GRANT ALL ON public.snapshot_holdings TO service_role;
ALTER TABLE public.snapshot_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshot_holdings rw" ON public.snapshot_holdings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX snapshot_holdings_snap_idx ON public.snapshot_holdings(snapshot_id);

-- ============================================================
-- RETIREMENT PLAN
-- ============================================================
CREATE TABLE public.retirement_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Active Plan',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  date_of_birth DATE,
  target_retirement_date DATE,
  desired_annual_income NUMERIC(18,2),
  current_annual_spend NUMERIC(18,2),
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retirement_plans TO authenticated;
GRANT ALL ON public.retirement_plans TO service_role;
ALTER TABLE public.retirement_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans rw" ON public.retirement_plans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.retirement_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- INCOME SOURCES (state pension, DB pension, rental, annuity, consulting)
-- ============================================================
CREATE TABLE public.income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL, -- state_pension / db_pension / annuity / rental / consulting / other
  currency TEXT NOT NULL DEFAULT 'GBP',
  annual_value NUMERIC(18,2) NOT NULL,
  start_date DATE,
  end_date DATE,
  inflation_behaviour TEXT NOT NULL DEFAULT 'cpi', -- cpi / fixed / none
  tax_status TEXT NOT NULL DEFAULT 'taxable',      -- taxable / tax_free
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_sources TO authenticated;
GRANT ALL ON public.income_sources TO service_role;
ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "income_sources rw" ON public.income_sources FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_income_updated BEFORE UPDATE ON public.income_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- PROPERTY ASSETS
-- ============================================================
CREATE TABLE public.property_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  current_value NUMERIC(18,2) NOT NULL,
  purchase_price NUMERIC(18,2),
  purchase_date DATE,
  estimated_sale_date DATE,
  monthly_rental_income NUMERIC(18,2) DEFAULT 0,
  monthly_expenses NUMERIC(18,2) DEFAULT 0,
  mortgage_balance NUMERIC(18,2) DEFAULT 0,
  role_in_plan TEXT, -- sell_at_retirement / keep / downsize / other
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_assets TO authenticated;
GRANT ALL ON public.property_assets TO service_role;
ALTER TABLE public.property_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "property rw" ON public.property_assets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_property_updated BEFORE UPDATE ON public.property_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- SCENARIOS
-- ============================================================
CREATE TABLE public.scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenarios TO authenticated;
GRANT ALL ON public.scenarios TO service_role;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scenarios rw" ON public.scenarios FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_scenarios_updated BEFORE UPDATE ON public.scenarios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- DOCUMENTS (statements, wills, pension docs, etc.)
-- ============================================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- statement / pension / will / insurance / property / other
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded', -- uploaded / parsed / processed / error
  parsed_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents rw" ON public.documents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- AI CONVERSATIONS
-- ============================================================
CREATE TABLE public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_conv rw" ON public.ai_conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_ai_conv_updated BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- user / assistant / system
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_msg rw" ON public.ai_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ai_messages_conv_idx ON public.ai_messages(conversation_id, created_at);

-- ============================================================
-- AI REVIEWS (quarterly / on-demand)
-- ============================================================
CREATE TABLE public.ai_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'quarterly',
  period_start DATE,
  period_end DATE,
  summary TEXT,
  metrics JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_reviews TO authenticated;
GRANT ALL ON public.ai_reviews TO service_role;
ALTER TABLE public.ai_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_reviews rw" ON public.ai_reviews FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- FX RATES (shared lookup; base GBP)
-- ============================================================
CREATE TABLE public.fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL DEFAULT 'GBP',
  quote_currency TEXT NOT NULL,
  rate NUMERIC(18,8) NOT NULL,
  as_of DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (base_currency, quote_currency, as_of)
);
GRANT SELECT ON public.fx_rates TO authenticated, anon;
GRANT ALL ON public.fx_rates TO service_role;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fx public read" ON public.fx_rates FOR SELECT TO authenticated, anon USING (true);
