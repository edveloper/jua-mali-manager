import { useState } from 'react';
import { UserPlus, Users, Mail, Lock, User, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface Employee {
  id: string;
  user_id: string;
  role: string;
  email: string;
  full_name: string;
}

export function EmployeeManager() {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
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
      // Fetch profile data for each member
      const userIds = members.map(m => m.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        return;
      }

      const employeesWithProfiles = members.map(member => {
        const profile = profiles?.find(p => p.id === member.user_id);
        return {
          id: member.id,
          user_id: member.user_id,
          role: member.role,
          email: profile?.email || 'Unknown',
          full_name: profile?.full_name || 'Unknown',
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
      const { error } = await createEmployee(email, password, fullName);
      
      if (error) {
        toast({
          title: 'Failed to Add Employee',
          description: error.message || 'Could not create employee account',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Employee Added',
          description: `${fullName} can now log in with their credentials.`,
        });
        setEmail('');
        setPassword('');
        setFullName('');
        setShowForm(false);
        fetchEmployees();
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

  if (!isOwner) {
    return null;
  }

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
        <form onSubmit={handleSubmit} className="stat-card space-y-4">
          <p className="text-sm text-muted-foreground">
            Create login credentials for your employee. They will only be able to record sales.
          </p>

          <div className="space-y-2">
            <Label htmlFor="empName">Employee Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="empName"
                type="text"
                placeholder="Jane Wanjiku"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="empEmail">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="empEmail"
                type="email"
                placeholder="employee@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="empPassword">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="empPassword"
                type="password"
                placeholder="Create a password"
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

      {/* Employee List */}
      <div className="space-y-2">
        {employees.length === 0 ? (
          <div className="stat-card text-center py-6">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No employees yet</p>
            <p className="text-muted-foreground text-xs">Add employees to help manage your shop</p>
          </div>
        ) : (
          employees.map((employee) => (
            <div key={employee.id} className="stat-card flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{employee.full_name}</p>
                <p className="text-sm text-muted-foreground">{employee.email}</p>
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
          ))
        )}
      </div>
    </div>
  );
}
