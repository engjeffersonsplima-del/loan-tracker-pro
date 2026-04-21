import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface DBLoan {
  id: string;
  user_id: string;
  customer_id: string | null;
  borrower_name: string;
  amount: number;
  loan_date: string;
  due_date: string | null;
  payment_method: string;
  notes: string | null;
  installments: number;
  status: string;
  interest_rate: number;
  late_interest_rate: number;
  interest_type?: string;
  indefinite_term?: boolean;
  loan_type?: string;
  interest_paid_this_month?: boolean;
  payments: DBPayment[];
}

export interface DBPayment {
  id: string;
  loan_id: string;
  amount: number;
  date: string;
}

function computeStatus(amount: number, totalPaid: number, dueDate: string | null): string {
  if (totalPaid >= amount) return 'pago';
  const now = new Date();
  if (!dueDate) {
    return totalPaid > 0 ? 'parcial' : 'em_dia';
  }
  const due = new Date(dueDate);
  if (totalPaid > 0 && totalPaid < amount) {
    return now > due ? 'atrasado' : 'parcial';
  }
  return now > due ? 'atrasado' : 'em_dia';
}

export function useLoansDB(onCustomerCreated?: () => void) {
  const { user } = useAuth();
  const [loans, setLoans] = useState<DBLoan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLoans = useCallback(async () => {
    if (!user) return;
    const { data: loansData, error: loansError } = await supabase
      .from('loans')
      .select('*')
      .order('created_at', { ascending: false });

    if (loansError) {
      toast.error('Erro ao carregar empréstimos');
      console.error(loansError);
      setLoading(false);
      return;
    }

    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .order('date', { ascending: true });

    if (paymentsError) {
      console.error(paymentsError);
    }

    const paymentsByLoan = new Map<string, DBPayment[]>();
    (paymentsData || []).forEach(p => {
      const list = paymentsByLoan.get(p.loan_id) || [];
      list.push({ id: p.id, loan_id: p.loan_id, amount: p.amount, date: p.date });
      paymentsByLoan.set(p.loan_id, list);
    });

    const enriched: DBLoan[] = (loansData || []).map(l => ({
      ...l,
      payments: paymentsByLoan.get(l.id) || [],
    }));

    setLoans(enriched);
    setLoading(false);

    // Backfill: ensure every borrower_name in loans exists in customers table
    const { data: existingCustomers } = await supabase
      .from('customers')
      .select('id, name')
      .eq('user_id', user.id);

    const existingNames = new Set(
      (existingCustomers || []).map(c => c.name.trim().toLowerCase())
    );
    const loanNames = new Set(
      (loansData || []).map(l => l.borrower_name.trim()).filter(Boolean)
    );
    const missingNames = Array.from(loanNames).filter(
      n => !existingNames.has(n.toLowerCase())
    );

    if (missingNames.length > 0) {
      const toInsert = missingNames.map(name => ({ user_id: user.id, name }));
      const { error: insertErr } = await supabase.from('customers').insert(toInsert);
      if (!insertErr) {
        onCustomerCreated?.();
      }
    }
  }, [user, onCustomerCreated]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const addLoan = useCallback(async (data: {
    borrowerName: string;
    amount: number;
    loanDate: string;
    dueDate: string | null;
    paymentMethod: string;
    notes: string;
    installments: number;
    customerId?: string;
    interestRate?: number;
    lateInterestRate?: number;
    interestType?: 'simples' | 'composto';
    indefiniteTerm?: boolean;
    loanType?: 'juros_mensal' | 'parcelas_fixas';
  }) => {
    if (!user) return;
    // Auto-create customer if name doesn't match an existing one
    let customerId = data.customerId || null;
    if (!customerId) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', data.borrowerName.trim())
        .maybeSingle();
      if (existing) {
        customerId = existing.id;
      } else {
        const { data: created } = await supabase
          .from('customers')
          .insert({ user_id: user.id, name: data.borrowerName.trim() })
          .select('id')
          .maybeSingle();
        if (created) {
          customerId = created.id;
          onCustomerCreated?.();
        }
      }
    }

    const { error } = await supabase.from('loans').insert({
      user_id: user.id,
      customer_id: customerId,
      borrower_name: data.borrowerName,
      amount: data.amount,
      loan_date: data.loanDate,
      due_date: data.dueDate,
      payment_method: data.paymentMethod,
      notes: data.notes,
      installments: data.installments,
      status: 'em_dia',
      interest_rate: data.interestRate || 0,
      late_interest_rate: data.lateInterestRate || 0,
      interest_type: data.interestType || 'simples',
      indefinite_term: data.indefiniteTerm || false,
      loan_type: data.loanType || 'parcelas_fixas',
    });
    if (error) {
      toast.error('Erro ao salvar empréstimo');
      console.error(error);
    } else {
      toast.success('Empréstimo salvo!');
      await fetchLoans();
    }
  }, [user, fetchLoans, onCustomerCreated]);

  const deleteLoan = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('loans').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir empréstimo');
    } else {
      toast.success('Empréstimo excluído!');
      await fetchLoans();
    }
  }, [user, fetchLoans]);

  const addPayment = useCallback(async (loanId: string, amount: number) => {
    if (!user) return;
    const { error } = await supabase.from('payments').insert({
      loan_id: loanId,
      user_id: user.id,
      amount,
      date: new Date().toISOString().split('T')[0],
    });
    if (error) {
      toast.error('Erro ao registrar pagamento');
      console.error(error);
      return;
    }

    // Update loan status
    const loan = loans.find(l => l.id === loanId);
    if (loan) {
      const totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0) + amount;
      const newStatus = computeStatus(loan.amount, totalPaid, loan.due_date);
      await supabase.from('loans').update({ status: newStatus }).eq('id', loanId);
    }

    toast.success('Pagamento registrado!');
    await fetchLoans();
  }, [user, loans, fetchLoans]);

  const markAsPaid = useCallback(async (loanId: string) => {
    if (!user) return;
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;

    const totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = loan.amount - totalPaid;

    if (remaining > 0) {
      await supabase.from('payments').insert({
        loan_id: loanId,
        user_id: user.id,
        amount: remaining,
        date: new Date().toISOString().split('T')[0],
      });
    }

    await supabase.from('loans').update({ status: 'pago' }).eq('id', loanId);
    toast.success('Empréstimo marcado como pago!');
    await fetchLoans();
  }, [user, loans, fetchLoans]);

  const stats = useMemo(() => {
    const totalLent = loans.reduce((s, l) => s + l.amount, 0);
    const totalReceived = loans.reduce((s, l) => s + l.payments.reduce((ps, p) => ps + p.amount, 0), 0);
    // Compute total owed including accrued interest (30-day cycles)
    const now = Date.now();
    const totalOwedWithInterest = loans.reduce((sum, l) => {
      if (l.status === 'pago') return sum + l.amount;
      const start = new Date(l.loan_date).getTime();
      const days = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
      const months = Math.floor(days / 30);
      const due = l.due_date ? new Date(l.due_date).getTime() : null;
      const isOverdue = due ? now > due : false;
      const monthlyRate = (l.interest_rate || 0) / 100;
      const lateBonus = isOverdue ? (l.late_interest_rate || 0) / 100 : 0;
      const rate = monthlyRate + lateBonus;
      const total = l.interest_type === 'composto'
        ? l.amount * Math.pow(1 + rate, months)
        : l.amount * (1 + rate * months);
      return sum + total;
    }, 0);
    const totalPending = Math.max(0, totalOwedWithInterest - totalReceived);
    const overdue = loans.filter(l => l.status === 'atrasado').length;
    return { totalLent, totalReceived, totalPending, overdue, totalOwedWithInterest };
  }, [loans]);

  const updateLoan = useCallback(async (id: string, data: {
    borrowerName: string;
    amount: number;
    loanDate: string;
    dueDate: string | null;
    paymentMethod: string;
    notes: string;
    installments: number;
    interestRate?: number;
    lateInterestRate?: number;
    interestType?: 'simples' | 'composto';
    indefiniteTerm?: boolean;
    loanType?: 'juros_mensal' | 'parcelas_fixas';
  }) => {
    if (!user) return;
    const { error } = await supabase.from('loans').update({
      borrower_name: data.borrowerName,
      amount: data.amount,
      loan_date: data.loanDate,
      due_date: data.dueDate,
      payment_method: data.paymentMethod,
      notes: data.notes,
      installments: data.installments,
      interest_rate: data.interestRate || 0,
      late_interest_rate: data.lateInterestRate || 0,
      interest_type: data.interestType || 'simples',
      indefinite_term: data.indefiniteTerm || false,
      loan_type: data.loanType || 'parcelas_fixas',
    }).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar empréstimo');
      console.error(error);
    } else {
      toast.success('Empréstimo atualizado!');
      await fetchLoans();
    }
  }, [user, fetchLoans]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    if (!user) return;
    const { error } = await supabase.from('loans').update({ status }).eq('id', id);
    if (error) {
      toast.error('Erro ao alterar status');
      console.error(error);
    } else {
      toast.success('Status atualizado!');
      await fetchLoans();
    }
  }, [user, fetchLoans]);

  const updatePayment = useCallback(async (paymentId: string, data: { amount?: number; date?: string }) => {
    if (!user) return;
    const { error } = await supabase.from('payments').update(data).eq('id', paymentId);
    if (error) {
      toast.error('Erro ao atualizar pagamento');
      console.error(error);
    } else {
      toast.success('Pagamento atualizado!');
      await fetchLoans();
    }
  }, [user, fetchLoans]);

  const deletePayment = useCallback(async (paymentId: string) => {
    if (!user) return;
    const { error } = await supabase.from('payments').delete().eq('id', paymentId);
    if (error) {
      toast.error('Erro ao excluir pagamento');
      console.error(error);
    } else {
      toast.success('Pagamento excluído!');
      await fetchLoans();
    }
  }, [user, fetchLoans]);

  return { loans, loading, stats, addLoan, updateLoan, deleteLoan, addPayment, markAsPaid, updateStatus, updatePayment, deletePayment, refetch: fetchLoans };
}
