import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target } from 'lucide-react';

interface GoalProgressProps {
  target: number;
  received: number;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function GoalProgress({ target, received }: GoalProgressProps) {
  if (target === 0) return null;
  const pct = Math.min(100, Math.round((received / target) * 100));

  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">Meta do Mês</span>
          </div>
          <span className="text-xs font-bold text-primary">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2 mb-2" />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{formatCurrency(received)} recebido</span>
          <span>Meta: {formatCurrency(target)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
