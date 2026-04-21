export interface LoanLike {
  amount: number;
  loan_date: string;
  due_date: string | null;
  status: string;
  interest_rate: number;
  late_interest_rate: number;
  interest_type?: string;
  payments: { amount: number }[];
}

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Total owed for a single loan, including accrued interest in 30-day cycles.
 * Late bonus rate is added when past due_date.
 * For paid loans, returns the total actually received.
 */
export function computeLoanOwed(loan: LoanLike, now: number = Date.now()): number {
  const start = new Date(loan.loan_date).getTime();
  const days = Math.max(0, Math.floor((now - start) / DAY_MS));
  const months = Math.floor(days / 30);
  const due = loan.due_date ? new Date(loan.due_date).getTime() : null;
  const isOverdue = due ? now > due : false;
  const monthlyRate = (loan.interest_rate || 0) / 100;
  const lateBonus = isOverdue ? (loan.late_interest_rate || 0) / 100 : 0;
  const rate = monthlyRate + lateBonus;
  const totalWithInterest = loan.interest_type === 'composto'
    ? loan.amount * Math.pow(1 + rate, months)
    : loan.amount * (1 + rate * months);
  if (loan.status === 'pago') {
    return loan.payments.reduce((s, p) => s + p.amount, 0);
  }
  return totalWithInterest;
}

export function computeLoansStats(loans: LoanLike[], now: number = Date.now()) {
  const totalLent = loans.reduce((s, l) => s + l.amount, 0);
  const totalReceived = loans.reduce(
    (s, l) => s + l.payments.reduce((ps, p) => ps + p.amount, 0),
    0
  );
  const totalOwedWithInterest = loans.reduce(
    (s, l) => s + computeLoanOwed(l, now),
    0
  );
  const totalPending = Math.max(0, totalOwedWithInterest - totalReceived);
  const overdue = loans.filter(l => l.status === 'atrasado').length;
  return { totalLent, totalReceived, totalPending, overdue, totalOwedWithInterest };
}