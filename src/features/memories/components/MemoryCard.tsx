'use client';

import { Clock } from 'lucide-react';
import { MemoryData } from '../types/memory.types';
import PlatformIcon from './PlatformIcon';

function timeAgo(dateInput: string | Date): string {
  const date = new Date(dateInput);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

interface MemoryCardProps {
  memory: MemoryData;
}

export default function MemoryCard({ memory }: MemoryCardProps) {
  const isUrl = memory.type === 'url';
  const platform = isUrl && memory.tags.length > 0 ? memory.tags[0] : null;
  const badgeText = platform ?? memory.type;

  return (
    <div className="glass rounded-2xl p-5 hover:border-border-strong transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10 group flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            isUrl ? 'bg-primary/15 text-primary-light' : 'bg-accent/15 text-accent-light'
          }`}
        >
          <PlatformIcon platform={platform} type={memory.type} className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate text-sm group-hover:text-primary-light transition-colors">
            {memory.title}
          </h3>
          <span
            className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-medium ${
              isUrl
                ? 'bg-primary/10 text-primary-light'
                : 'bg-accent/10 text-accent-light'
            }`}
          >
            {badgeText}
          </span>
        </div>
      </div>

      {/* Content preview */}
      <p className="text-muted text-xs leading-relaxed line-clamp-2 flex-1">
        {memory.content}
      </p>

      {/* Tags — skip the first two (platform + subtype already shown as badge) for URL memories */}
      {memory.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(isUrl ? memory.tags.slice(2) : memory.tags).slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 bg-surface rounded-full text-muted"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Timestamp */}
      <div className="flex items-center gap-1 text-muted text-xs">
        <Clock className="w-3 h-3" />
        <span>{timeAgo(memory.createdAt)}</span>
      </div>
    </div>
  );
}
