import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, ChevronLeft, Filter, Truck, ShoppingCart, Clock, CheckCircle, XCircle, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '../lib/utils';

type OrderStatus = 'pending' | 'ordered' | 'partial' | 'delivered' | 'cancelled';

interface MaterialOrder {
  id: string;
  order_number: string | null;
  status: OrderStatus;
  order_date: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  total: number | null;
  notes: string | null;
  supplier_id: string | null;
  contact_id: string | null;
  created_at: string;
  contacts?: { first_name: string; last_name: string; address: string } | null;
  suppliers?: { name: string } | null;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  pending:   { label: 'Pending',   bg: 'bg-gray-500',   text: 'text-white', icon: Clock },
  ordered:   { label: 'Ordered',   bg: 'bg-blue-500',   text: 'text-white', icon: FileText },
  partial:   { label: 'Partial',   bg: 'bg-yellow-500', text: 'text-white', icon: Truck },
  delivered: { label: 'Delivered', bg: 'bg-green-500',  text: 'text-white', icon: CheckCircle },
  cancelled: { label: 'Cancelled', bg: 'bg-red-500',    text: 'text-white', icon: XCircle },
};

export default function MaterialOrders() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [orders, setOrders] = useState<MaterialOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (profile?.company_id) {
      fetchMaterialOrders();
    }
  }, [profile?.company_id]);

  const fetchMaterialOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('material_orders')
        .select(`
          *,
          contacts (first_name, last_name, address),
          suppliers (name)
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data as MaterialOrder[]) || []);
    } catch (err) {
      console.error('Error fetching material orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    const q = searchQuery.toLowerCase();
    const supplierName = o.suppliers?.name?.toLowerCase() || '';
    const contactName = o.contacts
      ? `${o.contacts.first_name} ${o.contacts.last_name}`.toLowerCase()
      : '';
    const orderNum = (o.order_number || '').toLowerCase();
    return !q || supplierName.includes(q) || contactName.includes(q) || orderNum.includes(q);
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-400 active:scale-90 transition-transform">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-primary">Material Orders</h1>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by supplier, contact, order #..."
              className="w-full bg-slate-100 border-none rounded-2xl py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-accent/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-slate-100" />
          ))
        ) : filteredOrders.length > 0 ? (
          filteredOrders.map((order, i) => {
            const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            const contactName = order.contacts
              ? `${order.contacts.first_name} ${order.contacts.last_name}`.trim()
              : null;

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card p-4 space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-primary">
                      <Package size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-primary text-sm">
                        {order.suppliers?.name || 'Unknown Supplier'}
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {order.order_number ? `Order #${order.order_number}` : `#${order.id.slice(0, 6)}`}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase flex items-center gap-1 ${statusCfg.bg} ${statusCfg.text}`}>
                    <StatusIcon size={10} />
                    {statusCfg.label}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {contactName && (
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <ShoppingCart size={13} />
                      <span>Customer: {contactName}</span>
                    </div>
                  )}
                  {order.contacts?.address && (
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <Truck size={13} />
                      <span>Delivery: {order.contacts.address}</span>
                    </div>
                  )}
                  {order.expected_delivery_date && (
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <Clock size={13} />
                      <span>Expected: {new Date(order.expected_delivery_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-50 flex justify-between items-center">
                  <p className="text-xs font-semibold text-slate-700">
                    Total: {formatCurrency(Number(order.total || 0))}
                  </p>
                  {order.notes && (
                    <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{order.notes}</p>
                  )}
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="text-center py-12 space-y-4">
            <div className="mx-auto h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-slate-200 shadow-sm">
              <Package size={32} />
            </div>
            <p className="text-slate-400 text-sm">No material orders found</p>
            <p className="text-slate-300 text-xs">Create orders from the desktop view under a contact's work order</p>
          </div>
        )}
      </div>
    </div>
  );
}
