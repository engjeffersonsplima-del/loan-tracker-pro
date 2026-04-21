import { useState, useMemo } from 'react';
import { Loan } from '@/types/loan';
import { StatusBadge } from './StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Trash2, CheckCircle, Percent, Edit, Infinity as InfinityIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

interface LoanDetailProps {
  loan: Loan;
  onBack: () => void;
  onAddPayment: (loanId: string, amount: number) => void;
  onMarkPaid: (loanId: string) => void;
  onDelete: (loanId: string) => void;
  onEdit: (loan: Loan) => void;
  onUpdateStatus?: (loanId: string, status: string) => void;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function LoanDetail({ loan, onBack, onAddPayment, onMarkPaid, onDelete, onEdit, onUpdateStatus }: LoanDetailProps) {
  const [payAmount, setPayAmount] = useState('');
  const totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0);

  const { remaining, totalWithInterest, monthsElapsed, accruedInterest, isOverdue } = useMemo(() => {
    const now = new Date();
    const start = new Date(loan.loanDate);
    const due = loan.dueDate ? new Date(loan.dueDate) : null;
    const isOverdue = !!due && now > due && loan.status !== 'pago';
    // Months elapsed since loan start (30-day cycles)
    const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const monthsElapsed = Math.floor(days / 30);
    const monthlyRate = loan.interestRate / 100; // taxa mensal
    const lateBonus = isOverdue ? loan.lateInterestRate / 100 : 0;
    const effectiveRate = monthlyRate + lateBonus;
    let totalWithInterest = loan.amount;
    if (loan.interestType === 'composto') {
      totalWithInterest = loan.amount * Math.pow(1 + effectiveRate, monthsElapsed);
    } else {
      totalWithInterest = loan.amount * (1 + effectiveRate * monthsElapsed);
    }
    const accruedInterest = totalWithInterest - loan.amount;
    const remaining = Math.max(0, totalWithInterest - totalPaid);
    return { remaining, totalWithInterest, monthsElapsed, accruedInterest, isOverdue };
  }, [loan, totalPaid]);

  const installmentValue = loan.installments > 0 ? loan.amount / loan.installments : 0;
  const installmentsPaid = installmentValue > 0 ? Math.min(loan.installments, Math.floor(totalPaid / installmentValue)) : 0;
  const progressPct = loan.installments > 0 ? (installmentsPaid / loan.installments) * 100 : 0;

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
        <div className="flex items-center gap-1">
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
            <StatusBadge status={loan.status} />
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
                Juros
              </div>
              {loan.interestRate > 0 && (
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Taxa de juros</span>
                  <span className="text-xs font-medium">{loan.interestRate}%</span>
                </div>
              )}
              {loan.lateInterestRate > 0 && (
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Juros por atraso</span>
                  <span className="text-xs font-medium text-destructive">+{loan.lateInterestRate}%</span>
                </div>
              )}
              {isOverdue && (
                <div className="flex justify-between border-t border-border pt-1">
                  <span className="text-xs text-destructive font-medium">⚠️ Taxa aplicada (atraso)</span>
                  <span className="text-xs font-bold text-destructive">{appliedRate}%</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1">
                <span className="text-xs text-muted-foreground font-medium">Total com juros</span>
                <span className="text-xs font-bold text-foreground">{formatCurrency(totalWithInterest)}</span>
              </div>
            </div>
          )}

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
            <span className="text-sm text-muted-foreground">Parcelas</span>
            <span className="text-sm">{loan.installments}x</span>
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