import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Check, Loader2 } from 'lucide-react';

export interface SearchableSelectOption {
  id: number | string;
  code?: string;
  title: string;
  subtitle?: string;
  badge?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  selectedId: number | string | undefined | null;
  onSelect: (option: SearchableSelectOption | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  onSearchChange?: (term: string) => void;
  className?: string;
  required?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  selectedId,
  onSelect,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search by code or name...',
  disabled = false,
  loading = false,
  onSearchChange,
  className = '',
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => String(opt.id) === String(selectedId));

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (onSearchChange) {
      onSearchChange(val);
    }
  };

  const filteredOptions = options.filter((opt) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchTitle = opt.title.toLowerCase().includes(term);
    const matchCode = opt.code ? opt.code.toLowerCase().includes(term) : false;
    const matchSubtitle = opt.subtitle ? opt.subtitle.toLowerCase().includes(term) : false;
    return matchTitle || matchCode || matchSubtitle;
  });

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden input for form validation if required */}
      {required && (
        <input
          type="text"
          value={selectedId ? String(selectedId) : ''}
          onChange={() => {}}
          required
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {/* Main Trigger Field */}
      <div
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`flex min-h-[42px] w-full cursor-pointer items-center justify-between rounded-md border bg-white px-3 py-2 text-sm shadow-sm transition-colors ${
          disabled
            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
            : isOpen
            ? 'border-blue-600 ring-2 ring-blue-100'
            : 'border-slate-300 hover:border-slate-400 text-slate-800'
        }`}
      >
        <div className="flex flex-1 items-center space-x-2 overflow-hidden mr-2">
          {selectedOption ? (
            <div className="flex items-center space-x-2 truncate">
              {selectedOption.code && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {selectedOption.code}
                </span>
              )}
              <span className="font-medium text-slate-900 truncate">{selectedOption.title}</span>
              {selectedOption.subtitle && (
                <span className="text-xs text-slate-500 truncate hidden sm:inline">
                  • {selectedOption.subtitle}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          {selectedOption && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
          />
        </div>
      </div>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={handleSearchInput}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    if (onSearchChange) onSearchChange('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1 text-sm">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-slate-500 space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span>Searching active employees...</span>
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                No employees found matching &quot;<span className="font-semibold">{searchTerm}</span>&quot;
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.id) === String(selectedId);
                return (
                  <div
                    key={opt.id}
                    onClick={() => {
                      onSelect(opt);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 text-blue-900 font-medium'
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex-1 pr-2 min-w-0">
                      <div className="flex items-center space-x-2">
                        {opt.code && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {opt.code}
                          </span>
                        )}
                        <span className="font-medium truncate">{opt.title}</span>
                        {opt.badge && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subtitle && (
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {opt.subtitle}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
