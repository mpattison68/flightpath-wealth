ALTER TABLE public.spending_categories DROP CONSTRAINT IF EXISTS spending_categories_rollup_check;
ALTER TABLE public.spending_categories ADD CONSTRAINT spending_categories_rollup_check CHECK (rollup IN ('core','lifestyle','reserve'));
