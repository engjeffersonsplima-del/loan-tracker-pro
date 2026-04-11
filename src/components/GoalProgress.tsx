import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card className="border-border">
      <CardHeader className="pb-2 p-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Meta do Mês
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>{formatCurrency(received)} recebido</span>
          <span>{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
        <p className="text-xs text-muted-foreground mt-2">
          Meta: {formatCurrency(target)}
        </p>
      </CardContent>
    </Card>
  );
}
