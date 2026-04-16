import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useForensics } from '../../hooks/useForensics';
import { Ghost, TrendingUp } from 'lucide-react';
import { formatKSh } from '../../utils/formatters';

export const TrendPulse = () => {
   const { user } = useAuth();
   const { detectPhantomInventory } = useForensics();
   const [alerts, setAlerts] = useState<any[]>([]);

   useEffect(() => {
      // Re-calculate the algorithm whenever the dashboard widget mounts or when DB alters
      if (user) {
         detectPhantomInventory(user.role === 'ADMIN', user.shopId).then(res => setAlerts(res));
      }
      
      const interval = setInterval(() => {
          if (user) detectPhantomInventory(user.role === 'ADMIN', user.shopId).then(res => setAlerts(res));
      }, 5000);

      return () => clearInterval(interval);
   }, [user]);

   return (
      <div className="flex gap-6 mt-6 animate-fade-in">
        <div className="glass-panel p-8 flex-1" style={{ borderTop: '4px solid var(--danger-color)' }}>
           <h3 className="text-2xl font-800 text-danger-color mb-6 flex items-center gap-3"><Ghost size={28} className="animate-pulse-glow"/> Phantom Inventory Watch</h3>
           {alerts.length === 0 ? <p className="text-success-color font-bold flex items-center gap-2"><span>No Internal Leakage Detected.</span></p> : (
              <div className="flex flex-col gap-4 max-h-72 overflow-y-auto pr-2">
                 {alerts.map((a) => (
                    <div key={a.id} className="p-4 rounded-xl flex flex-col gap-3 glass-card" style={{ borderLeft: '4px solid var(--danger-color)' }}>
                       <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-lg text-text-primary">{a.name}</span>
                          <span className="badge badge-danger">HIGH PROBABILITY LEAKAGE</span>
                       </div>
                       <div className="flex flex-col gap-2 text-sm text-text-secondary mt-2">
                          <div className="flex justify-between items-center">
                            <span>Shop Node: <b className="text-white bg-[rgba(255,255,255,0.1)] px-2 py-1 rounded">{a.shopName}</b></span>
                            <span>Floor Stock: <b className="text-white">{a.stockCount} Units</b></span>
                          </div>
                          <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop: '1px dashed var(--glass-border)' }}>
                            <span className="italic">Trigger: 0 sales logged in 48hrs</span>
                            <div className="flex flex-col items-end">
                              <span className="text-xs uppercase">Est. Lost Revenue</span>
                              <span className="text-danger-color font-800 text-lg">{formatKSh(a.lostRevenueKsh)}</span>
                            </div>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           )}
        </div>
        
        <div className="glass-panel p-8 flex-1" style={{ borderTop: '4px solid var(--success-color)' }}>
           <h3 className="text-2xl font-800 text-success-color mb-6 flex items-center gap-3"><TrendingUp size={28}/> 2026 Trend Core</h3>
           <p className="text-base text-text-secondary leading-relaxed mb-8">
              Real-time velocity tracking is actively monitoring global vectors for rapid response restocking:<br/><br/>
              <span className="text-white font-500 flex items-center gap-2 mb-2">✦ Qi2 Magnetic Ecosystems</span>
              <span className="text-white font-500 flex items-center gap-2 mb-2">✦ 240W Ultra-Fast GaN Hubs</span>
              <span className="text-white font-500 flex items-center gap-2 mb-2">✦ Smart Ring Wearables</span>
              <span className="text-white font-500 flex items-center gap-2 mb-2">✦ OWS Audio Topologies</span>
           </p>
           
           <button className="btn-primary w-full" style={{ background: 'var(--surface-color-2)', color: 'var(--success-color)', border: '1px solid var(--success-color)' }}>
              Open Prediction Models
           </button>
        </div>
      </div>
   );
};

export default TrendPulse;
