import { Loan } from '@/types/loan';
import { StatusBadge } from './StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { computeInterestCyclesWithStatus, calcularEmprestimoCompleto } from '@/lib/loanCalculations';

interface LoanListProps {
  loans: Loan[];
  onSelect: (loan: Loan) => void;
  onEdit?: (loan: Loan) => void;
  filter?: string;
  search?: string;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function LoanList({ loans, onSelect, onEdit, filter, search }: LoanListProps) {
  let filtered = loans;

  if (filter && filter !== 'todos') {
    filtered = filtered.filter(l => l.status === filter);
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(l => l.borrowerName.toLowerCase().includes(q));
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Nenhum empréstimo encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map(loan => {
        const dbLike = {
          amount: loan.amount,
          loan_date: loan.loanDate,
          due_date: loan.dueDate || null,
          status: loan.status,
          interest_rate: loan.interestRate,
          late_interest_rate: loan.lateInterestRate,
          interest_type: loan.interestType,
          cycle_period: loan.cyclePeriod,
          payments: loan.payments.map(p => ({ amount: p.amount, date: p.date })),
        };
        // "Juros em atraso" = soma dos juros de ciclos JÁ ENCERRADOS que ainda
        // não foram pagos. Não inclui ciclo em curso nem juros já quitados.
        let overdueInterest = 0;
        let principalRemaining = loan.amount;
        if (loan.status !== 'pago') {
          const cycles = computeInterestCyclesWithStatus(dbLike);
          overdueInterest = cycles
            .filter(c => c.status === 'pendente')
            .reduce((s, c) => s + c.interestAmount, 0);
          const r = calcularEmprestimoCompleto(dbLike);
          principalRemaining = Math.max(0, r.principalRestante);
        } else {
          principalRemaining = 0;
        }
        return (
          <Card
            key={loan.id}
            className="border-border cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => onSelect(loan)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm text-foreground truncate">{loan.borrowerName}</p>
                  <StatusBadge status={loan.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(loan.amount)}
                </p>
                {loan.status !== 'pago' && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Principal pendente: {formatCurrency(principalRemaining)}
                  </p>
                )}
                {overdueInterest > 0 && (
                  <p className="text-xs font-semibold text-destructive mt-0.5">
                    Juros em atraso: {formatCurrency(overdueInterest)}
                  </p>
                )}
              </div>
              {onEdit && (
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-primary" onClick={(e) => { e.stopPropagation(); onEdit(loan); }}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
