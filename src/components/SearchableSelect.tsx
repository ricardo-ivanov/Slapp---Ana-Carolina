import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: (string | SelectOption)[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Selecione uma opção...',
  required = false,
  className = '',
  disabled = false,
  searchPlaceholder = 'Buscar...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options to SelectOption format
  const normalizedOptions: SelectOption[] = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  // Find currently selected option
  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Filter options based on search query
  const filteredOptions = normalizedOptions.filter((opt) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      opt.label.toLowerCase().includes(query) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(query)) ||
      opt.value.toLowerCase().includes(query)
    );
  });

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  // Determine if we should show the search input (usually if options are large, e.g. > 4)
  const isLargeList = normalizedOptions.length > 4;

  return (
    <div ref={containerRef} className={`relative w-full text-left font-sans ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 bg-[#f2f4f6] hover:bg-white border hover:border-gray-300 focus:border-[#4d44e3] focus:bg-white rounded-lg px-3 py-2.5 text-xs font-semibold text-[#191c1e] transition-all outline-none select-none duration-150 disabled:opacity-60 disabled:pointer-events-none ${
          isOpen ? 'border-[#4d44e3] bg-white ring-1 ring-[#4d44e3]/30' : 'border-[#eceef0]'
        }`}
      >
        <span className={`block truncate ${!selectedOption ? 'text-[#777587] font-normal' : 'text-[#191c1e]'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0 text-[#777587]">
          {value && !required && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
              title="Limpar seleção"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#3525cd]' : ''}`} />
        </div>
      </button>

      {/* Hidden input for HTML form validation */}
      {required && (
        <input
          type="text"
          value={value}
          onChange={() => {}}
          required
          tabIndex={-1}
          className="absolute opacity-0 pointer-events-none w-0 h-0"
        />
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute z-50 mt-1 w-full rounded-xl bg-white shadow-xl border border-[#eceef0] py-1 text-xs text-[#191c1e] animate-fade-in divide-y divide-gray-50 overflow-hidden"
          style={{ transformOrigin: 'top' }}
        >
          {/* Search Box */}
          {isLargeList && (
            <div className="p-2 bg-gray-50/50">
              <div className="relative flex items-center bg-white border border-[#eceef0] rounded-lg px-2.5 py-1.5 focus-within:border-[#4d44e3] focus-within:ring-1 focus-within:ring-[#4d44e3]/20 transition-all">
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0 mr-1.5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent text-xs outline-none border-none text-[#191c1e] placeholder-gray-400 font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-0.5 hover:bg-gray-150 rounded"
                  >
                    <X className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div 
            ref={listRef}
            className="max-h-56 overflow-y-auto overflow-x-hidden py-1 divide-y divide-gray-50/50"
          >
            {filteredOptions.length === 0 ? (
              <div className="py-4 px-3 text-center text-gray-400 select-none font-medium">
                Nenhum resultado encontrado
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 transition-all outline-none font-medium ${
                      isSelected 
                        ? 'bg-[#3525cd]/5 text-[#3525cd] font-semibold' 
                        : 'hover:bg-[#f2f4f6] text-[#191c1e]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{opt.label}</div>
                      {opt.sublabel && (
                        <div className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-[#3525cd]/70' : 'text-gray-400'}`}>
                          {opt.sublabel}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[#3525cd] shrink-0 self-center" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
