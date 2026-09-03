import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

/**
 * Everything an owner may change about their own shop.
 *
 * Written out rather than left as a loose object because these end up on a
 * document a customer reads, and a typo in a key would fail silently: PostgREST
 * would reject the unknown column and the field would appear to save.
 */
export interface ShopProfileUpdate {
  name?: string;
  business_category?: string;
  offering_mode?: string;
  single_offering?: boolean;
  currency?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  kra_pin?: string | null;
  logo_url?: string | null;
  branch_label?: string | null;
  vat_registered?: boolean;
  vat_number?: string | null;
  mpesa_kind?: 'paybill' | 'till';
  mpesa_paybill?: string | null;
  mpesa_account?: string | null;
  cheque_payee?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
  bank_account?: string | null;
  default_terms_days?: number;
}

/** Permission keys stored in shop_members.permissions. Owners implicitly hold all. */
export type ShopPermission =
  | 'override_price'
  | 'record_expenses'
  | 'manage_deni'
  | 'restock_stock';

interface AuthContextType {
  user: User | null;
  shop: any | null;
  shopMember: any | null;
  isOwner: boolean;
  /** Owners get everything; employees only what the owner has switched on. */
  can: (permission: ShopPermission) => boolean;
  /** True while an employee is still on the password their owner typed for them. */
  mustChangePassword: boolean;
  completePasswordSetup: (newPassword: string) => Promise<{ error: any }>;
  sendPasswordReset: (email: string) => Promise<{ error: any }>;
  /** True after arriving from a reset link, until a new password is saved. */
  isRecovering: boolean;
  /**
   * True once a membership lookup has actually completed. Stays false if the
   * lookup errors, so a flaky connection is never mistaken for "no shop".
   */
  membershipResolved: boolean;
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
  /** Every shop this account belongs to, for the switcher. */
  shops: { id: string; name: string; branchLabel: string | null; businessId: string | null; role: string }[];
  switchShop: (shopId: string) => void;
  createEmployee: (email: string, password?: string, fullName?: string) => Promise<{ data: any; error: any }>;
  updateShopProfile: (updates: ShopProfileUpdate) => Promise<{ data: any; error: any }>;
}

/*
 * Which shop they were last looking at.
 *
 * Per browser rather than per account on purpose: it is a convenience, not a
 * setting, and the value is checked against real memberships on every load, so
 * a stale id or a shop somebody has been removed from simply falls back to the
 * first one they do belong to.
 */
const ACTIVE_SHOP_KEY = 'dukakonnect:active-shop';

const readActiveShop = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_SHOP_KEY);
  } catch {
    return null;
  }
};

const writeActiveShop = (shopId: string) => {
  try {
    localStorage.setItem(ACTIVE_SHOP_KEY, shopId);
  } catch {
    // Private mode. The app still works, it just forgets which shop.
  }
};

const clearActiveShop = () => {
  try {
    localStorage.removeItem(ACTIVE_SHOP_KEY);
  } catch {
    // Nothing to do.
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  /*
   * Every shop this person belongs to, and which one they are looking at.
   *
   * This used to be a single shop fetched with .maybeSingle(), which PostgREST
   * treats as an error the moment a second row exists. Anyone added as staff to
   * a second shop would not have seen the wrong shop, they would have been
   * unable to sign in at all.
   *
   * shop, shopMember and isOwner are derived from the active membership rather
   * than held as their own state. Three copies of one fact is three chances for
   * them to disagree during a switch.
   */
  const [memberships, setMemberships] = useState<any[]>([]);

  /*
   * The same list, readable immediately.
   *
   * switchShop checks that the target is somewhere this person actually
   * belongs. Reading that from state made creating a shop and moving to it
   * impossible: the refresh sets state, but the handler that called it is still
   * running with the array captured at its last render, so the shop created a
   * moment ago is not in it yet and the switch is silently refused. Which is
   * exactly what "welcome to your new shop, still showing the old one" was.
   *
   * The ref is written synchronously by the fetch, so it is already correct by
   * the time an awaited refresh returns.
   */
  const membershipsRef = useRef<any[]>([]);
  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [membershipResolved, setMembershipResolved] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchShopData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('shop_members')
        .select(`
          role,
          permissions,
          created_at,
          shops (
            id,
            name,
            business_category,
            offering_mode,
            single_offering,
            currency,
            created_at,
            address,
            phone,
            email,
            kra_pin,
            logo_url,
            branch_label,
            vat_registered,
            vat_number,
            mpesa_kind,
            mpesa_paybill,
            mpesa_account,
            cheque_payee,
            bank_name,
            bank_branch,
            bank_account,
            default_terms_days
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // A membership whose shop failed to load is not a shop they can use.
      const rows = (data || []).filter((row: any) => row.shops);
      membershipsRef.current = rows;
      setMemberships(rows);

      // The one they were last looking at, if they still belong to it. Falling
      // back to the first keeps a signed-in person on something real rather
      // than a blank dashboard.
      const remembered = readActiveShop();
      const chosen =
        rows.find((row: any) => row.shops.id === remembered) ?? rows[0] ?? null;
      setActiveShopId(chosen ? chosen.shops.id : null);

      // Set only on a clean lookup. If the query threw, we genuinely don't know
      // whether they have a shop, and must not act as if they don't.
      setMembershipResolved(true);
    } catch (err) {
      console.error("Auth Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const activeMembership =
    memberships.find((m: any) => m.shops?.id === activeShopId) ?? null;
  const shop = activeMembership?.shops ?? null;
  const shopMember = activeMembership;
  const isOwner = activeMembership?.role === 'owner';

  /** Every shop, with its branches grouped, for the switcher. */
  const shops = memberships.map((m: any) => ({
    id: m.shops.id,
    name: m.shops.name,
    branchLabel: m.shops.branch_label ?? null,
    businessId: m.shops.business_id ?? null,
    role: m.role as string,
  }));

  const switchShop = (shopId: string) => {
    // Only somewhere they actually belong. A stale id in storage, or a shop
    // they have since been removed from, must not blank the app.
    if (!membershipsRef.current.some((m: any) => m.shops?.id === shopId)) return;
    setActiveShopId(shopId);
    writeActiveShop(shopId);
  };

  const refreshShopData = async () => {
    if (currentUser) {
      await fetchShopData(currentUser.id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        const userObj = session?.user ?? null;
        setCurrentUser(userObj);
        if (userObj) {
          fetchShopData(userObj.id);
        } else {
          setLoading(false);
        }
      })
      // An expired or revoked refresh token rejects here. Without this the
      // promise fails silently, setLoading(false) never runs, and the app hangs
      // on the splash until the 12s failsafe fires.
      .catch((err) => {
        console.warn('Could not restore previous session:', err?.message || err);
        setCurrentUser(null);
        membershipsRef.current = [];
        setMemberships([]);
        setActiveShopId(null);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase signs the user in when they follow a reset link. Without this
      // flag they would land straight in the app and never be asked for the new
      // password they came to set.
      if (event === 'PASSWORD_RECOVERY') setIsRecovering(true);

      const userObj = session?.user ?? null;
      setCurrentUser(userObj);
      if (userObj) {
        fetchShopData(userObj.id);
      } else {
        membershipsRef.current = [];
        setMemberships([]);
        setActiveShopId(null);
        setMembershipResolved(false);
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
      // 2. Create the shop and its owner membership in one server-side call.
      //    Clients can no longer insert into shops or shop_members directly --
      //    that pair of permissions was what allowed a user to add themselves as
      //    owner of somebody else's shop.
      const { error: shopError } = await supabase.rpc('create_shop_with_owner', {
        p_name: shopName || `${fullName}'s Shop`,
        p_business_category: profile?.businessCategory || 'retail',
        p_offering_mode: profile?.offeringMode || 'products',
        p_single_offering: Boolean(profile?.singleOffering),
        p_currency: 'KES',
      });

      if (shopError) throw shopError;

      // 3. Sync local state
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
        // The active shop, not a guess. An owner with two shops was
        // previously refused outright.
        body: { email, password, fullName, shopId: shop.id },
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
    // A stale or already-revoked refresh token makes the server-side sign-out
    // fail, and the local session survives that failure -- which is exactly the
    // state someone is in when sign-out "does nothing". Fall back to a local
    // sign-out, which never touches the network.
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn('Sign out request failed, clearing local session:', error.message);
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }

    // onAuthStateChange does not fire when the call above failed, so the UI
    // cannot rely on it to reset.
    setCurrentUser(null);
    membershipsRef.current = [];
    setMemberships([]);
    setActiveShopId(null);
    clearActiveShop();
    setMembershipResolved(false);
    setLoading(false);
  };

  // Mirrors public.member_can() in the database. This is only for hiding UI --
  // the RPC re-checks it server-side, so a tampered client gains nothing.
  const can = (permission: ShopPermission) => {
    if (isOwner) return true;
    return shopMember?.permissions?.[permission] === true;
  };

  // Set by the create-employee function; cleared here in the same call that
  // changes the password, so the two can never drift apart.
  const mustChangePassword = Boolean(currentUser?.user_metadata?.must_change_password);

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    return { error };
  };

  const completePasswordSetup = async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { must_change_password: false },
    });

    // Update immediately rather than waiting on the USER_UPDATED event, so the
    // gate closes the moment the call succeeds.
    if (!error && data?.user) {
      setCurrentUser(data.user);
      setIsRecovering(false);
    }
    return { error };
  };

  const updateShopProfile = async (updates: ShopProfileUpdate) => {
    if (!shop?.id || !isOwner) {
      return { data: null, error: { message: "Only shop owners can update shop settings" } };
    }

    const { data, error } = await supabase.from('shops')
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
        shops,
        switchShop,
        can,
        mustChangePassword,
        completePasswordSetup,
        sendPasswordReset,
        isRecovering,
        membershipResolved,
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
