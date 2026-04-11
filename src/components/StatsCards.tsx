import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface StatsCardsProps {
  totalLent: number;
  totalReceived: number;
  totalPending: number;
  overdue: number;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function StatsCards({ totalLent, totalReceived, totalPending, overdue }: StatsCardsProps) {
  const cards = [
    { label: 'Total Emprestado', value: formatCurrency(totalLent), icon: DollarSign, iconClass: 'text-primary' },
    { label: 'Total Recebido', value: formatCurrency(totalReceived), icon: TrendingUp, iconClass: 'text-primary' },
    { label: 'A Receber', value: formatCurrency(totalPending), icon: TrendingDown, iconClass: 'text-warning' },
    { label: 'Atrasados', value: String(overdue), icon: AlertTriangle, iconClass: 'text-destructive' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map(card => (
        <Card key={card.label} className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`h-4 w-4 ${card.iconClass}`} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
