import { describe, it, expect } from 'vitest';
import { computeLoanOwed, computeLoansStats, type LoanLike } from './loanCalculations';

// Fixed "now" to make tests deterministic
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

  it('simple interest: 10% over 2 months (60 days)', () => {
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(60),
      interest_rate: 10,
      interest_type: 'simples',
    });
    // 1000 * (1 + 0.10 * 2) = 1200
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1200);
  });

  it('compound interest: 10% over 2 months', () => {
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(60),
      interest_rate: 10,
      interest_type: 'composto',
    });
    // 1000 * 1.10^2 = 1210
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1210);
  });

  it('does not accrue interest until 30 days have passed', () => {
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(29),
      interest_rate: 10,
      interest_type: 'simples',
    });
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1000);
  });

  it('applies late bonus rate when overdue (simple)', () => {
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(60),
      due_date: daysAgo(10),
      interest_rate: 10,
      late_interest_rate: 5,
      interest_type: 'simples',
    });
    // rate = 15% * 2 months => 1000 * (1 + 0.15*2) = 1300
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1300);
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

  it('paid loans return total paid, not principal+interest', () => {
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(90),
      status: 'pago',
      interest_rate: 10,
      interest_type: 'simples',
      payments: [{ amount: 1300 }],
    });
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1300);
  });

  it('indefinite term (no due_date) still accrues interest', () => {
    const loan = makeLoan({
      amount: 500,
      loan_date: daysAgo(90),
      due_date: null,
      interest_rate: 10,
      interest_type: 'simples',
    });
    // 500 * (1 + 0.1 * 3) = 650
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(650);
  });
});

describe('computeLoansStats', () => {
  it('aggregates totals across multiple loans with partial payments', () => {
    const loans: LoanLike[] = [
      makeLoan({
        amount: 1000,
        loan_date: daysAgo(60),
        interest_rate: 10,
        interest_type: 'simples',
        payments: [{ amount: 200 }],
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
    // loan1: 1200, loan2: 2000*(1+0.05*1)=2100 => 3300
    expect(stats.totalOwedWithInterest).toBeCloseTo(3300);
    // pending = 3300 - 200 = 3100
    expect(stats.totalPending).toBeCloseTo(3100);
  });

  it('totalPending subtracts payments from total owed with interest', () => {
    const loans: LoanLike[] = [
      makeLoan({
        amount: 1000,
        loan_date: daysAgo(60),
        interest_rate: 10,
        interest_type: 'composto',
        payments: [{ amount: 500 }, { amount: 100 }],
      }),
    ];
    const stats = computeLoansStats(loans, NOW);
    // owed: 1000*1.1^2 = 1210, received: 600, pending: 610
    expect(stats.totalOwedWithInterest).toBeCloseTo(1210);
    expect(stats.totalReceived).toBe(600);
    expect(stats.totalPending).toBeCloseTo(610);
  });

  it('never returns negative pending (overpaid scenario)', () => {
    const loans: LoanLike[] = [
      makeLoan({
        amount: 1000,
        loan_date: daysAgo(30),
        status: 'pago',
        payments: [{ amount: 1500 }],
      }),
    ];
    const stats = computeLoansStats(loans, NOW);
    expect(stats.totalPending).toBe(0);
  });

  it('counts only loans with status atrasado as overdue', () => {
    const loans: LoanLike[] = [
      makeLoan({ status: 'atrasado' }),
      makeLoan({ status: 'em_dia' }),
      makeLoan({ status: 'atrasado' }),
      makeLoan({ status: 'pago' }),
    ];
    expect(computeLoansStats(loans, NOW).overdue).toBe(2);
  });

  it('mixed paid + active: paid loan contributes only its received amount', () => {
    const loans: LoanLike[] = [
      makeLoan({
        amount: 1000,
        loan_date: daysAgo(60),
        status: 'pago',
        interest_rate: 10,
        payments: [{ amount: 1200 }],
      }),
      makeLoan({
        amount: 500,
        loan_date: daysAgo(30),
        interest_rate: 10,
        interest_type: 'simples',
      }),
    ];
    const stats = computeLoansStats(loans, NOW);
    // paid: 1200, active: 550 => total 1750
    expect(stats.totalOwedWithInterest).toBeCloseTo(1750);
    expect(stats.totalReceived).toBe(1200);
    // pending = 1750 - 1200 = 550
    expect(stats.totalPending).toBeCloseTo(550);
  });

  it('compound + late bonus combined', () => {
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
    // rate = 15%, 3 months => 1000 * 1.15^3 = 1520.875
    expect(stats.totalOwedWithInterest).toBeCloseTo(1520.875, 2);
  });
});