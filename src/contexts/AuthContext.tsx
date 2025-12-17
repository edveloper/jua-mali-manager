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
  signUp: (email: string, password?: string, fullName?: string, shopName?: string) => Promise<{ data: any; error: any }>;
  refreshShopData: () => Promise<void>;
  createEmployee: (email: string, password?: string, fullName?: string) => Promise<{ data: any; error: any }>;
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

  const signIn = async (email: string, password?: string) => {
    return await supabase.auth.signInWithPassword({
      email,
      password: password || '',
    });
  };

  const signUp = async (email: string, password?: string, fullName?: string, shopName?: string) => {
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
        .insert([{ name: shopName || `${fullName}'s Shop` }])
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

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: password || '123456',
        options: { data: { full_name: fullName } }
      });

      if (authError || !authData.user) throw authError;

      const { error: memberError } = await (supabase.from('shop_members') as any)
        .insert([{
          shop_id: shop.id,
          user_id: authData.user.id,
          role: 'attendant'
        }]);

      if (memberError) throw memberError;

      return { data: authData, error: null };
    } catch (err: any) {
      console.error("Employee creation error:", err);
      return { data: null, error: err };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
        createEmployee
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