import React, { useState } from 'react';
import { 
  BookOpen, TrendingUp, ShoppingBag, Wallet, 
  AlertTriangle, Droplet, Hash, CreditCard,
  Globe, BarChart3, Activity, ShieldCheck,
  Search, HelpCircle, Package, Ghost, Truck
} from 'lucide-react';

const mono: React.CSSProperties = {
  fontFamily: 'ui-monospace, "Cascadia Code", monospace',
  fontVariantNumeric: 'tabular-nums',
};

const bentoCard = (topColor: string = '#C2A56D'): React.CSSProperties => ({
  background: '#FFFFFF',
  border: '1px solid #E8EDF2',
  borderTop: `4px solid ${topColor}`,
  borderRadius: '16px',
  boxShadow: '0 10px 40px -10px rgba(44,57,71,0.08)',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  height: '100%',
});

const labelStyle: React.CSSProperties = {
  fontSize: '0.6rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.15em',
  color: '#547A95',
  marginBottom: '2px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 800,
  color: '#1A2B4A',
  margin: 0,
};

const defStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  lineHeight: '1.5',
  color: '#2C3947',
  margin: 0,
};

const whyStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#547A95',
  background: '#F8FAFC',
  padding: '12px',
  borderRadius: '8px',
  borderLeft: '3px solid #E8EDF2',
  marginTop: 'auto',
};

const TERMS = [
  {
    title: 'Revenue',
    subtitle: 'The Top Line',
    definition: 'Every shilling that comes into the shop before we pay for anything else.',
    analogy: 'The total amount of grain sold today.',
    icon: <TrendingUp size={18} style={{ color: '#15803D' }} />,
    color: '#15803D'
  },
  {
    title: 'COGS',
    subtitle: 'The Cost of Stock',
    definition: 'What we paid the supplier for the goods. We subtract this from Revenue to find our profit.',
    icon: <ShoppingBag size={18} style={{ color: '#B91C1C' }} />,
    color: '#B91C1C'
  },
  {
    title: 'Net Profit',
    subtitle: 'The Take-Home',
    definition: 'The actual money the business earned. This is what is left after paying for stock, rent, and staff.',
    icon: <Wallet size={18} style={{ color: '#C9A84C' }} />,
    color: '#C9A84C'
  },
  {
    title: 'Shrinkage',
    subtitle: 'The Leakage',
    definition: 'Products that disappeared due to theft or mistakes. Lowering this is our #1 goal.',
    icon: <AlertTriangle size={18} style={{ color: '#EF4444' }} />,
    color: '#EF4444'
  },
  {
    title: 'Today’s Revenue',
    definition: 'The total amount of cash and credit sales made today only. It resets to zero every morning.',
    icon: <Activity size={18} style={{ color: '#C9A84C' }} />
  },
  {
    title: 'Total Active Products',
    definition: 'The number of different types of items we currently have in stock and available for sale.',
    icon: <Hash size={18} style={{ color: '#C9A84C' }} />
  },
  {
    title: 'Outstanding Debt',
    definition: 'Money that customers have taken goods for but have not yet paid back to the shop.',
    icon: <CreditCard size={18} style={{ color: '#C9A84C' }} />
  },
  {
    title: 'Gross Revenue (Network)',
    definition: 'The total sales from every single shop location combined. This shows the \'Big Picture\' of the whole business.',
    icon: <Globe size={18} style={{ color: '#C9A84C' }} />
  },
  {
    title: 'Direct COGS (Wholesale)',
    definition: 'What we paid to buy the goods from our suppliers. We track this so we don\'t accidentally sell things for less than they cost.',
    icon: <BarChart3 size={18} style={{ color: '#C9A84C' }} />
  },
  {
    title: 'Take-Home Profit (Margin)',
    definition: 'The true earnings of the business. 100% Efficiency means we are managing our costs perfectly.',
    icon: <TrendingUp size={18} style={{ color: '#C9A84C' }} />
  },
  {
    title: 'Locked Capital (Inventory)',
    definition: 'Money that is currently \'sleeping\' inside the products in our store. We can\'t spend it until the items are sold.',
    icon: <ShoppingBag size={18} style={{ color: '#C9A84C' }} />
  },
  {
    title: 'Cash Position (Liquid)',
    definition: 'The actual money we have in the drawer or bank that we can spend right now to buy more stock or pay bills.',
    icon: <Droplet size={18} style={{ color: '#C9A84C' }} />
  },
  {
    title: 'Cash Velocity',
    definition: 'The speed at which items move from the shelf to the customer. 100% speed means our stock is selling as fast as we can get it.',
    icon: <Activity size={18} style={{ color: '#15803D' }} />
  },
  {
    title: 'Accounts Receivable Audit',
    definition: 'A formal check of all customers who owe us money to make sure no one is over their credit limit.',
    icon: <ShieldCheck size={18} style={{ color: '#C9A84C' }} />
  },
  {
    title: 'Projection (The Future Guess)',
    definition: 'A smart guess of how much money the shop will make by the end of the month or year, based on how fast we are selling right now.',
    why: 'It helps us plan for the future. If the projection is high, we know we need to order more stock soon to keep up with the demand.',
    icon: <TrendingUp size={18} style={{ color: '#C9A84C' }} />
  },
  {
    title: 'Shelf Check (Audit)',
    definition: 'Counting items manually on the shop shelves to make sure the computer matches what is actually there.',
    icon: <Package size={18} style={{ color: '#C9A84C' }} />
  },
  {
    title: 'Ghost Items (Phantom)',
    definition: 'Items that the system thinks are in stock but haven\'t sold in a long time. This helps find stolen or lost items.',
    icon: <Ghost size={18} style={{ color: '#C9A84C' }} />
  },
  {
    title: 'Paying Back Debt (Settlement)',
    definition: 'When a customer comes back to the shop to pay for items they took earlier on credit.',
    icon: <Wallet size={18} style={{ color: '#15803D' }} />
  },
  {
    title: 'Our Buying Price (Wholesale)',
    definition: 'What we paid our suppliers to get the stock. This is NOT the price the customer pays.',
    icon: <Hash size={18} style={{ color: '#C9A84C' }} />
  },
  {
    title: 'Sending Stock Out (Dispatch)',
    definition: 'Moving items from our shop to another branch location.',
    icon: <Truck size={18} style={{ color: '#C9A84C' }} />
  }
];

const BusinessGuide = () => {
  const [query, setQuery] = useState('');

  const filtered = TERMS.filter(t => 
    t.title.toLowerCase().includes(query.toLowerCase()) ||
    (t.subtitle && t.subtitle.toLowerCase().includes(query.toLowerCase())) ||
    t.definition.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '80px' }}>
      
      {/* ── Page Header & Search ───────────────────────────────────────── */}
      <div style={{ marginBottom: '48px', textAlign: 'center' }}>
        <div style={{ 
          width: '56px', height: '56px', borderRadius: '18px', background: 'var(--navy)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' 
        }}>
          <BookOpen size={28} style={{ color: '#fff' }} />
        </div>
        <h1 style={{ fontSize: '2.2rem', color: '#1A2B4A', fontWeight: 800, margin: '0 0 24px' }}>Business Intelligence Guide</h1>
        
        {/* Search Bar */}
        <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '15px', color: '#547A95', pointerEvents: 'none' }} />
          <input 
            type="text"
            placeholder="Search for a business term (e.g., Revenue, Profit)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ 
              width: '100%', height: '48px', paddingLeft: '48px', borderRadius: '12px',
              border: '2px solid #547A95', fontSize: '1rem', transition: 'all 200ms ease',
              outline: 'none'
            }}
            className="search-input-focus"
          />
          <style>{`
            .search-input-focus:focus {
              border-color: #2C3947 !important;
              box-shadow: 0 0 0 4px rgba(44,57,71,0.1);
            }
          `}</style>
        </div>
      </div>

      {/* ── Results Bento Grid ────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <HelpCircle size={64} style={{ color: '#547A95', opacity: 0.2 }} />
          <p style={{ fontSize: '1.1rem', color: '#547A95', fontWeight: 500 }}>
            Term not found. Please try a different business word.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
          {filtered.map((t, i) => (
            <div key={i} style={bentoCard()}>
              {t.subtitle && <p style={labelStyle}>{t.subtitle}</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {t.icon}
                <h3 style={titleStyle}>{t.title}</h3>
              </div>
              <p style={defStyle}>{t.definition}</p>
              
              {t.analogy && (
                <p style={{ ...defStyle, fontSize: '0.85rem', fontStyle: 'italic', color: '#547A95', marginTop: '4px' }}>
                  <strong>Analogy:</strong> {t.analogy}
                </p>
              )}

              {t.why && (
                <div style={whyStyle}>
                  <p style={{ margin: 0 }}><strong>Why?</strong> {t.why}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <footer style={{ marginTop: '64px', textAlign: 'center', borderTop: '1px solid #E8EDF2', paddingTop: '32px' }}>
        <p style={{ ...mono, fontSize: '0.75rem', color: '#94A3B8', letterSpacing: '0.1em' }}>
          OMNI-SHOP ENTERPRISE EDUCATION MODULE · v1.2
        </p>
      </footer>
    </div>
  );
};

export default BusinessGuide;
