import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  shop: any | null;
  shopMember: any | null;
  isOwner: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password?: string) => Promise<{ data: any; error: any }>;
  signUp: (
    email: string,
    password?: string,
    fullName?: string,
    shopName?: string,
    profile?: {
      businessCategory?: string;
      offeringMode?: string;
      singleOffering?: boolean;
    }
  ) => Promise<{ data: any; error: any }>;
  refreshShopData: () => Promise<void>;
  createEmployee: (email: string, password?: string, fullName?: string) => Promise<{ data: any; error: any }>;
  updateShopProfile: (updates: {
    name?: string;
    business_category?: string;
    offering_mode?: string;
    single_offering?: boolean;
    currency?: string;
  }) => Promise<{ data: any; error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [shop, setShop] = useState<any | null>(null);
  const [shopMember, setShopMember] = useState<any | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchShopData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('shop_members')
        .select(`
          role,
          created_at,
          shops (
            id,
            name,
            business_category,
            offering_mode,
            single_offering,
            currency,
            created_at
          )
        `)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setShop(data.shops);
        setShopMember(data);
        setIsOwner(data.role === 'owner');
      } else {
        setShop(null);
        setShopMember(null);
        setIsOwner(false);
      }
    } catch (err) {
      console.error("Auth Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const refreshShopData = async () => {
    if (currentUser) {
      await fetchShopData(currentUser.id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userObj = session?.user ?? null;
      setCurrentUser(userObj);
      if (userObj) {
        fetchShopData(userObj.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const userObj = session?.user ?? null;
      setCurrentUser(userObj);
      if (userObj) {
        fetchShopData(userObj.id);
      } else {
        setShop(null);
        setShopMember(null);
        setIsOwner(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading) return;
    const timeout = window.setTimeout(() => {
      console.warn('Auth loading timeout reached, releasing loading state.');
      setLoading(false);
    }, 12000);
    return () => window.clearTimeout(timeout);
  }, [loading]);

  const signIn = async (email: string, password?: string) => {
    return await supabase.auth.signInWithPassword({
      email,
      password: password || '',
    });
  };

  const signUp = async (
    email: string,
    password?: string,
    fullName?: string,
    shopName?: string,
    profile?: {
      businessCategory?: string;
      offeringMode?: string;
      singleOffering?: boolean;
    }
  ) => {
    // 1. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: password || '',
      options: { data: { full_name: fullName } }
    });

    if (authError || !authData.user) return { data: authData, error: authError };

    // Set session immediately so RLS policies recognize the user for the next steps
    if (authData.session) {
      await supabase.auth.setSession(authData.session);
    }

    try {
      // 2. Create Shop
      const { data: shopData, error: shopError } = await (supabase.from('shops') as any)
        .insert([{
          name: shopName || `${fullName}'s Shop`,
          business_category: profile?.businessCategory || 'retail',
          offering_mode: profile?.offeringMode || 'products',
          single_offering: Boolean(profile?.singleOffering),
          currency: 'KES'
        }])
        .select()
        .single();

      if (shopError) throw shopError;

      // 3. Create Membership as Owner
      const { error: memberError } = await (supabase.from('shop_members') as any)
        .insert([{
          shop_id: shopData.id,
          user_id: authData.user.id,
          role: 'owner'
        }]);

      if (memberError) throw memberError;

      // 4. Sync local state
      await fetchShopData(authData.user.id);
      return { data: authData, error: null };
    } catch (err: any) {
      return { data: authData, error: err };
    }
  };

  const createEmployee = async (email: string, password?: string, fullName?: string) => {
    if (!shop?.id || !isOwner) {
      return { data: null, error: { message: "Only shop owners can create employees" } };
    }

    // Must go through the Edge Function. Creating the user from here would swap
    // this browser's session over to the new employee and log the owner out.
    try {
      const { data, error } = await supabase.functions.invoke('create-employee', {
        body: { email, password, fullName },
      });

      if (error) {
        // FunctionsHttpError keeps the real message in the response body.
        let message = 'Could not create the employee account';
        const response = (error as any)?.context;
        if (response && typeof response.json === 'function') {
          try {
            const parsed = await response.json();
            if (parsed?.error) message = parsed.error;
          } catch {
            // fall through to the generic message
          }
        } else if (error.message) {
          message = error.message;
        }
        return { data: null, error: { message } };
      }

      if (data?.error) return { data: null, error: { message: data.error } };

      return { data, error: null };
    } catch (err: any) {
      console.error("Employee creation error:", err);
      return { data: null, error: { message: err?.message || 'Could not reach the server' } };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateShopProfile = async (updates: {
    name?: string;
    business_category?: string;
    offering_mode?: string;
    single_offering?: boolean;
    currency?: string;
  }) => {
    if (!shop?.id || !isOwner) {
      return { data: null, error: { message: "Only shop owners can update shop settings" } };
    }

    const { data, error } = await (supabase.from('shops') as any)
      .update(updates)
      .eq('id', shop.id)
      .select()
      .single();

    if (!error) await refreshShopData();
    return { data, error };
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user: currentUser, 
        shop, 
        shopMember, 
        isOwner, 
        loading, 
        signOut, 
        signIn,
        signUp,
        refreshShopData,
        createEmployee,
        updateShopProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
