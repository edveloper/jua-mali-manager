import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type ShopRole = 'owner' | 'employee';

interface ShopMember {
  id: string;
  shop_id: string;
  user_id: string;
  role: ShopRole;
}

interface Shop {
  id: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  shopMember: ShopMember | null;
  shop: Shop | null;
  isOwner: boolean;
  isEmployee: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string, fullName: string, shopName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  createEmployee: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [shopMember, setShopMember] = useState<ShopMember | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch shop membership
      const { data: memberData, error: memberError } = await supabase
        .from('shop_members')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (memberError) {
        console.error('Error fetching shop member:', memberError);
        return;
      }

      if (memberData) {
        setShopMember(memberData as ShopMember);

        // Fetch shop details
        const { data: shopData, error: shopError } = await supabase
          .from('shops')
          .select('*')
          .eq('id', memberData.shop_id)
          .maybeSingle();

        if (shopError) {
          console.error('Error fetching shop:', shopError);
        } else if (shopData) {
          setShop(shopData as Shop);
        }
      }
    } catch (error) {
      console.error('Error in fetchUserData:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check for existing session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserData(session.user.id).finally(() => {
          if (mounted) {
            setIsLoading(false);
          }
        });
      } else {
        setIsLoading(false);
      }
    });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('Auth state changed:', event, session?.user?.email);
        
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchUserData(session.user.id);
        } else {
          setShopMember(null);
          setShop(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, shopName?: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) return { error };

    // If this is a new owner, create shop and membership
    if (data.user && shopName) {
      // Create shop
      const { data: newShop, error: shopError } = await supabase
        .from('shops')
        .insert({ name: shopName })
        .select()
        .single();

      if (shopError) {
        console.error('Error creating shop:', shopError);
        return { error: shopError };
      }

      // Create owner membership
      const { error: memberError } = await supabase
        .from('shop_members')
        .insert({
          shop_id: newShop.id,
          user_id: data.user.id,
          role: 'owner',
        });

      if (memberError) {
        console.error('Error creating membership:', memberError);
        return { error: memberError };
      }

      // Manually fetch the data after creation
      await fetchUserData(data.user.id);
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setShopMember(null);
    setShop(null);
  };

  const createEmployee = async (email: string, password: string, fullName: string) => {
    if (!shop || !shopMember || shopMember.role !== 'owner') {
      return { error: { message: 'Only owners can create employees' } };
    }

    // Create the employee account
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) return { error };

    if (data.user) {
      // Add employee to shop
      const { error: memberError } = await supabase
        .from('shop_members')
        .insert({
          shop_id: shop.id,
          user_id: data.user.id,
          role: 'employee',
        });

      if (memberError) {
        console.error('Error adding employee to shop:', memberError);
        return { error: memberError };
      }
    }

    return { error: null };
  };

  const isOwner = shopMember?.role === 'owner';
  const isEmployee = shopMember?.role === 'employee';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        shopMember,
        shop,
        isOwner,
        isEmployee,
        isLoading,
        signUp,
        signIn,
        signOut,
        createEmployee,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}