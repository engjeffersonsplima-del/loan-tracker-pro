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

  it('principal-based interest: 10% over 2 full cycles (60 days) — juros NÃO capitalizam', () => {
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(60),
      interest_rate: 10,
      interest_type: 'simples',
    });
    // C1: 1000*0.1=100. C2: 1000*0.1=100 (base = principal). Total devido = 1200.
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1200);
  });

  it('compound interest: 10% over 2 full cycles', () => {
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(60),
      interest_rate: 10,
      interest_type: 'composto',
    });
    // Mesma regra: juros sempre sobre principal restante.
    expect(computeLoanOwed(loan, NOW)).toBeCloseTo(1200);
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
    const loan = makeLoan({
      amount: 1000,
      loan_date: daysAgo(60),
      due_date: daysAgo(30),
      interest_rate: 10,
      late_interest_rate: 5,
      interest_type: 'simples',
    });
    // C1 (normal): 1000*0.10=100. C2 (late): 1000*0.15=150. Total devido = 1250.
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
    // Sem atraso: C1 100, C2 100 -> 1200.
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
    // 3 ciclos de 10% sobre principal 500: 50*3 = 150 -> total 650.
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

  it('applies payment to due cycles in chronological order', () => {
    const loan = makeLoan({
      amount: 5000,
      loan_date: daysAgo(21),
      cycle_period: 'semanal',
      interest_rate: 8,
      interest_type: 'simples',
      payments: [{ amount: 2900, date: daysAgo(14) }],
    });
    const cycles = computeInterestCyclesWithStatus(loan, NOW).filter(c => c.status !== 'em_curso');
    expect(cycles).toHaveLength(3);
    expect(cycles[0].status).toBe('pago');
    expect(cycles[1].status).toBe('pago');
    expect(cycles[2].status).toBe('pendente');
  });

  it('does not count pending non-late cycles as overdue interest for indefinite loans', () => {
    const loan = makeLoan({
      amount: 1500,
      loan_date: '2025-05-16',
      due_date: null,
      status: 'em_dia',
      interest_rate: 20,
      late_interest_rate: 0,
      interest_type: 'simples',
      cycle_period: 'mensal',
      payments: [],
    });
    const overdueInterest = computeInterestCyclesWithStatus(loan, NOW)
      .filter(c => c.status === 'pendente' && c.isLate)
      .reduce((sum, c) => sum + c.interestAmount, 0);
    expect(overdueInterest).toBe(0);
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
    // Juros sempre sobre principal: C1 100, C2 100 -> totalInterest 200.
    // Pagamento de 300: cobre 200 juros + 100 principal -> remaining = 900+0 = 900.
    expect(b.totalInterest).toBeCloseTo(200);
    expect(b.interestPaid).toBeCloseTo(200);
    expect(b.principalPaid).toBeCloseTo(100);
    expect(b.remaining).toBeCloseTo(900);
  });
});

describe('payments reduce future interest (principal-based)', () => {
  it('R$5000 @ 8%/ciclo: pagamento entre ciclos reduz juros futuros', () => {
    const loan = makeLoan({
      amount: 5000,
      loan_date: daysAgo(21),
      cycle_period: 'semanal',
      interest_rate: 8,
      interest_type: 'simples',
      payments: [{ amount: 2900, date: daysAgo(14) }],
    });
    const cycles = computeInterestCycles(loan, NOW).filter(c => c.status !== 'em_curso');
    expect(cycles).toHaveLength(3);
    // C1: 5000*0.08=400. Pgto 2900 cobre 400 juros + 2500 principal -> principal=2500.
    // C2: 2500*0.08=200. C3: 2500*0.08=200 (juros não capitalizam).
    expect(cycles[0].interestAmount).toBeCloseTo(400);
    expect(cycles[1].interestAmount).toBeCloseTo(200);
    expect(cycles[2].interestAmount).toBeCloseTo(200);
    const b = computeBalanceBreakdown(loan, NOW);
    expect(b.totalInterest).toBeCloseTo(800);
    // remaining = principal 2500 + juros pendentes (C2+C3=400) = 2900.
    expect(b.remaining).toBeCloseTo(2900);
  });

  it('sem pagamentos parciais: juros continuam sobre principal cheio', () => {
    const loan = makeLoan({
      amount: 5000,
      loan_date: daysAgo(21),
      cycle_period: 'semanal',
      interest_rate: 8,
      interest_type: 'simples',
      payments: [],
    });
    const cycles = computeInterestCycles(loan, NOW).filter(c => c.status !== 'em_curso');
    // Principal-based (não capitaliza): 400, 400, 400.
    expect(cycles[0].interestAmount).toBeCloseTo(400);
    expect(cycles[1].interestAmount).toBeCloseTo(400);
    expect(cycles[2].interestAmount).toBeCloseTo(400);
  });
});

describe('computeLoansStats', () => {
  it('aggregates totals with partial payments', () => {
    const loans: LoanLike[] = [
      makeLoan({
        amount: 1000,
        loan_date: daysAgo(14),
        cycle_period: 'semanal',
        interest_rate: 10,
        interest_type: 'simples',
        payments: [{ amount: 200, date: daysAgo(0) }],
      }),
      makeLoan({
        amount: 2000,
        loan_date: daysAgo(7),
        cycle_period: 'semanal',
        interest_rate: 5,
        interest_type: 'simples',
        payments: [],
      }),
    ];
    const stats = computeLoansStats(loans, NOW);
    expect(stats.totalLent).toBe(3000);
    expect(stats.totalReceived).toBe(200);
    // Loan1 (1000, 60d, 10%): C1 100 + C2 100 = 200 juros -> totalOwed = 1200.
    // Loan2 (2000, 30d, 5%): C1 100 -> totalOwed = 2100.
    // Soma totalOwed = 3300. Pending = 3300-200 = 3100.
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
    // Juros sobre principal: 100 + 100 = 200 -> totalOwed = 1200. Pago 600 -> pending 600.
    expect(stats.totalOwedWithInterest).toBeCloseTo(1200);
    expect(stats.totalPending).toBeCloseTo(600);
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
    // C1 (normal) 100, C2 (normal, due == cEnd) 100, C3 (late) 150 -> totalOwed = 1350.
    expect(stats.totalOwedWithInterest).toBeCloseTo(1350, 1);
  });
});
