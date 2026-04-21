import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Camera, User, MapPin, CreditCard, Phone, Download, Upload } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

interface CustomerFormProps {
  onSave: (data: { name: string; address?: string; rg?: string; phone?: string; photo_url?: string }) => Promise<any>;
  onUploadPhoto: (file: File) => Promise<string | null>;
  onBack: () => void;
  initial?: { name: string; address?: string; rg?: string; phone?: string; photo_url?: string };
}

export function CustomerForm({ onSave, onUploadPhoto, onBack, initial }: CustomerFormProps) {
  const [name, setName] = useState(initial?.name || '');
  const [address, setAddress] = useState(initial?.address || '');
  const [rg, setRg] = useState(initial?.rg || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await onUploadPhoto(file);
    if (url) setPhotoUrl(url);
    setUploading(false);
  };

  const handleDownloadPhoto = async () => {
    if (!photoUrl) {
      toast.error('Nenhuma foto para baixar');
      return;
    }
    try {
      const res = await fetch(photoUrl);
      const blob = await res.blob();
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
          const safeName = (name || 'cliente').replace(/[^a-z0-9]/gi, '_').toLowerCase();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), address: address.trim() || undefined, rg: rg.trim() || undefined, phone: phone.trim() || undefined, photo_url: photoUrl || undefined });
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-lg font-bold text-foreground">{initial ? 'Editar Cliente' : 'Novo Cliente'}</h2>
          <p className="text-xs text-muted-foreground">Preencha os dados do cliente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photo */}
        <div className="flex justify-center">
          <div className="relative">
            <Avatar className="w-24 h-24 border-2 border-primary/20">
              <AvatarImage src={photoUrl} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {name ? name[0].toUpperCase() : <User className="h-8 w-8" />}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:opacity-90 transition"
            >
              <Upload className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          </div>
        </div>
        {uploading && <p className="text-xs text-center text-muted-foreground">Enviando foto...</p>}

        <div className="flex justify-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="rounded-xl"
          >
            <Camera className="h-4 w-4 mr-2" />
            Tirar foto
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-xl"
          >
            <Upload className="h-4 w-4 mr-2" />
            Enviar foto
          </Button>
          {photoUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadPhoto}
              className="rounded-xl"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar JPG
            </Button>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cname" className="text-xs font-medium flex items-center gap-1">
            <User className="h-3 w-3" /> Nome completo *
          </Label>
          <Input id="cname" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: João Silva" required className="h-11 rounded-xl" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cphone" className="text-xs font-medium flex items-center gap-1">
            <Phone className="h-3 w-3" /> Telefone (WhatsApp)
          </Label>
          <Input id="cphone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="h-11 rounded-xl" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="crg" className="text-xs font-medium flex items-center gap-1">
            <CreditCard className="h-3 w-3" /> RG
          </Label>
          <Input id="crg" value={rg} onChange={e => setRg(e.target.value)} placeholder="00.000.000-0" className="h-11 rounded-xl" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="caddress" className="text-xs font-medium flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Endereço
          </Label>
          <Input id="caddress" value={address} onChange={e => setAddress(e.target.value)} placeholder="Rua, nº, bairro, cidade" className="h-11 rounded-xl" />
        </div>

        <Button type="submit" disabled={saving || !name.trim()} className="w-full h-12 rounded-xl text-sm font-semibold">
          {saving ? 'Salvando...' : 'Salvar Cliente'}
        </Button>
      </form>
    </div>
  );
}
