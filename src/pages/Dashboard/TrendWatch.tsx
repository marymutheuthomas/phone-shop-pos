import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useForensics } from '../../hooks/useForensics';
import { Ghost, TrendingUp } from 'lucide-react';

export const TrendWatch = () => {
   const { user } = useAuth();
   const { detectPhantoms } = useForensics();
   const [alerts, setAlerts] = useState<any[]>([]);

   useEffect(() => {
      // Re-calculate the algorithm whenever the dashboard widget mounts or when DB alters
      if (user) {
         detectPhantoms(user.shopId).then(res => setAlerts(res));
      }
      
      const interval = setInterval(() => {
          if (user) detectPhantoms(user.shopId).then(res => setAlerts(res));
      }, 5000); // 5-second polling interval for simulation magic

      return () => clearInterval(interval);
   }, [user]);

   return (
      <div className="flex gap-6 mt-6 animate-fade-in">
        <div className="glass-panel p-6 flex-1" style={{ border: '1px solid rgba(245, 158, 11, 0.2)', background: 'rgba(245, 158, 11, 0.05)' }}>
           <h3 className="text-xl font-bold text-warning-color mb-4 flex items-center gap-2"><Ghost /> Phantom Inventory Sweeper</h3>
           {alerts.length === 0 ? <p className="text-success-color font-bold">No phantom anomalies tracking against offline models.</p> : (
              <div className="flex flex-col gap-3">
                 {alerts.map((a, i) => (
                    <div key={i} className="p-3 rounded-lg flex flex-col gap-2" style={{ background: 'var(--surface-color-1)' }}>
                       <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-text-primary">{a.name}</span>
                          <span className="text-xs font-bold text-danger-color" style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Unrecorded Sales Detected</span>
                       </div>
                       <p className="text-sm text-text-secondary">Physical Local Stock: {a.stockCount} | Offline Sales History in 48hrs: 0</p>
                    </div>
                 ))}
              </div>
           )}
        </div>
        <div className="glass-panel p-6 flex-1" style={{ border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.05)' }}>
           <h3 className="text-xl font-bold text-success-color mb-4 flex items-center gap-2"><TrendingUp /> 2026 Trend Intelligence</h3>
           <p className="text-sm text-text-secondary leading-relaxed mb-4">
              System is currently tracking globally emerging movement algorithms prioritizing: <b>Qi2.2 MagSafe nodes, Open Wearable Stereo (OWS) structures, and AI-enabled Smart Rings.</b> Ensure multi-branch inventory reflects these dynamics immediately.
           </p>
           <button className="btn btn-primary" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success-color)', border: '1px solid var(--success-color)', width: '100%' }}>View Regional Forecasting Data</button>
        </div>
      </div>
   );
};

export default TrendWatch;
