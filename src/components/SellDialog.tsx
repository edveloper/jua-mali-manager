import { useState } from 'react';
import { X, Minus, Plus, ShoppingCart, CreditCard, Wallet } from 'lucide-react';
import { Product, Customer } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SellDialogProps {
  product: Product;
  customers: Customer[];
  onSell: (
    productId: string,
    quantity: number,
    isCredit?: boolean,
    customerId?: string,
    meta?: { staffName?: string; sessionTime?: string; notes?: string; status?: 'completed' | 'scheduled' | 'cancelled' }
  ) => void;
  onClose: () => void;
  isOwner?: boolean;
  offeringMode?: 'products' | 'services' | 'mixed' | string;
  allowCredit?: boolean;
}

export function SellDialog({ product, customers, onSell, onClose, isOwner = true, offeringMode = 'products', allowCredit = true }: SellDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [isCredit, setIsCredit] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [staffName, setStaffName] = useState('');
  const [sessionTime, setSessionTime] = useState('');
  const [notes, setNotes] = useState('');
  const [sessionStatus, setSessionStatus] = useState<'completed' | 'scheduled' | 'cancelled'>('completed');
  const actionLabel = offeringMode === 'services' ? 'Record Service' : 'Record Sale';

  const handleSell = () => {
    if (quantity > 0 && quantity <= product.quantity) {
      if (allowCredit && isCredit && !selectedCustomerId) return;
      if (offeringMode === 'services') {
        onSell(
          product.id,
          quantity,
          false,
          undefined,
          {
            staffName: staffName.trim(),
            sessionTime: sessionTime || undefined,
            notes: notes.trim(),
            status: sessionStatus,
          }
        );
      } else {
        onSell(product.id, quantity, allowCredit ? isCredit : false, (allowCredit && isCredit) ? selectedCustomerId : undefined);
      }
      onClose();
    }
  };

  const total = product.sellingPrice * quantity;
  const profit = (product.sellingPrice - product.costPrice) * quantity;

  return (
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl animate-slide-up">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">{actionLabel}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="bg-muted rounded-xl p-4">
            <h3 className="font-semibold text-foreground">{product.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Price: KSh {product.sellingPrice.toLocaleString()} | Stock: {product.quantity}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Quantity</label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.min(product.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                className="text-center text-lg font-semibold"
                min={1}
                max={product.quantity}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.min(product.quantity, quantity + 1))}
                disabled={quantity >= product.quantity}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {allowCredit && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Payment Type</label>
              <div className="flex gap-2">
                <Button
                  variant={!isCredit ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setIsCredit(false)}
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Cash
                </Button>
                <Button
                  variant={isCredit ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setIsCredit(true)}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Credit
                </Button>
              </div>
            </div>
          )}

          {offeringMode === 'services' && (
            <div className="space-y-3 rounded-xl border border-border p-3">
              <p className="text-sm font-medium text-foreground">Service Session Details</p>
              <Input
                placeholder="Staff name (optional)"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
              />
              <Input
                type="datetime-local"
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
              />
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={sessionStatus}
                onChange={(e) => setSessionStatus(e.target.value as 'completed' | 'scheduled' | 'cancelled')}
              >
                <option value="completed">Completed</option>
                <option value="scheduled">Scheduled</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <Input
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}

          {/* Customer Selection for Credit */}
          {isCredit && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Select Customer</label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No customers yet. Add one in Credit tab.
                    </div>
                  ) : (
                    customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="bg-muted rounded-xl p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-bold text-lg">KSh {total.toLocaleString()}</span>
            </div>
            {/* Only show profit to owners */}
            {isOwner && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Profit</span>
                <span className="font-semibold text-success">KSh {profit.toLocaleString()}</span>
              </div>
            )}
          {allowCredit && isCredit && (
            <div className="flex justify-between text-warning pt-2 border-t border-border">
              <span>Payment Type</span>
              <span className="font-semibold">Credit Sale</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleSell}
              disabled={allowCredit && isCredit && !selectedCustomerId}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {isCredit ? 'Credit Sale' : (offeringMode === 'services' ? 'Complete Service' : 'Complete Sale')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
