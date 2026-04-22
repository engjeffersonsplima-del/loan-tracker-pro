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

  it('saldo-based interest: 10% over 2 full cycles (60 days) — juros não pagos capitalizam', () => {
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(60),
      interest_rate: 10,
      interest_type: 'simples',
    });
    // C1: 1000*0.1=100 (saldo 1100). C2: 1100*0.1=110 (saldo 1210).
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1210);
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
    // C1 (normal): 1000*0.10=100 (saldo 1100). C2 (late): 1100*0.15=165 (saldo 1265).
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1265);
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
    // Sem atraso: C1 100 (saldo 1100), C2 110 (saldo 1210).
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1210);
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
    // 3 ciclos de 10% sobre saldo: 500->550->605->665.5
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(665.5);
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
      payments: [{ amount: 300, date: daysAgo(0) }],
    });
    const b = computeBalanceBreakdown(loan, NOW);
    // Sem pagamento intermediário: C1 100, C2 110 -> totalInterest 210.
    // Pagamento de 300: cobre 210 juros + 90 principal.
    expect(b.totalInterest).toBeCloseTo(210);
    expect(b.interestPaid).toBeCloseTo(210);
    expect(b.principalPaid).toBeCloseTo(90);
    expect(b.remaining).toBeCloseTo(910);
  });
});

describe('payments reduce future interest (saldo-based)', () => {
  it('R$5000 @ 8%/ciclo: pagamento entre ciclos reduz juros futuros', () => {
    // Loan 90 days ago. 8% per 30-day cycle = R$400 on R$5000.
    // After cycle 1 (60 days ago) borrower pays R$400 (juros) + R$2500 (principal).
    // Cycle 2 base = 2500 -> juros = 200. Cycle 3 base = 2500 -> juros = 200.
    const loan = makeLoan({
      amount: 5000,
      loan_date: daysAgo(90),
      interest_rate: 8,
      interest_type: 'simples',
      payments: [{ amount: 2900, date: daysAgo(60) }],
    });
    const cycles = computeInterestCycles(loan, NOW).filter(c => c.status !== 'em_curso');
    expect(cycles).toHaveLength(3);
    expect(cycles[0].interestAmount).toBeCloseTo(400);
    expect(cycles[1].interestAmount).toBeCloseTo(200);
    expect(cycles[2].interestAmount).toBeCloseTo(200);
    // Total interest 800; total devido 5800; pago 2900 -> saldo 2900.
    // (Principal restante 2500 + 200 juros ciclo2 + 200 juros ciclo3 = 2900)
    const b = computeBalanceBreakdown(loan, NOW);
    expect(b.totalInterest).toBeCloseTo(800);
    expect(b.remaining).toBeCloseTo(2900);
  });

  it('sem pagamentos parciais: juros continuam sobre principal cheio', () => {
    const loan = makeLoan({
      amount: 5000,
      loan_date: daysAgo(90),
      interest_rate: 8,
      interest_type: 'simples',
      payments: [],
    });
    const cycles = computeInterestCycles(loan, NOW).filter(c => c.status !== 'em_curso');
    // Saldo-based (juros não pagos capitalizam): 5000->5400->5832->6298.56
    expect(cycles[0].interestAmount).toBeCloseTo(400);
    expect(cycles[1].interestAmount).toBeCloseTo(432);
    expect(cycles[2].interestAmount).toBeCloseTo(466.56);
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
    // Loan1 (1000, 60d, 10%): saldo 1210 (C1 100 + C2 110). Pagamento 200 hoje
    //   abate juros -> remaining = 1210-200 = 1010 (saldo) mas totalOwed = 1210.
    // Loan2 (2000, 30d, 5%): C1 100 -> totalOwed 2100, remaining 2100.
    // Soma totalOwed = 3310. Pending = 3310-200 = 3110.
    expect(stats.totalOwedWithInterest).toBeCloseTo(3310);
    expect(stats.totalPending).toBeCloseTo(3110);
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
