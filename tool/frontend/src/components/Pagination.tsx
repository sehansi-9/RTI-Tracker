import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  className = '',
  size = 'sm'
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <Button
        variant="outline"
        size={size}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="px-2 disabled:opacity-50"
        title="Previous Page"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      
      <div className="flex items-center gap-1.5 min-w-fit">
        <span className="text-xs font-semibold text-gray-700">
          {currentPage}
        </span>
        <span className="text-xs text-gray-400">/</span>
        <span className="text-xs font-medium text-gray-500">
          {totalPages}
        </span>
      </div>

      <Button
        variant="outline"
        size={size}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="px-2 disabled:opacity-50"
        title="Next Page"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
