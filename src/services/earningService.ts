import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  serverTimestamp,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';

export interface EarningHistory {
  id?: string;
  userId: string;
  type: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  description?: string;
  createdAt: any;
}

const HISTORY_CACHE_KEY = 'earning_history_cache';
const DEPOSIT_HISTORY_KEY = 'deposit_history_cache';
const WITHDRAW_HISTORY_KEY = 'withdraw_history_cache';

/**
 * Service to manage earning, deposit, and withdrawal history with local storage.
 */
export const earningService = {
  // --- Earning History ---
  async addEarningRecord(record: Omit<EarningHistory, 'userId' | 'createdAt' | 'id'>) {
    const user = auth.currentUser;
    if (!user) throw new Error('User must be logged in to add earning record');

    const newRecord: EarningHistory = {
      ...record,
      userId: user.uid,
      id: Math.random().toString(36).substring(2, 15),
      createdAt: new Date().toISOString(),
    };

    try {
      const cached = this.getLocalHistory();
      const updatedHistory = [newRecord, ...cached].slice(0, 100);
      localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(updatedHistory));
      return newRecord.id;
    } catch (error) {
      console.error('Error adding earning record:', error);
      throw error;
    }
  },

  async getEarningHistory(): Promise<EarningHistory[]> {
    return this.getLocalHistory();
  },

  getLocalHistory(): EarningHistory[] {
    const cached = localStorage.getItem(HISTORY_CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return [];
      }
    }
    return [];
  },

  deleteRecords(ids: string[]) {
    const cached = this.getLocalHistory();
    const updatedHistory = cached.filter(item => !item.id || !ids.includes(item.id));
    localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(updatedHistory));
  },

  // --- Deposit History ---
  async addDepositRecord(record: any) {
    const user = auth.currentUser;
    if (!user) return;
    const newRecord = {
      ...record,
      id: Math.random().toString(36).substring(2, 15),
      createdAt: new Date().toISOString(),
    };
    const history = this.getDepositHistory();
    localStorage.setItem(DEPOSIT_HISTORY_KEY, JSON.stringify([newRecord, ...history].slice(0, 100)));
  },

  getDepositHistory(): any[] {
    const cached = localStorage.getItem(DEPOSIT_HISTORY_KEY);
    return cached ? JSON.parse(cached) : [];
  },

  deleteDepositRecords(ids: string[]) {
    const history = this.getDepositHistory();
    localStorage.setItem(DEPOSIT_HISTORY_KEY, JSON.stringify(history.filter(item => !ids.includes(item.id))));
  },

  // --- Withdraw History ---
  async addWithdrawRecord(record: any) {
    const user = auth.currentUser;
    if (!user) return;
    const newRecord = {
      ...record,
      id: Math.random().toString(36).substring(2, 15),
      createdAt: new Date().toISOString(),
    };
    const history = this.getWithdrawHistory();
    localStorage.setItem(WITHDRAW_HISTORY_KEY, JSON.stringify([newRecord, ...history].slice(0, 100)));
  },

  getWithdrawHistory(): any[] {
    const cached = localStorage.getItem(WITHDRAW_HISTORY_KEY);
    return cached ? JSON.parse(cached) : [];
  },

  deleteWithdrawRecords(ids: string[]) {
    const history = this.getWithdrawHistory();
    localStorage.setItem(WITHDRAW_HISTORY_KEY, JSON.stringify(history.filter(item => !ids.includes(item.id))));
  },

  clearCache() {
    localStorage.removeItem(HISTORY_CACHE_KEY);
    localStorage.removeItem(DEPOSIT_HISTORY_KEY);
    localStorage.removeItem(WITHDRAW_HISTORY_KEY);
  }
};
