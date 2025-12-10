import { Receipt, TrendingUp } from 'lucide-react';
import { Sale } from '@/types/inventory';

interface SalesHistoryProps {
  sales: Sale[];
}

export function SalesHistory({ sales }: SalesHistoryProps) {
  const formatCurrency = (amount: number) => `KSh ${amount.toLocaleString()}`;
  
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-KE', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Group sales by date
  const groupedSales = sales.reduce((acc, sale) => {
    const dateKey = formatDate(sale.createdAt);
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(sale);
    return acc;
  }, {} as Record<string, Sale[]>);

  const sortedDates = Object.keys(groupedSales).reverse();

  const totalProfit = sales.reduce((sum, s) => sum + s.profit, 0);
  const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);

  if (sales.length === 0) {
    return (
      <div className="text-center py-12 animate-slide-up">
        <div className="bg-muted rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <Receipt className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground">No Sales Yet</h3>
        <p className="text-muted-foreground mt-1">Sales will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <p className="metric-label">Total Sales</p>
          <p className="metric-value text-secondary">{formatCurrency(totalSales)}</p>
        </div>
        <div className="stat-card">
          <p className="metric-label">Total Profit</p>
          <p className="metric-value text-success">{formatCurrency(totalProfit)}</p>
        </div>
      </div>

      {sortedDates.map((date) => (
        <div key={date}>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">{date}</h3>
          <div className="space-y-2">
            {groupedSales[date].reverse().map((sale) => (
              <div key={sale.id} className="bg-card rounded-xl p-3 border border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{sale.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      {sale.quantity} × {formatCurrency(sale.unitPrice)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold">{formatCurrency(sale.totalAmount)}</p>
                    <div className="flex items-center gap-1 text-success text-sm">
                      <TrendingUp className="h-3 w-3" />
                      <span>{formatCurrency(sale.profit)}</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{formatTime(sale.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
