"use client";

import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Users, Droplets, DollarSign, Package, FileText, Download, LogOut, Plus, Trash2, Search, Activity } from 'lucide-react';

// ==================== TYPES ====================
interface User {
  businessName: string;
  phone: string;
  address: string;
}


interface Customer {
  id: number;
  flatNumber: string;
  name: string;
  phone: string;
  rate: number;
  createdAt: string;
}

interface Delivery {
  id: number;
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
  id: number;
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

interface AppData {
  customers: Customer[];
  deliveries: Delivery[];
  payments: Payment[];
  lastSaved: string;
}

// ==================== STORAGE UTILITY ====================
const Storage = {
  getData(): AppData {
    if (typeof window === 'undefined') return { customers: [], deliveries: [], payments: [], lastSaved: '' };
    const data = localStorage.getItem('waterCRM_data');
    return data ? JSON.parse(data) : { customers: [], deliveries: [], payments: [], lastSaved: '' };
  },
  
  saveData(updates: Partial<AppData>) {
    const current = this.getData();
    const updated = { ...current, ...updates, lastSaved: new Date().toISOString() };
    localStorage.setItem('waterCRM_data', JSON.stringify(updated));
  },
  
  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    const user = localStorage.getItem('waterCRM_user');
    return user ? JSON.parse(user) : null;
  },
  
  setCurrentUser(user: User) {
    localStorage.setItem('waterCRM_user', JSON.stringify(user));
  },
  
  removeCurrentUser() {
    localStorage.removeItem('waterCRM_user');
  },
  
  exportData() {
    const data = this.getData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `water-crm-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  }
};

// ==================== CALCULATOR UTILITY ====================
const Calculator = {
  getCustomerOutstanding(flatNumber: string, deliveries: Delivery[], payments: Payment[]): number {
    const totalBilled = deliveries
      .filter(d => d.flatNumber === flatNumber)
      .reduce((sum, d) => sum + d.amount, 0);
    const totalPaid = payments
      .filter(p => p.flatNumber === flatNumber)
      .reduce((sum, p) => sum + p.amountReceived, 0);
    return totalBilled - totalPaid;
  },
  
  getDateRangeStats(deliveries: Delivery[], payments: Payment[], startDate: string, endDate: string) {
    const filtered = deliveries.filter(d => d.date >= startDate && d.date <= endDate);
    const filteredPayments = payments.filter(p => p.date >= startDate && p.date <= endDate);
    
    return {
      deliveries: filtered.length,
      bottlesDelivered: filtered.reduce((sum, d) => sum + d.delivered, 0),
      revenue: filtered.reduce((sum, d) => sum + d.amount, 0),
      collected: filteredPayments.reduce((sum, p) => sum + p.amountReceived, 0),
      empties: filtered.reduce((sum, d) => sum + d.collected, 0)
    };
  }
};

// ==================== DATE UTILITY ====================
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

// ==================== MAIN COMPONENT ====================
export default function AdvancedWaterCRM() {
  const [user, setUser] = useState<User | null>(null);
  const [isLogin, setIsLogin] = useState(false);
  const [loginForm, setLoginForm] = useState({ businessName: '', phone: '', address: '' });
  
  const [data, setData] = useState<AppData>({ customers: [], deliveries: [], payments: [], lastSaved: '' });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'deliveries' | 'payments' | 'accounts' | 'reports'>('dashboard');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('all');
  const [showModal, setShowModal] = useState<'delivery' | 'payment' | 'customer' | null>(null);
  
  const [customerForm, setCustomerForm] = useState({ flatNumber: '', name: '', phone: '', rate: 120 });
  const [deliveryForm, setDeliveryForm] = useState({
    date: DateUtils.getTodayString(),
    flatNumber: '',
    delivered: 1,
    collected: 0,
    notes: ''
  });
  const [paymentForm, setPaymentForm] = useState({
    date: DateUtils.getTodayString(),
    flatNumber: '',
    amountReceived: 0,
    method: 'cash' as 'cash' | 'bank' | 'online',
    notes: ''
  });

 const loadData = () => {
  const appData = Storage.getData();
  setData(appData);
};

useEffect(() => {
  const init = () => {
    const currentUser = Storage.getCurrentUser();

    if (currentUser) {
      setUser(currentUser);
      loadData();
    } else {
      setIsLogin(true);
    }
  };

  init();
}, []);


  const handleLogin = () => {
    if (!loginForm.businessName || !loginForm.phone) {
      alert('⚠️ Please fill all required fields');
      return;
    }
    Storage.setCurrentUser(loginForm as User);
    setUser(loginForm as User);
    setIsLogin(false);
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      Storage.removeCurrentUser();
      setUser(null);
      setIsLogin(true);
    }
  };

  // ==================== CUSTOMER FUNCTIONS ====================
  const addCustomer = () => {
    if (!customerForm.flatNumber || !customerForm.name) {
      alert('⚠️ Please fill required fields');
      return;
    }

    if (data.customers.find(c => c.flatNumber.toLowerCase() === customerForm.flatNumber.toLowerCase())) {
      alert('⚠️ Flat number already exists!');
      return;
    }

    const newCustomer: Customer = {
      id: Date.now(),
      flatNumber: customerForm.flatNumber,
      name: customerForm.name,
      phone: customerForm.phone,
      rate: customerForm.rate,
      createdAt: new Date().toISOString()
    };

    Storage.saveData({ customers: [...data.customers, newCustomer] });
    setCustomerForm({ flatNumber: '', name: '', phone: '', rate: 120 });
    loadData();
    setShowModal(null);
    alert('✅ Customer added successfully!');
  };

  const deleteCustomer = (id: number) => {
    if (confirm('Delete this customer? This will also delete their delivery and payment records.')) {
      const customer = data.customers.find(c => c.id === id);
      if (customer) {
        const updatedDeliveries = data.deliveries.filter(d => d.flatNumber !== customer.flatNumber);
        const updatedPayments = data.payments.filter(p => p.flatNumber !== customer.flatNumber);
        Storage.saveData({
          customers: data.customers.filter(c => c.id !== id),
          deliveries: updatedDeliveries,
          payments: updatedPayments
        });
        loadData();
      }
    }
  };

  // ==================== DELIVERY FUNCTIONS ====================
  const addDelivery = () => {
    if (!deliveryForm.date || !deliveryForm.flatNumber || deliveryForm.delivered === 0) {
      alert('⚠️ Please fill required fields');
      return;
    }

    const customer = data.customers.find(c => c.flatNumber === deliveryForm.flatNumber);
    if (!customer) return;

    const newDelivery: Delivery = {
      id: Date.now(),
      date: deliveryForm.date,
      flatNumber: deliveryForm.flatNumber,
      customerName: customer.name,
      delivered: deliveryForm.delivered,
      collected: deliveryForm.collected,
      notes: deliveryForm.notes,
      amount: deliveryForm.delivered * customer.rate,
      createdAt: new Date().toISOString()
    };

    Storage.saveData({ deliveries: [...data.deliveries, newDelivery] });
    setDeliveryForm({ date: DateUtils.getTodayString(), flatNumber: '', delivered: 1, collected: 0, notes: '' });
    loadData();
    setShowModal(null);
    alert('✅ Delivery recorded!');
  };

  const deleteDelivery = (id: number) => {
    if (confirm('Delete this delivery?')) {
      Storage.saveData({ deliveries: data.deliveries.filter(d => d.id !== id) });
      loadData();
    }
  };

  // ==================== PAYMENT FUNCTIONS ====================
  const addPayment = () => {
    if (!paymentForm.date || !paymentForm.flatNumber || paymentForm.amountReceived === 0) {
      alert('⚠️ Please fill required fields');
      return;
    }

    const customer = data.customers.find(c => c.flatNumber === paymentForm.flatNumber);
    if (!customer) return;

    const outstanding = Calculator.getCustomerOutstanding(paymentForm.flatNumber, data.deliveries, data.payments);
    const remaining = outstanding - paymentForm.amountReceived;

    let status: 'full' | 'partial' | 'pending' = 'pending';
    if (paymentForm.amountReceived >= outstanding && outstanding > 0) {
      status = 'full';
    } else if (paymentForm.amountReceived > 0 && paymentForm.amountReceived < outstanding) {
      status = 'partial';
    }

    const newPayment: Payment = {
      id: Date.now(),
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

    Storage.saveData({ payments: [...data.payments, newPayment] });
    setPaymentForm({ date: DateUtils.getTodayString(), flatNumber: '', amountReceived: 0, method: 'cash', notes: '' });
    loadData();
    setShowModal(null);
    alert('✅ Payment recorded!');
  };

  const deletePayment = (id: number) => {
    if (confirm('Delete this payment?')) {
      Storage.saveData({ payments: data.payments.filter(p => p.id !== id) });
      loadData();
    }
  };

  // ==================== STATS CALCULATION ====================
  const getStats = () => {
    const today = DateUtils.getTodayString();
    const week = DateUtils.getWeekRange();
    const month = DateUtils.getMonthRange();
    
    const todayStats = Calculator.getDateRangeStats(data.deliveries, data.payments, today, today);
    const weekStats = Calculator.getDateRangeStats(data.deliveries, data.payments, week.start, week.end);
    const monthStats = Calculator.getDateRangeStats(data.deliveries, data.payments, month.start, month.end);
    
    const totalRevenue = data.deliveries.reduce((sum, d) => sum + d.amount, 0);
    const totalCollected = data.payments.reduce((sum, p) => sum + p.amountReceived, 0);
    const outstanding = totalRevenue - totalCollected;
    
    const pendingEmpties = data.deliveries.reduce((sum, d) => sum + d.delivered - d.collected, 0);
    
    return {
      today: todayStats,
      week: weekStats,
      month: monthStats,
      totalCustomers: data.customers.length,
      totalRevenue,
      totalCollected,
      outstanding,
      pendingEmpties
    };
  };

  const stats = getStats();

  // ==================== FILTERED DATA ====================
  const getFilteredData = () => {
    let filteredDeliveries = data.deliveries;
    let filteredPayments = data.payments;
    let filteredCustomers = data.customers;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredDeliveries = filteredDeliveries.filter(d => 
        d.flatNumber.toLowerCase().includes(term) || 
        d.customerName.toLowerCase().includes(term)
      );
      filteredPayments = filteredPayments.filter(p => 
        p.flatNumber.toLowerCase().includes(term) || 
        p.customerName.toLowerCase().includes(term)
      );
      filteredCustomers = filteredCustomers.filter(c => 
        c.flatNumber.toLowerCase().includes(term) || 
        c.name.toLowerCase().includes(term)
      );
    }

    if (filterDate !== 'all') {
      const today = DateUtils.getTodayString();
      const week = DateUtils.getWeekRange();
      const month = DateUtils.getMonthRange();
      
      if (filterDate === 'today') {
        filteredDeliveries = filteredDeliveries.filter(d => d.date === today);
        filteredPayments = filteredPayments.filter(p => p.date === today);
      } else if (filterDate === 'week') {
        filteredDeliveries = filteredDeliveries.filter(d => d.date >= week.start && d.date <= week.end);
        filteredPayments = filteredPayments.filter(p => p.date >= week.start && p.date <= week.end);
      } else if (filterDate === 'month') {
        filteredDeliveries = filteredDeliveries.filter(d => d.date >= month.start && d.date <= month.end);
        filteredPayments = filteredPayments.filter(p => p.date >= month.start && p.date <= month.end);
      }
    }

    return { filteredDeliveries, filteredPayments, filteredCustomers };
  };

  const filtered = getFilteredData();

  // ==================== LOGIN SCREEN ====================
  if (isLogin) {
    return (
      <div className="min-h-screen bg-linear-to-br from-cyan-500 via-blue-500 to-indigo-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-linear-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Droplets className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Aab-e-Hayat</h1>
            <p className="text-gray-600">Advanced Water Delivery CRM</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Business Name *</label>
              <input
                type="text"
                placeholder="Enter your business name"
                value={loginForm.businessName}
                onChange={(e) => setLoginForm({ ...loginForm, businessName: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 placeholder-gray-400"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number *</label>
              <input
                type="tel"
                placeholder="Enter phone number"
                value={loginForm.phone}
                onChange={(e) => setLoginForm({ ...loginForm, phone: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 placeholder-gray-400"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
              <input
                type="text"
                placeholder="Enter business address"
                value={loginForm.address}
                onChange={(e) => setLoginForm({ ...loginForm, address: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 placeholder-gray-400"
              />
            </div>
            
            <button
              onClick={handleLogin}
              className="w-full py-4 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold text-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              Get Started →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-linear-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Droplets className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Aab-e-Hayat</h1>
                <p className="text-xs text-gray-500">Water Delivery CRM</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-semibold text-green-700">Auto-saved</span>
              </div>
              
              <button
                onClick={() => Storage.exportData()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
              
              <div className="flex items-center gap-2 px-3 py-2 bg-linear-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-200">
                <div className="w-8 h-8 bg-linear-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow">
                  {user.businessName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-gray-800 hidden sm:block">{user.businessName}</span>
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-linear-to-r from-red-500 to-red-600 rounded-lg hover:shadow-lg transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          <div className="bg-linear-to-br from-blue-500 to-blue-600 p-4 rounded-2xl shadow-lg text-white">
            <Users className="w-6 h-6 mb-2 opacity-80" />
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <div className="text-xs opacity-90">Customers</div>
          </div>
          
          <div className="bg-linear-to-br from-green-500 to-green-600 p-4 rounded-2xl shadow-lg text-white">
            <Package className="w-6 h-6 mb-2 opacity-80" />
            <div className="text-2xl font-bold">{stats.today.deliveries}</div>
            <div className="text-xs opacity-90">Today</div>
          </div>
          
          <div className="bg-linear-to-br from-purple-500 to-purple-600 p-4 rounded-2xl shadow-lg text-white">
            <TrendingUp className="w-6 h-6 mb-2 opacity-80" />
            <div className="text-2xl font-bold">{stats.week.deliveries}</div>
            <div className="text-xs opacity-90">This Week</div>
          </div>
          
          <div className="bg-linear-to-br from-orange-500 to-orange-600 p-4 rounded-2xl shadow-lg text-white">
            <Calendar className="w-6 h-6 mb-2 opacity-80" />
            <div className="text-2xl font-bold">{stats.month.deliveries}</div>
            <div className="text-xs opacity-90">This Month</div>
          </div>
          
          <div className="bg-linear-to-br from-cyan-500 to-cyan-600 p-4 rounded-2xl shadow-lg text-white">
            <DollarSign className="w-6 h-6 mb-2 opacity-80" />
            <div className="text-lg font-bold">Rs. {stats.month.revenue.toLocaleString()}</div>
            <div className="text-xs opacity-90">Monthly Rev</div>
          </div>
          
          <div className="bg-linear-to-br from-emerald-500 to-emerald-600 p-4 rounded-2xl shadow-lg text-white">
            <Activity className="w-6 h-6 mb-2 opacity-80" />
            <div className="text-lg font-bold">Rs. {stats.month.collected.toLocaleString()}</div>
            <div className="text-xs opacity-90">Collected</div>
          </div>
          
          <div className="bg-linear-to-br from-red-500 to-red-600 p-4 rounded-2xl shadow-lg text-white">
            <FileText className="w-6 h-6 mb-2 opacity-80" />
            <div className="text-lg font-bold">Rs. {stats.outstanding.toLocaleString()}</div>
            <div className="text-xs opacity-90">Outstanding</div>
          </div>
          
          <div className="bg-linear-to-br from-amber-500 to-amber-600 p-4 rounded-2xl shadow-lg text-white">
            <Package className="w-6 h-6 mb-2 opacity-80" />
            <div className="text-2xl font-bold">{stats.pendingEmpties}</div>
            <div className="text-xs opacity-90">Empties</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-6 overflow-hidden">
          <div className="flex overflow-x-auto">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
              { id: 'customers', label: 'Customers', icon: Users },
              { id: 'deliveries', label: 'Deliveries', icon: Package },
              { id: 'payments', label: 'Payments', icon: DollarSign },
              { id: 'accounts', label: 'Accounts', icon: FileText },
              { id: 'reports', label: 'Reports', icon: Activity }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'dashboard' | 'customers' | 'deliveries' | 'payments' | 'accounts' | 'reports')}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'text-cyan-600 bg-cyan-50 border-b-4 border-cyan-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search and Filter Bar */}
        {(activeTab === 'deliveries' || activeTab === 'payments' || activeTab === 'customers') && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by flat number or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 placeholder-gray-400"
                />
              </div>
              
              <div className="flex gap-2">
                <select
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 font-semibold"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
                
                {activeTab === 'customers' && (
                  <button
                    onClick={() => setShowModal('customer')}
                    className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">Add Customer</span>
                  </button>
                )}
                
                {activeTab === 'deliveries' && (
                  <button
                    onClick={() => setShowModal('delivery')}
                    className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">Add Delivery</span>
                  </button>
                )}
                
                {activeTab === 'payments' && (
                  <button
                    onClick={() => setShowModal('payment')}
                    className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">Add Payment</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
                <div className="text-sm text-gray-500">Last updated: {data.lastSaved ? new Date(data.lastSaved).toLocaleString() : 'Never'}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-linear-to-br from-blue-50 to-cyan-50 p-6 rounded-2xl border border-blue-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Today&apos;s Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Deliveries:</span>
                      <span className="font-bold text-gray-900">{stats.today.deliveries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bottles:</span>
                      <span className="font-bold text-gray-900">{stats.today.bottlesDelivered}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Revenue:</span>
                      <span className="font-bold text-green-600">Rs. {stats.today.revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Collected:</span>
                      <span className="font-bold text-cyan-600">Rs. {stats.today.collected.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-linear-to-br from-purple-50 to-pink-50 p-6 rounded-2xl border border-purple-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">This Week</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Deliveries:</span>
                      <span className="font-bold text-gray-900">{stats.week.deliveries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bottles:</span>
                      <span className="font-bold text-gray-900">{stats.week.bottlesDelivered}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Revenue:</span>
                      <span className="font-bold text-green-600">Rs. {stats.week.revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Collected:</span>
                      <span className="font-bold text-cyan-600">Rs. {stats.week.collected.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-linear-to-br from-orange-50 to-amber-50 p-6 rounded-2xl border border-orange-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">This Month</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Deliveries:</span>
                      <span className="font-bold text-gray-900">{stats.month.deliveries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bottles:</span>
                      <span className="font-bold text-gray-900">{stats.month.bottlesDelivered}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Revenue:</span>
                      <span className="font-bold text-green-600">Rs. {stats.month.revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Collected:</span>
                      <span className="font-bold text-cyan-600">Rs. {stats.month.collected.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Deliveries</h3>
                {data.deliveries.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>No deliveries yet. Start recording deliveries!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Bottles</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.deliveries.slice(-10).reverse().map((d) => (
                          <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-900">{DateUtils.formatDate(d.date)}</td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-gray-900">{d.flatNumber}</div>
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
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-semibold mb-2">No customers found</p>
                  <p className="text-sm">Add your first customer to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Flat #</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Rate</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Outstanding</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.filteredCustomers.map((c) => {
                        const outstanding = Calculator.getCustomerOutstanding(c.flatNumber, data.deliveries, data.payments);
                        return (
                          <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-bold text-gray-900">{c.flatNumber}</td>
                            <td className="px-4 py-3 font-semibold text-gray-900">{c.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{c.phone || '-'}</td>
                            <td className="px-4 py-3 font-semibold text-gray-900">Rs. {c.rate}</td>
                            <td className="px-4 py-3">
                              <span className={`font-bold ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                Rs. {outstanding.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => deleteCustomer(c.id)}
                                className="flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold text-sm transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
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
                  <p className="text-lg font-semibold mb-2">No deliveries found</p>
                  <p className="text-sm">Record your first delivery</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Delivered</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Collected</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Notes</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.filteredDeliveries.slice().reverse().map((d) => (
                        <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900">{DateUtils.formatDate(d.date)}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">{d.flatNumber}</div>
                            <div className="text-xs text-gray-500">{d.customerName}</div>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{d.delivered}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{d.collected}</td>
                          <td className="px-4 py-3 font-bold text-green-600">Rs. {d.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">{d.notes || '-'}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => deleteDelivery(d.id)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                            >
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
                  <p className="text-lg font-semibold mb-2">No payments found</p>
                  <p className="text-sm">Record your first payment</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
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
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900">{DateUtils.formatDate(p.date)}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">{p.flatNumber}</div>
                            <div className="text-xs text-gray-500">{p.customerName}</div>
                          </td>
                          <td className="px-4 py-3 font-bold text-green-600">Rs. {p.amountReceived.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 capitalize">{p.paymentMethod}</td>
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                              p.status === 'full' ? 'bg-green-100 text-green-700' :
                              p.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {p.status === 'full' ? '✓ Full' : p.status === 'partial' ? '◐ Partial' : '○ Pending'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => deletePayment(p.id)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                            >
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

          {/* ACCOUNTS TAB */}
          {activeTab === 'accounts' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Customer Accounts (Khata)</h2>
              
              {data.customers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-semibold mb-2">No accounts yet</p>
                  <p className="text-sm">Add customers to see their accounts</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Total Billed</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Paid</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Outstanding</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.customers.map((c) => {
                        const totalBilled = data.deliveries
                          .filter(d => d.flatNumber === c.flatNumber)
                          .reduce((sum, d) => sum + d.amount, 0);
                        const totalPaid = data.payments
                          .filter(p => p.flatNumber === c.flatNumber)
                          .reduce((sum, p) => sum + p.amountReceived, 0);
                        const outstanding = totalBilled - totalPaid;
                        
                        return (
                          <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-bold text-gray-900">{c.flatNumber}</div>
                              <div className="text-sm text-gray-700">{c.name}</div>
                              <div className="text-xs text-gray-500">{c.phone || 'No phone'}</div>
                            </td>
                            <td className="px-4 py-3 font-bold text-gray-900">Rs. {totalBilled.toLocaleString()}</td>
                            <td className="px-4 py-3 font-bold text-green-600">Rs. {totalPaid.toLocaleString()}</td>
                            <td className="px-4 py-3 font-bold text-red-600">Rs. {outstanding.toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                                outstanding === 0 ? 'bg-green-100 text-green-700' :
                                outstanding > 1000 ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {outstanding === 0 ? '✓ Clear' : outstanding > 1000 ? '⚠ High' : '○ Due'}
                              </span>
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

          {/* REPORTS TAB */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Business Reports</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-linear-to-br from-blue-50 to-cyan-100 p-6 rounded-2xl border border-blue-200">
                  <div className="text-sm font-semibold text-blue-700 mb-2">Total Customers</div>
                  <div className="text-4xl font-bold text-blue-900">{data.customers.length}</div>
                </div>
                
                <div className="bg-linear-to-br from-green-50 to-emerald-100 p-6 rounded-2xl border border-green-200">
                  <div className="text-sm font-semibold text-green-700 mb-2">Total Deliveries</div>
                  <div className="text-4xl font-bold text-green-900">{data.deliveries.length}</div>
                </div>
                
                <div className="bg-linear-to-br from-purple-50 to-pink-100 p-6 rounded-2xl border border-purple-200">
                  <div className="text-sm font-semibold text-purple-700 mb-2">Total Revenue</div>
                  <div className="text-3xl font-bold text-purple-900">
                    Rs. {stats.totalRevenue.toLocaleString()}
                  </div>
                </div>
                
                <div className="bg-linear-to-br from-cyan-50 to-blue-100 p-6 rounded-2xl border border-cyan-200">
                  <div className="text-sm font-semibold text-cyan-700 mb-2">Total Collected</div>
                  <div className="text-3xl font-bold text-cyan-900">
                    Rs. {stats.totalCollected.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="bg-linear-to-br from-orange-50 to-red-100 p-8 rounded-2xl border-2 border-orange-200">
                <div className="text-sm font-semibold text-orange-700 mb-2">Total Outstanding</div>
                <div className="text-5xl font-bold text-orange-900 mb-2">
                  Rs. {stats.outstanding.toLocaleString()}
                </div>
                <p className="text-sm text-orange-700">Amount pending from all customers</p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Top Customers by Revenue</h3>
                <div className="space-y-3">
                  {data.customers
                    .map((c) => ({
                      ...c,
                      revenue: data.deliveries
                        .filter((d) => d.flatNumber === c.flatNumber)
                        .reduce((sum, d) => sum + d.amount, 0),
                    }))
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 10)
                    .map((c, index) => (
                      <div key={c.id} className="flex items-center justify-between p-4 bg-linear-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-linear-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-lg">{c.flatNumber} - {c.name}</div>
                            <div className="text-sm text-gray-600">{c.phone || 'No phone'}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-2xl text-gray-900">Rs. {c.revenue.toLocaleString()}</div>
                          <div className="text-sm text-gray-500">Total Revenue</div>
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 transform transition-all">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Add New Customer</h3>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Flat Number *</label>
                <input
                  type="text"
                  placeholder="e.g., A-101"
                  value={customerForm.flatNumber}
                  onChange={(e) => setCustomerForm({ ...customerForm, flatNumber: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 placeholder-gray-400 font-semibold"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Customer Name *</label>
                <input
                  type="text"
                  placeholder="Enter customer name"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 placeholder-gray-400 font-semibold"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  placeholder="Enter phone number"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 placeholder-gray-400 font-semibold"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Rate per Bottle (Rs.)</label>
                <input
                  type="number"
                  placeholder="30"
                  value={customerForm.rate}
                  onChange={(e) => setCustomerForm({ ...customerForm, rate: parseInt(e.target.value) || 30 })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 placeholder-gray-400 font-semibold"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={addCustomer}
                className="flex-1 py-3 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold hover:shadow-xl transition-all transform hover:scale-105"
              >
                ✓ Add Customer
              </button>
              <button
                onClick={() => setShowModal(null)}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'delivery' && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 transform transition-all">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Record Delivery</h3>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Date *</label>
                <input
                  type="date"
                  value={deliveryForm.date}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, date: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 font-semibold"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Customer *</label>
                <select
                  value={deliveryForm.flatNumber}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, flatNumber: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 font-semibold"
                >
                  <option value="">Select Customer</option>
                  {data.customers.map((c) => (
                    <option key={c.id} value={c.flatNumber}>
                      {c.flatNumber} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Bottles Delivered *</label>
                <input
                  type="number"
                  placeholder="1"
                  value={deliveryForm.delivered}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, delivered: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 placeholder-gray-400 font-semibold"
                  min="1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Empties Collected</label>
                <input
                  type="number"
                  placeholder="0"
                  value={deliveryForm.collected}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, collected: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 placeholder-gray-400 font-semibold"
                  min="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Notes</label>
                <textarea
                  placeholder="Optional notes..."
                  value={deliveryForm.notes}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 placeholder-gray-400 font-semibold"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={addDelivery}
                className="flex-1 py-3 bg-linear-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-xl transition-all transform hover:scale-105"
              >
                ✓ Record Delivery
              </button>
              <button
                onClick={() => setShowModal(null)}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'payment' && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 transform transition-all">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Record Payment</h3>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Date *</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 font-semibold"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Customer *</label>
                <select
                  value={paymentForm.flatNumber}
                  onChange={(e) => setPaymentForm({ ...paymentForm, flatNumber: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 font-semibold"
                >
                  <option value="">Select Customer</option>
                  {data.customers.map((c) => {
                    const outstanding = Calculator.getCustomerOutstanding(c.flatNumber, data.deliveries, data.payments);
                    return (
                      <option key={c.id} value={c.flatNumber}>
                        {c.flatNumber} - {c.name} (Due: Rs. {outstanding})
                      </option>
                    );
                  })}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Amount Received (Rs.) *</label>
                <input
                  type="number"
                  placeholder="0"
                  value={paymentForm.amountReceived}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amountReceived: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 placeholder-gray-400 font-semibold"
                  min="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Payment Method</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as 'cash' | 'bank' | 'online' })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 font-semibold"
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="online">Online Payment</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Notes</label>
                <textarea
                  placeholder="Optional notes..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all outline-none text-gray-900 placeholder-gray-400 font-semibold"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={addPayment}
                className="flex-1 py-3 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold hover:shadow-xl transition-all transform hover:scale-105"
              >
                ✓ Record Payment
              </button>
              <button
                onClick={() => setShowModal(null)}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}