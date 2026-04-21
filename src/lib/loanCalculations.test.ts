import { describe, it, expect } from 'vitest';
import {
  computeLoanOwed,
  computeLoansStats,
  computeInterestCycles,
  computeInterestCyclesWithStatus,
  computeBalanceBreakdown,
  type LoanLike,
} from './loanCalculations';

const NOW = new Date('2026-04-21T12:00:00Z').getTime();

function daysAgo(n: number): string {
  return new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}
function daysFromNow(n: number): string {
  return new Date(NOW + n * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function makeLoan(overrides: Partial<LoanLike> = {}): LoanLike {
  return {
    amount: 1000,
    loan_date: daysAgo(0),
    due_date: null,
    status: 'em_dia',
    interest_rate: 0,
    late_interest_rate: 0,
    interest_type: 'simples',
    payments: [],
    ...overrides,
  };
}

describe('computeLoanOwed', () => {
  it('returns principal when no time and no interest', () => {
    const loan = makeLoan({ amount: 1000, loan_date: daysAgo(0) });
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1000);
  });

  it('simple interest: 10% over 2 full cycles (60 days)', () => {
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(60),
      interest_rate: 10,
      interest_type: 'simples',
    });
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1200);
  });

  it('compound interest: 10% over 2 full cycles', () => {
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(60),
      interest_rate: 10,
      interest_type: 'composto',
    });
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1210);
  });

  it('does NOT apply interest before 30 days complete (in-progress cycle)', () => {
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(29),
      interest_rate: 10,
      interest_type: 'simples',
    });
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1000);
  });

  it('applies late bonus only to cycles ending after due date', () => {
    // 60 days ago, due 30 days ago. Cycle 1 ends at day 30 (=30 days ago) — not > due, so normal.
    // Cycle 2 ends today — > due, late bonus.
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(60),
      due_date: daysAgo(30),
      interest_rate: 10,
      late_interest_rate: 5,
      interest_type: 'simples',
    });
    // Cycle1: 1000 * 0.10 = 100 (normal). Cycle2: 1000 * 0.15 = 150 (late). Total = 1250.
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1250);
  });

  it('does not apply late bonus when before due date', () => {
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(60),
      due_date: daysFromNow(10),
      interest_rate: 10,
      late_interest_rate: 5,
      interest_type: 'simples',
    });
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1200);
  });

  it('paid loans return total paid', () => {
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(90),
      status: 'pago',
      interest_rate: 10,
      payments: [{ amount: 1300, date: daysAgo(0) }],
    });
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1300);
  });

  it('indefinite term still accrues per-cycle interest', () => {
    const loan = makeLoan({
      amount: 500,
      loan_date: daysAgo(90),
      due_date: null,
      interest_rate: 10,
      interest_type: 'simples',
    });
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(650);
  });
});

describe('computeInterestCycles', () => {
  it('returns one in-progress cycle with 0 interest when under 30 days', () => {
    const loan = makeLoan({ loan_date: daysAgo(10), interest_rate: 10 });
    const cycles = computeInterestCycles(loan, NOW);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].status).toBe('em_curso');
    expect(cycles[0].interestAmount).toBe(0);
  });

  it('returns completed cycles + current in-progress cycle', () => {
    const loan = makeLoan({ loan_date: daysAgo(45), interest_rate: 10 });
    const cycles = computeInterestCycles(loan, NOW);
    expect(cycles).toHaveLength(2);
    expect(cycles[0].status).toBe('pendente');
    expect(cycles[0].interestAmount).toBeCloseTo(100);
    expect(cycles[1].status).toBe('em_curso');
  });

  it('marks cycles as late when ending after due date', () => {
    const loan = makeLoan({
      loan_date: daysAgo(90),
      due_date: daysAgo(45),
      interest_rate: 10,
      late_interest_rate: 5,
    });
    const cycles = computeInterestCycles(loan, NOW);
    // completed: 3 cycles ending at day 30, 60, 90 (i.e. 60,30,0 days ago)
    const completed = cycles.filter(c => c.status !== 'em_curso');
    expect(completed).toHaveLength(3);
    expect(completed[0].isLate).toBe(false); // ended 60 days ago, before due (45d ago)
    expect(completed[1].isLate).toBe(true); // ended 30 days ago, after due
    expect(completed[2].isLate).toBe(true);
  });
});

describe('computeInterestCyclesWithStatus', () => {
  it('marks cycles as pago when payments cover their interest in order', () => {
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(90),
      interest_rate: 10,
      interest_type: 'simples',
      // 3 completed cycles, each 100 interest. Paid 250 => first 2 cycles paid, 3rd pending (50 short).
      payments: [{ amount: 250, date: daysAgo(0) }],
    });
    const cycles = computeInterestCyclesWithStatus(loan, NOW);
    const completed = cycles.filter(c => c.status !== 'em_curso');
    expect(completed[0].status).toBe('pago');
    expect(completed[1].status).toBe('pago');
    expect(completed[2].status).toBe('pendente');
  });
});

describe('computeBalanceBreakdown', () => {
  it('allocates payments to interest first, then principal', () => {
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(60),
      interest_rate: 10,
      interest_type: 'simples',
      payments: [{ amount: 300, date: daysAgo(0) }], // 200 interest + 100 principal
    });
    const b = computeBalanceBreakdown(loan, NOW);
    expect(b.totalInterest).toBeCloseTo(200);
    expect(b.interestPaid).toBeCloseTo(200);
    expect(b.principalPaid).toBeCloseTo(100);
    expect(b.remaining).toBeCloseTo(900);
  });
});

describe('computeLoansStats', () => {
  it('aggregates totals with partial payments', () => {
    const loans: LoanLike[] = [
      makeLoan({
        amount: 1000,
        loan_date: daysAgo(60),
        interest_rate: 10,
        interest_type: 'simples',
        payments: [{ amount: 200, date: daysAgo(0) }],
      }),
      makeLoan({
        amount: 2000,
        loan_date: daysAgo(30),
        interest_rate: 5,
        interest_type: 'simples',
        payments: [],
      }),
    ];
    const stats = computeLoansStats(loans, NOW);
    expect(stats.totalLent).toBe(3000);
    expect(stats.totalReceived).toBe(200);
    expect(stats.totalOwedWithInterest).toBeCloseTo(3300);
    expect(stats.totalPending).toBeCloseTo(3100);
  });

  it('compound interest aggregation', () => {
    const loans: LoanLike[] = [
      makeLoan({
        amount: 1000,
        loan_date: daysAgo(60),
        interest_rate: 10,
        interest_type: 'composto',
        payments: [{ amount: 500, date: daysAgo(0) }, { amount: 100, date: daysAgo(0) }],
      }),
    ];
    const stats = computeLoansStats(loans, NOW);
    expect(stats.totalOwedWithInterest).toBeCloseTo(1210);
    expect(stats.totalPending).toBeCloseTo(610);
  });

  it('never negative pending', () => {
    const loans: LoanLike[] = [
      makeLoan({
        amount: 1000,
        loan_date: daysAgo(30),
        status: 'pago',
        payments: [{ amount: 1500, date: daysAgo(0) }],
      }),
    ];
    expect(computeLoansStats(loans, NOW).totalPending).toBe(0);
  });

  it('counts only atrasado loans as overdue', () => {
    const loans: LoanLike[] = [
      makeLoan({ status: 'atrasado' }),
      makeLoan({ status: 'em_dia' }),
      makeLoan({ status: 'atrasado' }),
      makeLoan({ status: 'pago' }),
    ];
    expect(computeLoansStats(loans, NOW).overdue).toBe(2);
  });

  it('compound + late bonus per-cycle', () => {
    // 90 days ago, due 30 days ago. Cycles end at day 30,60,90 (60,30,0 days ago).
    // Cycle1 (ended 60d ago, before due): rate 10% -> 1000*1.10 = 1100
    // Cycle2 (ended 30d ago, == due, not >): rate 10% -> 1100*1.10 = 1210
    // Actually due_date === cycle2 end, cEnd > due is false. Cycle3 late: 1210*1.15 = 1391.5
    const loans: LoanLike[] = [
      makeLoan({
        amount: 1000,
        loan_date: daysAgo(90),
        due_date: daysAgo(30),
        interest_rate: 10,
        late_interest_rate: 5,
        interest_type: 'composto',
      }),
    ];
    const stats = computeLoansStats(loans, NOW);
    expect(stats.totalOwedWithInterest).toBeCloseTo(1391.5, 1);
  });
});
