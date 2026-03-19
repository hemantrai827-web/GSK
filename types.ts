
export type UserRole = 'USER' | 'ADMIN' | 'AGENT' | 'SUB_AGENT';

export interface BankDetails {
  holderName: string;
  accountNumber: string;
  ifsc: string;
  bankName?: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  mobile?: string;
  password?: string;
  role: UserRole;
  wallet_balance: number;
  lockedBalance?: number; // Funds locked in pending withdrawals
  referralCode: string;
  referredBy?: string;
  depositCount: number;
  validReferralCount: number;
  isSubAgentPending?: boolean;
  bankDetails?: BankDetails;
  access_expires_at?: any; // Timestamp for agent access expiry
  agent_status?: 'active' | 'expired';
  agent_expiry?: any;
}

export interface AgentPayment {
  id: string;
  agentId: string;
  amount: number;
  utr: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: any;
  screenshotUrl?: string;
}

export interface AgentChat {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: any;
}

export interface BazaarResult {
  id: string;
  name: string;
  openTime: string;
  closeTime: string;
  result: string | null;
  isLive: boolean;
}

export interface MatkaGame {
  id: string;
  name: string;
  intervalMinutes: number;
  lastResult: string;
  nextDrawTime: number;
  currentRoundId?: string; // e.g., "14:05"
}

export interface Bet {
  id: string;
  userId: string;
  gameId: string;
  gameType: 'BAZAAR' | 'MATKA';
  selection: string;
  amount: number;
  status: 'PENDING' | 'WON' | 'LOST' | 'COMPLETED' | 'active' | 'win' | 'lose';
  winAmount?: number;
  timestamp: number;
  roundId?: string; // Links bet to specific time slot
  bet_number?: string;
  bet_amount?: number;
}

export interface DepositRequest {
  id: string;
  userId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  utr?: string;
  userName?: string;
  userMobile?: string;
  screenshotUrl?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  userName?: string; // Captured at time of request
  userMobile?: string; // Captured at time of request
  type: 'DEPOSIT' | 'WITHDRAW' | 'BONUS' | 'REFERRAL' | 'GAME_FEE' | 'GAME_WIN' | 'COMMISSION' | 'ADMIN_TRANSFER' | 'AGENT_SUBSCRIPTION';
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';
  timestamp: number;
  description: string;
  utr?: string;
  screenshot?: string;
  screenshotUrl?: string; // Explicit field for deposit proof
  storagePath?: string; // Path in firebase storage for deletion
  bankDetailsSnapshot?: BankDetails;
}

export interface ResultLog {
  id: string;
  gameId: string;
  gameName: string;
  result: string;
  type: 'BAZAAR' | 'MATKA';
  publishTime: number;
  createdAt: any;
  roundId?: string;
  expiresAt?: number; // For 24h retention policy
}
