import { useState } from 'react';
import { useLoans } from '@/hooks/useLoans';
import { StatsCards } from '@/components/StatsCards';
import { GoalProgress } from '@/components/GoalProgress';
import { LoanChart } from '@/components/LoanChart';
import { LoanList } from '@/components/LoanList';
import { LoanDetail } from '@/components/LoanDetail';
import { NewLoanForm } from '@/components/NewLoanForm';
import { GoalSettings } from '@/components/GoalSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loan } from '@/types/loan';
import { Plus, Home, List, Target, Search } from 'lucide-react';

type View = 'dashboard' | 'loans' | 'goals' | 'new' | 'detail';

export default function Index() {
  const {
    loans, stats, currentMonthGoal, currentMonthReceived,
    addLoan, deleteLoan, addPayment, markAsPaid, setMonthlyGoal,
  } = useLoans();

  const [view, setView] = useState<View>('dashboard');
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');

  const handleSelectLoan = (loan: Loan) => {
    setSelectedLoan(loan);
    setView('detail');
  };

  const handleBack = () => {
    setView('dashboard');
    setSelectedLoan(null);
  };

  const handleSaveLoan = (data: Parameters<typeof addLoan>[0]) => {
    addLoan(data);
    setView('loans');
  };

  const handleDelete = (id: string) => {
    deleteLoan(id);
    setView('loans');
  };

  // Re-fetch selected loan after payment
  const currentLoan = selectedLoan ? loans.find(l => l.id === selectedLoan.id) || selectedLoan : null;

  const overdueLoans = loans.filter(l => l.status === 'atrasado');

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        {view === 'dashboard' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-foreground">CobraCerto</h1>
                <p className="text-sm text-muted-foreground">Controle de empréstimos</p>
              </div>
              <Button size="icon" onClick={() => setView('new')}>
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            <StatsCards {...stats} />

            <GoalProgress target={currentMonthGoal.target} received={currentMonthReceived} />

            <LoanChart totalReceived={stats.totalReceived} totalPending={stats.totalPending} />

            {overdueLoans.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-destructive mb-2 flex items-center gap-1">
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
              <h2 className="text-lg font-semibold text-foreground">Empréstimos</h2>
              <Button size="icon" onClick={() => setView('new')}>
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto">
              {['todos', 'em_dia', 'atrasado', 'parcial', 'pago'].map(f => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f)}
                  className="text-xs whitespace-nowrap"
                >
                  {f === 'todos' ? 'Todos' : f === 'em_dia' ? 'Em dia' : f === 'atrasado' ? 'Atrasado' : f === 'parcial' ? 'Parcial' : 'Pago'}
                </Button>
              ))}
            </div>

            <LoanList loans={loans} onSelect={handleSelectLoan} filter={filter} search={search} />
          </div>
        )}

        {view === 'new' && (
          <NewLoanForm onSave={handleSaveLoan} onBack={handleBack} />
        )}

        {view === 'detail' && currentLoan && (
          <LoanDetail
            loan={currentLoan}
            onBack={() => setView('loans')}
            onAddPayment={addPayment}
            onMarkPaid={markAsPaid}
            onDelete={handleDelete}
          />
        )}

        {view === 'goals' && (
          <GoalSettings
            currentGoal={currentMonthGoal}
            currentReceived={currentMonthReceived}
            onSetGoal={setMonthlyGoal}
            onBack={handleBack}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="max-w-lg mx-auto flex justify-around py-2">
          {[
            { key: 'dashboard' as View, icon: Home, label: 'Início' },
            { key: 'loans' as View, icon: List, label: 'Empréstimos' },
            { key: 'goals' as View, icon: Target, label: 'Metas' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-colors ${
                view === item.key ? 'text-primary' : 'text-muted-foreground'
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
