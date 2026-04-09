import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-[#f0f0f0] flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-[#bbb]" />
      </div>
      <p className="text-sm font-medium text-[#555] mb-1">{title}</p>
      {description && <p className="text-xs text-[#aaa] max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
