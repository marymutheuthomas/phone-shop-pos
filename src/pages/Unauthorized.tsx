import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="p-6 md:p-8">
        <div className="p-6 mb-6">
          <ShieldAlert size={64} />
        </div>
        
        <h1 className="mb-4">Access Restricted</h1>
        
        <p className="mb-8">
          You do not have the required security credentials to view this module.
          Your access is limited based on your current role.
        </p>

        <button 
          onClick={() => navigate('/pos')}
          className="min-h-[56px] md:min-h-[64px] px-8"
        >
          <ArrowLeft size={18} />
          Return to POS Node
        </button>
        
        <p className="mt-8">
          SECURITY PROTOCOL ENFORCED BY OMNI-SHOP V1
        </p>
      </div>
    </div>
  );
}
