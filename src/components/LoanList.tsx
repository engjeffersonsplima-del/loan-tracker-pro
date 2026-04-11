import { Loan } from '@/types/loan';
import { StatusBadge } from './StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';

interface LoanListProps {
  loans: Loan[];
  onSelect: (loan: Loan) => void;
  filter?: string;
  search?: string;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function LoanList({ loans, onSelect, filter, search }: LoanListProps) {
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
        const totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0);
        const remaining = loan.amount - totalPaid;
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
                  {formatCurrency(loan.amount)} · Restante: {formatCurrency(Math.max(0, remaining))}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
