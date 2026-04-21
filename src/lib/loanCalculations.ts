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
  /** Principal outstanding at the start of this cycle (after prior payments). */
  principalBase?: number;
}

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Compute interest cycles (30-day periods) since loan start.
 *
 * Each cycle's interest is calculated on the CURRENT outstanding principal at
 * the start of that cycle. Payments are processed chronologically and applied
 * in order: (1) accrued interest from completed cycles, (2) remaining principal.
 * This guarantees that when a borrower pays down principal, future cycles
 * accrue LESS interest — never a fixed amount based on the original loan.
 *
 * Compound mode capitalizes any unpaid interest into the principal base.
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

  // Sort payments chronologically (older first).
  const payments = [...loan.payments]
    .map(p => ({ amount: p.amount, ts: new Date(p.date).getTime() }))
    .sort((a, b) => a.ts - b.ts);

  let principal = loan.amount;
  let unpaidInterest = 0; // for compound mode capitalization
  let pendingInterestForAlloc = 0; // accrued interest not yet covered by payments

  for (let i = 0; i < completedCycles; i++) {
    const cStart = start + i * 30 * DAY_MS;
    const cEnd = start + (i + 1) * 30 * DAY_MS;
    const isLate = due !== null && cEnd > due;
    const rate = monthlyRate + (isLate ? lateBonus : 0);
    const base = isCompound ? principal + unpaidInterest : principal;
    const interest = base * rate;

    cycles.push({
      cycleNumber: i + 1,
      startDate: new Date(cStart).toISOString().split('T')[0],
      endDate: new Date(cEnd).toISOString().split('T')[0],
      interestAmount: interest,
      status: 'pendente',
      isLate,
      principalBase: principal,
    });

    pendingInterestForAlloc += interest;

    // Apply any payments that occurred up through this cycle's end.
    while (payments.length && payments[0].ts <= cEnd) {
      let pay = payments.shift()!.amount;
      // 1) cover accrued interest first
      const interestCover = Math.min(pay, pendingInterestForAlloc);
      pendingInterestForAlloc -= interestCover;
      pay -= interestCover;
      // 2) remainder reduces principal
      if (pay > 0) {
        principal = Math.max(0, principal - pay);
      }
    }

    // For compound mode, any interest not yet paid capitalizes into base.
    unpaidInterest = isCompound ? pendingInterestForAlloc : 0;
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
      principalBase: principal,
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
