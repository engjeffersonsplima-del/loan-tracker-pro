import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ScheduledMessage {
  id: string;
  user_id: string;
  loan_id: string | null;
  customer_id: string | null;
  phone: string;
  message_text: string;
  recurrence: string;
  status: string;
  next_send_at: string;
  last_sent_at: string | null;
  created_at: string;
}

export function useScheduledMessages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('scheduled_messages')
      .select('*')
      .order('next_send_at', { ascending: true });
    if (error) {
      console.error(error);
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const addMessage = useCallback(async (data: {
    loanId?: string;
    customerId?: string;
    phone: string;
    messageText: string;
    recurrence: string;
    nextSendAt: string;
  }) => {
    if (!user) return;
    const { error } = await supabase.from('scheduled_messages').insert({
      user_id: user.id,
      loan_id: data.loanId || null,
      customer_id: data.customerId || null,
      phone: data.phone,
      message_text: data.messageText,
      recurrence: data.recurrence,
      next_send_at: data.nextSendAt,
    });
    if (error) {
      toast.error('Erro ao agendar mensagem');
      console.error(error);
    } else {
      toast.success('Mensagem agendada!');
      await fetchMessages();
    }
  }, [user, fetchMessages]);

  const toggleStatus = useCallback(async (id: string, currentStatus: string) => {
    if (!user) return;
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    const { error } = await supabase
      .from('scheduled_messages')
      .update({ status: newStatus })
      .eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      toast.success(newStatus === 'active' ? 'Mensagem ativada!' : 'Mensagem pausada!');
      await fetchMessages();
    }
  }, [user, fetchMessages]);

  const deleteMessage = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('scheduled_messages')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Erro ao excluir mensagem');
    } else {
      toast.success('Mensagem excluída!');
      await fetchMessages();
    }
  }, [user, fetchMessages]);

  const sendWhatsApp = useCallback((phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${fullPhone}?text=${encoded}`, '_blank');
  }, []);

  return { messages, loading, addMessage, toggleStatus, deleteMessage, sendWhatsApp, refetch: fetchMessages };
}
