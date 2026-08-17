-- What the shop owes.
--
-- The mirror of the credit book: customers/credit_sales/credit_payments pointing
-- the other way. Stock taken from a supplier is either paid for on collection or
-- owed, exactly as a sale is either paid now or taken on deni.
--
-- Without this, a statement showing turnover while concealing supplier debt
-- overstates the business, which is why the balance sheet was refused until now.

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS suppliers_shop_idx ON public.suppliers (shop_id);

CREATE TABLE IF NOT EXISTS public.supplier_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  -- Set when the debt came from taking stock; null for anything else owed.
  stock_movement_id UUID REFERENCES public.stock_movements(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  incurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_debts DROP CONSTRAINT IF EXISTS supplier_debts_status_check;
ALTER TABLE public.supplier_debts ADD CONSTRAINT supplier_debts_status_check
  CHECK (status IN ('pending', 'partially_paid', 'paid'));

CREATE INDEX IF NOT EXISTS supplier_debts_shop_status_idx
  ON public.supplier_debts (shop_id, status);

CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  supplier_debt_id UUID NOT NULL REFERENCES public.supplier_debts(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_method TEXT,
  payment_reference TEXT,
  -- The cash-out row this payment created, so the two can never drift.
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_payments DROP CONSTRAINT IF EXISTS supplier_payments_payment_method_check;
ALTER TABLE public.supplier_payments ADD CONSTRAINT supplier_payments_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('cash', 'mpesa', 'airtel', 'other'));

CREATE INDEX IF NOT EXISTS supplier_payments_shop_paid_idx
  ON public.supplier_payments (shop_id, paid_at DESC);

-- ---------------------------------------------------------------------------
-- Owner-only throughout. What a shop owes is a solvency signal, not something
-- the person behind the counter needs.
-- ---------------------------------------------------------------------------
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage suppliers" ON public.suppliers;
CREATE POLICY "Owners can manage suppliers"
ON public.suppliers FOR ALL
USING (public.is_shop_owner(auth.uid(), shop_id))
WITH CHECK (public.is_shop_owner(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Owners can view supplier debts" ON public.supplier_debts;
CREATE POLICY "Owners can view supplier debts"
ON public.supplier_debts FOR SELECT
USING (public.is_shop_owner(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Owners can record supplier debts" ON public.supplier_debts;
CREATE POLICY "Owners can record supplier debts"
ON public.supplier_debts FOR INSERT
WITH CHECK (public.is_shop_owner(auth.uid(), shop_id));

-- Balances are moved only by the payment function, so a debt can never be marked
-- settled without a payment recorded against it.
DROP POLICY IF EXISTS "Owners can view supplier payments" ON public.supplier_payments;
CREATE POLICY "Owners can view supplier payments"
ON public.supplier_payments FOR SELECT
USING (public.is_shop_owner(auth.uid(), shop_id));

-- ---------------------------------------------------------------------------
-- Restock, now aware that stock can be taken on credit
-- ---------------------------------------------------------------------------
-- The money question and the stock question are separate. Stock arriving is
-- recorded either way; the expense row is the CASH leaving, so it is written
-- only when the stock is actually paid for. On credit, a debt is written
-- instead, and the expense appears later when the supplier is paid.
DROP FUNCTION IF EXISTS public.record_product_restock_atomic(UUID, UUID, INTEGER, NUMERIC, TIMESTAMPTZ, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.record_product_restock_atomic(
  p_shop_id UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_unit_cost NUMERIC,
  p_happened_at TIMESTAMPTZ DEFAULT now(),
  p_notes TEXT DEFAULT NULL,
  p_allocation_mode TEXT DEFAULT 'cash',
  p_paid_now BOOLEAN DEFAULT true,
  p_supplier_id UUID DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_due_date DATE DEFAULT NULL
)
RETURNS TABLE (
  movement_id UUID,
  product_id UUID,
  new_stock_level INTEGER,
  new_cost_price NUMERIC,
  total_cost NUMERIC,
  expense_id UUID,
  debt_id UUID,
  happened_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
  v_old_stock INTEGER;
  v_old_cost NUMERIC;
  v_new_stock INTEGER;
  v_new_cost NUMERIC;
  v_total_cost NUMERIC;
  v_expense_id UUID;
  v_movement_id UUID;
  v_debt_id UUID;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Unit cost must be zero or greater';
  END IF;

  IF NOT public.is_shop_owner(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Only owners can restock inventory';
  END IF;

  IF NOT p_paid_now AND p_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Say who the stock was taken from';
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  v_old_stock := COALESCE(v_product.stock_level, 0);
  v_old_cost := COALESCE(v_product.cost_price, 0);
  v_new_stock := v_old_stock + p_quantity;
  v_total_cost := p_quantity * p_unit_cost;

  IF v_new_stock > 0 THEN
    v_new_cost := ((v_old_stock * v_old_cost) + v_total_cost) / v_new_stock;
  ELSE
    v_new_cost := p_unit_cost;
  END IF;

  UPDATE public.products
  SET stock_level = v_new_stock, cost_price = v_new_cost
  WHERE id = p_product_id;

  IF p_paid_now THEN
    INSERT INTO public.expenses (
      shop_id, category, description, amount, date,
      expense_type, recurrence_unit, allocation_mode, source, payment_method
    ) VALUES (
      p_shop_id, 'Stock Purchase',
      CONCAT('Restock: ', v_product.name, ' (', p_quantity, ' units)'),
      v_total_cost, (COALESCE(p_happened_at, now()))::date,
      'variable', 'none', COALESCE(p_allocation_mode, 'cash'), 'restock',
      NULLIF(trim(COALESCE(p_payment_method, '')), '')
    )
    RETURNING id INTO v_expense_id;
  END IF;

  INSERT INTO public.stock_movements (
    shop_id, product_id, product_name, movement_type, reason,
    quantity, unit_cost, total_cost, notes, happened_at, created_by, expense_id
  ) VALUES (
    p_shop_id, p_product_id, v_product.name, 'in', 'restock',
    p_quantity, p_unit_cost, v_total_cost, p_notes,
    COALESCE(p_happened_at, now()), auth.uid(), v_expense_id
  )
  RETURNING id INTO v_movement_id;

  IF NOT p_paid_now THEN
    INSERT INTO public.supplier_debts (
      shop_id, supplier_id, stock_movement_id, description, amount,
      incurred_on, due_date
    ) VALUES (
      p_shop_id, p_supplier_id, v_movement_id,
      CONCAT(v_product.name, ' (', p_quantity, ' units)'),
      v_total_cost, (COALESCE(p_happened_at, now()))::date, p_due_date
    )
    RETURNING id INTO v_debt_id;
  END IF;

  RETURN QUERY
  SELECT v_movement_id, p_product_id, v_new_stock, v_new_cost,
         v_total_cost, v_expense_id, v_debt_id, COALESCE(p_happened_at, now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_product_restock_atomic(UUID, UUID, INTEGER, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, BOOLEAN, UUID, TEXT, DATE) TO authenticated;

-- ---------------------------------------------------------------------------
-- Paying a supplier
-- ---------------------------------------------------------------------------
-- Writes the payment and the cash-out expense together, so the two cannot drift.
CREATE OR REPLACE FUNCTION public.record_supplier_payment_atomic(
  p_shop_id UUID,
  p_debt_id UUID,
  p_amount NUMERIC,
  p_paid_at TIMESTAMPTZ DEFAULT now(),
  p_payment_method TEXT DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  supplier_debt_id UUID,
  amount NUMERIC,
  new_amount_paid NUMERIC,
  new_balance NUMERIC,
  new_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debt RECORD;
  v_supplier RECORD;
  v_balance NUMERIC;
  v_new_paid NUMERIC;
  v_new_status TEXT;
  v_method TEXT;
  v_expense_id UUID;
  v_payment RECORD;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment must be greater than zero';
  END IF;

  IF NOT public.is_shop_owner(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Only owners can pay suppliers';
  END IF;

  v_method := NULLIF(trim(COALESCE(p_payment_method, '')), '');
  IF v_method IS NOT NULL AND v_method NOT IN ('cash', 'mpesa', 'airtel', 'other') THEN
    RAISE EXCEPTION 'Unknown payment method: %', v_method;
  END IF;

  SELECT sd.* INTO v_debt
  FROM public.supplier_debts AS sd
  WHERE sd.id = p_debt_id AND sd.shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That debt was not found';
  END IF;

  v_balance := v_debt.amount - COALESCE(v_debt.amount_paid, 0);

  IF v_balance <= 0 THEN
    RAISE EXCEPTION 'This one is already settled';
  END IF;

  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'Payment of % is more than the % still owed', p_amount, v_balance;
  END IF;

  SELECT s.* INTO v_supplier FROM public.suppliers AS s WHERE s.id = v_debt.supplier_id;

  v_new_paid := COALESCE(v_debt.amount_paid, 0) + p_amount;
  v_new_status := CASE WHEN v_new_paid >= v_debt.amount THEN 'paid' ELSE 'partially_paid' END;

  UPDATE public.supplier_debts AS sd
  SET amount_paid = v_new_paid, status = v_new_status
  WHERE sd.id = p_debt_id;

  -- Source 'restock' keeps this out of operating expenses, where it would
  -- double-count against COGS. It is stock money, just paid later.
  INSERT INTO public.expenses (
    shop_id, category, description, amount, date,
    expense_type, recurrence_unit, allocation_mode, source, payment_method
  ) VALUES (
    p_shop_id, 'Stock Purchase',
    CONCAT('Paid ', COALESCE(v_supplier.name, 'supplier'), ': ', v_debt.description),
    p_amount, (COALESCE(p_paid_at, now()))::date,
    'variable', 'none', 'cash', 'restock', v_method
  )
  RETURNING id INTO v_expense_id;

  INSERT INTO public.supplier_payments (
    shop_id, supplier_debt_id, supplier_id, amount, paid_at,
    payment_method, payment_reference, expense_id, recorded_by
  ) VALUES (
    p_shop_id, p_debt_id, v_debt.supplier_id, p_amount, COALESCE(p_paid_at, now()),
    v_method, NULLIF(trim(COALESCE(p_payment_reference, '')), ''), v_expense_id, auth.uid()
  )
  RETURNING * INTO v_payment;

  RETURN QUERY
  SELECT v_payment.id, v_payment.supplier_debt_id, v_payment.amount,
         v_new_paid, v_debt.amount - v_new_paid, v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_supplier_payment_atomic(UUID, UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
