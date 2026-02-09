'use client';

import { useState, useEffect, useRef } from 'react';
import {
  FileAudio, Calendar, DollarSign, User, Play, Pause, ChevronLeft,
  Clock, Send, MessageSquare, Loader2, CheckCircle, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

import CallAnalysisCard from './CallAnalysisCard';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface DocumentData {
  _id: string;
  fileName: string;
  fileUrl?: string; // Ensure this is populated
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  documentType?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  vendorName?: string;
  vendorAddress?: string;
  clientName?: string;
  clientAddress?: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  currency?: string;
  lineItems?: LineItem[];
  uploadedAt: string;
  processedAt?: string;
  processingError?: string;
  // Analysis Data
  intent?: string;
  financialEvents?: string[];
  emotionalState?: string;
  complianceNotes?: string[];
}

interface FinancialReviewProps {
  pdfUrl?: string;
  initialData: DocumentData;
}

const CHAT_SUGGESTIONS = [
  "What is the total amount?",
  "Who is the vendor?",
  "When is the due date?",
  "Summarize the audio"
];

export default function FinancialReview({ pdfUrl, initialData }: FinancialReviewProps) {
  const router = useRouter();
  const [data, setData] = useState<DocumentData>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [visualizerData, setVisualizerData] = useState<number[]>(new Array(20).fill(10));

  const audioRef = useRef<HTMLAudioElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null); // For auto-scroll
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai', text: string }>>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Poll for updates if status is PROCESSING
  useEffect(() => {
    if (data.status !== 'PROCESSING') return;

    const interval = setInterval(async () => {
      setIsRefreshing(true);
      try {
        const response = await fetch(`/api/documents?_id=${data._id}`);
        const result = await response.json();
        if (result.documents && result.documents[0]) {
          setData(result.documents[0]);
        }
      } catch (error) {
        console.error('Error refreshing document:', error);
      } finally {
        setIsRefreshing(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [data.status, data._id]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Audio Duration Handler
  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  // Initialize Audio Context and Visualizer
  const togglePlay = async () => {
    if (!audioRef.current || !data.fileUrl) return;

    if (!audioContextRef.current) {
      // Initialize Web Audio API
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 64; // Small size for fewer bars (20 needed)
      analyzerRef.current = analyzer;

      const source = audioContext.createMediaElementSource(audioRef.current);
      sourceRef.current = source;

      source.connect(analyzer);
      analyzer.connect(audioContext.destination);
    }

    // Resume context if suspended (browser policy)
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      updateVisualizer();
    }
  };

  const updateVisualizer = () => {
    if (!analyzerRef.current || !isPlaying) return;

    const bufferLength = analyzerRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyzerRef.current.getByteFrequencyData(dataArray);

    // Normalize and downsample to 20 bars
    const bars = 20;
    const step = Math.floor(bufferLength / bars);
    const newData = [];

    for (let i = 0; i < bars; i++) {
      const value = dataArray[i * step] || 0;
      // Scale to percentage (0-100) but keep min height
      const height = Math.max(10, (value / 255) * 100);
      newData.push(height);
    }

    setVisualizerData(newData);
    animationRef.current = requestAnimationFrame(updateVisualizer);
  };

  // Keep visualizer running while playing
  useEffect(() => {
    if (isPlaying) {
      updateVisualizer();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
  }, [isPlaying]);

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setChatInput('');
    setIsTyping(true);

    // Send to API
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: data._id,
          message: text
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to get response');
      }

      setMessages(prev => [...prev, {
        role: 'ai',
        text: result.answer
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'ai',
        text: "Sorry, I encountered an error while analyzing the document. Please try again."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const getStatusIcon = () => {
    switch (data.status) {
      case 'COMPLETED':
        return <CheckCircle size={16} />;
      case 'PROCESSING':
        return <Clock size={16} className="animate-spin-slow" />;
      case 'FAILED':
        return <AlertCircle size={16} />;
    }
  };

  // Helper function to get country from currency code
  const getCountryFromCurrency = (currencyCode?: string): string => {
    if (!currencyCode) return '';

    const currencyMap: Record<string, string> = {
      'USD': 'United States',
      'INR': 'India',
      'EUR': 'Europe',
      'GBP': 'United Kingdom',
      'JPY': 'Japan',
      'CNY': 'China',
      'AUD': 'Australia',
      'CAD': 'Canada',
      'CHF': 'Switzerland',
      'SGD': 'Singapore',
      'AED': 'UAE',
      'SAR': 'Saudi Arabia',
      'ZAR': 'South Africa',
      'BRL': 'Brazil',
      'MXN': 'Mexico',
      'RUB': 'Russia',
      'KRW': 'South Korea',
      'HKD': 'Hong Kong',
      'NZD': 'New Zealand',
      'SEK': 'Sweden',
      'NOK': 'Norway',
      'DKK': 'Denmark',
      'PLN': 'Poland',
      'THB': 'Thailand',
      'MYR': 'Malaysia',
      'IDR': 'Indonesia',
      'PHP': 'Philippines',
      'VND': 'Vietnam',
      'EGP': 'Egypt',
      'NGN': 'Nigeria',
      'PKR': 'Pakistan',
      'BDT': 'Bangladesh',
    };

    return currencyMap[currencyCode.toUpperCase()] || '';
  };

  // Helper function to get currency symbol
  const getCurrencySymbol = (currencyCode?: string): string => {
    if (!currencyCode) return '';

    const symbolMap: Record<string, string> = {
      'USD': '$',
      'INR': '₹',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CNY': '¥',
      'AUD': 'A$',
      'CAD': 'C$',
      'CHF': 'CHF',
      'SGD': 'S$',
      'AED': 'د.إ',
      'SAR': 'ر.س',
      'ZAR': 'R',
      'BRL': 'R$',
      'MXN': 'MX$',
      'RUB': '₽',
      'KRW': '₩',
      'HKD': 'HK$',
      'NZD': 'NZ$',
    };

    return symbolMap[currencyCode.toUpperCase()] || currencyCode.toUpperCase();
  };

  // Get vendor location from data or infer from currency
  const vendorLocation = data.vendorAddress || getCountryFromCurrency(data.currency);
  const currencySymbol = getCurrencySymbol(data.currency);

  const totalAmount = data.totalAmount || 0;
  const paidAmount = 0; // You can get this from data if available
  const remaining = totalAmount - paidAmount;

  return (
    <div className="financial-review">
      {/* Hidden Audio Element */}
      {data.fileUrl && (
        <audio
          ref={audioRef}
          src={data.fileUrl}
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
          crossOrigin="anonymous" // Important for AudioContext
        />
      )}

      {/* Header */}
      <div className="review-header animate-slide-down">
        <div className="header-left">
          <button onClick={() => router.back()} className="back-button">
            <ChevronLeft size={22} />
          </button>
          <div className="header-info">
            <div className="file-title">
              <FileAudio size={24} className="title-icon" />
              <h2>{data.fileName}</h2>
            </div>
            <p className="upload-date">Processed on {format(new Date(data.uploadedAt), 'MMM dd, yyyy')}</p>
          </div>
        </div>
        <div className={`status-badge ${data.status.toLowerCase()}`}>
          {getStatusIcon()}
          <span>{data.status}</span>
        </div>
      </div>

      <div className="review-grid">
        {/* Left Column - Audio Player */}
        <div className="audio-section">
          <div className="audio-card">
            <div className="audio-glow" />

            <div className="audio-content">
              <div className="audio-player">
                {/* Audio Icon */}
                <div className={`audio-icon-circle ${isPlaying ? 'playing' : ''}`}>
                  <FileAudio size={56} />
                </div>

                {/* Visualizer */}
                <div className="audio-visualizer">
                  {visualizerData.map((height, i) => (
                    <div
                      key={i}
                      className="bar"
                      style={{
                        height: `${height}%`,
                        opacity: isPlaying ? 1 : 0.5
                      }}
                    />
                  ))}
                </div>

                {/* Progress Bar */}
                <div className="progress-container">
                  <span className="time">{formatTime(currentTime)}</span>
                  <div className="progress-wrapper">
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSeek}
                      className="seek-slider"
                    />
                  </div>
                  <span className="time">{formatTime(duration)}</span>
                </div>

                {/* Controls */}
                <div className="audio-controls">
                  <button className="control-btn" onClick={() => {
                    if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 10);
                  }}>
                    <ChevronLeft size={28} />
                  </button>
                  <button
                    className="play-button"
                    onClick={togglePlay}
                  >
                    {isPlaying ? <Pause fill="#14213D" size={24} /> : <Play fill="#14213D" size={24} />}
                  </button>
                  <button className="control-btn" onClick={() => {
                    if (audioRef.current) audioRef.current.currentTime = Math.min(duration, currentTime + 10);
                  }}>
                    <ChevronLeft size={28} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Info & Chat */}
        <div className="info-section">
          <div className="scrollable-content">
            {/* Call Analysis Card (Commented out to match design) */}
            {/* <CallAnalysisCard
              intent={data.intent}
              financialEvents={data.financialEvents}
              emotionalState={data.emotionalState}
              complianceNotes={data.complianceNotes}
            /> */}

            {/* Metadata Card */}
            <div className="info-card">
              <h3 className="card-section-title">METADATA</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>TYPE</label>
                  <p>{data.documentType || 'Audio'}</p>
                </div>
                <div className="info-item">
                  <label>INVOICE #</label>
                  <p>{data.invoiceNumber || '-'}</p>
                </div>
                <div className="info-item">
                  <label>DATE</label>
                  <p>{data.invoiceDate ? format(new Date(data.invoiceDate), 'MMM dd, yyyy') : '-'}</p>
                </div>
                <div className="info-item">
                  <label>DUE DATE</label>
                  <p>{data.dueDate ? format(new Date(data.dueDate), 'MMM dd, yyyy') : '-'}</p>
                </div>
              </div>
            </div>

            {/* Parties & Summary Card */}
            <div className="summary-card">
              <div className="parties-grid">
                <div className="party-info">
                  <div className="party-label">
                    <User size={16} />
                    <span>VENDOR</span>
                  </div>
                  <p className="party-name">{data.vendorName || '-'}</p>
                  {vendorLocation && <p className="party-location">{vendorLocation}</p>}
                </div>
                <div className="party-info">
                  <div className="party-label">
                    <DollarSign size={16} />
                    <span>TOTAL</span>
                  </div>
                  <p className="total-amount">
                    {totalAmount > 0 ? `${currencySymbol}${totalAmount.toFixed(2)}` : 'No money mentioned'}
                  </p>
                  <p className="currency">{data.currency?.toUpperCase() || '-'}</p>
                </div>
              </div>

              <div className="payment-summary">
                <div className="payment-row">
                  <span>Paid So Far</span>
                  <span className="paid-amount">{currencySymbol}{paidAmount.toFixed(2)}</span>
                </div>
                <div className="payment-row total">
                  <span>Remaining Due</span>
                  <span className="remaining-amount">{currencySymbol}{remaining.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* AI Assistant Chat Card */}
            <div className="chat-card-container">
              <div className="chat-card">
                <div className="chat-header">
                  <div className="chat-header-content">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="folder-icon">
                      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" fill="currentColor" />
                    </svg>
                    <h3>AI Assistant</h3>
                  </div>
                </div>

                <div className="chat-messages">
                  {messages.length === 0 ? (
                    <div className="chat-empty">
                      <div className="chat-empty-icon">
                        <MessageSquare size={40} strokeWidth={1.5} />
                      </div>
                      <p>Ask me anything about this document!</p>
                    </div>
                  ) : (
                    messages.map((msg, i) => (
                      <div key={i} className={`message ${msg.role}`}>
                        <div className="message-bubble">
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                  {isTyping && (
                    <div className="message ai">
                      <div className="message-bubble typing">
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} /> {/* Auto-scroll target */}
                </div>

                <div className="chat-footer">
                  <div className="suggestions">
                    {CHAT_SUGGESTIONS.map((sugg, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(sugg)}
                        className="suggestion-chip"
                      >
                        {sugg}
                      </button>
                    ))}
                  </div>
                  <div className="chat-input-wrapper">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(chatInput)}
                      placeholder="Ask a question..."
                      className="chat-input"
                    />
                    <button
                      onClick={() => handleSendMessage(chatInput)}
                      className="send-button"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .financial-review {
          min-height: 100vh;
          background: var(--navy-bg);
          padding: 1rem;
        }

        .review-header {
          background: white;
          border-radius: 2rem;
          padding: 1.5rem 2rem;
          margin-bottom: 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 10px 50px rgba(20, 33, 61, 0.1);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .back-button {
          width: 3rem;
          height: 3rem;
          border-radius: 50%;
          border: 1px solid #f0f0f0;
          background: white;
          color: var(--navy-bg);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
        }

        .back-button:hover {
          background: #f7fafc;
          border-color: #e2e8f0;
        }

        .header-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .file-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .title-icon {
          color: var(--tangerine);
        }

        .file-title h2 {
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--navy-bg);
          margin: 0;
        }

        .upload-date {
          font-size: 0.875rem;
          color: #a0aec0;
          margin: 0;
          margin-left: 2.25rem;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border: 1px solid;
        }

        .status-badge.completed {
          background: rgba(72, 187, 120, 0.1);
          color: #22543d;
          border-color: rgba(72, 187, 120, 0.2);
        }

        .status-badge.processing {
          background: rgba(252, 163, 17, 0.1);
          color: var(--tangerine-darker);
          border-color: rgba(252, 163, 17, 0.2);
        }

        .status-badge.failed {
          background: rgba(245, 101, 101, 0.1);
          color: #742a2a;
          border-color: rgba(245, 101, 101, 0.2);
        }

        .review-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          max-width: 1600px;
          margin: 0 auto;
          height: calc(100vh - 150px); /* Full height minus header */
        }

        .audio-section {
          display: flex;
          flex-direction: column;
          height: 100%; /* Take full height of grid */
        }

        .audio-card {
          background: linear-gradient(135deg, #0f192e 0%, #14213D 100%);
          border-radius: 2rem;
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 3rem;
          position: relative;
          overflow: hidden;
          height: 100%; /* Full height */
          min-height: 600px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .audio-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 500px;
          height: 500px;
          background: rgba(252, 163, 17, 0.05);
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
        }

        .audio-content {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 500px;
        }

        .audio-player {
          background: rgba(20, 33, 61, 0.6);
          backdrop-filter: blur(10px);
          border-radius: 2.5rem;
          padding: 2.5rem;
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .audio-icon-circle {
          width: 10rem;
          height: 10rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 2.5rem;
          border: 2px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          color: white;
          opacity: 0.9;
          transition: all 0.3s;
        }

        .audio-icon-circle.playing {
          border-color: var(--tangerine);
          animation: pulseBorder 2s ease-in-out infinite;
        }

        .audio-visualizer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          height: 4rem;
          margin-bottom: 2rem;
        }

        .bar {
          width: 0.375rem;
          background: var(--tangerine);
          border-radius: 2rem;
          height: 6px;
          transition: height 0.1s ease; /* Smooth transition for visualizer */
          opacity: 0.8;
          min-height: 6px;
        }

        .bar.animate {
          animation: musicBar 0.5s infinite ease-in-out alternate;
        }

        .progress-container {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          margin-bottom: 2.5rem;
        }

        .time {
          color: #a0aec0;
          font-size: 0.75rem;
          font-family: 'Courier New', monospace;
          letter-spacing: 0.05em;
          width: 45px;
        }

        .progress-wrapper {
            flex: 1;
            position: relative;
            height: 0.375rem;
        }

        .seek-slider {
            -webkit-appearance: none;
            width: 100%;
            height: 0.375rem;
            background: #2d3748;
            border-radius: 2rem;
            outline: none;
            cursor: pointer;
        }
        
        .seek-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 1rem;
            height: 1rem;
            background: var(--tangerine);
            border-radius: 50%;
            cursor: pointer;
            transition: transform 0.1s;
        }

        .seek-slider::-webkit-slider-thumb:hover {
            transform: scale(1.2);
        }

        .progress-bar {
          flex: 1;
          height: 0.375rem;
          background: #2d3748;
          border-radius: 2rem;
          overflow: hidden;
          position: relative;
        }

        .progress-fill {
          width: 33%;
          height: 100%;
          background: var(--tangerine);
          border-radius: 2rem;
          position: relative;
          box-shadow: 0 0 10px var(--tangerine);
        }

        .progress-handle {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 0.75rem;
          height: 0.75rem;
          background: white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .info-card {
          background: white;
          border-radius: 2rem;
          padding: 2rem;
          box-shadow: 0 10px 50px rgba(20, 33, 61, 0.1);
          flex-shrink: 0;
        }

        .card-section-title {
          font-size: 0.625rem;
          font-weight: 700;
          color: rgba(20, 33, 61, 0.4);
          letter-spacing: 0.1em;
          margin: 0 0 1.5rem 0;
          padding-bottom: 1rem;
          border-bottom: 1px solid #f0f0f0;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
        }

        .info-item label {
          display: block;
          font-size: 0.625rem;
          font-weight: 700;
          color: #a0aec0;
          letter-spacing: 0.05em;
          margin-bottom: 0.375rem;
        }

        .info-item p {
          font-family: var(--font-display);
          font-size: 1rem;
          font-weight: 500;
          color: var(--navy-bg);
          margin: 0;
        }

        .summary-card {
           background: var(--cream-bg);
           border-radius: 2rem;
           padding: 2rem;
           border: 1px solid rgba(252, 163, 17, 0.2);
           flex-shrink: 0;
         }

         .parties-grid {
           display: grid;
           grid-template-columns: repeat(2, 1fr);
           gap: 1.5rem;
           margin-bottom: 2rem;
         }

         .party-label {
           display: flex;
           align-items: center;
           gap: 0.5rem;
           margin-bottom: 0.5rem;
           color: var(--tangerine-darker);
         }

         .party-label span {
           font-size: 0.625rem;
           font-weight: 700;
           letter-spacing: 0.1em;
         }

         .party-name {
           font-family: var(--font-display);
           font-size: 1.125rem;
           font-weight: 700;
           color: var(--navy-bg);
           margin: 0 0 0.25rem 0;
         }

         .party-location {
           font-size: 0.75rem;
           color: #718096;
           margin: 0;
         }

         .total-amount {
           font-family: var(--font-display);
           font-size: 1.875rem;
           font-weight: 700;
           color: var(--navy-bg);
           margin: 0 0 0.25rem 0;
         }

         .currency {
           font-size: 0.75rem;
           color: rgba(20, 33, 61, 0.6);
           margin: 0;
         }

         .payment-summary {
           padding-top: 1rem;
           border-top: 1px solid rgba(252, 163, 17, 0.1);
         }

         .payment-row {
           display: flex;
           justify-content: space-between;
           align-items: center;
           padding: 0.75rem 0;
           border-bottom: 1px solid rgba(252, 163, 17, 0.1);
         }

         .payment-row span:first-child {
           font-size: 0.875rem;
           color: #718096;
           font-weight: 500;
         }

         .paid-amount {
           font-family: var(--font-display);
           font-size: 1.125rem;
           font-weight: 700;
           color: var(--success);
         }

         .payment-row.total {
           border-bottom: none;
           padding-top: 0.5rem;
         }

         .remaining-amount {
           font-family: var(--font-display);
           font-size: 1.5rem;
           font-weight: 700;
           color: var(--tangerine-darker);
         }
        .audio-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2rem;
        }

        .control-btn {
          background: transparent;
          border: none;
          color: #a0aec0;
          cursor: pointer;
          transition: color 0.3s;
        }

        .control-btn:hover {
          color: white;
        }

        .play-button {
          width: 4rem;
          height: 4rem;
          border-radius: 50%;
          border: none;
          background: var(--tangerine);
          color: var(--navy-bg);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 20px rgba(252, 163, 17, 0.4);
          transition: all 0.3s;
        }

        .play-button:hover {
          background: var(--tangerine-dark);
          transform: scale(1.05);
        }

        .play-button:active {
          transform: scale(0.95);
        }

        /* Right Column - Info & Chat */
        .info-section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          height: 100%; /* Match audio section height */
          overflow: hidden;
          position: relative;
        }

        .scrollable-content {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding-bottom: 1rem;
          scrollbar-width: thin;
        }

        .scrollable-content::-webkit-scrollbar {
          width: 4px;
        }

        .scrollable-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .scrollable-content::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 4px;
        }

        /* Chat Card at Bottom */
        .chat-card-container {
          flex-shrink: 0; /* Don't shrink */
          height: auto;
          min-height: 300px;
          max-height: 400px;
          pointer-events: auto;
        }

        .chat-card {
          background: white;
          border-radius: 2rem;
          box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          height: 100%;
          pointer-events: auto;
          border: 1px solid rgba(229, 229, 229, 0.5);
        }

        .chat-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #f0f0f0;
          background: white;
          border-top-left-radius: 2rem;
          border-top-right-radius: 2rem;
        }

        .chat-header-content {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }

        .folder-icon {
          color: var(--tangerine);
          flex-shrink: 0;
        }

        .chat-header h3 {
          font-family: var(--font-display);
          font-size: 1rem;
          font-weight: 700;
          color: var(--navy-bg);
          margin: 0;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          scrollbar-width: thin;
        }

        .chat-messages::-webkit-scrollbar {
          width: 4px;
        }

        .chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }

        .chat-messages::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 4px;
        }

        .chat-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 1rem;
        }

        .chat-empty-icon {
          width: 4rem;
          height: 4rem;
          border-radius: 50%;
          background: #f7fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a0aec0;
        }

        .chat-empty p {
          color: #a0aec0;
          font-size: 0.9375rem;
          margin: 0;
        }

        .message {
          display: flex;
          animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .message.user {
          justify-content: flex-end;
        }

        .message.ai {
          justify-content: flex-start;
        }

        .message-bubble {
          max-width: 85%;
          padding: 0.75rem 1.25rem;
          border-radius: 1.25rem;
          font-size: 0.9375rem;
          line-height: 1.6;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
        }

        .message.user .message-bubble {
          background: var(--navy-bg);
          color: white;
          border-bottom-right-radius: 0.25rem;
        }

        .message.ai .message-bubble {
          background: #f7fafc;
          color: var(--navy-bg);
          border: 1px solid #f0f0f0;
          border-bottom-left-radius: 0.25rem;
        }

        .message-bubble.typing {
          display: flex;
          gap: 0.375rem;
          padding: 1rem 1.5rem;
        }

        .dot {
          width: 0.375rem;
          height: 0.375rem;
          background: #cbd5e1;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }

        .dot:nth-child(1) { animation-delay: -0.32s; }
        .dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1.0);
          }
        }

        .chat-footer {
          padding: 1rem 1.5rem;
          background: white;
          border-top: 1px solid #f0f0f0;
          border-bottom-left-radius: 2rem;
          border-bottom-right-radius: 2rem;
        }


        .suggestions {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
          overflow-x: auto;
          padding-bottom: 0.25rem;
        }

        .suggestions::-webkit-scrollbar {
          height: 4px;
        }

        .suggestion-chip {
          white-space: nowrap;
          padding: 0.5rem 1rem;
          background: #f7fafc;
          border: 1px solid #f0f0f0;
          border-radius: 2rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: #718096;
          cursor: pointer;
          transition: all 0.3s;
        }

        .suggestion-chip:hover {
          background: var(--cream-bg);
          color: var(--tangerine-darker);
          border-color: rgba(252, 163, 17, 0.2);
        }

        .chat-input-wrapper {
          display: flex;
          gap: 0.75rem;
        }

        .chat-input {
          flex: 1;
          background: #f7fafc;
          border: none;
          border-radius: 2rem;
          padding: 0.75rem 1.5rem;
          font-size: 0.875rem;
          color: var(--navy-bg);
          outline: none;
          transition: all 0.3s;
        }

        .chat-input:focus {
          background: white;
          box-shadow: 0 0 0 2px rgba(252, 163, 17, 0.2);
        }

        .chat-input::placeholder {
          color: #a0aec0;
        }

        .send-button {
          width: 2.75rem;
          height: 2.75rem;
          border-radius: 50%;
          border: none;
          background: var(--tangerine);
          color: var(--navy-bg);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(252, 163, 17, 0.3);
          transition: all 0.3s;
        }

        .send-button:hover {
          background: var(--tangerine-dark);
        }

        .send-button:active {
          transform: scale(0.9);
        }

        @media (max-width: 1400px) {
          .review-grid {
            grid-template-columns: 1fr;
            height: auto;
          }

          .audio-section {
            height: auto;
            min-height: 600px;
          }

          .info-section {
            height: auto;
            min-height: 800px;
          }

          .scrollable-content {
            overflow: visible;
          }

          .chat-card-container {
            max-height: none;
          }
        }

        @media (max-width: 768px) {
          .review-header {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .parties-grid {
            grid-template-columns: 1fr;
          }
        }

        @keyframes pulseBorder {
          0% { box-shadow: 0 0 0 0 rgba(252, 163, 17, 0.4); }
          70% { box-shadow: 0 0 0 20px rgba(252, 163, 17, 0); }
          100% { box-shadow: 0 0 0 0 rgba(252, 163, 17, 0); }
        }

        @keyframes musicBar {
          0% { height: 10%; }
          100% { height: 100%; }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slide-down {
          animation: slideDown 0.5s ease-out forwards;
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

