"use client";

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Users, Droplets, DollarSign, Package, FileText, Download, Plus, Trash2, Search, Activity, CreditCard, AlertCircle, CheckCircle, Clock, Eye } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

// Types
interface Customer {
  id: string;
  flatNumber: string;
  name: string;
  phone: string;
  rate: number;
  createdAt: string;
}

interface Delivery {
  id: string;
  date: string;
  flatNumber: string;
  customerName: string;
  delivered: number;
  collected: number;
  notes: string;
  amount: number;
  createdAt: string;
}

interface Payment {
  id: string;
  date: string;
  flatNumber: string;
  customerName: string;
  totalBill: number;
  amountReceived: number;
  remainingBalance: number;
  paymentMethod: 'cash' | 'bank' | 'online';
  status: 'full' | 'partial' | 'pending';
  notes: string;
  createdAt: string;
}

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: 'cash' | 'bank' | 'online';
  notes: string;
  createdAt: string;
}

interface AppData {
  customers: Customer[];
  deliveries: Delivery[];
  payments: Payment[];
  expenses: Expense[];
  lastSaved: string;
}

// Storage
const Storage = {
  async getData(userId: string): Promise<AppData> {
    try {
      const stored = localStorage.getItem(`crm_${userId}`);
      if (stored) return JSON.parse(stored);
    } catch (error) {
      console.log('No existing data', error);
    }
    return { customers: [], deliveries: [], payments: [], expenses: [], lastSaved: '' };
  },

  async saveData(userId: string, updates: Partial<AppData>, currentData: AppData) {
    const updated = { ...currentData, ...updates, lastSaved: new Date().toISOString() };
    try {
      localStorage.setItem(`crm_${userId}`, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('Save failed:', error);
      return currentData;
    }
  },

  exportData(data: AppData, businessName: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${businessName.replace(/\s+/g, '-')}-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

// Calculator
const Calculator = {
  getCustomerOutstanding(flatNumber: string, deliveries: Delivery[], payments: Payment[]): number {
    const totalBilled = deliveries.filter(d => d.flatNumber === flatNumber).reduce((sum, d) => sum + d.amount, 0);
    const totalPaid = payments.filter(p => p.flatNumber === flatNumber).reduce((sum, p) => sum + p.amountReceived, 0);
    return totalBilled - totalPaid;
  },

  getDateRangeStats(deliveries: Delivery[], payments: Payment[], expenses: Expense[], startDate: string, endDate: string) {
    const filtered = deliveries.filter(d => d.date >= startDate && d.date <= endDate);
    const filteredPayments = payments.filter(p => p.date >= startDate && p.date <= endDate);
    const filteredExpenses = expenses.filter(e => e.date >= startDate && e.date <= endDate);

    return {
      deliveries: filtered.length,
      bottlesDelivered: filtered.reduce((sum, d) => sum + d.delivered, 0),
      revenue: filtered.reduce((sum, d) => sum + d.amount, 0),
      collected: filteredPayments.reduce((sum, p) => sum + p.amountReceived, 0),
      expenses: filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
      profit: filteredPayments.reduce((sum, p) => sum + p.amountReceived, 0) - filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
      empties: filtered.reduce((sum, d) => sum + d.collected, 0)
    };
  },

  getOverdueDues(customers: Customer[], deliveries: Delivery[], payments: Payment[]) {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    return customers.map(c => {
      const outstanding = this.getCustomerOutstanding(c.flatNumber, deliveries, payments);
      if (outstanding <= 0) return null;

      const lastDelivery = deliveries.filter(d => d.flatNumber === c.flatNumber).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const lastPayment = payments.filter(p => p.flatNumber === c.flatNumber).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      const dueDate = lastDelivery ? new Date(lastDelivery.date) : null;
      const isOverdue = dueDate && dueDate < thirtyDaysAgo;
      const daysPending = dueDate ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      return { customer: c, outstanding, lastDeliveryDate: lastDelivery?.date || '', lastPaymentDate: lastPayment?.date || '', daysPending, isOverdue };
    }).filter(Boolean);
  }
};

// Date Utils
const DateUtils = {
  getTodayString(): string {
    return new Date().toISOString().split('T')[0];
  },

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  getWeekRange(): { start: string; end: string } {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    const end = new Date(today);
    end.setDate(start.getDate() + 6);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  },

  getMonthRange(): { start: string; end: string } {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }
};

// Main Component
export default function WaterCRM() {
  // ✅ YE DEKHO - CLERK SE USER INFO LE RAHE HAIN
  const { user, isLoaded } = useUser();

  // ✅ USER OBJECT BANA RAHE HAIN - SAME FORMAT MEIN
  const currentUser = {
    id: user?.id || '',
    email: user?.primaryEmailAddress?.emailAddress || '',
    name: user?.fullName || 'User',
    businessName: (user?.publicMetadata?.businessName as string) || 'My Business',
  };

  const [data, setData] = useState<AppData>({ customers: [], deliveries: [], payments: [], expenses: [], lastSaved: '' });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'deliveries' | 'payments' | 'expenses' | 'dues' | 'reports'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('all');
  const [showModal, setShowModal] = useState<'delivery' | 'payment' | 'customer' | 'expense' | 'dueDetail' | null>(null);
  type TabId = "dashboard" | "customers" | "deliveries" | "payments" | "expenses" | "dues" | "reports";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedDue, setSelectedDue] = useState<any>(null);
  const [customerForm, setCustomerForm] = useState({ flatNumber: '', name: '', phone: '', rate: 30 });
  const [deliveryForm, setDeliveryForm] = useState({ date: DateUtils.getTodayString(), flatNumber: '', delivered: 1, collected: 0, notes: '' });
  const [paymentForm, setPaymentForm] = useState({ date: DateUtils.getTodayString(), flatNumber: '', amountReceived: 0, method: 'cash' as const, notes: '' });
  const [expenseForm, setExpenseForm] = useState({ date: DateUtils.getTodayString(), category: 'supplies', description: '', amount: 0, method: 'cash' as const, notes: '' });

  // ✅ DATA LOAD KARNE SE PEHLE CHECK KARO KI USER LOAD HO GAYA HAI
  useEffect(() => {
    const fetchData = async () => {
      if (!isLoaded || !user?.id) return;

      setLoading(true);
      const appData = await Storage.getData(user.id);
      setData(appData);
      setLoading(false);
    };
    fetchData();
  }, [isLoaded, user?.id]);

  const saveAndReload = async (updates: Partial<AppData>) => {
    if (!user?.id) return;
    const updated = await Storage.saveData(user.id, updates, data);
    setData(updated);
  };

  const addCustomer = async () => {
    if (!customerForm.flatNumber || !customerForm.name) return alert('⚠️ Please fill required fields');
    if (data.customers.find(c => c.flatNumber.toLowerCase() === customerForm.flatNumber.toLowerCase())) return alert('⚠️ Flat number exists!');

    const newCustomer: Customer = { id: `cust_${Date.now()}`, ...customerForm, createdAt: new Date().toISOString() };
    await saveAndReload({ customers: [...data.customers, newCustomer] });
    setCustomerForm({ flatNumber: '', name: '', phone: '', rate: 30 });
    setShowModal(null);
    alert('✅ Customer added!');
  };

  const deleteCustomer = async (id: string) => {
    if (!confirm('Delete this customer?')) return;
    const customer = data.customers.find(c => c.id === id);
    if (customer) {
      await saveAndReload({
        customers: data.customers.filter(c => c.id !== id),
        deliveries: data.deliveries.filter(d => d.flatNumber !== customer.flatNumber),
        payments: data.payments.filter(p => p.flatNumber !== customer.flatNumber)
      });
    }
  };

  const addDelivery = async () => {
    if (!deliveryForm.date || !deliveryForm.flatNumber || deliveryForm.delivered === 0) return alert('⚠️ Please fill required fields');
    const customer = data.customers.find(c => c.flatNumber === deliveryForm.flatNumber);
    if (!customer) return;

    const newDelivery: Delivery = {
      id: `del_${Date.now()}`,
      date: deliveryForm.date,
      flatNumber: deliveryForm.flatNumber,
      customerName: customer.name,
      delivered: deliveryForm.delivered,
      collected: deliveryForm.collected,
      notes: deliveryForm.notes,
      amount: deliveryForm.delivered * customer.rate,
      createdAt: new Date().toISOString()
    };

    await saveAndReload({ deliveries: [...data.deliveries, newDelivery] });
    setDeliveryForm({ date: DateUtils.getTodayString(), flatNumber: '', delivered: 1, collected: 0, notes: '' });
    setShowModal(null);
    alert('✅ Delivery recorded!');
  };

  const deleteDelivery = async (id: string) => {
    if (confirm('Delete this delivery?')) await saveAndReload({ deliveries: data.deliveries.filter(d => d.id !== id) });
  };

  const addPayment = async () => {
    if (!paymentForm.date || !paymentForm.flatNumber || paymentForm.amountReceived === 0) return alert('⚠️ Please fill required fields');
    const customer = data.customers.find(c => c.flatNumber === paymentForm.flatNumber);
    if (!customer) return;

    const outstanding = Calculator.getCustomerOutstanding(paymentForm.flatNumber, data.deliveries, data.payments);
    const remaining = outstanding - paymentForm.amountReceived;

    let status: 'full' | 'partial' | 'pending' = 'pending';
    if (paymentForm.amountReceived >= outstanding && outstanding > 0) status = 'full';
    else if (paymentForm.amountReceived > 0 && paymentForm.amountReceived < outstanding) status = 'partial';

    const newPayment: Payment = {
      id: `pay_${Date.now()}`,
      date: paymentForm.date,
      flatNumber: paymentForm.flatNumber,
      customerName: customer.name,
      totalBill: outstanding,
      amountReceived: paymentForm.amountReceived,
      remainingBalance: remaining > 0 ? remaining : 0,
      paymentMethod: paymentForm.method,
      status,
      notes: paymentForm.notes,
      createdAt: new Date().toISOString()
    };

    await saveAndReload({ payments: [...data.payments, newPayment] });
    setPaymentForm({ date: DateUtils.getTodayString(), flatNumber: '', amountReceived: 0, method: 'cash', notes: '' });
    setShowModal(null);
    alert('✅ Payment recorded!');
  };

  const deletePayment = async (id: string) => {
    if (confirm('Delete this payment?')) await saveAndReload({ payments: data.payments.filter(p => p.id !== id) });
  };

  const addExpense = async () => {
    if (!expenseForm.date || !expenseForm.description || expenseForm.amount === 0) return alert('⚠️ Please fill required fields');

    const newExpense: Expense = {
      id: `exp_${Date.now()}`,
      date: expenseForm.date,
      category: expenseForm.category,
      description: expenseForm.description,
      amount: expenseForm.amount,
      paymentMethod: expenseForm.method,  // ⭐ YE MISSING THA!
      notes: expenseForm.notes,
      createdAt: new Date().toISOString()
    };
    await saveAndReload({ expenses: [...data.expenses, newExpense] });
    setExpenseForm({ date: DateUtils.getTodayString(), category: 'supplies', description: '', amount: 0, method: 'cash', notes: '' });
    setShowModal(null);
    alert('✅ Expense recorded!');
  };

  const deleteExpense = async (id: string) => {
    if (confirm('Delete this expense?')) await saveAndReload({ expenses: data.expenses.filter(e => e.id !== id) });
  };

  const getStats = () => {
    const today = DateUtils.getTodayString();
    const week = DateUtils.getWeekRange();
    const month = DateUtils.getMonthRange();

    const todayStats = Calculator.getDateRangeStats(data.deliveries, data.payments, data.expenses, today, today);
    const weekStats = Calculator.getDateRangeStats(data.deliveries, data.payments, data.expenses, week.start, week.end);
    const monthStats = Calculator.getDateRangeStats(data.deliveries, data.payments, data.expenses, month.start, month.end);

    const totalRevenue = data.deliveries.reduce((sum, d) => sum + d.amount, 0);
    const totalCollected = data.payments.reduce((sum, p) => sum + p.amountReceived, 0);
    const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
    const outstanding = totalRevenue - totalCollected;
    const netProfit = totalCollected - totalExpenses;
    const pendingEmpties = data.deliveries.reduce((sum, d) => sum + d.delivered - d.collected, 0);

    return { today: todayStats, week: weekStats, month: monthStats, totalCustomers: data.customers.length, totalRevenue, totalCollected, totalExpenses, outstanding, netProfit, pendingEmpties };
  };

  const stats = getStats();
  const overdueDues = Calculator.getOverdueDues(data.customers, data.deliveries, data.payments);

  const getFilteredData = () => {
    let filteredDeliveries = data.deliveries;
    let filteredPayments = data.payments;
    let filteredCustomers = data.customers;
    let filteredExpenses = data.expenses;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredDeliveries = filteredDeliveries.filter(d => d.flatNumber.toLowerCase().includes(term) || d.customerName.toLowerCase().includes(term));
      filteredPayments = filteredPayments.filter(p => p.flatNumber.toLowerCase().includes(term) || p.customerName.toLowerCase().includes(term));
      filteredCustomers = filteredCustomers.filter(c => c.flatNumber.toLowerCase().includes(term) || c.name.toLowerCase().includes(term));
      filteredExpenses = filteredExpenses.filter(e => e.description.toLowerCase().includes(term) || e.category.toLowerCase().includes(term));
    }

    if (filterDate !== 'all') {
      const today = DateUtils.getTodayString();
      const week = DateUtils.getWeekRange();
      const month = DateUtils.getMonthRange();

      if (filterDate === 'today') {
        filteredDeliveries = filteredDeliveries.filter(d => d.date === today);
        filteredPayments = filteredPayments.filter(p => p.date === today);
        filteredExpenses = filteredExpenses.filter(e => e.date === today);
      } else if (filterDate === 'week') {
        filteredDeliveries = filteredDeliveries.filter(d => d.date >= week.start && d.date <= week.end);
        filteredPayments = filteredPayments.filter(p => p.date >= week.start && p.date <= week.end);
        filteredExpenses = filteredExpenses.filter(e => e.date >= week.start && e.date <= week.end);
      } else if (filterDate === 'month') {
        filteredDeliveries = filteredDeliveries.filter(d => d.date >= month.start && d.date <= month.end);
        filteredPayments = filteredPayments.filter(p => p.date >= month.start && p.date <= month.end);
        filteredExpenses = filteredExpenses.filter(e => e.date >= month.start && e.date <= month.end);
      }
    }

    return { filteredDeliveries, filteredPayments, filteredCustomers, filteredExpenses };
  };

  const filtered = getFilteredData();

  // ✅ LOADING STATE - JAB TAK CLERK USER LOAD NAHI HOTA
  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Droplets className="w-16 h-16 text-cyan-500 animate-bounce mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-linear-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Droplets className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{currentUser.businessName}</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Water Delivery CRM</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => Storage.exportData(data, currentUser.businessName)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-all">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>

              <div className="flex items-center gap-2 px-3 py-2 bg-linear-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-200">
                <div className="w-8 h-8 bg-linear-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-gray-700 hidden sm:inline">{currentUser.name}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          <div className="bg-linear-to-br from-blue-500 to-blue-600 p-4 rounded-xl shadow-lg text-white">
            <Users className="w-5 h-5 mb-2 opacity-80" />
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <div className="text-xs opacity-90">Customers</div>
          </div>
          <div className="bg-linear-to-br from-green-500 to-green-600 p-4 rounded-xl shadow-lg text-white">
            <TrendingUp className="w-5 h-5 mb-2 opacity-80" />
            <div className="text-lg font-bold">Rs. {stats.month.revenue.toLocaleString()}</div>
            <div className="text-xs opacity-90">Revenue</div>
          </div>
          <div className="bg-linear-to-br from-purple-500 to-purple-600 p-4 rounded-xl shadow-lg text-white">
            <Activity className="w-5 h-5 mb-2 opacity-80" />
            <div className="text-lg font-bold">Rs. {stats.month.collected.toLocaleString()}</div>
            <div className="text-xs opacity-90">Collected</div>
          </div>
          <div className="bg-linear-to-br from-orange-500 to-orange-600 p-4 rounded-xl shadow-lg text-white">
            <CreditCard className="w-5 h-5 mb-2 opacity-80" />
            <div className="text-lg font-bold">Rs. {stats.month.expenses.toLocaleString()}</div>
            <div className="text-xs opacity-90">Expenses</div>
          </div>
          <div className="bg-linear-to-br from-emerald-500 to-emerald-600 p-4 rounded-xl shadow-lg text-white">
            <TrendingUp className="w-5 h-5 mb-2 opacity-80" />
            <div className="text-lg font-bold">Rs. {stats.month.profit.toLocaleString()}</div>
            <div className="text-xs opacity-90">Profit</div>
          </div>
          <div className="bg-linear-to-br from-red-500 to-red-600 p-4 rounded-xl shadow-lg text-white">
            <AlertCircle className="w-5 h-5 mb-2 opacity-80" />
            <div className="text-lg font-bold">Rs. {stats.outstanding.toLocaleString()}</div>
            <div className="text-xs opacity-90">Due</div>
          </div>
          <div className="bg-linear-to-br from-cyan-500 to-cyan-600 p-4 rounded-xl shadow-lg text-white">
            <Package className="w-5 h-5 mb-2 opacity-80" />
            <div className="text-2xl font-bold">{stats.month.deliveries}</div>
            <div className="text-xs opacity-90">Deliveries</div>
          </div>
          <div className="bg-linear-to-br from-amber-500 to-amber-600 p-4 rounded-xl shadow-lg text-white">
            <Package className="w-5 h-5 mb-2 opacity-80" />
            <div className="text-2xl font-bold">{stats.pendingEmpties}</div>
            <div className="text-xs opacity-90">Empties</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-6 overflow-hidden">
          <div className="flex overflow-x-auto scrollbar-hide">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
              { id: 'customers', label: 'Customers', icon: Users },
              { id: 'deliveries', label: 'Deliveries', icon: Package },
              { id: 'payments', label: 'Payments', icon: DollarSign },
              { id: 'expenses', label: 'Expenses', icon: CreditCard },
              { id: 'dues', label: 'Dues', icon: AlertCircle },
              { id: 'reports', label: 'Reports', icon: FileText }
            ].map((tab) => {
              const Icon = tab.icon;
              return (

                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabId)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold whitespace-nowrap transition-all ${activeTab === tab.id ? 'text-cyan-600 bg-cyan-50 border-b-4 border-cyan-600' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search and Filter */}
        {(activeTab === 'deliveries' || activeTab === 'payments' || activeTab === 'customers' || activeTab === 'expenses') && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 text-gray-900 placeholder:text-gray-400 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-4 py-3 text-gray-900 placeholder:text-gray-400 border-2 border-gray-200 rounded-xl focus:border-cyan-500 transition-all outline-none font-semibold"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>

                {activeTab === 'customers' && (
                  <button onClick={() => setShowModal('customer')} className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all">
                    <Plus className="w-5 h-5" />
                    Add
                  </button>
                )}
                {activeTab === 'deliveries' && (
                  <button onClick={() => setShowModal('delivery')} className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all">
                    <Plus className="w-5 h-5" />
                    Add
                  </button>
                )}
                {activeTab === 'payments' && (
                  <button onClick={() => setShowModal('payment')} className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all">
                    <Plus className="w-5 h-5" />
                    Add
                  </button>
                )}
                {activeTab === 'expenses' && (
                  <button onClick={() => setShowModal('expense')} className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-red-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all">
                    <Plus className="w-5 h-5" />
                    Add
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`p-6 rounded-xl border-2 ${stats.month.profit >= 0 ? 'bg-linear-to-br from-emerald-50 to-green-50 border-emerald-200' : 'bg-linear-to-br from-red-50 to-orange-50 border-red-200'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Monthly Profit/Loss</h3>
                    {stats.month.profit >= 0 ? <TrendingUp className="w-6 h-6 text-emerald-600" /> : <TrendingDown className="w-6 h-6 text-red-600" />}
                  </div>
                  <div className={`text-4xl font-bold mb-2 ${stats.month.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    Rs. {Math.abs(stats.month.profit).toLocaleString()}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Revenue:</span>
                      <span className="font-bold text-green-600">+Rs. {stats.month.revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Collected:</span>
                      <span className="font-bold text-cyan-600">Rs. {stats.month.collected.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expenses:</span>
                      <span className="font-bold text-red-600">-Rs. {stats.month.expenses.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-linear-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border border-blue-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">This Week</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Deliveries:</span>
                      <span className="font-bold text-gray-900">{stats.week.deliveries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Revenue:</span>
                      <span className="font-bold text-green-600">Rs. {stats.week.revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Collected:</span>
                      <span className="font-bold text-cyan-600">Rs. {stats.week.collected.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expenses:</span>
                      <span className="font-bold text-red-600">Rs. {stats.week.expenses.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-blue-200">
                      <span className="text-gray-900 font-semibold">Profit:</span>
                      <span className={`font-bold ${stats.week.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Rs. {stats.week.profit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-linear-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Today</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Deliveries:</span>
                      <span className="font-bold text-gray-900">{stats.today.deliveries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Revenue:</span>
                      <span className="font-bold text-green-600">Rs. {stats.today.revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Collected:</span>
                      <span className="font-bold text-cyan-600">Rs. {stats.today.collected.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expenses:</span>
                      <span className="font-bold text-red-600">Rs. {stats.today.expenses.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-purple-200">
                      <span className="text-gray-900 font-semibold">Profit:</span>
                      <span className={`font-bold ${stats.today.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Rs. {stats.today.profit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Deliveries</h3>
                {data.deliveries.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>No deliveries yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Bottles</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.deliveries.slice(-5).reverse().map((d) => (
                          <tr key={d.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{DateUtils.formatDate(d.date)}</td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-sm text-gray-900">{d.flatNumber}</div>
                              <div className="text-xs text-gray-500">{d.customerName}</div>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{d.delivered}</td>
                            <td className="px-4 py-3 text-sm font-bold text-green-600">Rs. {d.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CUSTOMERS TAB */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Customer Directory</h2>
              {filtered.filteredCustomers.length === 0 ? (
                <div className="text-center py-12 text-gray-800">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-semibold mb-2">No customers found</p>
                  <p className="text-sm">Add your first customer to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Flat</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Rate</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Due</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.filteredCustomers.map((c) => {
                        const outstanding = Calculator.getCustomerOutstanding(c.flatNumber, data.deliveries, data.payments);
                        return (
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-bold text-sm text-gray-900">{c.flatNumber}</td>
                            <td className="px-4 py-3 font-semibold text-sm text-gray-900">{c.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{c.phone || '-'}</td>
                            <td className="px-4 py-3 font-semibold text-sm text-gray-900">Rs. {c.rate}</td>
                            <td className="px-4 py-3">
                              <span className={`font-bold text-sm ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>Rs. {outstanding.toLocaleString()}</span>
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => deleteCustomer(c.id)} className="text-red-600 hover:text-red-800">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* DELIVERIES TAB */}
          {activeTab === 'deliveries' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Delivery History</h2>
              {filtered.filteredDeliveries.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>No deliveries found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.filteredDeliveries.slice().reverse().map((d) => (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{DateUtils.formatDate(d.date)}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-sm text-gray-900">{d.flatNumber}</div>
                            <div className="text-xs text-gray-500">{d.customerName}</div>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{d.delivered}</td>
                          <td className="px-4 py-3 font-bold text-sm text-green-600">Rs. {d.amount.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => deleteDelivery(d.id)} className="text-red-600 hover:text-red-800">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* PAYMENTS TAB */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Payment History</h2>
              {filtered.filteredPayments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>No payments found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Method</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.filteredPayments.slice().reverse().map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{DateUtils.formatDate(p.date)}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-sm text-gray-900">{p.flatNumber}</div>
                            <div className="text-xs text-gray-500">{p.customerName}</div>
                          </td>
                          <td className="px-4 py-3 font-bold text-sm text-green-600">Rs. {p.amountReceived.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 capitalize">{p.paymentMethod}</td>
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${p.status === 'full' ? 'bg-green-100 text-green-700' : p.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
                              {p.status === 'full' ? '✓' : p.status === 'partial' ? '◐' : '○'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => deletePayment(p.id)} className="text-red-600 hover:text-red-800">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* EXPENSES TAB */}
          {activeTab === 'expenses' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Business Expenses</h2>
              <div className="bg-linear-to-br from-red-50 to-orange-50 p-6 rounded-xl border-2 border-red-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-gray-900">This Month&apos;s Expenses</h3>
                  <CreditCard className="w-6 h-6 text-red-600" />
                </div>
                <div className="text-4xl font-bold text-red-600 mb-4">Rs. {stats.month.expenses.toLocaleString()}</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {['supplies', 'fuel', 'maintenance', 'salaries', 'rent', 'utilities'].map((cat) => {
                    const catExpenses = data.expenses.filter(e => e.category === cat && e.date >= DateUtils.getMonthRange().start && e.date <= DateUtils.getMonthRange().end);
                    const total = catExpenses.reduce((sum, e) => sum + e.amount, 0);
                    if (total === 0) return null;
                    return (
                      <div key={cat} className="flex justify-between">
                        <span className="text-gray-600 capitalize">{cat}:</span>
                        <span className="font-bold text-gray-900">Rs. {total.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {filtered.filteredExpenses.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>No expenses recorded</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.filteredExpenses.slice().reverse().map((e) => (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{DateUtils.formatDate(e.date)}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs font-semibold text-gray-700 capitalize">{e.category}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{e.description}</td>
                          <td className="px-4 py-3 font-bold text-sm text-red-600">Rs. {e.amount.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => deleteExpense(e.id)} className="text-red-600 hover:text-red-800">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* DUES TAB */}
          {activeTab === 'dues' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Outstanding Dues</h2>
              <div className="bg-linear-to-br from-red-50 to-orange-50 p-6 rounded-xl border-2 border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Total Outstanding</h3>
                    <div className="text-4xl font-bold text-red-600">Rs. {stats.outstanding.toLocaleString()}</div>
                    <p className="text-sm text-gray-600 mt-2">From {overdueDues.filter(d => d && d.outstanding > 0).length} customers</p>
                  </div>
                  <AlertCircle className="w-16 h-16 text-red-600 opacity-50" />
                </div>
              </div>
              {overdueDues.filter(d => d && d.outstanding > 0).length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="text-lg font-semibold">All clear! No outstanding dues</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {overdueDues.filter(d => d && d.outstanding > 0).sort((a, b) => (b?.outstanding || 0) - (a?.outstanding || 0)).map((due) => {
                    if (!due) return null;
                    return (
                      <div key={due.customer.id} className={`p-4 rounded-xl border-2 ${due.isOverdue ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-base text-gray-900">{due.customer.flatNumber}</span>
                              <span className="text-gray-600">•</span>
                              <span className="font-semibold text-sm text-gray-700">{due.customer.name}</span>
                            </div>
                            <div className="text-sm text-gray-600">{due.customer.phone || 'No phone'}</div>
                            <div className="flex items-center gap-4 mt-2 text-xs">
                              {due.lastDeliveryDate && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-gray-500" />
                                  <span className="text-gray-600">Last delivery: {DateUtils.formatDate(due.lastDeliveryDate)}</span>
                                </div>
                              )}
                              {due.daysPending > 0 && (
                                <div className={`px-2 py-0.5 rounded-full font-semibold ${due.isOverdue ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'}`}>
                                  {due.daysPending} days pending
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-2xl font-bold text-red-600">Rs. {due.outstanding.toLocaleString()}</div>
                              <div className="text-xs text-gray-500">Outstanding</div>
                            </div>
                            <button onClick={() => { setSelectedDue(due); setShowModal('dueDetail'); }} className="p-2 bg-white rounded-lg hover:bg-gray-50">
                              <Eye className="w-5 h-5 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* REPORTS TAB */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Business Reports</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-linear-to-br from-blue-50 to-cyan-100 p-6 rounded-xl border border-blue-200">
                  <div className="text-sm font-semibold text-blue-700 mb-2">Total Customers</div>
                  <div className="text-4xl font-bold text-blue-900">{data.customers.length}</div>
                </div>
                <div className="bg-linear-to-br from-green-50 to-emerald-100 p-6 rounded-xl border border-green-200">
                  <div className="text-sm font-semibold text-green-700 mb-2">Total Deliveries</div>
                  <div className="text-4xl font-bold text-green-900">{data.deliveries.length}</div>
                </div>
                <div className="bg-linear-to-br from-purple-50 to-pink-100 p-6 rounded-xl border border-purple-200">
                  <div className="text-sm font-semibold text-purple-700 mb-2">Total Revenue</div>
                  <div className="text-3xl font-bold text-purple-900">Rs. {stats.totalRevenue.toLocaleString()}</div>
                </div>
                <div className="bg-linear-to-br from-cyan-50 to-blue-100 p-6 rounded-xl border border-cyan-200">
                  <div className="text-sm font-semibold text-cyan-700 mb-2">Total Collected</div>
                  <div className="text-3xl font-bold text-cyan-900">Rs. {stats.totalCollected.toLocaleString()}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-8 rounded-xl border-2 ${stats.netProfit >= 0 ? 'bg-linear-to-br from-emerald-50 to-green-100 border-emerald-200' : 'bg-linear-to-br from-red-50 to-orange-100 border-red-200'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Net Profit/Loss</h3>
                    {stats.netProfit >= 0 ? <TrendingUp className="w-8 h-8 text-emerald-600" /> : <TrendingDown className="w-8 h-8 text-red-600" />}
                  </div>
                  <div className={`text-5xl font-bold mb-4 ${stats.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    Rs. {Math.abs(stats.netProfit).toLocaleString()}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Collected:</span>
                      <span className="font-bold text-green-600">+Rs. {stats.totalCollected.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Expenses:</span>
                      <span className="font-bold text-red-600">-Rs. {stats.totalExpenses.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-linear-to-br from-orange-50 to-red-100 p-8 rounded-xl border-2 border-orange-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Outstanding Summary</h3>
                  <div className="text-5xl font-bold text-orange-900 mb-4">Rs. {stats.outstanding.toLocaleString()}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Billed:</span>
                      <span className="font-bold text-gray-900">Rs. {stats.totalRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Collected:</span>
                      <span className="font-bold text-gray-900">Rs. {stats.totalCollected.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-orange-200">
                      <span className="text-gray-900 font-semibold">Collection Rate:</span>
                      <span className="font-bold text-gray-900">{((stats.totalCollected / stats.totalRevenue) * 100 || 0).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Top Customers by Revenue</h3>
                <div className="space-y-3">
                  {data.customers.map((c) => ({ ...c, revenue: data.deliveries.filter((d) => d.flatNumber === c.flatNumber).reduce((sum, d) => sum + d.amount, 0) })).sort((a, b) => b.revenue - a.revenue).slice(0, 10).map((c, index) => (
                    <div key={c.id} className="flex items-center justify-between p-4 bg-linear-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-linear-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">{index + 1}</div>
                        <div>
                          <div className="font-bold text-gray-900 text-lg">{c.flatNumber} - {c.name}</div>
                          <div className="text-sm text-gray-600">{c.phone || 'No phone'}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-2xl text-gray-900">Rs. {c.revenue.toLocaleString()}</div>
                        <div className="text-sm text-gray-500">Revenue</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      {showModal === 'customer' && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Add New Customer</h3>
              <button onClick={() => setShowModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Flat Number *</label>
                <input type="text" placeholder="e.g., A-101" value={customerForm.flatNumber} onChange={(e) => setCustomerForm({ ...customerForm, flatNumber: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Customer Name *</label>
                <input type="text" placeholder="Enter name" value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} className="w-full px-4 py-3 border-2 text-gray-900 placeholder:text-gray-400 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number</label>
                <input type="tel" placeholder="Enter phone" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} className="w-full px-4 py-3 border-2 text-gray-900 placeholder:text-gray-400 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Rate per Bottle (Rs.)</label>
                <input type="number" value={customerForm.rate} onChange={(e) => setCustomerForm({ ...customerForm, rate: parseInt(e.target.value) || 30 })} className="w-full px-4 py-3 border-2 text-gray-900 placeholder:text-gray-400 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={addCustomer} className="flex-1 py-3 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold hover:shadow-xl">Add Customer</button>
              <button onClick={() => setShowModal(null)} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'delivery' && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Record Delivery</h3>
              <button onClick={() => setShowModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Date *</label>
                <input type="date" value={deliveryForm.date} onChange={(e) => setDeliveryForm({ ...deliveryForm, date: e.target.value })} className="w-full px-4 py-3 border-2 text-gray-900 placeholder:text-gray-400 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Customer *</label>
                <select value={deliveryForm.flatNumber} onChange={(e) => setDeliveryForm({ ...deliveryForm, flatNumber: e.target.value })} className="w-full px-4 py-3 border-2 text-gray-900 placeholder:text-gray-400 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none">
                  <option value="">Select Customer</option>
                  {data.customers.map((c) => <option key={c.id} value={c.flatNumber}>{c.flatNumber} - {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Bottles Delivered *</label>
                <input type="number" value={deliveryForm.delivered} onChange={(e) => setDeliveryForm({ ...deliveryForm, delivered: parseInt(e.target.value) || 0 })} className="w-full px-4 text-gray-900 placeholder:text-gray-400 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none" min="1" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Empties Collected</label>
                <input type="number" value={deliveryForm.collected} onChange={(e) => setDeliveryForm({ ...deliveryForm, collected: parseInt(e.target.value) || 0 })} className="w-full px-4 py-3 text-gray-900 placeholder:text-gray-400 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none" min="0" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Notes</label>
                <textarea value={deliveryForm.notes} onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none" rows={3} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={addDelivery} className="flex-1 py-3 bg-linear-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-xl">Record Delivery</button>
              <button onClick={() => setShowModal(null)} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'payment' && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Record Payment</h3>
              <button onClick={() => setShowModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Date *</label>
                <input type="date" value={paymentForm.date} onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Customer *</label>
                <select value={paymentForm.flatNumber} onChange={(e) => setPaymentForm({ ...paymentForm, flatNumber: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none">
                  <option value="">Select Customer</option>
                  {data.customers.map((c) => {
                    const outstanding = Calculator.getCustomerOutstanding(c.flatNumber, data.deliveries, data.payments);
                    return <option key={c.id} value={c.flatNumber}>{c.flatNumber} - {c.name} (Due: Rs. {outstanding})</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Amount Received (Rs.) *</label>
                <input type="number" value={paymentForm.amountReceived} onChange={(e) => setPaymentForm({ ...paymentForm, amountReceived: parseFloat(e.target.value) || 0 })} className="w-full px-4 text-gray-900 placeholder:text-gray-400 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none" min="0" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Payment Method</label>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as any })} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="online">Online Payment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Notes</label>
                <textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none" rows={3} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={addPayment} className="flex-1 py-3 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold hover:shadow-xl">Record Payment</button>
              <button onClick={() => setShowModal(null)} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'expense' && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Add Expense</h3>
              <button onClick={() => setShowModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Date *</label>
                <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Category *</label>
                <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none">
                  <option value="supplies">Supplies</option>
                  <option value="fuel">Fuel</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="salaries">Salaries</option>
                  <option value="rent">Rent</option>
                  <option value="utilities">Utilities</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Description *</label>
                <input type="text" placeholder="e.g., Purchased 10 bottles" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} className="w-full px-4 text-gray-900 placeholder:text-gray-400 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Amount (Rs.) *</label>
                <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-3 text-gray-900 placeholder:text-gray-400 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none" min="0" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Payment Method</label>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <select value={expenseForm.method} onChange={(e) => setExpenseForm({ ...expenseForm, method: e.target.value as any })} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="online">Online Payment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Notes</label>
                <textarea value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none" rows={3} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={addExpense} className="flex-1 py-3 bg-linear-to-r from-red-500 to-orange-600 text-white rounded-xl font-bold hover:shadow-xl">Add Expense</button>
              <button onClick={() => setShowModal(null)} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'dueDetail' && selectedDue && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Due Details</h3>
              <button onClick={() => { setShowModal(null); setSelectedDue(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-6">
              <div className="bg-linear-to-br from-red-50 to-orange-50 p-6 rounded-xl border-2 border-red-200">
                <div className="text-center">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Total Outstanding</div>
                  <div className="text-4xl font-bold text-red-600 mb-2">Rs. {selectedDue.outstanding.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">{selectedDue.customer.flatNumber} - {selectedDue.customer.name}</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-semibold text-gray-700">Phone:</span>
                  <span className="text-sm text-gray-900">{selectedDue.customer.phone || 'Not provided'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-semibold text-gray-700">Rate per Bottle:</span>
                  <span className="text-sm text-gray-900">Rs. {selectedDue.customer.rate}</span>
                </div>
                {selectedDue.lastDeliveryDate && (
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-semibold text-gray-700">Last Delivery:</span>
                    <span className="text-sm text-gray-900">{DateUtils.formatDate(selectedDue.lastDeliveryDate)}</span>
                  </div>
                )}
                {selectedDue.lastPaymentDate && (
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-semibold text-gray-700">Last Payment:</span>
                    <span className="text-sm text-gray-900">{DateUtils.formatDate(selectedDue.lastPaymentDate)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-semibold text-gray-700">Days Pending:</span>
                  <span className={`text-sm font-bold ${selectedDue.isOverdue ? 'text-red-600' : 'text-yellow-600'}`}>{selectedDue.daysPending} days</span>
                </div>
              </div>
              <button onClick={() => { setPaymentForm({ ...paymentForm, flatNumber: selectedDue.customer.flatNumber, amountReceived: selectedDue.outstanding }); setShowModal('payment'); setSelectedDue(null); }} className="w-full py-3 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold hover:shadow-xl">
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}