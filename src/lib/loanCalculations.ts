export interface LoanLike {
  amount: number;
  loan_date: string;
  due_date: string | null;
  status: string;
  interest_rate: number;
  late_interest_rate: number;
  interest_type?: string;
  payments: { amount: number; date: string }[];
}

export interface InterestCycle {
  cycleNumber: number;
  startDate: string;
  endDate: string;
  interestAmount: number;
  status: 'pago' | 'pendente' | 'em_curso';
  isLate: boolean;
}

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Compute interest cycles (30-day periods) since loan start.
 * Only COMPLETED cycles accrue interest. Current (in-progress) cycle shows 0
 * unless overdue. Late bonus applies to cycles whose endDate > due_date.
 */
export function computeInterestCycles(loan: LoanLike, now: number = Date.now()): InterestCycle[] {
  const start = new Date(loan.loan_date).getTime();
  const due = loan.due_date ? new Date(loan.due_date).getTime() : null;
  const monthlyRate = (loan.interest_rate || 0) / 100;
  const lateBonus = (loan.late_interest_rate || 0) / 100;
  const isCompound = loan.interest_type === 'composto';

  const totalDays = Math.max(0, Math.floor((now - start) / DAY_MS));
  const completedCycles = Math.floor(totalDays / 30);
  const cycles: InterestCycle[] = [];

  let runningBase = loan.amount;
  for (let i = 0; i < completedCycles; i++) {
    const cStart = start + i * 30 * DAY_MS;
    const cEnd = start + (i + 1) * 30 * DAY_MS;
    const isLate = due !== null && cEnd > due;
    const rate = monthlyRate + (isLate ? lateBonus : 0);
    const interest = runningBase * rate;
    if (isCompound) runningBase += interest;
    cycles.push({
      cycleNumber: i + 1,
      startDate: new Date(cStart).toISOString().split('T')[0],
      endDate: new Date(cEnd).toISOString().split('T')[0],
      interestAmount: interest,
      status: 'pendente',
      isLate,
    });
  }

  // Current in-progress cycle (informational, zero interest until it completes)
  if (totalDays % 30 !== 0 || completedCycles === 0) {
    const cStart = start + completedCycles * 30 * DAY_MS;
    const cEnd = cStart + 30 * DAY_MS;
    const isLate = due !== null && now > due;
    cycles.push({
      cycleNumber: completedCycles + 1,
      startDate: new Date(cStart).toISOString().split('T')[0],
      endDate: new Date(cEnd).toISOString().split('T')[0],
      interestAmount: 0,
      status: 'em_curso',
      isLate,
    });
  }

  return cycles;
}

/**
 * Total owed TODAY: principal + sum of interest from COMPLETED cycles only.
 * The in-progress cycle does not yet contribute interest.
 */
export function computeLoanOwed(loan: LoanLike, now: number = Date.now()): number {
  if (loan.status === 'pago') {
    return loan.payments.reduce((s, p) => s + p.amount, 0);
  }
  const cycles = computeInterestCycles(loan, now);
  const totalInterest = cycles
    .filter(c => c.status !== 'em_curso')
    .reduce((s, c) => s + c.interestAmount, 0);
  return loan.amount + totalInterest;
}

/**
 * Remaining balance: pagamentos abatem juros pendentes primeiro, depois principal.
 * Returns { remaining, interestPaid, principalPaid, totalInterest }.
 */
export function computeBalanceBreakdown(loan: LoanLike, now: number = Date.now()) {
  const totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0);
  const cycles = computeInterestCycles(loan, now);
  const totalInterest = cycles
    .filter(c => c.status !== 'em_curso')
    .reduce((s, c) => s + c.interestAmount, 0);
  const totalOwed = loan.amount + totalInterest;
  const interestPaid = Math.min(totalPaid, totalInterest);
  const principalPaid = Math.max(0, totalPaid - totalInterest);
  const remaining = Math.max(0, totalOwed - totalPaid);
  return { remaining, interestPaid, principalPaid, totalInterest, totalOwed, totalPaid };
}

/**
 * Annotate cycles with paid/pendente status based on totalPaid allocation.
 * Pagamentos abatem ciclos em ordem cronol\u00f3gica.
 */
export function computeInterestCyclesWithStatus(loan: LoanLike, now: number = Date.now()): InterestCycle[] {
  const cycles = computeInterestCycles(loan, now);
  const totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0);
  let remainingPayment = totalPaid;
  return cycles.map(c => {
    if (c.status === 'em_curso') return c;
    if (remainingPayment >= c.interestAmount) {
      remainingPayment -= c.interestAmount;
      return { ...c, status: 'pago' as const };
    }
    return c;
  });
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
