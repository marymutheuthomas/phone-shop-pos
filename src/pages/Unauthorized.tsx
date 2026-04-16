import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center h-full min-h-[60vh] animate-fade-in">
      <div className="glass-panel p-12 max-w-lg text-center flex flex-col items-center border-t-4 border-danger-color">
        <div className="bg-[rgba(239,68,68,0.1)] p-6 rounded-full mb-6 text-danger-color">
          <ShieldAlert size={64} />
        </div>
        
        <h1 className="text-3xl font-800 text-white mb-4 uppercase tracking-tighter">Access Restricted</h1>
        
        <p className="text-text-secondary text-lg mb-8 leading-relaxed">
          You do not have the required security credentials to view this module.
          Your access is limited based on your current role.
        </p>

        <button 
          onClick={() => navigate('/pos')}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <ArrowLeft size={18} />
          Return to POS Node
        </button>
        
        <p className="mt-8 text-xs text-text-muted uppercase tracking-widest">
          SECURITY PROTOCOL ENFORCED BY OMNI-SHOP V1
        </p>
      </div>
    </div>
  );
}
