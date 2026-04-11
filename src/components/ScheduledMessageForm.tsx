import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, MessageCircle, Clock } from 'lucide-react';
import { Customer } from '@/hooks/useCustomers';
import { DBLoan } from '@/hooks/useLoansDB';

interface ScheduledMessageFormProps {
  customers: Customer[];
  loans: DBLoan[];
  onSave: (data: {
    loanId?: string;
    customerId?: string;
    phone: string;
    messageText: string;
    recurrence: string;
    nextSendAt: string;
  }) => Promise<void>;
  onBack: () => void;
}

export function ScheduledMessageForm({ customers, loans, onSave, onBack }: ScheduledMessageFormProps) {
  const [customerId, setCustomerId] = useState('');
  const [loanId, setLoanId] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [recurrence, setRecurrence] = useState('once');
  const [nextSendAt, setNextSendAt] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedCustomer = customers.find(c => c.id === customerId);

  const handleCustomerChange = (id: string) => {
    setCustomerId(id);
    const customer = customers.find(c => c.id === id);
    if (customer?.phone) setPhone(customer.phone);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !message || !nextSendAt) return;
    setSaving(true);
    await onSave({
      customerId: customerId || undefined,
      loanId: loanId || undefined,
      phone,
      messageText: message,
      recurrence,
      nextSendAt: new Date(nextSendAt).toISOString(),
    });
    setSaving(false);
  };

  const overdueLoans = loans.filter(l => l.status === 'atrasado' || l.status === 'parcial');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-lg font-bold text-foreground">Agendar Mensagem</h2>
          <p className="text-xs text-muted-foreground">Programe cobrança via WhatsApp</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Cliente (opcional)</Label>
          <Select value={customerId} onValueChange={handleCustomerChange}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
            <SelectContent>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {overdueLoans.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Empréstimo (opcional)</Label>
            <Select value={loanId} onValueChange={setLoanId}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Vincular a um empréstimo" /></SelectTrigger>
              <SelectContent>
                {overdueLoans.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.borrower_name} - R$ {l.amount.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="sphone" className="text-xs font-medium flex items-center gap-1">
            <MessageCircle className="h-3 w-3" /> Telefone WhatsApp *
          </Label>
          <Input
            id="sphone"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
            required
            className="h-11 rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="smsg" className="text-xs font-medium">Mensagem *</Label>
          <Textarea
            id="smsg"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Olá! Lembrando que seu pagamento está pendente..."
            required
            rows={4}
            className="rounded-xl"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1">
              <Clock className="h-3 w-3" /> Recorrência
            </Label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Uma vez</SelectItem>
                <SelectItem value="hourly">A cada hora</SelectItem>
                <SelectItem value="daily">Diariamente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="snext" className="text-xs font-medium">Próximo envio *</Label>
            <Input
              id="snext"
              type="datetime-local"
              value={nextSendAt}
              onChange={e => setNextSendAt(e.target.value)}
              required
              className="h-11 rounded-xl"
            />
          </div>
        </div>

        <Button type="submit" disabled={saving || !phone || !message || !nextSendAt} className="w-full h-12 rounded-xl text-sm font-semibold bg-green-600 hover:bg-green-700">
          <MessageCircle className="h-4 w-4 mr-2" />
          {saving ? 'Agendando...' : 'Agendar Mensagem'}
        </Button>
      </form>
    </div>
  );
}
