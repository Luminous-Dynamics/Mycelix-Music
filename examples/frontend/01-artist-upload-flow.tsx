/**
 * Example: Complete Artist Upload Flow
 *
 * This React component demonstrates a complete song upload workflow:
 * 1. File selection (audio + cover art)
 * 2. Metadata input
 * 3. Economic strategy selection
 * 4. Revenue split configuration
 * 5. Upload to IPFS
 * 6. Smart contract interaction
 */

'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { MycelixSDK } from '@mycelix/sdk';

interface SongMetadata {
  title: string;
  artist: string;
  album: string;
  genre: string;
  description: string;
  duration: number;
}

interface RevenueRecipient {
  address: string;
  percentage: number;
  role: string;
}

export default function ArtistUploadFlow() {
  // =============================================================================
  // State Management
  // =============================================================================

  const { ready, authenticated, user } = usePrivy();
  const [step, setStep] = useState<number>(1);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverArt, setCoverArt] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<SongMetadata>({
    title: '',
    artist: '',
    album: '',
    genre: 'Electronic',
    description: '',
    duration: 0,
  });
  const [economicModel, setEconomicModel] = useState<'pay-per-stream' | 'gift-economy'>('pay-per-stream');
  const [pricePerStream, setPricePerStream] = useState<string>('0.01');
  const [recipients, setRecipients] = useState<RevenueRecipient[]>([
    { address: '', percentage: 100, role: 'artist' },
  ]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  // =============================================================================
  // Step 1: File Selection
  // =============================================================================

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        setError('Please select a valid audio file');
        return;
      }
      setAudioFile(file);
      setError('');

      // Get audio duration
      const audio = new Audio();
      audio.src = URL.createObjectURL(file);
      audio.onloadedmetadata = () => {
        setMetadata(prev => ({ ...prev, duration: Math.floor(audio.duration) }));
      };
    }
  };

  const handleCoverArtChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      setCoverArt(file);
      setError('');
    }
  };

  // =============================================================================
  // Step 2: Metadata Input
  // =============================================================================

  const handleMetadataChange = (field: keyof SongMetadata, value: string) => {
    setMetadata(prev => ({ ...prev, [field]: value }));
  };

  // =============================================================================
  // Step 3: Economic Strategy
  // =============================================================================

  const handleEconomicModelChange = (model: 'pay-per-stream' | 'gift-economy') => {
    setEconomicModel(model);
    if (model === 'gift-economy') {
      setPricePerStream('0');
    }
  };

  // =============================================================================
  // Step 4: Revenue Splits
  // =============================================================================

  const addRecipient = () => {
    setRecipients([...recipients, { address: '', percentage: 0, role: '' }]);
  };

  const updateRecipient = (index: number, field: keyof RevenueRecipient, value: string | number) => {
    const updated = [...recipients];
    updated[index] = { ...updated[index], [field]: value };
    setRecipients(updated);
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const totalPercentage = recipients.reduce((sum, r) => sum + r.percentage, 0);

  // =============================================================================
  // Step 5: Upload
  // =============================================================================

  const handleUpload = async () => {
    if (!authenticated || !user) {
      setError('Please connect your wallet first');
      return;
    }

    if (!audioFile) {
      setError('Please select an audio file');
      return;
    }

    if (totalPercentage !== 100) {
      setError('Revenue splits must total 100%');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Initialize SDK
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const sdk = new MycelixSDK({
        provider,
        signer,
        routerAddress: process.env.NEXT_PUBLIC_ROUTER_ADDRESS!,
        apiUrl: process.env.NEXT_PUBLIC_API_URL!,
      });

      // Upload files to IPFS (simulated - would use real IPFS in production)
      console.log('Uploading to IPFS...');
      const audioHash = 'QmAudio' + Math.random().toString(36).substring(7);
      const coverHash = coverArt ? 'QmCover' + Math.random().toString(36).substring(7) : undefined;

      // Prepare royalty splits
      const royaltySplit = {
        recipients: recipients.map(r => r.address),
        basisPoints: recipients.map(r => r.percentage * 100), // Convert to basis points
        roles: recipients.map(r => r.role),
      };

      // Upload song
      const result = await sdk.uploadSong({
        metadata: {
          ...metadata,
          coverArt: coverHash ? `ipfs://${coverHash}` : undefined,
          audioFile: `ipfs://${audioHash}`,
        },
        economicModel,
        pricePerStream: ethers.parseEther(pricePerStream),
        royaltySplit,
      });

      setUploadResult(result);
      setStep(5); // Success step

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // =============================================================================
  // Render Steps
  // =============================================================================

  if (!ready || !authenticated) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Upload Your Music</h2>
        <p className="text-gray-600 mb-4">Please connect your wallet to continue</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {['Files', 'Metadata', 'Economic Model', 'Revenue Splits', 'Review'].map((label, i) => (
            <div
              key={i}
              className={`flex-1 text-center text-sm ${
                step > i + 1 ? 'text-green-600' : step === i + 1 ? 'text-blue-600 font-bold' : 'text-gray-400'
              }`}
            >
              {label}
            </div>
          ))}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Step Content */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Upload Files</h2>

          {/* Audio File */}
          <div>
            <label className="block text-sm font-medium mb-2">Audio File *</label>
            <input
              type="file"
              accept="audio/*"
              onChange={handleAudioChange}
              className="w-full p-3 border border-gray-300 rounded-lg"
            />
            {audioFile && (
              <p className="mt-2 text-sm text-green-600">
                ✓ {audioFile.name} ({Math.round(audioFile.size / 1024 / 1024)}MB, {metadata.duration}s)
              </p>
            )}
          </div>

          {/* Cover Art */}
          <div>
            <label className="block text-sm font-medium mb-2">Cover Art (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleCoverArtChange}
              className="w-full p-3 border border-gray-300 rounded-lg"
            />
            {coverArt && (
              <p className="mt-2 text-sm text-green-600">✓ {coverArt.name}</p>
            )}
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!audioFile}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300"
          >
            Next: Add Metadata
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Song Metadata</h2>

          <input
            type="text"
            placeholder="Song Title *"
            value={metadata.title}
            onChange={(e) => handleMetadataChange('title', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />

          <input
            type="text"
            placeholder="Artist Name *"
            value={metadata.artist}
            onChange={(e) => handleMetadataChange('artist', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />

          <input
            type="text"
            placeholder="Album"
            value={metadata.album}
            onChange={(e) => handleMetadataChange('album', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />

          <select
            value={metadata.genre}
            onChange={(e) => handleMetadataChange('genre', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          >
            <option value="Electronic">Electronic</option>
            <option value="Hip Hop">Hip Hop</option>
            <option value="Rock">Rock</option>
            <option value="Pop">Pop</option>
            <option value="Jazz">Jazz</option>
            <option value="Classical">Classical</option>
          </select>

          <textarea
            placeholder="Description"
            value={metadata.description}
            onChange={(e) => handleMetadataChange('description', e.target.value)}
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />

          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!metadata.title || !metadata.artist}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300"
            >
              Next: Choose Economic Model
            </button>
          </div>
        </div>
      )}

      {/* Additional steps would be rendered similarly */}

      {step === 5 && uploadResult && (
        <div className="text-center space-y-6">
          <div className="text-6xl">🎉</div>
          <h2 className="text-3xl font-bold text-green-600">Upload Successful!</h2>
          <div className="bg-gray-50 p-6 rounded-lg text-left">
            <p className="font-medium mb-2">Song ID:</p>
            <p className="text-sm text-gray-600 mb-4">{uploadResult.songId}</p>
            <p className="font-medium mb-2">Transaction Hash:</p>
            <p className="text-sm text-gray-600 break-all">{uploadResult.txHash}</p>
          </div>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Usage in Next.js page:
 *
 * import ArtistUploadFlow from '@/examples/frontend/01-artist-upload-flow';
 *
 * export default function UploadPage() {
 *   return <ArtistUploadFlow />;
 * }
 */
