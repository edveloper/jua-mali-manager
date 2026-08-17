import { useState, useEffect } from 'react';
import { UserPlus, Phone, Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { toAuthEmail, toDisplayIdentity } from '@/lib/identity';

/** Everything an owner can hand over. Owners always hold all of these. */
const PERMISSIONS: { key: string; title: string; detail: string; enabledToast: string; disabledToast: string }[] = [
  {
    key: 'override_price',
    title: 'Agree a price with the customer',
    detail: 'Only within the range you set on each item.',
    enabledToast: 'can now set prices',
    disabledToast: 'can no longer set prices',
  },
  {
    key: 'manage_deni',
    title: 'Handle deni',
    detail: 'See who owes you and record their payments. They still cannot see your profit.',
    enabledToast: 'can now handle deni',
    disabledToast: 'can no longer handle deni',
  },
  {
    key: 'record_expenses',
    title: 'Record spending',
    detail: 'Add costs like transport or airtime. They cannot delete anything already recorded.',
    enabledToast: 'can now record spending',
    disabledToast: 'can no longer record spending',
  },
];

interface Employee {
  id: string;
  user_id: string;
  role: string;
  email: string;
  full_name: string;
  permissions: Record<string, boolean>;
}

export function EmployeeManager() {
  const [showForm, setShowForm] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  
  const { createEmployee, shop, isOwner } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (shop && isOwner) {
      fetchEmployees();
    }
  }, [shop, isOwner]);

  const fetchEmployees = async () => {
    if (!shop) return;

    // 1. Fetch members with role 'employee' (matching DB enum)
    const { data: members, error } = await supabase
      .from('shop_members')
      .select('*')
      .eq('shop_id', shop.id)
      .eq('role', 'employee');

    if (error) {
      console.error('Error fetching employees:', error);
      return;
    }

    if (members && members.length > 0) {
      const userIds = members.map(m => m.user_id);
      
      // 2. Fetch profile data
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
      }

      const employeesWithProfiles = members.map(member => {
        const profile = profiles?.find(p => p.id === member.user_id);
        return {
          id: member.id,
          user_id: member.user_id,
          role: member.role,
          // Fallback to 'No Email' or 'Unknown' if profile doesn't exist yet
          email: profile?.email || 'Invited User',
          full_name: profile?.full_name || 'New Staff',
          permissions: (member.permissions as Record<string, boolean>) || {},
        };
      });

      setEmployees(employeesWithProfiles);
    } else {
      setEmployees([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await createEmployee(toAuthEmail(identifier), password, fullName);

      if (error) {
        toast({
          title: 'Failed to Add Employee',
          description: error.message || 'Could not create employee account',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Employee Added',
          description: `${fullName} can now sign in with ${identifier.trim()}.`,
        });
        setIdentifier('');
        setPassword('');
        setFullName('');
        setShowForm(false);
        // Delay slightly to allow Supabase Auth triggers to create the profile
        setTimeout(fetchEmployees, 1000);
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePermission = async (employee: Employee, key: string, enabled: boolean) => {
    const next = { ...employee.permissions, [key]: enabled };

    // Optimistic: a switch that lags behind the thumb feels broken on a phone.
    setEmployees((prev) =>
      prev.map((e) => (e.id === employee.id ? { ...e, permissions: next } : e))
    );

    const { error } = await supabase.from('shop_members')
      .update({ permissions: next })
      .eq('id', employee.id);

    if (error) {
      setEmployees((prev) =>
        prev.map((e) => (e.id === employee.id ? { ...e, permissions: employee.permissions } : e))
      );
      toast({
        title: 'Could not save',
        description: error.message || 'Permission was not changed.',
        variant: 'destructive',
      });
      return;
    }

    const permission = PERMISSIONS.find((p) => p.key === key);
    toast({
      title: `${employee.full_name} ${enabled ? permission?.enabledToast : permission?.disabledToast}`,
    });
  };

  const messageFromFunctionError = async (error: any, fallback: string) => {
    const response = error?.context;
    if (response && typeof response.json === 'function') {
      try {
        const parsed = await response.json();
        if (parsed?.error) return parsed.error as string;
      } catch {
        // fall through to the generic message
      }
    }
    return fallback;
  };

  const handleResetPassword = async (employee: Employee) => {
    if (newPassword.length < 6) {
      toast({ title: 'Use at least 6 characters', variant: 'destructive' });
      return;
    }

    setIsResetting(true);
    const { data, error } = await supabase.functions.invoke('reset-employee-password', {
      body: { memberId: employee.id, newPassword },
    });
    setIsResetting(false);

    if (error || data?.error) {
      toast({
        title: 'Could not reset it',
        description: error ? await messageFromFunctionError(error, 'Please try again.') : data.error,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'New password set',
      description: `Tell ${employee.full_name} this password. They will choose their own when they sign in.`,
    });
    setNewPassword('');
    setResettingId(null);
  };

  const handleRemoveEmployee = async (employeeId: string, employeeName: string) => {
    const confirmed = window.confirm(
      `Remove ${employeeName} and delete their login?\n\n` +
      `They will no longer be able to sign in. Sales they already recorded are kept.\n\n` +
      `This cannot be undone.`
    );
    if (!confirmed) return;

    // Deleting the shop_members row from here would leave the login behind, so
    // the person could still sign in and their phone number would stay taken.
    const { data, error } = await supabase.functions.invoke('remove-employee', {
      body: { memberId: employeeId },
    });

    let message = '';
    if (error) {
      message = await messageFromFunctionError(error, 'Could not remove employee. Please try again.');
    } else if (data?.error) {
      message = data.error;
    }

    if (message) {
      toast({ title: 'Could not remove', description: message, variant: 'destructive' });
      return;
    }

    toast({
      title: 'Employee Removed',
      description: `${employeeName} can no longer sign in.`,
    });
    fetchEmployees();
  };

  if (!isOwner) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {employees.length === 0
            ? 'Nobody added yet'
            : `${employees.length} ${employees.length === 1 ? 'person' : 'people'}`}
        </p>
        <Button onClick={() => setShowForm(!showForm)} size="sm" variant={showForm ? 'ghost' : 'default'}>
          {showForm ? 'Cancel' : <><UserPlus className="h-4 w-4 mr-1.5" /> Add someone</>}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="sheet space-y-4">
          <p className="text-sm text-muted-foreground">
            Give your employee a temporary password. The first time they sign in, they
            will be asked to choose their own.
          </p>

          <div className="space-y-2">
            <Label htmlFor="empName">Their name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="empName"
                placeholder="Jane Wanjiku"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="empIdentifier">Phone number or email</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="empIdentifier"
                placeholder="0712 345 678"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This is what they will use to sign in.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="empPassword">Temporary password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="empPassword"
                type="password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                minLength={6}
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add them'}
          </Button>
        </form>
      )}

      <div className="grid gap-3">
        {employees.length === 0 ? (
          <div className="sheet">
            <p className="text-sm text-muted-foreground">
              Anyone you add gets their own login. They can sell and check stock, but never see
              what you paid for things, your spending, or your profit.
            </p>
          </div>
        ) : (
          employees.map((employee) => (
            <div key={employee.id} className="sheet space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{employee.full_name}</p>
                  <p className="text-sm text-muted-foreground truncate">{toDisplayIdentity(employee.email)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setResettingId(resettingId === employee.id ? null : employee.id);
                      setNewPassword('');
                    }}
                    className="text-xs text-muted-foreground active:text-primary"
                  >
                    {resettingId === employee.id ? 'Cancel' : 'New password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveEmployee(employee.id, employee.full_name)}
                    className="text-xs text-muted-foreground active:text-destructive"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {resettingId === employee.id && (
                <div className="pt-3 border-t border-border/70 space-y-2">
                  <Label htmlFor={`pw-${employee.id}`}>Temporary password</Label>
                  <Input
                    id={`pw-${employee.id}`}
                    type="text"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tell it to them yourself. They will be asked to choose their own the
                    next time they sign in.
                  </p>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleResetPassword(employee)}
                    disabled={isResetting || newPassword.length < 6}
                  >
                    {isResetting ? 'Setting...' : 'Set this password'}
                  </Button>
                </div>
              )}

              <div className="pt-3 border-t border-border/70 space-y-3">
                {PERMISSIONS.map((permission) => (
                  <label key={permission.key} className="flex items-center justify-between gap-3 cursor-pointer">
                    <span className="text-sm">
                      {permission.title}
                      <span className="block text-xs text-muted-foreground">{permission.detail}</span>
                    </span>
                    <Switch
                      checked={employee.permissions?.[permission.key] === true}
                      onCheckedChange={(checked) => handleTogglePermission(employee, permission.key, checked)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
