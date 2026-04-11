import { useState, useCallback, useMemo } from 'react';
import { Loan, Payment, LoanStatus, MonthlyGoal } from '@/types/loan';

const STORAGE_KEY = 'cobracerto_loans';
const GOALS_KEY = 'cobracerto_goals';

function loadLoans(): Loan[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveLoans(loans: Loan[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loans));
}

function loadGoals(): MonthlyGoal[] {
  try {
    const data = localStorage.getItem(GOALS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveGoals(goals: MonthlyGoal[]) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

function computeStatus(loan: Loan): LoanStatus {
  const totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0);
  if (totalPaid >= loan.amount) return 'pago';
  if (totalPaid > 0 && totalPaid < loan.amount) {
    const now = new Date();
    const due = new Date(loan.dueDate);
    return now > due ? 'atrasado' : 'parcial';
  }
  const now = new Date();
  const due = new Date(loan.dueDate);
  return now > due ? 'atrasado' : 'em_dia';
}

export function useLoans() {
  const [loans, setLoans] = useState<Loan[]>(loadLoans);
  const [goals, setGoals] = useState<MonthlyGoal[]>(loadGoals);

  const updateLoans = useCallback((newLoans: Loan[]) => {
    setLoans(newLoans);
    saveLoans(newLoans);
  }, []);

  const addLoan = useCallback((loan: Omit<Loan, 'id' | 'payments' | 'status'>) => {
    const newLoan: Loan = {
      ...loan,
      id: crypto.randomUUID(),
      payments: [],
      status: 'em_dia',
    };
    newLoan.status = computeStatus(newLoan);
    const updated = [...loadLoans(), newLoan];
    updateLoans(updated);
  }, [updateLoans]);

  const deleteLoan = useCallback((id: string) => {
    updateLoans(loadLoans().filter(l => l.id !== id));
  }, [updateLoans]);

  const addPayment = useCallback((loanId: string, amount: number) => {
    const current = loadLoans();
    const updated = current.map(l => {
      if (l.id !== loanId) return l;
      const payment: Payment = {
        id: crypto.randomUUID(),
        amount,
        date: new Date().toISOString().split('T')[0],
      };
      const withPayment = { ...l, payments: [...l.payments, payment] };
      withPayment.status = computeStatus(withPayment);
      return withPayment;
    });
    updateLoans(updated);
  }, [updateLoans]);

  const markAsPaid = useCallback((loanId: string) => {
    const current = loadLoans();
    const updated = current.map(l => {
      if (l.id !== loanId) return l;
      const totalPaid = l.payments.reduce((s, p) => s + p.amount, 0);
      const remaining = l.amount - totalPaid;
      if (remaining <= 0) return { ...l, status: 'pago' as LoanStatus };
      const payment: Payment = {
        id: crypto.randomUUID(),
        amount: remaining,
        date: new Date().toISOString().split('T')[0],
      };
      return { ...l, payments: [...l.payments, payment], status: 'pago' as LoanStatus };
    });
    updateLoans(updated);
  }, [updateLoans]);

  const setMonthlyGoal = useCallback((month: string, target: number) => {
    const current = loadGoals();
    const existing = current.findIndex(g => g.month === month);
    let updated: MonthlyGoal[];
    if (existing >= 0) {
      updated = current.map((g, i) => i === existing ? { ...g, target } : g);
    } else {
      updated = [...current, { month, target }];
    }
    setGoals(updated);
    saveGoals(updated);
  }, []);

  const stats = useMemo(() => {
    const totalLent = loans.reduce((s, l) => s + l.amount, 0);
    const totalReceived = loans.reduce((s, l) => s + l.payments.reduce((ps, p) => ps + p.amount, 0), 0);
    const totalPending = totalLent - totalReceived;
    const overdue = loans.filter(l => l.status === 'atrasado').length;
    return { totalLent, totalReceived, totalPending, overdue };
  }, [loans]);

  const currentMonthGoal = useMemo(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return goals.find(g => g.month === month) || { month, target: 0 };
  }, [goals]);

  const currentMonthReceived = useMemo(() => {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return loans.reduce((total, l) =>
      total + l.payments
        .filter(p => p.date.startsWith(monthPrefix))
        .reduce((s, p) => s + p.amount, 0),
    0);
  }, [loans]);

  return {
    loans,
    stats,
    goals,
    currentMonthGoal,
    currentMonthReceived,
    addLoan,
    deleteLoan,
    addPayment,
    markAsPaid,
    setMonthlyGoal,
  };
}
