ALTER TABLE public.loans ADD COLUMN interest_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.loans ADD COLUMN late_interest_rate numeric NOT NULL DEFAULT 0;