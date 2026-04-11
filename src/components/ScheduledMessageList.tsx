import { ScheduledMessage } from '@/hooks/useScheduledMessages';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Pause, Play, Trash2, Send } from 'lucide-react';

interface ScheduledMessageListProps {
  messages: ScheduledMessage[];
  onToggle: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onSendNow: (phone: string, message: string) => void;
}

function recurrenceLabel(r: string) {
  if (r === 'hourly') return 'A cada hora';
  if (r === 'daily') return 'Diariamente';
  return 'Uma vez';
}

export function ScheduledMessageList({ messages, onToggle, onDelete, onSendNow }: ScheduledMessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma mensagem agendada</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map(msg => (
        <Card key={msg.id} className="border-border">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{msg.phone}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{msg.message_text}</p>
              </div>
              <Badge variant={msg.status === 'active' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                {msg.status === 'active' ? 'Ativa' : msg.status === 'paused' ? 'Pausada' : 'Concluída'}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{recurrenceLabel(msg.recurrence)}</span>
              <span>Próximo: {new Date(msg.next_send_at).toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex gap-1.5 pt-1">
              <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs flex-1"
                onClick={() => onSendNow(msg.phone, msg.message_text)}>
                <Send className="h-3 w-3 mr-1" /> Enviar agora
              </Button>
              <Button size="sm" variant="outline" className="h-8 rounded-lg"
                onClick={() => onToggle(msg.id, msg.status)}>
                {msg.status === 'active' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </Button>
              <Button size="sm" variant="outline" className="h-8 rounded-lg text-destructive"
                onClick={() => onDelete(msg.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
