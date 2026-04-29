import type { ReactNode } from 'react';
interface Column<T> {
  header: string;
  render: (item: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
}

/**
 * DataTable: Premium standardized data display component.
 * Ensures consistent alignment, spacing, and hover states across all ledgers.
 */
export function DataTable<T>({ 
  data, 
  columns, 
  loading, 
  emptyMessage = "No records found.",
  onRowClick 
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="p-12">
        <div >Syncing Ledger Data...</div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="overflow-hidden">
        <table className="w-full">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th 
                key={idx} 
                className={col.className}
                
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody >
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-12">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, rowIdx) => (
              <tr 
                key={rowIdx} 
                className={onRowClick ? 'cursor-pointer hover:bg-slate-50 transition-colors' : ''}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col, colIdx) => (
                  <td 
                    key={colIdx} 
                    className={`py-4 px-6 border-b border-slate-100 ${col.className || ''}`}
                    
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
