import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';

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

export function NewLoanForm({ onSave, onBack }: NewLoanFormProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [loanDate, setLoanDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [method, setMethod] = useState('pix');
  const [notes, setNotes] = useState('');
  const [installments, setInstallments] = useState('1');

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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold text-foreground">Novo Empréstimo</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Nome da pessoa</Label>
          <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: João Silva" required />
        </div>

        <div>
          <Label htmlFor="amount">Valor (R$)</Label>
          <Input id="amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="loanDate">Data</Label>
            <Input id="loanDate" type="date" value={loanDate} onChange={e => setLoanDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="dueDate">Vencimento</Label>
            <Input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="installments">Parcelas</Label>
            <Input id="installments" type="number" min="1" value={installments} onChange={e => setInstallments(e.target.value)} />
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Observações</Label>
          <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anotações opcionais..." rows={3} />
        </div>

        <Button type="submit" className="w-full">Salvar Empréstimo</Button>
      </form>
    </div>
  );
}
