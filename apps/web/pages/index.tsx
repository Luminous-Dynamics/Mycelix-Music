import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { motion } from 'framer-motion';
import { Music, Sparkles, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import EarningsCalculator from '../components/EarningsCalculator';
import Navigation from '../components/Navigation';

export default function HomePage() {
  const { login, authenticated, user } = usePrivy();
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const features = [
    {
      icon: Music,
      title: 'Artists: 10x-50x More Earnings',
      description: 'Earn $100-$1,500 from 10K plays vs Spotify\'s $30. Choose pay-per-stream, freemium, tips, or patronage.',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: Sparkles,
      title: 'Listeners: Try 3 Free Plays',
      description: 'Discover new music risk-free with freemium. Then tip what you want or pay per stream.',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: TrendingUp,
      title: 'Everyone: Support Artists Directly',
      description: 'Your payments go straight to artists. No middlemen, no 90-day delays, no exploitation.',
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: Users,
      title: 'Community: You Own This',
      description: 'DAO-governed platform. Zero platform fees for first 100 artists. Built for the people, by the people.',
      color: 'from-orange-500 to-red-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Navigation />

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 pt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <h1 className="text-6xl font-bold text-white mb-6">
            Music Streaming,
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Reimagined
            </span>
          </h1>
          <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
            The first decentralized music platform where every artist is sovereign, every listener is
            valued, and every community designs its own economy.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/discover"
              className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-lg font-medium transition"
            >
              Discover Music
            </Link>
            <Link
              href="/upload"
              className="px-8 py-4 border-2 border-purple-400 text-purple-400 hover:bg-purple-400/10 rounded-lg text-lg font-medium transition"
            >
              Upload Your Song
            </Link>
          </div>
        </motion.div>

        {/* Earnings Calculator - Make it irresistible for artists! */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-20"
        >
          <EarningsCalculator />
        </motion.div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              onHoverStart={() => setHoveredCard(index)}
              onHoverEnd={() => setHoveredCard(null)}
              className="relative group"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${feature.color} rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300`}
              />
              <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 h-full hover:border-white/20 transition">
                <feature.icon className="w-12 h-12 text-purple-400 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 grid md:grid-cols-3 gap-8 text-center"
        >
          <div>
            <div className="text-4xl font-bold text-white mb-2">3+</div>
            <div className="text-gray-400">Economic Models</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-2">10x</div>
            <div className="text-gray-400">Better Artist Earnings</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-2">100%</div>
            <div className="text-gray-400">Artist Sovereignty</div>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500">
            <p>© 2025 Mycelix Music. Built on Mycelix Protocol.</p>
            <p className="mt-2 text-sm">
              Powered by FLOW 💧 | CGC ✨ | TEND 🤲 | CIV 🏛️
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
