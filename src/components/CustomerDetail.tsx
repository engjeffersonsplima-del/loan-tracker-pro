import { Customer } from '@/hooks/useCustomers';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Trash2, Phone, MapPin, CreditCard, MessageCircle, Edit } from 'lucide-react';

interface CustomerDetailProps {
  customer: Customer;
  onBack: () => void;
  onDelete: (id: string) => void;
  onEdit: (customer: Customer) => void;
  onWhatsApp: (phone: string, message: string) => void;
}

export function CustomerDetail({ customer, onBack, onDelete, onEdit, onWhatsApp }: CustomerDetailProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground">{customer.name}</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit(customer)} className="text-primary">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(customer.id)} className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex justify-center">
        <Avatar className="w-24 h-24 border-2 border-primary/20">
          <AvatarImage src={customer.photo_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
            {customer.name[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>

      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          {customer.phone && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Telefone
              </span>
              <span className="text-sm font-medium">{customer.phone}</span>
            </div>
          )}
          {customer.rg && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> RG
              </span>
              <span className="text-sm font-medium">{customer.rg}</span>
            </div>
          )}
          {customer.address && (
            <div className="flex justify-between items-start">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Endereço
              </span>
              <span className="text-sm font-medium text-right max-w-[60%]">{customer.address}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {customer.phone && (
        <Button
          onClick={() => onWhatsApp(customer.phone!, `Olá ${customer.name}!`)}
          className="w-full h-12 rounded-xl text-sm font-semibold bg-green-600 hover:bg-green-700"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Enviar WhatsApp
        </Button>
      )}
    </div>
  );
}
