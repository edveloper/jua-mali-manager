ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS expense_type TEXT NOT NULL DEFAULT 'one_off',
ADD COLUMN IF NOT EXISTS recurrence_unit TEXT NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS allocation_mode TEXT NOT NULL DEFAULT 'cash',
ADD COLUMN IF NOT EXISTS effective_from DATE,
ADD COLUMN IF NOT EXISTS effective_to DATE;

ALTER TABLE public.expenses
DROP CONSTRAINT IF EXISTS expenses_expense_type_check;

ALTER TABLE public.expenses
ADD CONSTRAINT expenses_expense_type_check
CHECK (expense_type IN ('one_off', 'variable', 'recurring'));

ALTER TABLE public.expenses
DROP CONSTRAINT IF EXISTS expenses_recurrence_unit_check;

ALTER TABLE public.expenses
ADD CONSTRAINT expenses_recurrence_unit_check
CHECK (recurrence_unit IN ('none', 'daily', 'weekly', 'monthly', 'annual'));

ALTER TABLE public.expenses
DROP CONSTRAINT IF EXISTS expenses_allocation_mode_check;

ALTER TABLE public.expenses
ADD CONSTRAINT expenses_allocation_mode_check
CHECK (allocation_mode IN ('cash', 'accrual'));
