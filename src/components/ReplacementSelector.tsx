import { useState } from 'react';
import { AlertTriangle, Check, X, AlertCircle, RefreshCw } from 'lucide-react';
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
  whyAlternative?: string;
}

export interface FailedStory {
  storyId: string;
  headline: string;
  reason: string;
}

interface ReplacementSelectorProps {
  failedStory: FailedStory;
  alternatives: Story[];
  onSubmit: (selection: { selectedStoryId?: string; removeStory: boolean }) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function ReplacementSelector({
  failedStory,
  alternatives,
  onSubmit,
  onCancel,
  isLoading = false
}: ReplacementSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removeStory, setRemoveStory] = useState(false);

  const handleAlternativeSelect = (id: string) => {
    setSelectedId(id);
    setRemoveStory(false);
  };

  const handleRemoveSelect = () => {
    setSelectedId(null);
    setRemoveStory(true);
  };

  const isValid = selectedId !== null || removeStory;

  const handleSubmit = () => {
    if (isValid) {
      onSubmit({
        selectedStoryId: selectedId || undefined,
        removeStory
      });
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return 'bg-green-500';
    if (rating >= 6) return 'bg-blue-500';
    if (rating >= 4) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Story Replacement Required</h2>
              <p className="text-sm text-slate-400">Fact check failed - please select a replacement</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Failed Story Section */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <X className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-400 mb-1">Failed Story</h3>
                <p className="text-white font-medium mb-2">{failedStory.headline}</p>
                <p className="text-sm text-slate-400">
                  <span className="text-red-400">Reason: </span>
                  {failedStory.reason}
                </p>
              </div>
            </div>
          </div>

          {/* Alternatives Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Select a Replacement</h3>
            </div>
            <p className="text-sm text-slate-400">
              Choose one of the alternative stories below, or remove the failed story entirely.
              All alternatives are in English.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-400 w-10">Select</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-400">Headline</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-400 hidden md:table-cell">Summary</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-slate-400 w-24">Rating</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-400 hidden sm:table-cell">Source</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-400 hidden lg:table-cell">Why This Alternative</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {alternatives.map((story) => {
                    const isSelected = selectedId === story.id;
                    return (
                      <tr 
                        key={story.id} 
                        className={cn(
                          "hover:bg-slate-800/50 transition-colors cursor-pointer",
                          isSelected && "bg-blue-500/10"
                        )}
                        onClick={() => handleAlternativeSelect(story.id)}
                      >
                        <td className="py-3 px-2">
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                            isSelected 
                              ? "bg-blue-500 border-blue-500" 
                              : "border-slate-600 hover:border-slate-500"
                          )}>
                            {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
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
                        <td className="py-3 px-2 hidden lg:table-cell">
                          <span className="text-sm text-slate-500">{story.whyAlternative || '-'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remove Option */}
          <div 
            className={cn(
              "border rounded-lg p-4 cursor-pointer transition-colors",
              removeStory 
                ? "bg-red-500/10 border-red-500/50" 
                : "border-slate-700 hover:bg-slate-800/50"
            )}
            onClick={handleRemoveSelect}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                removeStory 
                  ? "bg-red-500 border-red-500" 
                  : "border-slate-600"
              )}>
                {removeStory && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <div className="flex-1">
                <div className="font-medium text-slate-200">Remove this story entirely</div>
                <div className="text-sm text-slate-400">
                  The podcast will continue with one fewer story
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            {!isValid && (
              <span className="flex items-center gap-2 text-amber-400">
                <AlertCircle className="w-4 h-4" />
                Select a replacement or choose to remove the story
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
                  Confirm Replacement
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
