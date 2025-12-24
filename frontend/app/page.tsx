'use client';

import { useState, useEffect } from 'react';
import { Ticket, Plus, Trophy, Clock, Users, Coins, Loader2, CheckCircle, XCircle } from 'lucide-react';
import {
  connectWallet,
  disconnectWallet,
  checkConnection,
  getCurrentAddress,
  createRaffle,
  buyTickets,
  drawWinner,
  getRaffleCount,
  getRaffle,
  getUserTickets,
  isRaffleActive,
  canDrawWinner,
  getTotalStats,
  truncateAddress,
  formatDuration,
  formatSTX,
  parseSTX,
  getExplorerUrl,
  Raffle,
} from '@/lib/stacks';

export default function RafflePage() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [stats, setStats] = useState({ raffles: 0, tickets: 0, prizePool: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [txPending, setTxPending] = useState(false);
  const [txResult, setTxResult] = useState<{ success: boolean; txId?: string } | null>(null);

  useEffect(() => {
    if (checkConnection()) {
      setAddress(getCurrentAddress());
    }
    loadData();

    const handleDisconnect = () => setAddress(null);
    window.addEventListener('walletconnect_disconnect', handleDisconnect);
    return () => window.removeEventListener('walletconnect_disconnect', handleDisconnect);
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [count, totalStats] = await Promise.all([
        getRaffleCount(),
        getTotalStats(),
      ]);
      
      setStats(totalStats);
      
      const rafflePromises = [];
      for (let i = count; i > Math.max(0, count - 10); i--) {
        rafflePromises.push(getRaffle(i));
      }
      const loadedRaffles = (await Promise.all(rafflePromises)).filter(Boolean) as Raffle[];
      setRaffles(loadedRaffles);
    } catch (error) {
      console.error('Load error:', error);
    }
    setLoading(false);
  }

  async function handleConnect() {
    setConnecting(true);
    const result = await connectWallet();
    if (result.connected) {
      setAddress(result.address);
    }
    setConnecting(false);
  }

  async function handleBuyTickets(raffleId: number, quantity: number) {
    if (!address) return;
    
    setTxPending(true);
    const result = await buyTickets(raffleId, quantity);
    setTxResult(result);
    setTxPending(false);
    
    if (result.success) {
      setTimeout(() => loadData(), 2000);
    }
  }

  async function handleDrawWinner(raffleId: number) {
    setTxPending(true);
    const result = await drawWinner(raffleId);
    setTxResult(result);
    setTxPending(false);
    
    if (result.success) {
      setTimeout(() => loadData(), 2000);
    }
  }

  async function handleCreateRaffle(title: string, ticketPrice: number, maxTickets: number, duration: number) {
    if (!address) return;
    
    setTxPending(true);
    const result = await createRaffle(title, ticketPrice, maxTickets, duration);
    setTxResult(result);
    setTxPending(false);
    setShowCreateModal(false);
    
    if (result.success) {
      setTimeout(() => loadData(), 2000);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-900 via-gray-900 to-black text-white">
      {/* Header */}
      <header className="border-b border-orange-800/50 backdrop-blur-sm sticky top-0 z-50 bg-black/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ticket className="w-8 h-8 text-orange-400" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
              STX Raffle
            </h1>
          </div>
          
          {address ? (
            <div className="flex items-center gap-4">
              <span className="text-orange-300">{truncateAddress(address)}</span>
              <button
                onClick={async () => {
                  await disconnectWallet();
                  setAddress(null);
                }}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Disconnect
              </button>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg font-medium transition-all disabled:opacity-50"
            >
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-orange-900/30 rounded-xl p-6 border border-orange-800/50">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-5 h-5 text-orange-400" />
              <span className="text-orange-300">Total Raffles</span>
            </div>
            <p className="text-3xl font-bold">{stats.raffles}</p>
          </div>
          <div className="bg-orange-900/30 rounded-xl p-6 border border-orange-800/50">
            <div className="flex items-center gap-3 mb-2">
              <Ticket className="w-5 h-5 text-orange-400" />
              <span className="text-orange-300">Tickets Sold</span>
            </div>
            <p className="text-3xl font-bold">{stats.tickets}</p>
          </div>
          <div className="bg-orange-900/30 rounded-xl p-6 border border-orange-800/50">
            <div className="flex items-center gap-3 mb-2">
              <Coins className="w-5 h-5 text-orange-400" />
              <span className="text-orange-300">Total Prize Pool</span>
            </div>
            <p className="text-3xl font-bold">{formatSTX(stats.prizePool)} STX</p>
          </div>
        </div>

        {/* Create Button */}
        {address && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="mb-8 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-500 hover:to-yellow-500 rounded-lg font-medium transition-all"
          >
            <Plus className="w-5 h-5" />
            Create Raffle
          </button>
        )}

        {/* Raffles Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-orange-300">Active Raffles</h2>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
            </div>
          ) : raffles.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No raffles yet. Create the first one!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {raffles.map(raffle => (
                <RaffleCard
                  key={raffle.id}
                  raffle={raffle}
                  address={address}
                  onBuyTickets={handleBuyTickets}
                  onDrawWinner={handleDrawWinner}
                  txPending={txPending}
                />
              ))}
            </div>
          )}
        </div>

        {/* TX Result Toast */}
        {txResult && (
          <div className={`fixed bottom-4 right-4 p-4 rounded-lg ${txResult.success ? 'bg-green-900' : 'bg-red-900'} border ${txResult.success ? 'border-green-700' : 'border-red-700'}`}>
            <div className="flex items-center gap-2">
              {txResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <span>{txResult.success ? 'Transaction submitted!' : 'Transaction failed'}</span>
            </div>
            {txResult.txId && (
              <a
                href={getExplorerUrl(txResult.txId)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-orange-400 hover:underline mt-1 block"
              >
                View on Explorer →
              </a>
            )}
            <button
              onClick={() => setTxResult(null)}
              className="absolute top-1 right-2 text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <CreateRaffleModal
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreateRaffle}
            pending={txPending}
          />
        )}
      </main>
    </div>
  );
}

// Raffle Card Component
function RaffleCard({
  raffle,
  address,
  onBuyTickets,
  onDrawWinner,
  txPending,
}: {
  raffle: Raffle;
  address: string | null;
  onBuyTickets: (id: number, qty: number) => void;
  onDrawWinner: (id: number) => void;
  txPending: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [canDraw, setCanDraw] = useState(false);

  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    setTimeRemaining(Math.max(0, raffle.endTime - now));
    
    canDrawWinner(raffle.id).then(setCanDraw);
  }, [raffle]);

  const isActive = raffle.status === 'active' && timeRemaining > 0;
  const progress = (raffle.ticketsSold / raffle.maxTickets) * 100;

  return (
    <div className="bg-gray-900/50 rounded-xl p-6 border border-orange-800/30 hover:border-orange-600/50 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{raffle.title}</h3>
          <p className="text-gray-400 text-sm">by {truncateAddress(raffle.creator)}</p>
        </div>
        {raffle.winner ? (
          <div className="px-3 py-1 rounded-full text-sm bg-yellow-900 text-yellow-300">
            🏆 Winner: {truncateAddress(raffle.winner)}
          </div>
        ) : isActive ? (
          <div className="px-3 py-1 rounded-full text-sm bg-green-900 text-green-300">
            <Clock className="w-4 h-4 inline mr-1" />
            {formatDuration(timeRemaining)}
          </div>
        ) : (
          <div className="px-3 py-1 rounded-full text-sm bg-gray-800 text-gray-400">
            Ended
          </div>
        )}
      </div>

      {/* Prize Pool */}
      <div className="bg-orange-900/30 rounded-lg p-4 mb-4">
        <p className="text-sm text-orange-300">Prize Pool</p>
        <p className="text-2xl font-bold text-orange-400">{formatSTX(raffle.prizePool)} STX</p>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>{raffle.ticketsSold} / {raffle.maxTickets} tickets</span>
          <span>{formatSTX(raffle.ticketPrice)} STX each</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-600 to-yellow-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      {isActive && address && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="5"
            value={quantity}
            onChange={(e) => setQuantity(Math.min(5, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-20 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 text-center"
          />
          <button
            onClick={() => onBuyTickets(raffle.id, quantity)}
            disabled={txPending}
            className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg font-medium disabled:opacity-50"
          >
            Buy {quantity} Ticket{quantity > 1 ? 's' : ''} ({formatSTX(raffle.ticketPrice * quantity)} STX)
          </button>
        </div>
      )}

      {canDraw && !raffle.winner && (
        <button
          onClick={() => onDrawWinner(raffle.id)}
          disabled={txPending}
          className="w-full mt-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-medium disabled:opacity-50"
        >
          🎰 Draw Winner
        </button>
      )}
    </div>
  );
}

// Create Raffle Modal
function CreateRaffleModal({
  onClose,
  onSubmit,
  pending,
}: {
  onClose: () => void;
  onSubmit: (title: string, price: number, max: number, duration: number) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState('');
  const [ticketPrice, setTicketPrice] = useState(0.1);
  const [maxTickets, setMaxTickets] = useState(100);
  const [duration, setDuration] = useState(86400);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl p-6 max-w-lg w-full border border-orange-800">
        <h2 className="text-xl font-bold mb-4">Create Raffle</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-orange-500 outline-none"
              placeholder="Raffle title"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Ticket Price (STX)</label>
              <input
                type="number"
                step="0.1"
                value={ticketPrice}
                onChange={(e) => setTicketPrice(parseFloat(e.target.value) || 0.1)}
                className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max Tickets</label>
              <input
                type="number"
                value={maxTickets}
                onChange={(e) => setMaxTickets(parseInt(e.target.value) || 10)}
                className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-orange-500 outline-none"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-orange-500 outline-none"
            >
              <option value={3600}>1 hour</option>
              <option value={21600}>6 hours</option>
              <option value={86400}>1 day</option>
              <option value={259200}>3 days</option>
              <option value={604800}>7 days</option>
            </select>
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(title, parseSTX(ticketPrice), maxTickets, duration)}
            disabled={!title || pending}
            className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg disabled:opacity-50"
          >
            {pending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
