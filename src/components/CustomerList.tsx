import { Customer } from '@/hooks/useCustomers';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronRight, Phone, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DBLoan } from '@/hooks/useLoansDB';
import { computeBalanceBreakdown } from '@/lib/loanCalculations';

interface CustomerListProps {
  customers: Customer[];
  onSelect: (customer: Customer) => void;
  onEdit?: (customer: Customer) => void;
  search?: string;
  loans?: DBLoan[];
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CustomerList({ customers, onSelect, onEdit, search, loans = [] }: CustomerListProps) {
  let filtered = customers;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(c => c.name.toLowerCase().includes(q));
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Nenhum cliente encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map(customer => {
        const customerLoans = loans.filter(
          l => l.customer_id === customer.id || l.borrower_name.toLowerCase() === customer.name.toLowerCase()
        );
        const totalOwed = customerLoans
          .filter(l => l.status !== 'pago')
          .reduce((sum, l) => sum + computeBalanceBreakdown(l).remaining, 0);
        return (
        <Card
          key={customer.id}
          className="border-border cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => onSelect(customer)}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={customer.photo_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {customer.name[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground truncate">{customer.name}</p>
              {customer.phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {customer.phone}
                </p>
              )}
              {totalOwed > 0 && (
                <p className="text-xs font-semibold text-destructive mt-0.5">
                  Devido: {formatCurrency(totalOwed)}
                </p>
              )}
            </div>
            {onEdit && (
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-primary" onClick={(e) => { e.stopPropagation(); onEdit(customer); }}>
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
