import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { Pagination } from './Pagination';

export interface Column<T> {
  header: string;
  accessor?: keyof T;
  render?: (item: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  loading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  rowKey: keyof T | ((item: T) => string);
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function DataTable<T>({
  data,
  columns,
  onEdit,
  onDelete,
  loading,
  loadingMessage = "Loading...",
  emptyMessage = "No data found.",
  rowKey,
  currentPage,
  totalPages,
  onPageChange
}: DataTableProps<T>) {
  if (loading) {
    return <div className="p-10 text-center text-sm text-gray-500">{loadingMessage}</div>;
  }

  if (data.length === 0) {
    return <div className="p-10 text-center text-sm text-gray-500">{emptyMessage}</div>;
  }

  const getKey = (item: T) => {
    if (typeof rowKey === 'function') return rowKey(item);
    return item[rowKey] as unknown as string;
  };

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-white">
            <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100">
              {columns.map((col, i) => (
                <th key={i} className={`px-4 py-3 ${col.headerClassName || ''}`}>
                  {col.header}
                </th>
              ))}
              {(onEdit || onDelete) && <th className="px-4 py-3 w-[140px]">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((item) => (
              <tr key={getKey(item)} className="hover:bg-gray-50/50">
                {columns.map((col, i) => (
                  <td key={i} className={`px-4 py-3 ${col.className || ''}`}>
                    {col.render ? col.render(item) : (col.accessor ? String(item[col.accessor] || '-') : '-')}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {onEdit && (
                        <Button variant="outline" size="sm" className="px-2" onClick={() => onEdit(item)} title="Edit">
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button variant="danger" size="sm" className="px-2" onClick={() => onDelete(item)} title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages && totalPages > 1 && onPageChange && (
        <div className="p-3 border-t border-gray-100 bg-gray-50/30">
          <Pagination
            currentPage={currentPage || 1}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
