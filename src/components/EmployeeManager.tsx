import { useState, useEffect } from 'react';
import { UserPlus, Users, Phone, Lock, User, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { toAuthEmail, toDisplayIdentity } from '@/lib/identity';

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
          permissions: (member as any).permissions || {},
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

    const { error } = await (supabase.from('shop_members') as any)
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

    toast({
      title: enabled
        ? `${employee.full_name} can now set prices`
        : `${employee.full_name} can no longer set prices`,
    });
  };

  const handleRemoveEmployee = async (employeeId: string, employeeName: string) => {
    const confirmed = window.confirm(`Remove ${employeeName} from your shop?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('shop_members')
      .delete()
      .eq('id', employeeId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Could not remove employee. Please try again.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Employee Removed',
        description: `${employeeName} has been removed from your shop.`,
      });
      fetchEmployees();
    }
  };

  if (!isOwner) return null;

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5" />
          Employees
        </h2>
        <Button 
          onClick={() => setShowForm(!showForm)}
          size="sm"
          variant={showForm ? 'outline' : 'default'}
        >
          <UserPlus className="h-4 w-4 mr-1" />
          {showForm ? 'Cancel' : 'Add Employee'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="stat-card space-y-4 bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">
            Give your employee a temporary password. The first time they sign in, they
            will be asked to choose their own.
          </p>

          <div className="space-y-2">
            <Label htmlFor="empName">Employee Name</Label>
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
            <Label htmlFor="empIdentifier">Phone Number or Email</Label>
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
            <Label htmlFor="empPassword">Temporary Password</Label>
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
            {isSubmitting ? 'Creating Account...' : 'Create Employee Account'}
          </Button>
        </form>
      )}

      <div className="grid gap-3">
        {employees.length === 0 ? (
          <div className="stat-card text-center py-10 border rounded-lg border-dashed">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm font-medium">No employees yet</p>
            <p className="text-muted-foreground text-xs">Staff you add will appear here.</p>
          </div>
        ) : (
          employees.map((employee) => (
            <div key={employee.id} className="stat-card p-4 bg-card rounded-lg border shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {employee.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-foreground leading-none mb-1">{employee.full_name}</p>
                    <p className="text-sm text-muted-foreground">{toDisplayIdentity(employee.email)}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveEmployee(employee.id, employee.full_name)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <label className="flex items-center justify-between gap-3 pt-3 border-t border-border/50 cursor-pointer">
                <span className="text-sm">
                  Can agree a price with the customer
                  <span className="block text-xs text-muted-foreground">
                    Only within the range you set on each item.
                  </span>
                </span>
                <Switch
                  checked={employee.permissions?.override_price === true}
                  onCheckedChange={(checked) =>
                    handleTogglePermission(employee, 'override_price', checked)
                  }
                />
              </label>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
