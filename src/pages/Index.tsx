import { useState } from 'react';
import { useLoansDB, DBLoan } from '@/hooks/useLoansDB';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { useScheduledMessages } from '@/hooks/useScheduledMessages';
import { useAuth } from '@/hooks/useAuth';
import { StatsCards } from '@/components/StatsCards';
import { GoalProgress } from '@/components/GoalProgress';
import { LoanChart } from '@/components/LoanChart';
import { LoanList } from '@/components/LoanList';
import { LoanDetail } from '@/components/LoanDetail';
import { NewLoanForm } from '@/components/NewLoanForm';
import { CustomerForm } from '@/components/CustomerForm';
import { CustomerList } from '@/components/CustomerList';
import { CustomerDetail } from '@/components/CustomerDetail';
import { ScheduledMessageForm } from '@/components/ScheduledMessageForm';
import { ScheduledMessageList } from '@/components/ScheduledMessageList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loan } from '@/types/loan';
import { Plus, Home, List, Users, MessageCircle, Search, LogOut, DollarSign } from 'lucide-react';

type View = 'dashboard' | 'loans' | 'customers' | 'messages' | 'new-loan' | 'loan-detail' | 'edit-loan' | 'new-customer' | 'edit-customer' | 'customer-detail' | 'new-message';

export default function Index() {
  const { customers, addCustomer, updateCustomer, deleteCustomer, uploadPhoto, refetch: refetchCustomers } = useCustomers();
  const { loans: dbLoans, stats, addLoan, updateLoan, deleteLoan, addPayment, markAsPaid, updateStatus, updatePayment, deletePayment } = useLoansDB(refetchCustomers);
  const { messages, addMessage, toggleStatus, deleteMessage, sendWhatsApp } = useScheduledMessages();
  const { signOut } = useAuth();

  const [view, setView] = useState<View>('dashboard');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  // Convert DB loans to the Loan type used by existing components
  const loans: Loan[] = dbLoans.map(l => ({
    id: l.id,
    borrowerName: l.borrower_name,
    amount: l.amount,
    loanDate: l.loan_date,
    dueDate: l.due_date || '',
    paymentMethod: l.payment_method,
    notes: l.notes || '',
    status: l.status as any,
    installments: l.installments,
    interestRate: l.interest_rate,
    lateInterestRate: l.late_interest_rate,
    loanType: (l as any).loan_type || 'parcelas_fixas',
    interestPaidThisMonth: (l as any).interest_paid_this_month || false,
    interestType: ((l as any).interest_type as 'simples' | 'composto') || 'simples',
    indefiniteTerm: (l as any).indefinite_term || false,
    payments: l.payments.map(p => ({ id: p.id, amount: p.amount, date: p.date })),
  }));

  const selectedLoan = loans.find(l => l.id === selectedLoanId) || null;
  const overdueLoans = loans.filter(l => l.status === 'atrasado');

  const handleSelectLoan = (loan: Loan) => {
    setSelectedLoanId(loan.id);
    setView('loan-detail');
  };

  const handleSaveLoan = (data: Parameters<typeof addLoan>[0]) => {
    addLoan(data);
    setView('loans');
  };

  const handleDeleteLoan = (id: string) => {
    deleteLoan(id);
    setView('loans');
  };

  const handleEditLoan = (loan: Loan) => {
    setSelectedLoanId(loan.id);
    setView('edit-loan');
  };

  const handleUpdateLoan = (data: Parameters<typeof updateLoan>[1]) => {
    if (selectedLoanId) {
      updateLoan(selectedLoanId, data);
      setView('loans');
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setView('customer-detail');
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setView('edit-customer');
  };

  const handleUpdateCustomer = async (data: { name: string; address?: string; rg?: string; phone?: string; photo_url?: string }) => {
    if (selectedCustomer) {
      await updateCustomer(selectedCustomer.id, data);
      setView('customers');
    }
  };

  const handleDeleteCustomer = (id: string) => {
    deleteCustomer(id);
    setView('customers');
  };

  // Simple goal state (kept in memory for now)
  const currentMonthGoal = { month: '', target: 0 };
  const currentMonthReceived = 0;

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24">
        {view === 'dashboard' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground tracking-tight">CobraCerto</h1>
                  <p className="text-[11px] text-muted-foreground">Controle de empréstimos</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" onClick={signOut} className="rounded-xl text-muted-foreground">
                  <LogOut className="h-4 w-4" />
                </Button>
                <Button size="icon" onClick={() => setView('new-loan')} className="rounded-xl shadow-sm">
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <StatsCards {...stats} />
            <GoalProgress target={currentMonthGoal.target} received={currentMonthReceived} />
            <LoanChart totalReceived={stats.totalReceived} totalPending={stats.totalPending} />

            {overdueLoans.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                  ⚠️ Atrasados ({overdueLoans.length})
                </h3>
                <LoanList loans={overdueLoans} onSelect={handleSelectLoan} />
              </div>
            )}
          </div>
        )}

        {view === 'loans' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Empréstimos</h2>
              <Button size="icon" onClick={() => setView('new-loan')} className="rounded-xl shadow-sm">
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-11 rounded-xl" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {['todos', 'em_dia', 'atrasado', 'parcial', 'pago'].map(f => (
                <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="text-xs whitespace-nowrap rounded-lg">
                  {f === 'todos' ? 'Todos' : f === 'em_dia' ? 'Em dia' : f === 'atrasado' ? 'Atrasado' : f === 'parcial' ? 'Parcial' : 'Pago'}
                </Button>
              ))}
            </div>
            <LoanList loans={loans} onSelect={handleSelectLoan} onEdit={handleEditLoan} filter={filter} search={search} />
          </div>
        )}

        {view === 'customers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Clientes</h2>
              <Button size="icon" onClick={() => setView('new-customer')} className="rounded-xl shadow-sm">
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="pl-9 h-11 rounded-xl" />
            </div>
            <CustomerList customers={customers} onSelect={handleSelectCustomer} onEdit={handleEditCustomer} search={customerSearch} />
          </div>
        )}

        {view === 'messages' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Mensagens</h2>
              <Button size="icon" onClick={() => setView('new-message')} className="rounded-xl shadow-sm">
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            <ScheduledMessageList messages={messages} onToggle={toggleStatus} onDelete={deleteMessage} onSendNow={sendWhatsApp} />
          </div>
        )}

        {view === 'new-loan' && (
          <NewLoanForm onSave={handleSaveLoan} onBack={() => setView('dashboard')} />
        )}

        {view === 'loan-detail' && selectedLoan && (
          <LoanDetail
            loan={selectedLoan}
            onBack={() => setView('loans')}
            onAddPayment={addPayment}
            onMarkPaid={markAsPaid}
            onDelete={handleDeleteLoan}
            onEdit={handleEditLoan}
            onUpdateStatus={updateStatus}
            onUpdatePayment={updatePayment}
            onDeletePayment={deletePayment}
          />
        )}

        {view === 'edit-loan' && selectedLoan && (
          <NewLoanForm
            onSave={handleUpdateLoan}
            onBack={() => setView('loan-detail')}
            editLoan={selectedLoan}
          />
        )}

        {view === 'new-customer' && (
          <CustomerForm onSave={addCustomer} onUploadPhoto={uploadPhoto} onBack={() => setView('customers')} />
        )}

        {view === 'customer-detail' && selectedCustomer && (
          <CustomerDetail
            customer={selectedCustomer}
            onBack={() => setView('customers')}
            onDelete={handleDeleteCustomer}
            onEdit={handleEditCustomer}
            onWhatsApp={sendWhatsApp}
            loans={dbLoans}
          />
        )}

        {view === 'edit-customer' && selectedCustomer && (
          <CustomerForm
            onSave={handleUpdateCustomer}
            onUploadPhoto={uploadPhoto}
            onBack={() => setView('customer-detail')}
            initial={{
              name: selectedCustomer.name,
              address: selectedCustomer.address || undefined,
              rg: selectedCustomer.rg || undefined,
              phone: selectedCustomer.phone || undefined,
              photo_url: selectedCustomer.photo_url || undefined,
            }}
          />
        )}

        {view === 'new-message' && (
          <ScheduledMessageForm
            customers={customers}
            loans={dbLoans}
            onSave={addMessage}
            onBack={() => setView('messages')}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border/50 z-50">
        <div className="max-w-lg mx-auto flex justify-around py-2 px-1">
          {[
            { key: 'dashboard' as View, icon: Home, label: 'Início' },
            { key: 'loans' as View, icon: List, label: 'Empréstimos' },
            { key: 'customers' as View, icon: Users, label: 'Clientes' },
            { key: 'messages' as View, icon: MessageCircle, label: 'Mensagens' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                view === item.key || (item.key === 'loans' && view === 'loan-detail') || (item.key === 'customers' && view === 'customer-detail')
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
