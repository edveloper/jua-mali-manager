import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardStats, Service, ServiceSale } from '@/types/inventory';
import { useToast } from '@/hooks/use-toast';

export const useServices = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceSales, setServiceSales] = useState<ServiceSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { shop, isOwner } = useAuth();
  const { toast } = useToast();

  const fetchServices = async () => {
    if (!shop?.id) return;
    try {
      setIsLoading(true);
      const { data, error } = await (supabase.from('services') as any)
        .select('*')
        .eq('shop_id', shop.id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      setServices((data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        category: s.category || 'General',
        costPrice: Number(s.cost_per_service || 0),
        sellingPrice: Number(s.price || 0),
        quantity: Number(s.capacity || 0),
        lowStockThreshold: Number(s.min_capacity_level || 0),
        durationMinutes: Number(s.duration_minutes || 0),
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })));
    } catch (error) {
      console.error('Services error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchServiceSales = async () => {
    if (!shop?.id) return;
    try {
      const { data, error } = await (supabase.from('service_sales') as any)
        .select('*')
        .eq('shop_id', shop.id);

      if (error) throw error;

      setServiceSales((data || []).map((s: any) => {
        const totalAmount = Number(s.total_amount || 0);
        const costAtSale = Number(s.cost_at_sale || 0);
        const qty = Number(s.quantity || 0);
        return {
          id: s.id,
          serviceId: s.service_id,
          serviceName: s.service_name,
          quantity: qty,
          totalAmount,
          profit: totalAmount - (costAtSale * qty),
          staffName: s.staff_name || '',
          sessionTime: s.session_time || '',
          notes: s.notes || '',
          status: s.status || 'completed',
          createdAt: s.created_at,
        };
      }));
    } catch (error) {
      console.error('Service sales error:', error);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchServiceSales();
  }, [shop?.id]);

  const addService = async (serviceData: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!shop?.id || !isOwner) return;
    try {
      const { error } = await (supabase.from('services') as any).insert([{
        shop_id: shop.id,
        name: serviceData.name,
        category: serviceData.category,
        cost_per_service: serviceData.costPrice,
        price: serviceData.sellingPrice,
        capacity: serviceData.quantity,
        min_capacity_level: serviceData.lowStockThreshold,
        duration_minutes: serviceData.durationMinutes || null,
      }]);
      if (error) throw error;
      toast({ title: 'Service added successfully' });
      await fetchServices();
    } catch (error: any) {
      toast({ title: 'Error adding service', description: error.message, variant: 'destructive' });
    }
  };

  const updateService = async (id: string, updates: Partial<Service>) => {
    if (!isOwner) return;
    try {
      const { error } = await (supabase.from('services') as any)
        .update({
          name: updates.name,
          category: updates.category,
          cost_per_service: updates.costPrice,
          price: updates.sellingPrice,
          capacity: updates.quantity,
          min_capacity_level: updates.lowStockThreshold,
          duration_minutes: updates.durationMinutes,
        })
        .eq('id', id);
      if (error) throw error;
      await fetchServices();
    } catch (error: any) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    }
  };

  const deleteService = async (id: string) => {
    if (!isOwner) return;
    try {
      const { error } = await (supabase.from('services') as any)
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Service archived' });
      await fetchServices();
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  const recordServiceSale = async (
    serviceId: string,
    quantity: number,
    meta?: { staffName?: string; sessionTime?: string; notes?: string; status?: 'completed' | 'scheduled' | 'cancelled' }
  ) => {
    if (!shop?.id) return;

    try {
      const { data, error } = await (supabase.rpc('record_service_sale_atomic' as any, {
        p_shop_id: shop.id,
        p_service_id: serviceId,
        p_quantity: quantity,
        p_staff_name: meta?.staffName || null,
        p_session_time: meta?.sessionTime || null,
        p_notes: meta?.notes || null,
        p_status: meta?.status || 'completed',
      }) as any);
      if (error) throw error;

      await fetchServices();
      await fetchServiceSales();
      return Array.isArray(data) ? data[0] : data;
    } catch {
      toast({ title: 'Service transaction failed', variant: 'destructive' });
      return null;
    }
  };

  const getStats = (): DashboardStats => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayData = serviceSales.filter((s) => new Date(s.createdAt) >= today);

    return {
      totalProducts: services.length,
      lowStockCount: services.filter((s) => s.quantity <= s.lowStockThreshold).length,
      totalStockValue: services.reduce((sum, s) => sum + (s.sellingPrice * s.quantity), 0),
      todaySales: todayData.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0),
      todayProfit: todayData.reduce((sum, s) => sum + (Number(s.profit) || 0), 0),
    };
  };

  return {
    services,
    serviceSales,
    isLoading,
    addService,
    updateService,
    deleteService,
    recordServiceSale,
    getStats,
    getLowAvailabilityServices: () => services.filter((s) => s.quantity <= s.lowStockThreshold),
    searchServices: (q: string) => services.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())),
    refreshServices: fetchServices,
  };
};
