import { useState } from 'react';
import { Customer } from '@/hooks/useCustomers';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ArrowLeft, Trash2, Phone, MapPin, CreditCard, MessageCircle, Edit, Download, DollarSign } from 'lucide-react';
import { DBLoan } from '@/hooks/useLoansDB';
import { computeBalanceBreakdown } from '@/lib/loanCalculations';
import { toast } from 'sonner';

interface CustomerDetailProps {
  customer: Customer;
  onBack: () => void;
  onDelete: (id: string) => void;
  onEdit: (customer: Customer) => void;
  onWhatsApp: (phone: string, message: string) => void;
  loans?: DBLoan[];
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CustomerDetail({ customer, onBack, onDelete, onEdit, onWhatsApp, loans = [] }: CustomerDetailProps) {
  const [photoOpen, setPhotoOpen] = useState(false);

  const customerLoans = loans.filter(
    l => l.customer_id === customer.id || l.borrower_name.toLowerCase() === customer.name.toLowerCase()
  );
  const totalOwed = customerLoans
    .filter(l => l.status !== 'pago')
    .reduce((sum, l) => sum + computeBalanceBreakdown(l).remaining, 0);

  const handleDownloadPhoto = async () => {
    if (!customer.photo_url) return;
    try {
      const res = await fetch(customer.photo_url);
      const blob = await res.blob();
      // Convert to JPG via canvas
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((jpgBlob) => {
          if (!jpgBlob) return;
          const link = document.createElement('a');
          const safeName = customer.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          link.download = `${safeName}.jpg`;
          link.href = URL.createObjectURL(jpgBlob);
          link.click();
          URL.revokeObjectURL(link.href);
          URL.revokeObjectURL(url);
          toast.success('Imagem baixada');
        }, 'image/jpeg', 0.92);
      };
      img.onerror = () => {
        toast.error('Erro ao baixar imagem');
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch {
      toast.error('Erro ao baixar imagem');
    }
  };

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
        <Avatar
          className="w-24 h-24 border-2 border-primary/20 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => customer.photo_url && setPhotoOpen(true)}
        >
          <AvatarImage src={customer.photo_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
            {customer.name[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>

      {customer.photo_url && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={handleDownloadPhoto} className="rounded-xl">
            <Download className="h-4 w-4 mr-2" />
            Baixar imagem (JPG)
          </Button>
        </div>
      )}

      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="max-w-sm p-2 bg-background">
          {customer.photo_url && (
            <>
              <img
                src={customer.photo_url}
                alt={customer.name}
                className="w-full h-auto rounded-lg object-contain max-h-[70vh]"
              />
              <Button onClick={handleDownloadPhoto} className="w-full mt-2 rounded-xl" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Baixar imagem (JPG)
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {totalOwed > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Total devido (com juros)
            </span>
            <span className="text-base font-bold text-destructive">{formatCurrency(totalOwed)}</span>
          </CardContent>
        </Card>
      )}

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
