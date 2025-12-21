// lib/utils.ts - All Types, Interfaces & Storage Utilities

// ==================== TYPES ====================
export interface User {
  businessName: string;
  phone: string;
  loginTime: string;
  dataKey: string;
}

export interface Customer {
  id: number;
  flatNumber: string;
  name: string;
  phone: string;
  rate: number;
  createdAt: string;
}

export interface Delivery {
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

export interface Payment {
  id: number;
  date: string;
  flatNumber: string;
  customerName: string;
  totalBill: number;
  amountReceived: number;
  remainingBalance: number;
  paymentMethod: 'cash' | 'bank' | 'jazzcash' | 'easypaisa' | 'other';
  status: 'full' | 'partial' | 'pending';
  notes: string;
  createdAt: string;
}

export interface AppData {
  customers: Customer[];
  deliveries: Delivery[];
  payments: Payment[];
  lastSaved: string;
}

export interface DashboardStats {
  totalCustomers: number;
  monthDeliveries: number;
  pendingEmpties: number;
  monthlyRevenue: number;
  monthlyPaid: number;
  outstanding: number;
}

// ==================== STORAGE UTILITIES ====================
export class Storage {
  // Get current user
  static getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    try {
      const userJson = localStorage.getItem('aab_current_user');
      return userJson ? JSON.parse(userJson) : null;
    } catch {
      return null;
    }
  }

  // Save current user
  static setCurrentUser(user: User): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('aab_current_user', JSON.stringify(user));
  }

  // Remove current user (logout)
  static removeCurrentUser(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('aab_current_user');
  }

  // Get app data for current user
  static getData(): AppData {
    if (typeof window === 'undefined') {
      return { customers: [], deliveries: [], payments: [], lastSaved: '' };
    }

    const user = this.getCurrentUser();
    if (!user) {
      return { customers: [], deliveries: [], payments: [], lastSaved: '' };
    }

    try {
      const dataJson = localStorage.getItem(user.dataKey);
      if (dataJson) {
        return JSON.parse(dataJson);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }

    return { customers: [], deliveries: [], payments: [], lastSaved: '' };
  }

  // Save app data for current user
  static saveData(data: Partial<AppData>): void {
    if (typeof window === 'undefined') return;

    const user = this.getCurrentUser();
    if (!user) return;

    try {
      const currentData = this.getData();
      const updatedData: AppData = {
        ...currentData,
        ...data,
        lastSaved: new Date().toISOString(),
      };

      localStorage.setItem(user.dataKey, JSON.stringify(updatedData));

      // Update user login time
      user.loginTime = new Date().toISOString();
      this.setCurrentUser(user);
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  // Export data as JSON file
  static exportData(): void {
    const user = this.getCurrentUser();
    if (!user) return;

    const data = this.getData();
    const exportData = {
      owner: user.businessName,
      phone: user.phone,
      ...data,
      exportDate: new Date().toISOString(),
      summary: {
        totalCustomers: data.customers.length,
        totalDeliveries: data.deliveries.length,
        totalPayments: data.payments.length,
        totalRevenue: data.deliveries.reduce((sum, d) => sum + d.amount, 0),
        totalPaid: data.payments.reduce((sum, p) => sum + p.amountReceived, 0),
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aab-e-hayat-${user.businessName.replace(/\s+/g, '-')}-${
      new Date().toISOString().split('T')[0]
    }.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// ==================== CALCULATION UTILITIES ====================
export class Calculator {
  // Calculate dashboard statistics
  static getDashboardStats(data: AppData): DashboardStats {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filter this month's data
    const thisMonthDeliveries = data.deliveries.filter((d) => {
      const date = new Date(d.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const thisMonthPayments = data.payments.filter((p) => {
      const date = new Date(p.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    // Calculate totals
    const totalDelivered = data.deliveries.reduce((sum, d) => sum + d.delivered, 0);
    const totalCollected = data.deliveries.reduce((sum, d) => sum + d.collected, 0);
    const monthDeliveries = thisMonthDeliveries.reduce((sum, d) => sum + d.delivered, 0);
    const monthlyRevenue = thisMonthDeliveries.reduce((sum, d) => sum + d.amount, 0);
    const monthlyPaid = thisMonthPayments.reduce((sum, p) => sum + p.amountReceived, 0);

    return {
      totalCustomers: data.customers.length,
      monthDeliveries,
      pendingEmpties: totalDelivered - totalCollected,
      monthlyRevenue,
      monthlyPaid,
      outstanding: monthlyRevenue - monthlyPaid,
    };
  }

  // Get customer khata (account details)
  static getCustomerKhata(customer: Customer, deliveries: Delivery[], payments: Payment[]) {
    const customerDeliveries = deliveries.filter((d) => d.flatNumber === customer.flatNumber);
    const customerPayments = payments.filter((p) => p.flatNumber === customer.flatNumber);

    const totalDelivered = customerDeliveries.reduce((sum, d) => sum + d.delivered, 0);
    const totalCollected = customerDeliveries.reduce((sum, d) => sum + d.collected, 0);
    const totalAmount = customerDeliveries.reduce((sum, d) => sum + d.amount, 0);
    const totalPaid = customerPayments.reduce((sum, p) => sum + p.amountReceived, 0);

    return {
      ...customer,
      totalDelivered,
      totalCollected,
      pendingEmpties: totalDelivered - totalCollected,
      totalAmount,
      totalPaid,
      outstandingAmount: totalAmount - totalPaid,
    };
  }

  // Get outstanding amount for a customer
  static getCustomerOutstanding(flatNumber: string, deliveries: Delivery[], payments: Payment[]): number {
    const customerDeliveries = deliveries.filter((d) => d.flatNumber === flatNumber);
    const customerPayments = payments.filter((p) => p.flatNumber === flatNumber);

    const totalBilled = customerDeliveries.reduce((sum, d) => sum + d.amount, 0);
    const totalPaid = customerPayments.reduce((sum, p) => sum + p.amountReceived, 0);

    return totalBilled - totalPaid;
  }
}

// ==================== DATE UTILITIES ====================
export class DateUtils {
  // Get today's date in YYYY-MM-DD format
  static getTodayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  // Format date for display
  static formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // Get time ago string
  static getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`;
    return DateUtils.formatDate(dateString);
  }

  // Filter by date range
  static isInRange(dateString: string, range: 'today' | 'week' | 'month' | 'all'): boolean {
    if (range === 'all') return true;

    const date = new Date(dateString);
    const now = new Date();

    if (range === 'today') {
      return date.toDateString() === now.toDateString();
    }

    if (range === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return date >= weekAgo;
    }

    if (range === 'month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }

    return false;
  }
}

// ==================== VALIDATION ====================
export class Validator {
  static isValidPhone(phone: string): boolean {
    return /^03\d{9}$/.test(phone.replace(/-/g, ''));
  }

  static isValidNumber(value: unknown): boolean {
    return !isNaN(parseFloat(value as string)) && isFinite(value as number);
  }
}

// ==================== CLASSNAMES UTILITY ====================
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}