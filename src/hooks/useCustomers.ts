import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Customer {
  id: string;
  name: string;
  address: string | null;
  rg: string | null;
  phone: string | null;
  photo_url: string | null;
  user_id: string;
  created_at: string;
}

export function useCustomers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name');
    if (error) {
      toast.error('Erro ao carregar clientes');
      console.error(error);
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const addCustomer = useCallback(async (data: { name: string; address?: string; rg?: string; phone?: string; photo_url?: string }) => {
    if (!user) return null;
    const { data: created, error } = await supabase
      .from('customers')
      .insert({
        user_id: user.id,
        name: data.name,
        address: data.address || null,
        rg: data.rg || null,
        phone: data.phone || null,
        photo_url: data.photo_url || null,
      })
      .select()
      .single();
    if (error) {
      toast.error('Erro ao cadastrar cliente');
      console.error(error);
      return null;
    }
    toast.success('Cliente cadastrado!');
    await fetchCustomers();
    return created;
  }, [user, fetchCustomers]);

  const updateCustomer = useCallback(async (id: string, data: Partial<Customer>) => {
    if (!user) return;
    const { error } = await supabase
      .from('customers')
      .update(data)
      .eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar cliente');
    } else {
      toast.success('Cliente atualizado!');
      await fetchCustomers();
    }
  }, [user, fetchCustomers]);

  const deleteCustomer = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Erro ao excluir cliente');
    } else {
      toast.success('Cliente excluído!');
      await fetchCustomers();
    }
  }, [user, fetchCustomers]);

  const uploadPhoto = useCallback(async (file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from('customer-photos')
      .upload(path, file);
    if (error) {
      toast.error('Erro ao fazer upload da foto');
      console.error(error);
      return null;
    }
    const { data: { publicUrl } } = supabase.storage
      .from('customer-photos')
      .getPublicUrl(path);
    return publicUrl;
  }, [user]);

  return { customers, loading, addCustomer, updateCustomer, deleteCustomer, uploadPhoto, refetch: fetchCustomers };
}
