import { Badge } from '@/components/ui/badge';
import { LoanStatus } from '@/types/loan';
import { CheckCircle, Clock, AlertTriangle, MinusCircle } from 'lucide-react';

const statusConfig: Record<LoanStatus, { label: string; className: string; icon: typeof CheckCircle }> = {
  em_dia: { label: 'Em dia', className: 'bg-primary/10 text-primary border-primary/20', icon: CheckCircle },
  atrasado: { label: 'Atrasado', className: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertTriangle },
  pago: { label: 'Pago', className: 'bg-muted text-muted-foreground border-border', icon: CheckCircle },
  parcial: { label: 'Parcial', className: 'bg-warning/10 text-warning border-warning/20', icon: MinusCircle },
};

export function StatusBadge({ status }: { status: LoanStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`${config.className} gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
