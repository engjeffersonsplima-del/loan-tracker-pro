import { Customer } from '@/hooks/useCustomers';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronRight, Phone } from 'lucide-react';

interface CustomerListProps {
  customers: Customer[];
  onSelect: (customer: Customer) => void;
  search?: string;
}

export function CustomerList({ customers, onSelect, search }: CustomerListProps) {
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
      {filtered.map(customer => (
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
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
