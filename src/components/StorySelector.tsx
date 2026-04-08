import { useState, useMemo } from 'react';
import { Check, AlertCircle, Newspaper, Globe } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Story {
  id: string;
  headline: string;
  summary: string;
  newsRating: number;
  source: string;
  originalLanguage: string;
  section: 'local' | 'continent';
  url?: string;
}

interface StorySelectorProps {
  localStories: Story[];
  continentStories: Story[];
  onSubmit: (selection: { localStoryIds: string[]; continentStoryIds: string[] }) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function StorySelector({
  localStories,
  continentStories,
  onSubmit,
  onCancel,
  isLoading = false
}: StorySelectorProps) {
  // Pre-select top 5 local and top 3 continent by newsRating
  const defaultLocalIds = useMemo(() => {
    return [...localStories]
      .sort((a, b) => b.newsRating - a.newsRating)
      .slice(0, 5)
      .map(s => s.id);
  }, [localStories]);

  const defaultContinentIds = useMemo(() => {
    return [...continentStories]
      .sort((a, b) => b.newsRating - a.newsRating)
      .slice(0, 3)
      .map(s => s.id);
  }, [continentStories]);

  const [selectedLocalIds, setSelectedLocalIds] = useState<Set<string>>(new Set(defaultLocalIds));
  const [selectedContinentIds, setSelectedContinentIds] = useState<Set<string>>(new Set(defaultContinentIds));

  const handleLocalToggle = (storyId: string) => {
    setSelectedLocalIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(storyId)) {
        newSet.delete(storyId);
      } else {
        newSet.add(storyId);
      }
      return newSet;
    });
  };

  const handleContinentToggle = (storyId: string) => {
    setSelectedContinentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(storyId)) {
        newSet.delete(storyId);
      } else {
        newSet.add(storyId);
      }
      return newSet;
    });
  };

  const isValid = selectedLocalIds.size === 5 && selectedContinentIds.size === 3;

  const handleSubmit = () => {
    if (isValid) {
      onSubmit({
        localStoryIds: Array.from(selectedLocalIds),
        continentStoryIds: Array.from(selectedContinentIds)
      });
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return 'bg-green-500';
    if (rating >= 6) return 'bg-blue-500';
    if (rating >= 4) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const StoryTable = ({ 
    stories, 
    selectedIds, 
    onToggle, 
    title, 
    icon: Icon,
    targetCount,
    section
  }: { 
    stories: Story[];
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    title: string;
    icon: React.ElementType;
    targetCount: number;
    section: 'local' | 'continent';
  }) => {
    const currentCount = section === 'local' 
      ? selectedLocalIds.size 
      : selectedContinentIds.size;
    const isComplete = currentCount === targetCount;
    const isOver = currentCount > targetCount;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          <div className={cn(
            "text-sm font-medium px-3 py-1 rounded-full",
            isComplete ? "bg-green-500/20 text-green-400" :
            isOver ? "bg-red-500/20 text-red-400" :
            "bg-slate-700 text-slate-400"
          )}>
            Selected: {currentCount}/{targetCount}
          </div>
        </div>

        {isOver && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 p-2 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span>Please select exactly {targetCount} stories</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-2 text-xs font-medium text-slate-400 w-10">Select</th>
                <th className="text-left py-2 px-2 text-xs font-medium text-slate-400">Headline</th>
                <th className="text-left py-2 px-2 text-xs font-medium text-slate-400 hidden md:table-cell">Summary</th>
                <th className="text-center py-2 px-2 text-xs font-medium text-slate-400 w-24">Rating</th>
                <th className="text-left py-2 px-2 text-xs font-medium text-slate-400 hidden sm:table-cell">Source</th>
                <th className="text-center py-2 px-2 text-xs font-medium text-slate-400 w-20">Lang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {stories
                .sort((a, b) => b.newsRating - a.newsRating)
                .map((story) => {
                  const isSelected = selectedIds.has(story.id);
                  return (
                    <tr 
                      key={story.id} 
                      className={cn(
                        "hover:bg-slate-800/50 transition-colors cursor-pointer",
                        isSelected && "bg-blue-500/10"
                      )}
                      onClick={() => onToggle(story.id)}
                    >
                      <td className="py-3 px-2">
                        <div className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                          isSelected 
                            ? "bg-blue-500 border-blue-500" 
                            : "border-slate-600 hover:border-slate-500"
                        )}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-medium text-slate-200 text-sm">{story.headline}</div>
                      </td>
                      <td className="py-3 px-2 hidden md:table-cell">
                        <div className="text-sm text-slate-400 line-clamp-2">{story.summary}</div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            getRatingColor(story.newsRating)
                          )} />
                          <span className="text-sm font-medium text-slate-300">{story.newsRating}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 hidden sm:table-cell">
                        <span className="text-sm text-slate-500">{story.source}</span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="text-xs px-2 py-1 bg-slate-800 rounded text-slate-400">
                          {story.originalLanguage}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-2xl font-bold text-white mb-2">Select Stories for Your Podcast</h2>
          <p className="text-slate-400">
            Review all researched stories and select exactly 5 local and 3 continent stories.
            All content has been translated to English.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Local Stories */}
          <StoryTable
            stories={localStories}
            selectedIds={selectedLocalIds}
            onToggle={handleLocalToggle}
            title="Local News"
            icon={Newspaper}
            targetCount={5}
            section="local"
          />

          {/* Divider */}
          <div className="border-t border-slate-800" />

          {/* Continent Stories */}
          <StoryTable
            stories={continentStories}
            selectedIds={selectedContinentIds}
            onToggle={handleContinentToggle}
            title="Continent News"
            icon={Globe}
            targetCount={3}
            section="continent"
          />
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            {!isValid && (
              <span className="flex items-center gap-2 text-amber-400">
                <AlertCircle className="w-4 h-4" />
                Select exactly 5 local and 3 continent stories to continue
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {onCancel && (
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={!isValid || isLoading}
              className={cn(
                "px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2",
                isValid && !isLoading
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Confirm Selection
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
