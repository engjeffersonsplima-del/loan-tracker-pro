import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GoalProgress } from './GoalProgress';
import { ArrowLeft } from 'lucide-react';
import { MonthlyGoal } from '@/types/loan';

interface GoalSettingsProps {
  currentGoal: MonthlyGoal;
  currentReceived: number;
  onSetGoal: (month: string, target: number) => void;
  onBack: () => void;
}

export function GoalSettings({ currentGoal, currentReceived, onSetGoal, onBack }: GoalSettingsProps) {
  const [target, setTarget] = useState(String(currentGoal.target || ''));

  const handleSave = () => {
    const val = parseFloat(target);
    if (!val || val <= 0) return;
    onSetGoal(currentGoal.month, val);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold text-foreground">Metas</h2>
      </div>

      <GoalProgress target={currentGoal.target} received={currentReceived} />

      <Card className="border-border">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium">Definir Meta Mensal</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div>
            <Label htmlFor="target">Meta de recebimento (R$)</Label>
            <Input
              id="target"
              type="number"
              step="0.01"
              placeholder="Ex: 5000"
              value={target}
              onChange={e => setTarget(e.target.value)}
            />
          </div>
          <Button onClick={handleSave} className="w-full">Salvar Meta</Button>
        </CardContent>
      </Card>
    </div>
  );
}
