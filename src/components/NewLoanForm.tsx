import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Calculator, CreditCard, Calendar } from 'lucide-react';

interface NewLoanFormProps {
  onSave: (data: {
    borrowerName: string;
    amount: number;
    loanDate: string;
    dueDate: string;
    paymentMethod: string;
    notes: string;
    installments: number;
  }) => void;
  onBack: () => void;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function NewLoanForm({ onSave, onBack }: NewLoanFormProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [loanDate, setLoanDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [method, setMethod] = useState('pix');
  const [notes, setNotes] = useState('');
  const [installments, setInstallments] = useState('1');

  const preview = useMemo(() => {
    const total = parseFloat(amount) || 0;
    const parcelas = parseInt(installments) || 1;
    const valorParcela = parcelas > 0 ? total / parcelas : 0;
    return { total, parcelas, valorParcela };
  }, [amount, installments]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount || !dueDate) return;
    onSave({
      borrowerName: name,
      amount: parseFloat(amount),
      loanDate,
      dueDate,
      paymentMethod: method,
      notes,
      installments: parseInt(installments) || 1,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-lg font-bold text-foreground">Novo Empréstimo</h2>
          <p className="text-xs text-muted-foreground">Preencha os dados abaixo</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-medium">Nome da pessoa</Label>
          <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: João Silva" required className="h-11 rounded-xl" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="amount" className="text-xs font-medium">Valor total (R$)</Label>
          <Input id="amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" required className="h-11 rounded-xl text-lg font-semibold" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="loanDate" className="text-xs font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Data
            </Label>
            <Input id="loanDate" type="date" value={loanDate} onChange={e => setLoanDate(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate" className="text-xs font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Vencimento
            </Label>
            <Input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required className="h-11 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1">
              <CreditCard className="h-3 w-3" /> Pagamento
            </Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="installments" className="text-xs font-medium">Parcelas</Label>
            <Input id="installments" type="number" min="1" value={installments} onChange={e => setInstallments(e.target.value)} className="h-11 rounded-xl" />
          </div>
        </div>

        {/* Preview de parcelas */}
        {preview.total > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Resumo</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 bg-background rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor da Parcela</p>
                  <p className="text-base font-bold text-primary">{formatCurrency(preview.valorParcela)}</p>
                  <p className="text-[10px] text-muted-foreground">{preview.parcelas}x</p>
                </div>
                <div className="text-center p-2 bg-background rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor Total</p>
                  <p className="text-base font-bold text-foreground">{formatCurrency(preview.total)}</p>
                  <p className="text-[10px] text-muted-foreground">até o vencimento</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-xs font-medium">Observações</Label>
          <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anotações opcionais..." rows={3} className="rounded-xl" />
        </div>

        <Button type="submit" className="w-full h-12 rounded-xl text-sm font-semibold">
          Salvar Empréstimo
        </Button>
      </form>
    </div>
  );
}
