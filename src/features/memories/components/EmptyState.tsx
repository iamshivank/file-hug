import { Bookmark } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <Bookmark className="w-8 h-8 text-primary-light" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">No memories yet</h3>
      <p className="text-muted text-sm max-w-xs mx-auto leading-relaxed">
        Paste a URL or write a thought above. Everything you save will appear here.
      </p>
    </div>
  );
}
