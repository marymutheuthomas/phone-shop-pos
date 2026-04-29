import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useForensics } from '../../hooks/useForensics';
import { Ghost, TrendingUp } from 'lucide-react';

export const TrendWatch = () => {
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
      }, 5000); // 5-second polling interval for simulation magic

      return () => clearInterval(interval);
   }, [user]);

   return (
      <div className="flex gap-6 mt-6">
        <div className="p-6 md:p-8" >
           <h3 className="mb-4 flex items-center gap-2"><Ghost /> Phantom Inventory Sweeper</h3>
           {alerts.length === 0 ? <p >No phantom anomalies tracking against offline models.</p> : (
              <div className="flex flex-col gap-3">
                 {alerts.map((a, i) => (
                    <div key={i} className="p-3 flex flex-col gap-2" >
                       <div className="flex justify-between items-center mb-1">
                          <span >{a.name}</span>
                          <span  >Unrecorded Sales Detected</span>
                       </div>
                       <p >Physical Local Stock: {a.stockCount} | Offline Sales History in 48hrs: 0</p>
                    </div>
                 ))}
              </div>
           )}
        </div>
        <div className="p-6 md:p-8" >
           <h3 className="mb-4 flex items-center gap-2"><TrendingUp /> 2026 Trend Intelligence</h3>
           <p className="mb-4">
              System is currently tracking globally emerging movement algorithms prioritizing: <b>Qi2.2 MagSafe nodes, Open Wearable Stereo (OWS) structures, and AI-enabled Smart Rings.</b> Ensure multi-branch inventory reflects these dynamics immediately.
           </p>
           <button className="min-h-[56px] md:min-h-[64px] px-8 flex items-center justify-center gap-2" >View Regional Forecasting Data</button>
        </div>
      </div>
   );
};

export default TrendWatch;
