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

/**
 * Parse a date string (YYYY-MM-DD or DD/MM/YYYY) as a LOCAL date at 00:00.
 * Avoids the UTC shift of `new Date("2025-06-14")` which renders as the
 * previous day in negative UTC offsets (e.g. GMT-3 → 13/06/2025).
 */
function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const dmy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let y = parseInt(dmy[3]);
    if (y < 100) y += 2000;
    return new Date(y, parseInt(dmy[2]) - 1, parseInt(dmy[1]));
  }
  return new Date(dateStr);
}

/** Format a timestamp as YYYY-MM-DD using local time (no UTC shift). */
function toLocalISO(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Retorna o tamanho do ciclo em dias com base em loan.cycle_period. */
export function getCycleDays(loan: Pick<LoanLike, 'cycle_period'>): number {
  return loan.cycle_period === 'semanal' ? 7 : 30;
}

/**
 * Avança `n` ciclos a partir de `startTs`, respeitando o tipo de período:
 * - 'semanal': soma exatos 7*n dias.
 * - 'mensal': soma `n` MESES de calendário, mantendo o mesmo dia. Quando o
 *   mês destino não tem aquele dia (ex.: 31/01 em fevereiro), pula para
 *   o dia 1 do mês seguinte (ex.: 01/03), conforme regra de negócio.
 * Retorna timestamp local 00:00.
 */
export function addCycles(
  startTs: number,
  n: number,
  cyclePeriod?: string,
): number {
  if (cyclePeriod === 'semanal') {
    return startTs + n * 7 * DAY_MS;
  }
  const d = new Date(startTs);
  const baseDay = d.getDate();
  const totalMonth = d.getMonth() + n;
  const targetYear = d.getFullYear() + Math.floor(totalMonth / 12);
  const targetMonth = ((totalMonth % 12) + 12) % 12;
  const daysInTarget = new Date(targetYear, targetMonth + 1, 0).getDate();
  if (baseDay <= daysInTarget) {
    return new Date(targetYear, targetMonth, baseDay).getTime();
  }
  return new Date(targetYear, targetMonth + 1, 1).getTime();
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
  const monthlyRate = (loan.interest_rate || 0) / 100;
  const lateBonus = (loan.late_interest_rate || 0) / 100;
  const due = loan.due_date ? parseLocalDate(loan.due_date).getTime() : null;

  let principal = loan.amount;
  let jurosAcumulado = 0;
  let totalJurosCobrados = 0;
  let totalJurosPagos = 0;
  let totalPrincipalPago = 0;
  const historico: LoanComputationEvent[] = [];

  const eventos = [
    ...loan.payments.map(p => ({
      type: 'pagamento' as const,
      ts: parseLocalDate(p.date).getTime(),
      amount: p.amount,
    })),
  ].sort((a, b) => a.ts - b.ts);
  eventos.push({ type: 'pagamento' as const, ts: now, amount: 0 }); // marca "hoje"
  // O último evento serve só para acumular juros até hoje; o pagamento=0 é no-op.

  const startTs = parseLocalDate(loan.loan_date).getTime();
  let cursor = startTs;
  let cyclesElapsed = 0;

  for (let i = 0; i < eventos.length; i++) {
    const ev = eventos[i];
    // Fecha quantos ciclos couberem até este evento (semanal=7d, mensal=mês de calendário).
    while (true) {
      const periodEnd = addCycles(startTs, cyclesElapsed + 1, loan.cycle_period);
      if (periodEnd > ev.ts) break;
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
      cyclesElapsed += 1;
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
  const start = parseLocalDate(loan.loan_date).getTime();
  const due = loan.due_date ? parseLocalDate(loan.due_date).getTime() : null;
  const cycleDays = getCycleDays(loan);
  const totalDays = Math.max(0, Math.floor((now - start) / DAY_MS));
  const completedCycles = Math.floor(totalDays / cycleDays);

  // Reproduz os ciclos completos calculados pelo motor orientado a eventos,
  // garantindo base de cálculo sobre saldo vivo (principal + juros pendentes).
  const periodEvents: { ts: number; juros: number; saldoBase: number; isLate: boolean }[] = [];
  // Mini-replay focado apenas em períodos completos:
  const monthlyRate = (loan.interest_rate || 0) / 100;
  const lateBonus = (loan.late_interest_rate || 0) / 100;
  const sortedPayments = [...loan.payments]
    .map(p => ({ ts: parseLocalDate(p.date).getTime(), amount: p.amount }))
    .sort((a, b) => a.ts - b.ts);

  let principal = loan.amount;
  let pendingInterest = 0;
  let payIdx = 0;

  for (let i = 0; i < completedCycles; i++) {
    const cStart = start + i * cycleDays * DAY_MS;
    const cEnd = start + (i + 1) * cycleDays * DAY_MS;
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
    startDate: toLocalISO(start + i * cycleDays * DAY_MS),
    endDate: toLocalISO(e.ts),
    interestAmount: e.juros,
    status: 'pendente',
    isLate: e.isLate,
    principalBase: e.saldoBase,
  }));

  if (totalDays % cycleDays !== 0 || completedCycles === 0) {
    const cStart = start + completedCycles * cycleDays * DAY_MS;
    const cEnd = cStart + cycleDays * DAY_MS;
    const isLate = due !== null && now > due;
    cycles.push({
      cycleNumber: completedCycles + 1,
      startDate: toLocalISO(cStart),
      endDate: toLocalISO(cEnd),
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
