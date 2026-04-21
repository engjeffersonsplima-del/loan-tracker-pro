import { useState, useMemo, useEffect } from 'react';
import { Loan } from '@/types/loan';
import { StatusBadge } from './StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Trash2, CheckCircle, Percent, Edit, Infinity as InfinityIcon, History, RotateCcw, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { computeInterestCyclesWithStatus, computeBalanceBreakdown, type LoanLike } from '@/lib/loanCalculations';
import { toast } from 'sonner';

interface LoanDetailProps {
  loan: Loan;
  onBack: () => void;
  onAddPayment: (loanId: string, amount: number) => void;
  onMarkPaid: (loanId: string) => void;
  onDelete: (loanId: string) => void;
  onEdit: (loan: Loan) => void;
  onUpdateStatus?: (loanId: string, status: string) => void;
  onUpdatePayment?: (paymentId: string, data: { amount?: number; date?: string }) => void;
  onDeletePayment?: (paymentId: string) => void;
  onRecalculate?: () => void | Promise<void>;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function LoanDetail({ loan, onBack, onAddPayment, onMarkPaid, onDelete, onEdit, onUpdateStatus, onUpdatePayment, onDeletePayment, onRecalculate }: LoanDetailProps) {
  const [payAmount, setPayAmount] = useState('');
  const [recalcTick, setRecalcTick] = useState(0);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const overrideKey = `loan-cycle-overrides:${loan.id}`;
  type CycleOverride = { amount?: number; startDate?: string; status?: 'pago' | 'pendente' };
  const [cycleOverrides, setCycleOverrides] = useState<Record<number, CycleOverride>>(() => {
    try {
      const raw = localStorage.getItem(overrideKey);
      const parsed = raw ? JSON.parse(raw) : {};
      // Migrate legacy format: { [n]: number } -> { [n]: { amount: number } }
      const migrated: Record<number, CycleOverride> = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'number') migrated[Number(k)] = { amount: v };
        else if (v && typeof v === 'object') migrated[Number(k)] = v as CycleOverride;
      });
      return migrated;
    } catch {
      return {};
    }
  });
  const [editingCycle, setEditingCycle] = useState<number | null>(null);
  const [editCycleAmount, setEditCycleAmount] = useState('');
  const [editCycleDate, setEditCycleDate] = useState('');
  useEffect(() => {
    try { localStorage.setItem(overrideKey, JSON.stringify(cycleOverrides)); } catch {}
  }, [cycleOverrides, overrideKey]);
  const totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0);

  const { remaining, totalWithInterest, completedCycles, accruedInterest, isOverdue, cycles, lateCyclesCount, interestPaid, principalPaid } = useMemo(() => {
    const loanLike: LoanLike = {
      amount: loan.amount,
      loan_date: loan.loanDate,
      due_date: loan.dueDate || null,
      status: loan.status,
      interest_rate: loan.interestRate,
      late_interest_rate: loan.lateInterestRate,
      interest_type: loan.interestType,
      payments: loan.payments.map(p => ({ amount: p.amount, date: p.date })),
    };
    const rawCycles = computeInterestCyclesWithStatus(loanLike);
    const DAY_MS = 1000 * 60 * 60 * 24;
    const due = loan.dueDate ? new Date(loan.dueDate).getTime() : null;
    const monthlyRate = (loan.interestRate || 0) / 100;
    const lateBonus = (loan.lateInterestRate || 0) / 100;
    // Start from base cycles, then cascade dates from overrides.
    let cycles = rawCycles.map(c => ({ ...c }));
    for (let i = 0; i < cycles.length; i++) {
      const ov = cycleOverrides[cycles[i].cycleNumber];
      if (ov?.startDate) {
        const newStart = new Date(ov.startDate).getTime();
        cycles[i].startDate = new Date(newStart).toISOString().split('T')[0];
        cycles[i].endDate = new Date(newStart + 30 * DAY_MS).toISOString().split('T')[0];
        for (let j = i + 1; j < cycles.length; j++) {
          const s = newStart + (j - i) * 30 * DAY_MS;
          cycles[j].startDate = new Date(s).toISOString().split('T')[0];
          cycles[j].endDate = new Date(s + 30 * DAY_MS).toISOString().split('T')[0];
        }
      }
    }
    cycles = cycles.map(c => ({
      ...c,
      isLate: due !== null && new Date(c.endDate).getTime() > due,
    }));

    // Recompute interest cycle-by-cycle on the LIVE outstanding balance
    // (principal restante + juros acumulados ainda não pagos) na data do ciclo.
    // Aplica pagamentos cronologicamente: cobrem juros pendentes primeiro, depois principal.
    const sortedPayments = [...loan.payments]
      .map(p => ({ amount: p.amount, ts: new Date(p.date).getTime() }))
      .sort((a, b) => a.ts - b.ts);
    let payIdx = 0;
    let principal = loan.amount;
    let pendingInterest = 0;
    let interestPaidTotal = 0;
    let principalPaidTotal = 0;

    const cyclesStatused = cycles.map(c => {
      if (c.status === 'em_curso') {
        return { ...c, principalBase: principal };
      }
      const ov = cycleOverrides[c.cycleNumber];
      const cycleEnd = new Date(c.endDate).getTime();
      const base = principal + pendingInterest; // saldo devedor total na data do ciclo
      const rate = monthlyRate + (c.isLate ? lateBonus : 0);
      const computedInterest = base * rate;
      const interest = ov?.amount !== undefined ? ov.amount : computedInterest;
      pendingInterest += interest;

      // Apply payments up to this cycle end
      while (payIdx < sortedPayments.length && sortedPayments[payIdx].ts <= cycleEnd) {
        let pay = sortedPayments[payIdx].amount;
        const intCover = Math.min(pay, pendingInterest);
        pendingInterest -= intCover;
        interestPaidTotal += intCover;
        pay -= intCover;
        if (pay > 0) {
          const prinCover = Math.min(pay, principal);
          principal -= prinCover;
          principalPaidTotal += prinCover;
        }
        payIdx++;
      }

      // Status: manual override > automático (pendingInterest sobre este ciclo coberto?)
      const autoStatus: 'pago' | 'pendente' = pendingInterest <= 0.001 ? 'pago' : 'pendente';
      const status = ov?.status ?? autoStatus;
      return { ...c, interestAmount: interest, principalBase: base, status };
    });

    // Drain remaining payments (after last completed cycle) onto principal/interest
    while (payIdx < sortedPayments.length) {
      let pay = sortedPayments[payIdx].amount;
      const intCover = Math.min(pay, pendingInterest);
      pendingInterest -= intCover;
      interestPaidTotal += intCover;
      pay -= intCover;
      if (pay > 0) {
        const prinCover = Math.min(pay, principal);
        principal -= prinCover;
        principalPaidTotal += prinCover;
      }
      payIdx++;
    }

    const totalInterest = cyclesStatused
      .filter(c => c.status !== 'em_curso')
      .reduce((s, c) => s + c.interestAmount, 0);
    const totalOwed = loan.amount + totalInterest;
    const remaining = Math.max(0, principal + pendingInterest);
    const interestPaid = interestPaidTotal;
    const principalPaid = principalPaidTotal;
    const completedCycles = cyclesStatused.filter(c => c.status !== 'em_curso').length;
    const lateCyclesCount = cyclesStatused.filter(c => c.isLate && c.status !== 'em_curso').length;
    const now = new Date();
    const dueDateObj = loan.dueDate ? new Date(loan.dueDate) : null;
    const isOverdue = !!dueDateObj && now > dueDateObj && loan.status !== 'pago';
    return {
      remaining,
      totalWithInterest: totalOwed,
      completedCycles,
      accruedInterest: totalInterest,
      isOverdue,
      cycles: cyclesStatused,
      lateCyclesCount,
      interestPaid,
      principalPaid,
    };
    // Reagir a mudanças finas: cada pagamento (valor + data), datas do empréstimo,
    // taxas, tipo de juros e overrides de ciclos.
  }, [
    loan.id,
    loan.amount,
    loan.loanDate,
    loan.dueDate,
    loan.status,
    loan.interestRate,
    loan.lateInterestRate,
    loan.interestType,
    // serializa pagamentos para detectar edição de data ou valor individual
    JSON.stringify(loan.payments.map(p => ({ a: p.amount, d: p.date }))),
    cycleOverrides,
    recalcTick,
  ]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      // Repuxa pagamentos/empréstimo do banco (caso houve edições)
      if (onRecalculate) await onRecalculate();
      // Limpa overrides de ciclos que já não existem mais (ex: data de empréstimo mudou)
      setCycleOverrides(prev => {
        const validNumbers = new Set(cycles.map(c => c.cycleNumber));
        const next: Record<number, CycleOverride> = {};
        Object.entries(prev).forEach(([k, v]) => {
          if (validNumbers.has(Number(k))) next[Number(k)] = v;
        });
        return next;
      });
      // Força re-execução do useMemo
      setRecalcTick(t => t + 1);
      toast.success('Juros e saldo recalculados!');
    } catch (e) {
      toast.error('Erro ao recalcular');
    } finally {
      setIsRecalculating(false);
    }
  };

  const installmentValue = loan.installments > 0 ? loan.amount / loan.installments : 0;
  const installmentsPaid = installmentValue > 0 ? Math.min(loan.installments, Math.floor(totalPaid / installmentValue)) : 0;
  const progressPct = loan.installments > 0 ? (installmentsPaid / loan.installments) * 100 : 0;

  const handlePayment = () => {
    const val = parseFloat(payAmount);
    if (!val || val <= 0) return;
    onAddPayment(loan.id, val);
    setPayAmount('');
    // Após registrar pagamento, força sincronização com o banco e recálculo.
    setTimeout(() => { void handleRecalculate(); }, 300);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground">{loan.borrowerName}</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="text-primary"
            title="Recalcular juros e saldo devedor"
          >
            <RefreshCw className={`h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onEdit(loan)} className="text-primary">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(loan.id)} className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            {onUpdateStatus ? (
              <Select value={loan.status} onValueChange={(v) => onUpdateStatus(loan.id, v)}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_dia">Em dia</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <StatusBadge status={loan.status} />
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Valor emprestado</span>
            <span className="text-sm font-medium">{formatCurrency(loan.amount)}</span>
          </div>
          
          {/* Interest info */}
          {(loan.interestRate > 0 || loan.lateInterestRate > 0) && (
            <div className="bg-accent/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Percent className="h-3.5 w-3.5 text-primary" />
                Juros ({loan.interestType === 'composto' ? 'composto' : 'simples'})
              </div>
              {loan.interestRate > 0 && (
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Taxa mensal</span>
                  <span className="text-xs font-medium">{loan.interestRate}%</span>
                </div>
              )}
              {loan.lateInterestRate > 0 && (
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Juros por atraso</span>
                  <span className="text-xs font-medium text-destructive">+{loan.lateInterestRate}%</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Ciclos de 30 dias concluídos</span>
                <span className="text-xs font-medium">{completedCycles}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Juros acumulados</span>
                <span className="text-xs font-medium text-warning">{formatCurrency(accruedInterest)}</span>
              </div>
              {isOverdue && lateCyclesCount > 0 && (
                <div className="flex justify-between border-t border-border pt-1">
                  <span className="text-xs text-destructive font-medium">⚠️ {lateCyclesCount} {lateCyclesCount === 1 ? 'ciclo' : 'ciclos'} em atraso</span>
                  <span className="text-xs font-bold text-destructive">+{loan.lateInterestRate}%</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1">
                <span className="text-xs text-muted-foreground font-medium">Valor devido hoje (saldo)</span>
                <span className="text-xs font-bold text-foreground">{formatCurrency(remaining)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Pago</span>
            <span className="text-sm font-medium text-primary">{formatCurrency(totalPaid)}</span>
          </div>
          {accruedInterest > 0 && totalPaid > 0 && (
            <div className="flex justify-between pl-3 text-xs text-muted-foreground">
              <span>↳ abatido em juros / principal</span>
              <span>{formatCurrency(interestPaid)} / {formatCurrency(principalPaid)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Saldo devedor</span>
            <span className="text-sm font-medium">{formatCurrency(remaining)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Vencimento</span>
            <span className="text-sm flex items-center gap-1">
              {loan.indefiniteTerm || !loan.dueDate ? (
                <><InfinityIcon className="h-3.5 w-3.5 text-primary" /> Indefinido</>
              ) : (
                new Date(loan.dueDate).toLocaleDateString('pt-BR')
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Parcelas</span>
            <span className="text-sm">{installmentsPaid} / {loan.installments}x</span>
          </div>
          {loan.installments > 1 && (
            <Progress value={progressPct} className="h-2" />
          )}
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Pagamento</span>
            <span className="text-sm capitalize">{loan.paymentMethod}</span>
          </div>
          {loan.notes && (
            <div>
              <span className="text-sm text-muted-foreground">Obs:</span>
              <p className="text-sm mt-1">{loan.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {loan.status !== 'pago' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              placeholder="Valor do pagamento"
              value={payAmount}
              onChange={e => setPayAmount(e.target.value)}
            />
            <Button onClick={handlePayment}>Pagar</Button>
          </div>
          <Button variant="outline" className="w-full" onClick={() => onMarkPaid(loan.id)}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Marcar como Pago
          </Button>
        </div>
      )}

      {cycles.filter(c => c.status !== 'em_curso').length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 text-foreground flex items-center gap-1.5">
            <History className="h-4 w-4 text-primary" />
            Histórico de Juros
          </h3>
          <div className="space-y-1">
            {cycles.filter(c => c.status !== 'em_curso').map(c => (
              <div key={c.cycleNumber} className="py-2 px-3 rounded-md bg-accent/30 border border-border text-xs">
                {editingCycle === c.cycleNumber ? (
                  <div className="space-y-2">
                    <span className="font-medium text-foreground block">Ciclo {c.cycleNumber}</span>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground w-16">Início</label>
                      <Input
                        type="date"
                        value={editCycleDate}
                        onChange={e => setEditCycleDate(e.target.value)}
                        className="h-8 text-xs flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground w-16">Juros R$</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editCycleAmount}
                        onChange={e => setEditCycleAmount(e.target.value)}
                        className="h-8 text-xs flex-1"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingCycle(null)}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          const val = parseFloat(editCycleAmount);
                          const next: CycleOverride = {};
                          if (!isNaN(val) && val >= 0) next.amount = val;
                          if (editCycleDate) next.startDate = editCycleDate;
                          setCycleOverrides(prev => ({ ...prev, [c.cycleNumber]: next }));
                          setEditingCycle(null);
                          // Força recálculo em cascata de todos os ciclos seguintes
                          setRecalcTick(t => t + 1);
                          toast.success('Ciclo atualizado e recalculado');
                        }}
                      >
                        Salvar
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Alterar a data do início recalcula os ciclos seguintes a cada 30 dias.
                    </p>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        Ciclo {c.cycleNumber}
                        {cycleOverrides[c.cycleNumber] !== undefined && (
                          <span className="ml-1 text-[10px] text-primary">(editado)</span>
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(c.startDate).toLocaleDateString('pt-BR')} → {new Date(c.endDate).toLocaleDateString('pt-BR')}
                      </span>
                      {c.principalBase !== undefined && (
                        <span className="text-[10px] text-muted-foreground">
                          base: {formatCurrency(c.principalBase)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-end">
                        <span className={`font-semibold ${c.isLate ? 'text-destructive' : 'text-warning'}`}>
                          {formatCurrency(c.interestAmount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const newStatus: 'pago' | 'pendente' = c.status === 'pago' ? 'pendente' : 'pago';
                            setCycleOverrides(prev => ({
                              ...prev,
                              [c.cycleNumber]: { ...(prev[c.cycleNumber] || {}), status: newStatus },
                            }));
                          }}
                          className={`text-[10px] uppercase tracking-wide cursor-pointer hover:underline ${c.status === 'pago' ? 'text-primary' : 'text-muted-foreground'}`}
                          title="Alternar pago/pendente"
                        >
                          {c.status === 'pago' ? '✓ Pago' : '• Pendente'}{c.isLate ? ' · atraso' : ''}
                        </button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary"
                        onClick={() => {
                          setEditingCycle(c.cycleNumber);
                          setEditCycleAmount(String(c.interestAmount.toFixed(2)));
                          setEditCycleDate(c.startDate);
                        }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      {cycleOverrides[c.cycleNumber] !== undefined && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          title="Restaurar valor calculado"
                          onClick={() => {
                            setCycleOverrides(prev => {
                              const next = { ...prev };
                              delete next[c.cycleNumber];
                              return next;
                            });
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loan.payments.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 text-foreground">Histórico de Pagamentos</h3>
          <div className="space-y-1">
            {loan.payments.map(p => (
              <div key={p.id} className="py-2 border-b border-border last:border-0">
                {editingPaymentId === p.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={editDate}
                      onChange={e => setEditDate(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={editAmount}
                      onChange={e => setEditAmount(e.target.value)}
                      className="h-8 text-xs w-24"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        const val = parseFloat(editAmount);
                        if (!val || val <= 0) return;
                        onUpdatePayment?.(p.id, { amount: val, date: editDate });
                        setEditingPaymentId(null);
                          setTimeout(() => { void handleRecalculate(); }, 300);
                      }}
                    >
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingPaymentId(null)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{new Date(p.date).toLocaleDateString('pt-BR')}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-primary">{formatCurrency(p.amount)}</span>
                      {onUpdatePayment && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary"
                          onClick={() => {
                            setEditingPaymentId(p.id);
                            setEditAmount(String(p.amount));
                            setEditDate(p.date);
                          }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {onDeletePayment && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => {
                            onDeletePayment(p.id);
                            setTimeout(() => { void handleRecalculate(); }, 300);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}