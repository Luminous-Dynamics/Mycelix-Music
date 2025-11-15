/**
 * Search Bar Component
 * Universal search with autocomplete and suggestions
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSearch, useSearchSuggestions, useSearchHistory } from '@/hooks/useSearch';
import { useRouter } from 'next/navigation';

interface SearchBarProps {
  placeholder?: string;
  userAddress?: string;
  autoFocus?: boolean;
  onResultClick?: (result: any) => void;
}

export function SearchBar({
  placeholder = 'Search songs, artists, playlists...',
  userAddress,
  autoFocus = false,
  onResultClick,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { results, isLoading } = useSearch(query, 'all', userAddress);
  const { data: suggestionsData } = useSearchSuggestions(query);
  const { data: historyData } = useSearchHistory(userAddress);

  const suggestions = suggestionsData?.suggestions || [];
  const recentSearches = historyData?.history || [];

  // Show results when query exists or showing recent searches
  const showDropdown = showResults && (query || recentSearches.length > 0);
  const displayResults = query ? results : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    const itemCount = displayResults.length + suggestions.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < itemCount - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < displayResults.length) {
          handleResultClick(displayResults[selectedIndex]);
        } else if (query) {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowResults(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    setShowResults(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleResultClick = (result: any) => {
    setShowResults(false);
    setQuery('');

    if (onResultClick) {
      onResultClick(result);
      return;
    }

    // Navigate based on result type
    switch (result.result_type) {
      case 'song':
        router.push(`/songs/${result.result_id}`);
        break;
      case 'artist':
        router.push(`/artists/${result.result_id}`);
        break;
      case 'playlist':
        router.push(`/playlists/${result.result_id}`);
        break;
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowResults(false);
    router.push(`/search?q=${encodeURIComponent(suggestion)}`);
  };

  return (
    <div className="relative w-full max-w-2xl">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          className="block w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setShowResults(true)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
        />

        {query && (
          <button
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {isLoading && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showDropdown && (
        <div
          ref={resultsRef}
          className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto"
        >
          {/* Recent Searches */}
          {!query && recentSearches.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                Recent Searches
              </div>
              {recentSearches.slice(0, 5).map((search: any, index: number) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(search.search_query)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{search.search_query}</span>
                </button>
              ))}
            </div>
          )}

          {/* Search Results */}
          {query && displayResults.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                Results
              </div>
              {displayResults.slice(0, 8).map((result, index) => (
                <button
                  key={`${result.result_type}-${result.result_id}`}
                  onClick={() => handleResultClick(result)}
                  className={`w-full px-3 py-2 text-left rounded flex items-center gap-3 ${
                    selectedIndex === index
                      ? 'bg-blue-100 dark:bg-blue-900'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {/* Icon/Image */}
                  {result.image_url ? (
                    <img src={result.image_url} alt={result.title} className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                      {getResultIcon(result.result_type)}
                    </div>
                  )}

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {result.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {result.subtitle} • {result.result_type}
                    </div>
                  </div>

                  {/* Relevance score (optional) */}
                  {/* <div className="text-xs text-gray-400">
                    {(result.relevance * 100).toFixed(0)}%
                  </div> */}
                </button>
              ))}

              {/* See all results */}
              {displayResults.length > 8 && (
                <button
                  onClick={handleSearch}
                  className="w-full px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-center"
                >
                  See all {displayResults.length} results
                </button>
              )}
            </div>
          )}

          {/* Suggestions */}
          {query && suggestions.length > 0 && (
            <div className="p-2 border-t border-gray-200 dark:border-gray-700">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                Suggestions
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion.suggestion)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {suggestion.suggestion}
                  </span>
                  <span className="text-xs text-gray-400">
                    {suggestion.suggestion_type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {query && displayResults.length === 0 && !isLoading && (
            <div className="p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                No results found for "{query}"
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Try different keywords or browse trending songs
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getResultIcon(type: string) {
  switch (type) {
    case 'song':
      return '🎵';
    case 'artist':
      return '🎤';
    case 'playlist':
      return '📚';
    case 'user':
      return '👤';
    default:
      return '🔍';
  }
}

/**
 * Compact Search Bar for mobile/header
 */
export function CompactSearchBar({ userAddress }: { userAddress?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <SearchBar userAddress={userAddress} autoFocus />
      <button
        onClick={() => setIsExpanded(false)}
        className="p-2 text-gray-600 dark:text-gray-400"
      >
        ✕
      </button>
    </div>
  );
}
