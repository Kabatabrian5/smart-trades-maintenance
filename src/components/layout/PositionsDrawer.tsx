import { useState } from 'react';

interface Position {
  id: string;
  symbol: string;
  contract: string;
  stake: number;
  duration: number;
  ticksElapsed?: number;
  contractValue?: number;
  payout?: number;
  profit?: number;
  status: 'Pending' | 'Open' | 'Settled';
  result?: 'won' | 'lost';
}

export default function PositionsDrawer({ positions }: { positions: Position[] }) {
  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'transactions' | 'journal'>('summary');
  const settledPositions = positions.filter((position) => position.status === 'Settled');
  const totalStake = positions.reduce((total, position) => total + position.stake, 0);
  const totalPayout = settledPositions.reduce((total, position) => total + (position.payout ?? 0), 0);
  const totalProfitLoss = settledPositions.reduce((total, position) => total + (position.profit ?? 0), 0);
  const contractsLost = settledPositions.filter((position) => position.result === 'lost').length;
  const contractsWon = settledPositions.filter((position) => position.result === 'won').length;

  return (
    <aside className="w-80 bg-[#121217] border-r border-[#22222c] flex flex-col h-full text-white font-sans select-none">
      
      {/* Top Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-[#22222c] text-xs font-bold text-gray-200">
        <span>Positions</span>
        <button className="text-gray-500 hover:text-white transition-colors">✕</button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[#22222c] text-xs font-semibold text-gray-400">
        <button
          onClick={() => setActiveSubTab('summary')}
          className={`flex-1 py-2.5 text-center transition-all ${
            activeSubTab === 'summary'
              ? 'border-b-2 border-red-500 text-white font-bold bg-[#17171e]/50'
              : 'hover:text-white'
          }`}
        >
          Summary
        </button>
        <button
          onClick={() => setActiveSubTab('transactions')}
          className={`flex-1 py-2.5 text-center transition-all ${
            activeSubTab === 'transactions'
              ? 'border-b-2 border-red-500 text-white font-bold bg-[#17171e]/50'
              : 'hover:text-white'
          }`}
        >
          Transactions
        </button>
        <button
          onClick={() => setActiveSubTab('journal')}
          className={`flex-1 py-2.5 text-center transition-all ${
            activeSubTab === 'journal'
              ? 'border-b-2 border-red-500 text-white font-bold bg-[#17171e]/50'
              : 'hover:text-white'
          }`}
        >
          Journal
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 text-gray-500">
        {positions.length === 0 ? <div className="flex h-full flex-col items-center justify-center text-center"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-[#262633] bg-[#1a1a22] text-gray-400 shadow-inner">📊</div><p className="text-xs font-medium text-gray-400">No positions yet</p><p className="mt-1 text-[10px] text-gray-600">Completed or open trades will appear here.</p></div> : <div className="space-y-2">{positions.map((position) => { const profit = position.profit ?? 0; return <div key={position.id} className="rounded-xl border border-[#262633] bg-[#1a1a22] p-3 text-xs"><div className="flex justify-between gap-2"><span className="font-bold text-white">{position.symbol}</span><span className={position.status === 'Settled' ? (position.result === 'won' ? 'text-emerald-400' : 'text-rose-400') : 'text-amber-300'}>{position.status}</span></div><div className="mt-1 text-gray-500">{position.contract} · #{position.id}</div><div className="mt-2 grid grid-cols-2 gap-2 text-[11px]"><span>Tick {position.ticksElapsed ?? 0}/{position.duration}</span><span className={profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>P/L {profit.toFixed(2)} USD</span><span>Value {(position.contractValue ?? position.stake).toFixed(2)} USD</span><span>Payout {(position.payout ?? 0).toFixed(2)} USD</span></div></div>; })}</div>}
      </div>

      {/* Footer Run Statistics */}
      <div className="p-4 bg-[#16161c] border-t border-[#22222c] text-xs">
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div>
            <span className="text-gray-500 block text-[10px] uppercase font-semibold">Total stake</span>
            <span className="font-bold text-gray-200">{totalStake.toFixed(2)} USD</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px] uppercase font-semibold">Total payout</span>
            <span className="font-bold text-gray-200">{totalPayout.toFixed(2)} USD</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px] uppercase font-semibold">No. of runs</span>
            <span className="font-bold text-gray-200">{positions.length}</span>
          </div>
        </div>

        {/* Contracts Breakdown */}
        <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-[#22222c] mb-4 text-[11px]">
          <div>
            <span className="text-gray-500 block text-[9px] uppercase">Contracts lost</span>
            <span className="font-bold text-gray-300">{contractsLost}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[9px] uppercase">Contracts won</span>
            <span className="font-bold text-gray-300">{contractsWon}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[9px] uppercase">Total profit/loss</span>
            <span className={`font-bold ${totalProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{totalProfitLoss.toFixed(2)} USD</span>
          </div>
        </div>

        {/* Reset Button */}
        <button className="w-full py-2.5 bg-[#1f1f28] hover:bg-[#282835] border border-[#2e2e3d] rounded-xl text-xs font-bold text-gray-300 transition-all shadow-sm">
          Reset
        </button>
      </div>
    </aside>
  );
}