import { useState } from 'react';
import { Loan } from '@/types/loan';
import { StatusBadge } from './StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Trash2, CheckCircle } from 'lucide-react';

interface LoanDetailProps {
  loan: Loan;
  onBack: () => void;
  onAddPayment: (loanId: string, amount: number) => void;
  onMarkPaid: (loanId: string) => void;
  onDelete: (loanId: string) => void;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function LoanDetail({ loan, onBack, onAddPayment, onMarkPaid, onDelete }: LoanDetailProps) {
  const [payAmount, setPayAmount] = useState('');
  const totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, loan.amount - totalPaid);

  const handlePayment = () => {
    const val = parseFloat(payAmount);
    if (!val || val <= 0) return;
    onAddPayment(loan.id, val);
    setPayAmount('');
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
        <Button variant="ghost" size="icon" onClick={() => onDelete(loan.id)} className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <StatusBadge status={loan.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Valor</span>
            <span className="text-sm font-medium">{formatCurrency(loan.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Pago</span>
            <span className="text-sm font-medium text-primary">{formatCurrency(totalPaid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Restante</span>
            <span className="text-sm font-medium">{formatCurrency(remaining)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Vencimento</span>
            <span className="text-sm">{new Date(loan.dueDate).toLocaleDateString('pt-BR')}</span>
          </div>
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

      {loan.payments.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 text-foreground">Histórico de Pagamentos</h3>
          <div className="space-y-1">
            {loan.payments.map(p => (
              <div key={p.id} className="flex justify-between text-sm py-2 border-b border-border last:border-0">
                <span className="text-muted-foreground">{new Date(p.date).toLocaleDateString('pt-BR')}</span>
                <span className="font-medium text-primary">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
