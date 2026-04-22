export type LoanStatus = 'em_dia' | 'atrasado' | 'pago' | 'parcial';

export interface Payment {
  id: string;
  amount: number;
  date: string;
}

export interface Loan {
  id: string;
  borrowerName: string;
  amount: number;
  loanDate: string;
  dueDate: string;
  paymentMethod: string;
  notes: string;
  status: LoanStatus;
  installments: number;
  interestRate: number;
  lateInterestRate: number;
  loanType: 'juros_mensal' | 'parcelas_fixas';
  interestPaidThisMonth: boolean;
  interestType: 'simples' | 'composto';
  indefiniteTerm: boolean;
  cyclePeriod: 'mensal' | 'semanal';
  payments: Payment[];
}

export interface MonthlyGoal {
  month: string;
  target: number;
}
