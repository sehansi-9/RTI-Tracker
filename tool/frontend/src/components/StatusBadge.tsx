
interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusStyles = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('sent') || s.includes('waiting')) {
      return 'bg-blue-50 text-blue-700 border-blue-100';
    }
    if (s.includes('received') || s.includes('completed')) {
      return 'bg-green-50 text-green-700 border-green-100';
    }
    if (s.includes('appealed') || s.includes('danger') || s.includes('error')) {
      return 'bg-red-50 text-red-700 border-red-100';
    }
    if (s.includes('pending') || s.includes('draft')) {
      return 'bg-gray-50 text-gray-700 border-gray-100';
    }
    return 'bg-orange-50 text-orange-700 border-orange-100';
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusStyles(status)}`}>
      {status}
    </span>
  );
}
