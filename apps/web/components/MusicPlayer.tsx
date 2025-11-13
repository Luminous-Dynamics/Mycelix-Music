import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Heart, Share2, List } from 'lucide-react';
import { Song } from '../data/mockSongs';

interface MusicPlayerProps {
  song: Song;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export default function MusicPlayer({ song, onClose, onNext, onPrevious }: MusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const duration = 240; // 4 minutes demo
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulate playback progress
  useEffect(() => {
    if (isPlaying) {
      progressIntervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            return duration;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseInt(e.target.value);
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: song.title,
          text: `Check out "${song.title}" by ${song.artist} on Mycelix Music!`,
          url: window.location.href,
        });
      } catch (err) {
        alert('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-white/10 overflow-hidden">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        {/* Album Art */}
        <div className="relative w-full aspect-square">
          {/* Real cover art */}
          <Image
            src={song.coverArt}
            alt={`${song.title} by ${song.artist}`}
            fill
            sizes="(max-width: 768px) 100vw, 512px"
            className="object-cover"
            priority
          />

          {/* Waveform Overlay (simulated) */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center space-x-1 p-4">
            {Array.from({ length: 50 }).map((_, i) => {
              const height = Math.random() * 60 + 20;
              const isActive = i < (currentTime / duration) * 50;
              return (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all ${
                    isActive ? 'bg-purple-400' : 'bg-white/30'
                  }`}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
        </div>

        {/* Player Controls */}
        <div className="p-6 space-y-4">

          {/* Song Info */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-1">{song.title}</h2>
            <p className="text-gray-400">{song.artist}</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                         [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-500
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                         [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                         [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:rounded-full
                         [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
            />
            <div className="flex justify-between text-sm text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center space-x-6">
            <button
              onClick={onPrevious}
              className="p-3 rounded-full hover:bg-white/10 transition disabled:opacity-50"
              disabled={!onPrevious}
            >
              <SkipBack className="w-6 h-6 text-white" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-5 rounded-full bg-purple-600 hover:bg-purple-700 transition shadow-lg shadow-purple-500/50"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 text-white" />
              ) : (
                <Play className="w-8 h-8 text-white ml-1" />
              )}
            </button>

            <button
              onClick={onNext}
              className="p-3 rounded-full hover:bg-white/10 transition disabled:opacity-50"
              disabled={!onNext}
            >
              <SkipForward className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Secondary Controls */}
          <div className="flex items-center justify-between">

            {/* Volume */}
            <div className="flex items-center space-x-2 flex-1">
              <button
                onClick={toggleMute}
                className="p-2 rounded-full hover:bg-white/10 transition"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-gray-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-gray-400" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                           [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500
                           [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                           [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3
                           [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:rounded-full
                           [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsLiked(!isLiked)}
                className={`p-2 rounded-full hover:bg-white/10 transition ${
                  isLiked ? 'text-red-500' : 'text-gray-400'
                }`}
              >
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={handleShare}
                className="p-2 rounded-full hover:bg-white/10 transition text-gray-400"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button
                className="p-2 rounded-full hover:bg-white/10 transition text-gray-400"
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Song Stats */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="text-sm">
              <span className="text-gray-400">{song.plays.toLocaleString()} plays</span>
              {' • '}
              <span className="text-gray-400">{song.genre}</span>
            </div>
            <div className="text-sm">
              <span className="text-green-400 font-semibold">${song.earnings} earned</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
