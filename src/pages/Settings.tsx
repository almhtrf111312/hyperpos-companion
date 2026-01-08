import { useState } from 'react';
import { 
  Store,
  Globe,
  DollarSign,
  RefreshCw,
  Bell,
  Printer,
  Shield,
  Database,
  Save,
  User,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const settingsTabs = [
  { id: 'store', label: 'المحل', icon: Store },
  { id: 'currencies', label: 'العملات', icon: DollarSign },
  { id: 'sync', label: 'التزامن', icon: RefreshCw },
  { id: 'notifications', label: 'الإشعارات', icon: Bell },
  { id: 'printing', label: 'الطباعة', icon: Printer },
  { id: 'users', label: 'المستخدمين', icon: User },
  { id: 'backup', label: 'النسخ الاحتياطي', icon: Database },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('store');
  const [storeSettings, setStoreSettings] = useState({
    name: 'HyperPOS Store',
    type: 'phones',
    phone: '+963 912 345 678',
    email: 'store@hyperpos.com',
    address: 'دمشق، شارع النيل',
  });

  const [exchangeRates, setExchangeRates] = useState({
    TRY: 32,
    SYP: 14500,
  });

  const [syncSettings, setSyncSettings] = useState({
    interval: 10,
    showSuccessNotification: true,
    showErrorNotification: true,
    showSyncStatus: true,
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">الإعدادات</h1>
          <p className="text-muted-foreground mt-1">إدارة إعدادات النظام</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Save className="w-5 h-5 ml-2" />
          حفظ التغييرات
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-card rounded-2xl border border-border p-2">
            {settingsTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-all",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'store' && (
            <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-4">معلومات المحل</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">اسم المحل</label>
                    <div className="relative">
                      <Store className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={storeSettings.name}
                        onChange={(e) => setStoreSettings({ ...storeSettings, name: e.target.value })}
                        className="pr-10 bg-muted border-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">نوع المحل</label>
                    <select className="w-full h-10 px-3 rounded-lg bg-muted border-0 text-foreground">
                      <option value="phones">متجر هواتف</option>
                      <option value="grocery">بقالة</option>
                      <option value="pharmacy">صيدلية</option>
                      <option value="clothing">ملابس</option>
                      <option value="restaurant">مطعم/كافيه</option>
                      <option value="repair">ورشة إصلاح</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">رقم الهاتف</label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={storeSettings.phone}
                        onChange={(e) => setStoreSettings({ ...storeSettings, phone: e.target.value })}
                        className="pr-10 bg-muted border-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">البريد الإلكتروني</label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={storeSettings.email}
                        onChange={(e) => setStoreSettings({ ...storeSettings, email: e.target.value })}
                        className="pr-10 bg-muted border-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">العنوان</label>
                    <div className="relative">
                      <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={storeSettings.address}
                        onChange={(e) => setStoreSettings({ ...storeSettings, address: e.target.value })}
                        className="pr-10 bg-muted border-0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'currencies' && (
            <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-4">أسعار الصرف</h2>
                <p className="text-muted-foreground text-sm mb-6">تحديث أسعار الصرف اليومية (العملة الأساسية: الدولار الأمريكي)</p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-bold">$</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">الدولار الأمريكي (USD)</p>
                        <p className="text-sm text-muted-foreground">العملة الأساسية</p>
                      </div>
                    </div>
                    <span className="font-bold text-foreground">1.00</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                        <span className="text-warning font-bold">₺</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">الليرة التركية (TRY)</p>
                        <p className="text-sm text-muted-foreground">1 USD = {exchangeRates.TRY} TRY</p>
                      </div>
                    </div>
                    <Input
                      type="number"
                      value={exchangeRates.TRY}
                      onChange={(e) => setExchangeRates({ ...exchangeRates, TRY: Number(e.target.value) })}
                      className="w-32 bg-background border-0 text-left"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center">
                        <span className="text-info font-bold">ل.س</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">الليرة السورية (SYP)</p>
                        <p className="text-sm text-muted-foreground">1 USD = {exchangeRates.SYP} SYP</p>
                      </div>
                    </div>
                    <Input
                      type="number"
                      value={exchangeRates.SYP}
                      onChange={(e) => setExchangeRates({ ...exchangeRates, SYP: Number(e.target.value) })}
                      className="w-32 bg-background border-0 text-left"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-4">إعدادات التزامن</h2>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">تكرار التزامن التلقائي</label>
                    <select 
                      className="w-full h-10 px-3 rounded-lg bg-muted border-0 text-foreground"
                      value={syncSettings.interval}
                      onChange={(e) => setSyncSettings({ ...syncSettings, interval: Number(e.target.value) })}
                    >
                      <option value={1}>كل دقيقة</option>
                      <option value={5}>كل 5 دقائق</option>
                      <option value={10}>كل 10 دقائق</option>
                      <option value={30}>كل 30 دقيقة</option>
                      <option value={60}>كل ساعة</option>
                      <option value={0}>يدوي فقط</option>
                    </select>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-foreground">إشعارات التزامن</h3>
                    
                    <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                      <div>
                        <p className="font-medium text-foreground">إشعار التزامن الناجح</p>
                        <p className="text-sm text-muted-foreground">عرض رسالة عند نجاح التزامن</p>
                      </div>
                      <Switch 
                        checked={syncSettings.showSuccessNotification}
                        onCheckedChange={(checked) => setSyncSettings({ ...syncSettings, showSuccessNotification: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                      <div>
                        <p className="font-medium text-foreground">إشعار فشل التزامن</p>
                        <p className="text-sm text-muted-foreground">عرض تحذير عند فشل التزامن</p>
                      </div>
                      <Switch 
                        checked={syncSettings.showErrorNotification}
                        onCheckedChange={(checked) => setSyncSettings({ ...syncSettings, showErrorNotification: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                      <div>
                        <p className="font-medium text-foreground">إظهار حالة التزامن</p>
                        <p className="text-sm text-muted-foreground">عرض حالة التزامن في الشريط العلوي</p>
                      </div>
                      <Switch 
                        checked={syncSettings.showSyncStatus}
                        onCheckedChange={(checked) => setSyncSettings({ ...syncSettings, showSyncStatus: checked })}
                      />
                    </div>
                  </div>

                  <Button variant="outline" className="w-full">
                    <RefreshCw className="w-4 h-4 ml-2" />
                    تزامن الآن
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">إدارة المستخدمين</h2>
                <Button className="bg-primary hover:bg-primary/90">
                  <User className="w-4 h-4 ml-2" />
                  إضافة كاشير
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                      <span className="text-primary-foreground font-bold">م</span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">المشرف</p>
                      <p className="text-sm text-muted-foreground">admin@hyperpos.com</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium badge-success">
                    مشرف
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-info/20 flex items-center justify-center">
                      <span className="text-info font-bold">أ</span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">أحمد محمد</p>
                      <p className="text-sm text-muted-foreground">ahmed@hyperpos.com</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium badge-info">
                    كاشير
                  </span>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'notifications' || activeTab === 'printing' || activeTab === 'backup') && (
            <div className="bg-card rounded-2xl border border-border p-6 flex items-center justify-center h-64">
              <p className="text-muted-foreground">قريباً...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
