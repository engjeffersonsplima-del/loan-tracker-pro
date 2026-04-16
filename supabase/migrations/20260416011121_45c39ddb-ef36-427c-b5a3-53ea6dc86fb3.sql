ALTER TABLE public.loans ADD COLUMN loan_type text NOT NULL DEFAULT 'parcelas_fixas';
ALTER TABLE public.loans ADD COLUMN interest_paid_this_month boolean NOT NULL DEFAULT false;