'use client';

import SignClient from '@walletconnect/sign-client';
import QRCodeModal from '@walletconnect/qrcode-modal';
import { SessionTypes } from '@walletconnect/types';
import { StacksMainnet } from '@stacks/network';
import {
  cvToJSON,
  callReadOnlyFunction,
  ClarityValue,
  uintCV,
  stringAsciiCV,
  principalCV,
  serializeCV,
} from '@stacks/transactions';

// ============================================
// CONFIGURATION
// ============================================

// BigInt JSON serialization fix for WalletConnect
if (typeof BigInt.prototype.toJSON === 'undefined') {
  BigInt.prototype.toJSON = function() {
    return this.toString();
  };
}

export const NETWORK = new StacksMainnet();
export const NETWORK_NAME: 'mainnet' | 'testnet' = 'mainnet';

export const CONTRACT = {
  address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'SP_YOUR_ADDRESS',
  name: process.env.NEXT_PUBLIC_CONTRACT_NAME || 'raffle',
};

// WalletConnect Configuration
const WALLETCONNECT_CONFIG = {
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  metadata: {
    name: 'STX Raffle',
    description: 'Provably fair lottery system on Stacks',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3001',
    icons: ['https://avatars.githubusercontent.com/u/45615063'],
  },
};

const STACKS_CHAINS = {
  mainnet: 'stacks:1',
  testnet: 'stacks:2147483648',
};

const WC_SESSION_KEY = 'walletconnect_session';

let signClient: SignClient | null = null;
let currentSession: SessionTypes.Struct | null = null;

// ============================================
// TYPES
// ============================================

export interface WalletState {
  connected: boolean;
  address: string | null;
}

export interface Raffle {
  id: number;
  creator: string;
  title: string;
  ticketPrice: number;
  maxTickets: number;
  ticketsSold: number;
  prizePool: number;
  startTime: number;
  endTime: number;
  winner: string | null;
  status: string;
}

export interface TransactionResult {
  success: boolean;
  txId?: string;
  error?: string;
}

// ============================================
// CLIENT MANAGEMENT
// ============================================

async function getSignClient(): Promise<SignClient> {
  if (signClient) return signClient;

  signClient = await SignClient.init({
    projectId: WALLETCONNECT_CONFIG.projectId,
    metadata: WALLETCONNECT_CONFIG.metadata,
  });

  // Restore existing session
  if (typeof window !== 'undefined') {
    const sessions = signClient.session.getAll();
    if (sessions.length > 0) {
      currentSession = sessions[sessions.length - 1];
    }
  }

  setupEventListeners(signClient);
  return signClient;
}

function setupEventListeners(client: SignClient) {
  client.on('session_delete', ({ topic }) => {
    if (currentSession?.topic === topic) {
      currentSession = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem(WC_SESSION_KEY);
        window.dispatchEvent(new Event('walletconnect_disconnect'));
      }
    }
  });

  client.on('session_update', ({ topic }) => {
    if (currentSession?.topic === topic) {
      const sessions = client.session.getAll();
      currentSession = sessions.find(s => s.topic === topic) || null;
    }
  });
}

// ============================================
// WALLET CONNECTION
// ============================================

export async function connectWallet(): Promise<WalletState> {
  try {
    const client = await getSignClient();

    // Check existing session
    const sessions = client.session.getAll();
    if (sessions.length > 0) {
      currentSession = sessions[sessions.length - 1];
      const address = currentSession.namespaces.stacks?.accounts[0]?.split(':')[2];
      if (address) return { connected: true, address };
    }

    // Create new session
    const chainId = NETWORK_NAME === 'mainnet' ? STACKS_CHAINS.mainnet : STACKS_CHAINS.testnet;

    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        stacks: {
          methods: ['stacks_signMessage', 'stacks_stxTransfer', 'stacks_contractCall', 'stacks_contractDeploy'],
          chains: [chainId],
          events: ['accountsChanged', 'chainChanged'],
        },
      },
    });

    // Show QR code
    if (uri) {
      QRCodeModal.open(uri, () => console.log('QR modal closed'));
    }

    const session = await approval();
    QRCodeModal.close();
    currentSession = session;

    const address = session.namespaces.stacks?.accounts[0]?.split(':')[2];
    if (address) {
      localStorage.setItem(WC_SESSION_KEY, JSON.stringify({ topic: session.topic, address }));
      return { connected: true, address };
    }

    return { connected: false, address: null };
  } catch (error) {
    console.error('WalletConnect error:', error);
    QRCodeModal.close();
    return { connected: false, address: null };
  }
}

export function checkConnection(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(WC_SESSION_KEY);
    if (stored) {
      const { topic } = JSON.parse(stored);
      if (signClient && topic) {
        const session = signClient.session.get(topic);
        return !!session;
      }
    }
  } catch {}
  return false;
}

export function getCurrentAddress(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    if (currentSession) {
      const address = currentSession.namespaces.stacks?.accounts[0]?.split(':')[2];
      if (address) return address;
    }
    const stored = localStorage.getItem(WC_SESSION_KEY);
    if (stored) {
      const { address } = JSON.parse(stored);
      return address || null;
    }
  } catch {}
  return null;
}

export async function disconnectWallet(): Promise<void> {
  try {
    if (signClient && currentSession) {
      await signClient.disconnect({
        topic: currentSession.topic,
        reason: { code: 6000, message: 'User disconnected' },
      });
    }
    currentSession = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(WC_SESSION_KEY);
    }
  } catch (error) {
    console.error('Disconnect error:', error);
  }
}

// ============================================
// CONTRACT CALLS
// ============================================

async function callContract(
  functionName: string,
  args: ClarityValue[]
): Promise<TransactionResult> {
  try {
    if (!currentSession) throw new Error('No active WalletConnect session');

    const client = await getSignClient();
    const address = getCurrentAddress();
    if (!address) throw new Error('No address found');

    const functionArgs = args.map(arg =>
      `0x${Buffer.from(serializeCV(arg)).toString('hex')}`
    );

    const chainId = NETWORK_NAME === 'mainnet' ? STACKS_CHAINS.mainnet : STACKS_CHAINS.testnet;

    const requestParams = {
      pubkey: address,
      contractAddress: CONTRACT.address,
      contractName: CONTRACT.name,
      functionName,
      functionArgs,
      network: NETWORK_NAME,
      postConditions: [],
    };

    const result = await client.request({
      topic: currentSession.topic,
      chainId,
      request: {
        method: 'stacks_contractCall',
        params: requestParams,
      },
    });

    if (result && typeof result === 'object' && 'txId' in result) {
      return { success: true, txId: result.txId as string };
    }

    return { success: false, error: 'Transaction cancelled or failed' };
  } catch (error: any) {
    console.error('Contract call error:', error);
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

async function readContract(
  functionName: string,
  args: ClarityValue[] = []
): Promise<any> {
  try {
    const result = await callReadOnlyFunction({
      contractAddress: CONTRACT.address,
      contractName: CONTRACT.name,
      functionName,
      functionArgs: args,
      network: NETWORK,
      senderAddress: CONTRACT.address,
    });
    return cvToJSON(result);
  } catch (error) {
    console.error('Read error:', error);
    return null;
  }
}

// ============================================
// RAFFLE FUNCTIONS
// ============================================

export async function createRaffle(
  title: string,
  ticketPrice: number,
  maxTickets: number,
  durationSeconds: number
): Promise<TransactionResult> {
  return callContract('create-raffle', [
    stringAsciiCV(title),
    uintCV(ticketPrice),
    uintCV(maxTickets),
    uintCV(durationSeconds),
  ]);
}

export async function buyTickets(
  raffleId: number,
  quantity: number
): Promise<TransactionResult> {
  return callContract('buy-tickets', [
    uintCV(raffleId),
    uintCV(quantity),
  ]);
}

export async function drawWinner(raffleId: number): Promise<TransactionResult> {
  return callContract('draw-winner', [uintCV(raffleId)]);
}

// ============================================
// READ FUNCTIONS
// ============================================

export async function getRaffleCount(): Promise<number> {
  const result = await readContract('get-raffle-count');
  return result?.value || 0;
}

export async function getRaffle(raffleId: number): Promise<Raffle | null> {
  const result = await readContract('get-raffle', [uintCV(raffleId)]);
  if (!result?.value) return null;
  
  const r = result.value;
  return {
    id: raffleId,
    creator: r.creator?.value || '',
    title: r.title?.value || '',
    ticketPrice: parseInt(r['ticket-price']?.value || '0'),
    maxTickets: parseInt(r['max-tickets']?.value || '0'),
    ticketsSold: parseInt(r['tickets-sold']?.value || '0'),
    prizePool: parseInt(r['prize-pool']?.value || '0'),
    startTime: parseInt(r['start-time']?.value || '0'),
    endTime: parseInt(r['end-time']?.value || '0'),
    winner: r.winner?.value?.value || null,
    status: r.status?.value || 'unknown',
  };
}

export async function getUserTickets(raffleId: number, user: string): Promise<number> {
  const result = await readContract('get-user-tickets', [
    uintCV(raffleId),
    principalCV(user),
  ]);
  return result?.value || 0;
}

export async function isRaffleActive(raffleId: number): Promise<boolean> {
  const result = await readContract('is-raffle-active', [uintCV(raffleId)]);
  return result?.value === true;
}

export async function canDrawWinner(raffleId: number): Promise<boolean> {
  const result = await readContract('can-draw-winner', [uintCV(raffleId)]);
  return result?.value === true;
}

export async function getTimeRemaining(raffleId: number): Promise<number> {
  const result = await readContract('get-time-remaining', [uintCV(raffleId)]);
  return result?.value || 0;
}

export async function getTotalStats(): Promise<{ raffles: number; tickets: number; prizePool: number }> {
  const result = await readContract('get-total-stats');
  return {
    raffles: parseInt(result?.value?.['total-raffles']?.value || '0'),
    tickets: parseInt(result?.value?.['total-tickets-sold']?.value || '0'),
    prizePool: parseInt(result?.value?.['total-prize-pool']?.value || '0'),
  };
}

// ============================================
// UTILITIES
// ============================================

export function formatSTX(microSTX: number): string {
  return (microSTX / 1_000_000).toFixed(2);
}

export function parseSTX(stx: number): number {
  return Math.floor(stx * 1_000_000);
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function truncateAddress(address: string | null): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function getExplorerUrl(txId: string): string {
  return `https://explorer.hiro.so/txid/${txId}`;
}
