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
    { label: 'Emprestado', value: formatCurrency(totalLent), icon: DollarSign, iconBg: 'bg-primary/10', iconClass: 'text-primary' },
    { label: 'Recebido', value: formatCurrency(totalReceived), icon: TrendingUp, iconBg: 'bg-primary/10', iconClass: 'text-primary' },
    { label: 'A Receber', value: formatCurrency(totalPending), icon: TrendingDown, iconBg: 'bg-warning/10', iconClass: 'text-warning' },
    { label: 'Atrasados', value: String(overdue), icon: AlertTriangle, iconBg: 'bg-destructive/10', iconClass: 'text-destructive' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map(card => (
        <Card key={card.label} className="border-border/50 shadow-sm">
          <CardContent className="p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                <card.icon className={`h-3.5 w-3.5 ${card.iconClass}`} />
              </div>
            </div>
            <p className="text-lg font-bold text-foreground leading-tight">{card.value}</p>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{card.label}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
