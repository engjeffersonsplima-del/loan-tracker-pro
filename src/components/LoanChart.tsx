import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

interface LoanChartProps {
  totalReceived: number;
  totalPending: number;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function LoanChart({ totalReceived, totalPending }: LoanChartProps) {
  if (totalReceived === 0 && totalPending === 0) return null;

  const data = [
    { name: 'Recebido', value: totalReceived },
    { name: 'A Receber', value: totalPending },
  ];

  const COLORS = ['hsl(142, 60%, 40%)', 'hsl(38, 92%, 50%)'];

  return (
    <Card className="border-border">
      <CardHeader className="pb-2 p-4">
        <CardTitle className="text-sm font-medium">Recebido vs A Receber</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index]} />
              ))}
            </Pie>
            <Legend
              formatter={(value, entry) => {
                const payload = entry?.payload as { value?: number };
                return `${value}: ${formatCurrency(payload?.value ?? 0)}`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
