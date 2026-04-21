ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS interest_type text NOT NULL DEFAULT 'simples';
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS indefinite_term boolean NOT NULL DEFAULT false;
ALTER TABLE public.loans ALTER COLUMN due_date DROP NOT NULL;