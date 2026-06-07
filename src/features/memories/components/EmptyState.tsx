import { Bookmark } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="card text-center py-16 px-6">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-border flex items-center justify-center mx-auto mb-4">
        <Bookmark className="w-6 h-6 text-primary-light" />
      </div>
      <h3 className="font-display text-lg text-foreground mb-2">Nothing saved yet</h3>
      <p className="text-muted text-sm max-w-xs mx-auto leading-relaxed">
        Paste a link or jot down a note above. Everything you keep will show up here.
      </p>
    </div>
  );
}
