/**
 * React Integration Example
 *
 * Complete React component examples for integrating Mycelix Music
 * Shows authentication, upload, playback, and payment flows
 */

import React, { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useMycelix } from '@/hooks/useMycelix';
import { formatEther, parseEther } from 'ethers/lib/utils';

// ============================================================================
// Example 1: Wallet Connection Component
// ============================================================================

export function WalletConnect() {
  const { login, logout, authenticated, user } = usePrivy();
  const { wallets } = useWallets();

  return (
    <div className="wallet-connect">
      {authenticated ? (
        <div>
          <p>Connected: {user?.wallet?.address}</p>
          <button onClick={logout}>Disconnect</button>
        </div>
      ) : (
        <button onClick={login}>Connect Wallet</button>
      )}
    </div>
  );
}

// ============================================================================
// Example 2: Song Upload Component
// ============================================================================

interface SongUploadProps {
  onUploadComplete?: (songId: string) => void;
}

export function SongUpload({ onUploadComplete }: SongUploadProps) {
  const { sdk, address } = useMycelix();
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    genre: '',
    file: null as File | null,
    strategy: 'pay-per-stream',
    price: '0.01',
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, file: e.target.files[0] });
    }
  };

  const uploadToIPFS = async (file: File): Promise<string> => {
    // Upload to IPFS using Web3.Storage or Pinata
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload-ipfs', {
      method: 'POST',
      body: formData,
    });

    const { ipfsHash } = await response.json();
    return ipfsHash;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sdk || !formData.file) return;

    setUploading(true);

    try {
      // 1. Upload file to IPFS
      const ipfsHash = await uploadToIPFS(formData.file);

      // 2. Generate unique song ID
      const songId = `song-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // 3. Upload to blockchain
      const tx = await sdk.uploadSong({
        songId,
        strategyId: formData.strategy,
        metadata: {
          title: formData.title,
          artist: formData.artist,
          genre: formData.genre,
          duration: 240, // Get from audio file
        },
        ipfsHash,
        price: parseEther(formData.price),
        splits: [
          { recipient: address!, basisPoints: 10000, role: 'artist' },
        ],
      });

      // 4. Wait for confirmation
      await tx.wait();

      // 5. Save to database
      await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId,
          title: formData.title,
          artist: formData.artist,
          genre: formData.genre,
          ipfsHash,
          strategy: formData.strategy,
          price: formData.price,
          artistAddress: address,
        }),
      });

      onUploadComplete?.(songId);
      alert('Song uploaded successfully!');

      // Reset form
      setFormData({
        title: '',
        artist: '',
        genre: '',
        file: null,
        strategy: 'pay-per-stream',
        price: '0.01',
      });
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="song-upload">
      <h2>Upload Song</h2>

      <div>
        <label>Title</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>

      <div>
        <label>Artist</label>
        <input
          type="text"
          value={formData.artist}
          onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
          required
        />
      </div>

      <div>
        <label>Genre</label>
        <input
          type="text"
          value={formData.genre}
          onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
          required
        />
      </div>

      <div>
        <label>Audio File</label>
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          required
        />
      </div>

      <div>
        <label>Strategy</label>
        <select
          value={formData.strategy}
          onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
        >
          <option value="pay-per-stream">Pay Per Stream</option>
          <option value="gift-economy">Gift Economy</option>
        </select>
      </div>

      {formData.strategy === 'pay-per-stream' && (
        <div>
          <label>Price (FLOW)</label>
          <input
            type="number"
            step="0.001"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            required
          />
        </div>
      )}

      <button type="submit" disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload Song'}
      </button>
    </form>
  );
}

// ============================================================================
// Example 3: Music Player Component
// ============================================================================

interface MusicPlayerProps {
  songId: string;
}

export function MusicPlayer({ songId }: MusicPlayerProps) {
  const { sdk, address } = useMycelix();
  const [song, setSong] = useState<any>(null);
  const [playing, setPlaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSong();
  }, [songId]);

  const loadSong = async () => {
    try {
      // Load from API
      const response = await fetch(`/api/songs/${songId}`);
      const songData = await response.json();
      setSong(songData);
    } catch (error) {
      console.error('Failed to load song:', error);
    }
  };

  const handlePlay = async () => {
    if (!sdk || !song) return;

    // For pay-per-stream, process payment first
    if (song.strategy === 'pay-per-stream' && !paid) {
      setLoading(true);

      try {
        // 1. Approve token spending
        const approveTx = await sdk.approveToken(song.price);
        await approveTx.wait();

        // 2. Process payment
        const playTx = await sdk.play(songId, { listener: address! });
        await playTx.wait();

        setPaid(true);
        setPlaying(true);

        // 3. Track analytics
        await fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'song_played',
            songId,
            listener: address,
          }),
        });
      } catch (error) {
        console.error('Payment failed:', error);
        alert('Payment failed. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      // For gift economy, just play
      setPlaying(true);
    }
  };

  const handlePause = () => {
    setPlaying(false);
  };

  if (!song) {
    return <div>Loading...</div>;
  }

  return (
    <div className="music-player">
      <div className="song-info">
        <h3>{song.title}</h3>
        <p>{song.artist}</p>
      </div>

      <div className="controls">
        {!playing ? (
          <button onClick={handlePlay} disabled={loading}>
            {loading ? 'Processing...' : paid ? 'Play' : `Play (${formatEther(song.price)} FLOW)`}
          </button>
        ) : (
          <button onClick={handlePause}>Pause</button>
        )}
      </div>

      {playing && (
        <audio
          src={`https://ipfs.io/ipfs/${song.ipfsHash}`}
          autoPlay
          controls
          onEnded={() => setPlaying(false)}
        />
      )}

      <div className="song-stats">
        <p>Plays: {song.playCount || 0}</p>
        <p>Strategy: {song.strategy}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Example 4: Artist Dashboard Component
// ============================================================================

export function ArtistDashboard() {
  const { sdk, address } = useMycelix();
  const [songs, setSongs] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalPlays: 0,
    totalEarnings: '0',
    songCount: 0,
  });

  useEffect(() => {
    loadArtistData();
  }, [address]);

  const loadArtistData = async () => {
    if (!address) return;

    try {
      // Load songs from API
      const response = await fetch(`/api/artists/${address}/songs`);
      const songData = await response.json();
      setSongs(songData);

      // Calculate stats
      const totalPlays = songData.reduce((sum: number, song: any) => sum + (song.playCount || 0), 0);
      const totalEarnings = songData.reduce(
        (sum: string, song: any) => {
          return (parseFloat(sum) + parseFloat(song.totalEarnings || '0')).toString();
        },
        '0'
      );

      setStats({
        totalPlays,
        totalEarnings,
        songCount: songData.length,
      });
    } catch (error) {
      console.error('Failed to load artist data:', error);
    }
  };

  return (
    <div className="artist-dashboard">
      <h2>Artist Dashboard</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Songs</h3>
          <p className="stat-value">{stats.songCount}</p>
        </div>

        <div className="stat-card">
          <h3>Total Plays</h3>
          <p className="stat-value">{stats.totalPlays}</p>
        </div>

        <div className="stat-card">
          <h3>Total Earnings</h3>
          <p className="stat-value">{formatEther(stats.totalEarnings)} FLOW</p>
        </div>
      </div>

      <div className="songs-list">
        <h3>Your Songs</h3>
        {songs.map((song) => (
          <div key={song.songId} className="song-card">
            <h4>{song.title}</h4>
            <p>Plays: {song.playCount || 0}</p>
            <p>Earnings: {formatEther(song.totalEarnings || '0')} FLOW</p>
            <p>Strategy: {song.strategy}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Example 5: Search & Discovery Component
// ============================================================================

export function SongSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);

    try {
      const response = await fetch(`/api/songs/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="song-search">
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for songs..."
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      <div className="search-results">
        {results.map((song) => (
          <div key={song.songId} className="result-card">
            <h4>{song.title}</h4>
            <p>{song.artist}</p>
            <p>{song.genre}</p>
            <MusicPlayer songId={song.songId} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Example 6: Complete App Layout
// ============================================================================

export function MycelixApp() {
  const { authenticated } = usePrivy();
  const [view, setView] = useState<'discover' | 'upload' | 'dashboard'>('discover');

  return (
    <div className="mycelix-app">
      <header>
        <h1>Mycelix Music</h1>
        <WalletConnect />
      </header>

      <nav>
        <button onClick={() => setView('discover')}>Discover</button>
        {authenticated && (
          <>
            <button onClick={() => setView('upload')}>Upload</button>
            <button onClick={() => setView('dashboard')}>Dashboard</button>
          </>
        )}
      </nav>

      <main>
        {view === 'discover' && <SongSearch />}
        {view === 'upload' && authenticated && <SongUpload />}
        {view === 'dashboard' && authenticated && <ArtistDashboard />}
      </main>
    </div>
  );
}
