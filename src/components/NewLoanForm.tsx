import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Calculator, CreditCard, Calendar, Percent, CheckCircle, XCircle, Infinity as InfinityIcon } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';

import { Loan } from '@/types/loan';

interface NewLoanFormProps {
  onSave: (data: {
    borrowerName: string;
    amount: number;
    loanDate: string;
    dueDate: string | null;
    paymentMethod: string;
    notes: string;
    installments: number;
    interestRate?: number;
    lateInterestRate?: number;
    interestType?: 'simples' | 'composto';
    indefiniteTerm?: boolean;
    loanType?: 'juros_mensal' | 'parcelas_fixas';
    cyclePeriod?: 'mensal' | 'semanal';
  }) => void;
  onBack: () => void;
  editLoan?: Loan;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function NewLoanForm({ onSave, onBack, editLoan }: NewLoanFormProps) {
  const [name, setName] = useState(editLoan?.borrowerName || '');
  const [amount, setAmount] = useState(editLoan ? String(editLoan.amount) : '');
  const [loanDate, setLoanDate] = useState(editLoan?.loanDate || new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(editLoan?.dueDate || '');
  const [method, setMethod] = useState(editLoan?.paymentMethod || 'pix');
  const [notes, setNotes] = useState(editLoan?.notes || '');
  const [installments, setInstallments] = useState(editLoan ? String(editLoan.installments) : '1');
  const [interestRate, setInterestRate] = useState(editLoan ? String(editLoan.interestRate) : '0');
  const [lateInterestRate, setLateInterestRate] = useState(editLoan ? String(editLoan.lateInterestRate) : '0');
  const [loanType, setLoanType] = useState<'juros_mensal' | 'parcelas_fixas'>(editLoan?.loanType || 'parcelas_fixas');
  const [interestPaidThisMonth, setInterestPaidThisMonth] = useState(editLoan?.interestPaidThisMonth || false);
  const [interestType, setInterestType] = useState<'simples' | 'composto'>(editLoan?.interestType || 'simples');
  const [indefiniteTerm, setIndefiniteTerm] = useState<boolean>(editLoan?.indefiniteTerm || false);
  const [cyclePeriod, setCyclePeriod] = useState<'mensal' | 'semanal'>(editLoan?.cyclePeriod || 'mensal');

  const preview = useMemo(() => {
    const total = parseFloat(amount) || 0;
    const parcelas = parseInt(installments) || 1;
    const rate = parseFloat(interestRate) || 0;
    const totalWithInterest = total * (1 + rate / 100);
    const valorParcela = parcelas > 0 ? totalWithInterest / parcelas : 0;
    return { total, parcelas, valorParcela, totalWithInterest, rate };
  }, [amount, installments, interestRate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount) return;
    if (!indefiniteTerm && !dueDate) return;
    onSave({
      borrowerName: name,
      amount: parseFloat(amount),
      loanDate,
      dueDate: indefiniteTerm ? null : dueDate,
      paymentMethod: method,
      notes,
      installments: parseInt(installments) || 1,
      interestRate: parseFloat(interestRate) || 0,
      lateInterestRate: parseFloat(lateInterestRate) || 0,
      interestType,
      indefiniteTerm,
      loanType,
      cyclePeriod,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-lg font-bold text-foreground">{editLoan ? 'Editar Empréstimo' : 'Novo Empréstimo'}</h2>
          <p className="text-xs text-muted-foreground">{editLoan ? 'Altere os dados abaixo' : 'Preencha os dados abaixo'}</p>
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
            <Input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={indefiniteTerm} required={!indefiniteTerm} className="h-11 rounded-xl disabled:opacity-50" />
          </div>
        </div>

        {/* Prazo indefinido */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <InfinityIcon className="h-4 w-4 text-primary" />
            <Label className="text-xs font-medium cursor-pointer">Prazo indefinido (sem data final)</Label>
          </div>
          <Switch checked={indefiniteTerm} onCheckedChange={setIndefiniteTerm} />
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

        {/* Tipo de empréstimo */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Tipo de Empréstimo</Label>
          <RadioGroup value={loanType} onValueChange={(v) => setLoanType(v as any)} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="parcelas_fixas" id="parcelas_fixas" />
              <Label htmlFor="parcelas_fixas" className="text-xs cursor-pointer">Parcelas Fixas</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="juros_mensal" id="juros_mensal" />
              <Label htmlFor="juros_mensal" className="text-xs cursor-pointer">Juros por Mês</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Período do ciclo de juros */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Período do Ciclo de Juros</Label>
          <RadioGroup value={cyclePeriod} onValueChange={(v) => setCyclePeriod(v as 'mensal' | 'semanal')} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="mensal" id="ciclo_mensal" />
              <Label htmlFor="ciclo_mensal" className="text-xs cursor-pointer">Mensal (a cada 30 dias)</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="semanal" id="ciclo_semanal" />
              <Label htmlFor="ciclo_semanal" className="text-xs cursor-pointer">Semanal (a cada 7 dias)</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Juros pago este mês */}
        {loanType === 'juros_mensal' && (
          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
            <div className="flex items-center gap-2">
              {interestPaidThisMonth ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <Label className="text-xs font-medium cursor-pointer">Juros do mês pago?</Label>
            </div>
            <Switch checked={interestPaidThisMonth} onCheckedChange={setInterestPaidThisMonth} />
          </div>
        )}

        {/* Juros */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="interestRate" className="text-xs font-medium flex items-center gap-1">
              <Percent className="h-3 w-3" /> Juros mensal (%)
            </Label>
            <Input id="interestRate" type="number" step="0.1" min="0" value={interestRate} onChange={e => setInterestRate(e.target.value)} placeholder="0" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lateInterestRate" className="text-xs font-medium flex items-center gap-1">
              <Percent className="h-3 w-3 text-destructive" /> Juros atraso (%)
            </Label>
            <Input id="lateInterestRate" type="number" step="0.1" min="0" value={lateInterestRate} onChange={e => setLateInterestRate(e.target.value)} placeholder="0" className="h-11 rounded-xl" />
          </div>
        </div>

        {/* Tipo de juros (simples/composto) */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Tipo de Juros</Label>
          <RadioGroup value={interestType} onValueChange={(v) => setInterestType(v as 'simples' | 'composto')} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="simples" id="juros_simples" />
              <Label htmlFor="juros_simples" className="text-xs cursor-pointer">Simples (sobre o valor original)</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="composto" id="juros_composto" />
              <Label htmlFor="juros_composto" className="text-xs cursor-pointer">Composto (juros sobre juros)</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Preview de parcelas */}
        {preview.total > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Resumo</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-background rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Parcela</p>
                  <p className="text-sm font-bold text-primary">{formatCurrency(preview.valorParcela)}</p>
                  <p className="text-[10px] text-muted-foreground">{preview.parcelas}x</p>
                </div>
                <div className="text-center p-2 bg-background rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total + Juros</p>
                  <p className="text-sm font-bold text-foreground">{formatCurrency(preview.totalWithInterest)}</p>
                  <p className="text-[10px] text-muted-foreground">{preview.rate}%</p>
                </div>
                <div className="text-center p-2 bg-background rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Emprestado</p>
                  <p className="text-sm font-bold text-muted-foreground">{formatCurrency(preview.total)}</p>
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
          {editLoan ? 'Atualizar Empréstimo' : 'Salvar Empréstimo'}
        </Button>
      </form>
    </div>
  );
}
