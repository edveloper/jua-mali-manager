import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ShopMemberSummary {
  userId: string;
  role: string;
  fullName: string;
}

/**
 * Everyone in the shop, so a sale's sold_by can be shown as a name instead of a
 * UUID. Profiles are kept after an account is deleted, which is what lets an old
 * sale still say who made it.
 */
export const useShopMembers = () => {
  const [members, setMembers] = useState<ShopMemberSummary[]>([]);
  const { shop, user } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!shop?.id) {
        setMembers([]);
        return;
      }

      const { data: memberRows, error } = await supabase
        .from('shop_members')
        .select('user_id, role')
        .eq('shop_id', shop.id);

      if (error || !memberRows?.length) {
        if (!cancelled && error) console.error('Shop members error:', error);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', memberRows.map((m) => m.user_id));

      if (cancelled) return;

      setMembers(
        memberRows.map((m) => ({
          userId: m.user_id,
          role: m.role,
          fullName: profiles?.find((p) => p.id === m.user_id)?.full_name || 'Staff',
        }))
      );
    };

    load();
    return () => { cancelled = true; };
  }, [shop?.id]);

  /** First name only -- a sales list has no room for more. */
  const nameFor = (userId?: string | null) => {
    if (!userId) return '';
    if (userId === user?.id) return 'You';
    const match = members.find((m) => m.userId === userId);
    if (!match) return 'Staff';
    return match.fullName.trim().split(' ')[0];
  };

  /** Real name, for anything leaving the app. "You" means nothing in a file
      somebody else opens. */
  const fullNameFor = (userId?: string | null) => {
    if (!userId) return '';
    return members.find((m) => m.userId === userId)?.fullName ?? 'Staff';
  };

  return { members, nameFor, fullNameFor };
};
