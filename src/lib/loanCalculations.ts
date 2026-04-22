export interface LoanLike {
  amount: number;
  loan_date: string;
  due_date: string | null;
  status: string;
  interest_rate: number;
  late_interest_rate: number;
  interest_type?: string;
  /** Período de cobrança de juros: 'mensal' (30 dias) ou 'semanal' (7 dias). Default: 'mensal'. */
  cycle_period?: 'mensal' | 'semanal' | string;
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

/** Retorna o tamanho do ciclo em dias com base em loan.cycle_period. */
export function getCycleDays(loan: Pick<LoanLike, 'cycle_period'>): number {
  return loan.cycle_period === 'semanal' ? 7 : 30;
}

export interface LoanComputationEvent {
  type: 'juros' | 'pagamento';
  date: string;
  /** For 'juros': interest accrued in this period. For 'pagamento': total paid. */
  amount: number;
  /** Saldo devedor (principal + juros pendentes) usado como base do cálculo. */
  saldoBase?: number;
  /** Pagamento: parcela aplicada a juros. */
  pagoJuros?: number;
  /** Pagamento: parcela aplicada a principal. */
  pagoPrincipal?: number;
  /** Saldo devedor após o evento. */
  saldoApos: number;
  isLate?: boolean;
}

export interface LoanComputationResult {
  valorInicial: number;
  totalPago: number;
  /** Principal restante (não inclui juros pendentes). */
  principalRestante: number;
  /** Juros acumulados ainda não pagos. */
  jurosAcumulado: number;
  /** Saldo devedor total = principalRestante + jurosAcumulado. */
  saldoDevedor: number;
  totalJurosCobrados: number;
  totalJurosPagos: number;
  totalPrincipalPago: number;
  historico: LoanComputationEvent[];
}

/**
 * Motor de cálculo orientado a eventos (cronológico).
 *
 * Regra (definida pelo usuário):
 * - Os juros do mês incidem SEMPRE sobre o PRINCIPAL RESTANTE (valor emprestado
 *   ainda não amortizado), nunca sobre juros acumulados. Juros não pagos NÃO
 *   capitalizam — ficam apenas como dívida pendente.
 * - "Juros acumulado" é só uma referência informativa do total devido em juros.
 * - "Valor devido hoje" / "saldo devedor" = principal restante + juros pendentes.
 * - Pagamentos abatem primeiro os juros pendentes e depois o principal,
 *   reduzindo simultaneamente o saldo devedor e o valor devido hoje.
 * - Pagar parte do principal reduz os juros dos próximos ciclos (porque a base
 *   diminuiu), mas dentro de um ciclo a base é o principal vivo no início dele.
 */
export function calcularEmprestimoCompleto(
  loan: LoanLike,
  now: number = Date.now()
): LoanComputationResult {
  const periodoDias = 30;
  const monthlyRate = (loan.interest_rate || 0) / 100;
  const lateBonus = (loan.late_interest_rate || 0) / 100;
  const due = loan.due_date ? new Date(loan.due_date).getTime() : null;

  let principal = loan.amount;
  let jurosAcumulado = 0;
  let totalJurosCobrados = 0;
  let totalJurosPagos = 0;
  let totalPrincipalPago = 0;
  const historico: LoanComputationEvent[] = [];

  const eventos = [
    ...loan.payments.map(p => ({
      type: 'pagamento' as const,
      ts: new Date(p.date).getTime(),
      amount: p.amount,
    })),
  ].sort((a, b) => a.ts - b.ts);
  eventos.push({ type: 'pagamento' as const, ts: now, amount: 0 }); // marca "hoje"
  // O último evento serve só para acumular juros até hoje; o pagamento=0 é no-op.

  let cursor = new Date(loan.loan_date).getTime();

  for (let i = 0; i < eventos.length; i++) {
    const ev = eventos[i];
    const diffDias = Math.max(0, (ev.ts - cursor) / DAY_MS);
    const periodos = Math.floor(diffDias / periodoDias);

    for (let p = 0; p < periodos; p++) {
      const periodEnd = cursor + periodoDias * DAY_MS;
      const isLate = due !== null && periodEnd > due;
      // Base = apenas o principal restante (juros não capitalizam).
      const base = principal;
      const rate = monthlyRate + (isLate ? lateBonus : 0);
      const juros = base * rate;
      jurosAcumulado += juros;
      totalJurosCobrados += juros;
      historico.push({
        type: 'juros',
        date: new Date(periodEnd).toISOString(),
        amount: juros,
        saldoBase: base,
        saldoApos: principal + jurosAcumulado,
        isLate,
      });
      cursor = periodEnd;
    }

    if (ev.type === 'pagamento' && ev.amount > 0) {
      let restante = ev.amount;
      const pagoJuros = Math.min(restante, jurosAcumulado);
      jurosAcumulado -= pagoJuros;
      totalJurosPagos += pagoJuros;
      restante -= pagoJuros;
      const pagoPrincipal = Math.min(restante, principal);
      principal -= pagoPrincipal;
      totalPrincipalPago += pagoPrincipal;
      historico.push({
        type: 'pagamento',
        date: new Date(ev.ts).toISOString(),
        amount: ev.amount,
        pagoJuros,
        pagoPrincipal,
        saldoApos: principal + jurosAcumulado,
      });
      cursor = ev.ts;
    }
  }

  const totalPago = loan.payments.reduce((s, p) => s + p.amount, 0);
  return {
    valorInicial: loan.amount,
    totalPago,
    principalRestante: principal,
    jurosAcumulado,
    saldoDevedor: principal + jurosAcumulado,
    totalJurosCobrados,
    totalJurosPagos,
    totalPrincipalPago,
    historico,
  };
}

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
  const totalDays = Math.max(0, Math.floor((now - start) / DAY_MS));
  const completedCycles = Math.floor(totalDays / 30);

  // Reproduz os ciclos completos calculados pelo motor orientado a eventos,
  // garantindo base de cálculo sobre saldo vivo (principal + juros pendentes).
  const periodEvents: { ts: number; juros: number; saldoBase: number; isLate: boolean }[] = [];
  // Mini-replay focado apenas em períodos completos:
  const monthlyRate = (loan.interest_rate || 0) / 100;
  const lateBonus = (loan.late_interest_rate || 0) / 100;
  const sortedPayments = [...loan.payments]
    .map(p => ({ ts: new Date(p.date).getTime(), amount: p.amount }))
    .sort((a, b) => a.ts - b.ts);

  let principal = loan.amount;
  let pendingInterest = 0;
  let payIdx = 0;

  for (let i = 0; i < completedCycles; i++) {
    const cStart = start + i * 30 * DAY_MS;
    const cEnd = start + (i + 1) * 30 * DAY_MS;
    const isLate = due !== null && cEnd > due;
    // Base = apenas o principal restante (juros NÃO capitalizam).
    const base = principal;
    const rate = monthlyRate + (isLate ? lateBonus : 0);
    const juros = base * rate;
    pendingInterest += juros;
    periodEvents.push({ ts: cEnd, juros, saldoBase: base, isLate });

    // aplica pagamentos cujas datas caem até o fim do ciclo
    while (payIdx < sortedPayments.length && sortedPayments[payIdx].ts <= cEnd) {
      let pay = sortedPayments[payIdx].amount;
      const intCover = Math.min(pay, pendingInterest);
      pendingInterest -= intCover;
      pay -= intCover;
      if (pay > 0) {
        principal = Math.max(0, principal - pay);
      }
      payIdx++;
    }
  }

  const cycles: InterestCycle[] = periodEvents.map((e, i) => ({
    cycleNumber: i + 1,
    startDate: new Date(start + i * 30 * DAY_MS).toISOString().split('T')[0],
    endDate: new Date(e.ts).toISOString().split('T')[0],
    interestAmount: e.juros,
    status: 'pendente',
    isLate: e.isLate,
    principalBase: e.saldoBase,
  }));

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
      principalBase: principal + pendingInterest,
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
 * Remaining balance, computed from per-cycle accrual on the live principal.
 * Pagamentos abatem juros do ciclo primeiro (cronologicamente), depois principal.
 * Returns { remaining, interestPaid, principalPaid, totalInterest, totalOwed, totalPaid }.
 */
export function computeBalanceBreakdown(loan: LoanLike, now: number = Date.now()) {
  const r = calcularEmprestimoCompleto(loan, now);
  return {
    remaining: r.saldoDevedor,
    interestPaid: r.totalJurosPagos,
    principalPaid: r.totalPrincipalPago,
    totalInterest: r.totalJurosCobrados,
    totalOwed: loan.amount + r.totalJurosCobrados,
    totalPaid: r.totalPago,
  };
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
