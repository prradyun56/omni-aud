'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from '../../components/FileUpload';
import { FileAudio, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Document {
  _id: string;
  fileName: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  uploadedAt: string;
  documentType?: string;
  totalAmount?: number;
  currency?: string;
  vendorName?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'PROCESSING' | 'COMPLETED' | 'FAILED'>('all');

  const fetchDocuments = async () => {
    try {
      const queryParams = filter !== 'all' ? `?status=${filter}` : '';
      const response = await fetch(`/api/documents${queryParams}`);
      const data = await response.json();

      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [filter]);

  // Poll for updates every 5 seconds if there are processing documents
  useEffect(() => {
    const hasProcessing = documents.some(doc => doc.status === 'PROCESSING');

    if (!hasProcessing) return;

    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [documents]);

  const handleUploadComplete = (documentId: string) => {
    fetchDocuments();
  };

  const filteredDocuments = documents;

  const getStatusBadge = (status: string) => {
    const configs = {
      COMPLETED: {
        icon: CheckCircle,
        className: 'status-badge completed'
      },
      PROCESSING: {
        icon: Clock,
        className: 'status-badge processing'
      },
      FAILED: {
        icon: AlertCircle,
        className: 'status-badge failed'
      }
    };

    const config = configs[status as keyof typeof configs] || configs.PROCESSING;
    const Icon = config.icon;

    return (
      <div className={config.className}>
        <Icon size={14} />
        <span>{status}</span>
      </div>
    );
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'wav' || ext === 'mp3' || ext === 'mp4') {
      return <FileAudio size={18} />;
    }
    return <FileText size={18} />;
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

  // Format amount with currency or show message if no amount
  const formatAmount = (amount?: number, currency?: string): string => {
    if (amount === undefined || amount === null || amount === 0) {
      return 'No money mentioned';
    }
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${amount.toFixed(2)}`;
  };

  return (
    <div className="dashboard">
      {/* Background decorative elements */}
      <div className="bg-decoration">
        <div className="bg-noise" />
        <div className="bg-blob blob-1" />
        <div className="bg-blob blob-2" />
      </div>

      <div className="dashboard-content">
        {/* Header */}
        <div className="header animate-fade-in">
          <h1 className="title">Omni Audit</h1>
          <p className="subtitle">
            Making finance <span className="accent">effortless</span> for everyone.
          </p>
        </div>

        {/* Upload Section */}
        <div className="upload-section animate-slide-up">
          <FileUpload onUploadComplete={handleUploadComplete} />
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs animate-slide-up">
          {[
            { key: 'all', label: 'All Documents' },
            { key: 'PROCESSING', label: 'Processing' },
            { key: 'COMPLETED', label: 'Completed' },
            { key: 'FAILED', label: 'Failed' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as typeof filter)}
              className={`filter-tab ${filter === tab.key ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Documents Table */}
        <div className="table-card">
          <div className="table-header">
            <h2>Recent Activity</h2>
            <span className="count-badge">{filteredDocuments.length}</span>
          </div>

          {isLoading ? (
            <div className="empty-state">
              <p>Loading documents...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} />
              <h3>No documents found</h3>
              <p>Upload a financial document to get started</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="documents-table">
                <thead>
                  <tr>
                    <th>STATUS</th>
                    <th>FILE NAME</th>
                    <th>TYPE</th>
                    <th>VENDOR</th>
                    <th>AMOUNT</th>
                    <th>UPLOADED</th>
                    <th className="text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc, idx) => (
                    <tr
                      key={doc._id}
                      className="table-row"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <td>{getStatusBadge(doc.status)}</td>
                      <td>
                        <div className="file-cell">
                          <div className="file-icon">
                            {getFileIcon(doc.fileName)}
                          </div>
                          <span className="file-name">{doc.fileName}</span>
                        </div>
                      </td>
                      <td className="text-secondary">
                        {doc.fileName.split('.').pop()?.toUpperCase() || 'Audio'}
                      </td>
                      <td className="text-secondary">{doc.vendorName || '-'}</td>
                      <td className="amount">
                        {formatAmount(doc.totalAmount, doc.currency)}
                      </td>
                      <td className="text-muted">
                        {format(new Date(doc.uploadedAt), 'MMM dd, yyyy')}
                      </td>
                      <td className="text-right">
                        <button
                          className="view-btn"
                          onClick={() => router.push(`/dashboard/${doc._id}`)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
                .dashboard {
                    min-height: 100vh;
                    position: relative;
                    overflow-x: hidden;
                }

                .bg-decoration {
                    position: fixed;
                    inset: 0;
                    pointer-events: none;
                    overflow: hidden;
                    z-index: 0;
                }

                .bg-noise {
                    position: absolute;
                    inset: 0;
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
                    opacity: 0.03;
                    mix-blend-mode: overlay;
                }

                .bg-blob {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(120px);
                }

                .blob-1 {
                    top: -20%;
                    right: -10%;
                    width: 800px;
                    height: 800px;
                    background: rgba(29, 78, 216, 0.2);
                    animation: blob 20s infinite alternate;
                }

                .blob-2 {
                    bottom: -20%;
                    left: -10%;
                    width: 800px;
                    height: 800px;
                    background: rgba(59, 130, 246, 0.1);
                    animation: blob 20s infinite alternate;
                    animation-delay: 5s;
                }

                .dashboard-content {
                    position: relative;
                    z-index: 10;
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 3rem 1.5rem;
                }

                .header {
                    text-align: center;
                    margin-bottom: 4rem;
                }

                .title {
                    font-family: var(--font-display);
                    font-size: 4.5rem;
                    font-weight: 700;
                    color: white;
                    margin: 0 0 1rem 0;
                    letter-spacing: -0.03em;
                }

                .subtitle {
                    font-size: 1.25rem;
                    color: var(--text-gray);
                    opacity: 0.9;
                    margin: 0;
                    font-weight: 300;
                    letter-spacing: 0.01em;
                }

                .accent {
                    font-family: var(--font-display);
                    font-style: italic;
                    color: var(--tangerine);
                    font-weight: 600;
                }

                .upload-section {
                    margin-bottom: 5rem;
                    animation-delay: 100ms;
                }

                .filter-tabs {
                    display: flex;
                    justify-content: center;
                    gap: 0.5rem;
                    margin-bottom: 2rem;
                    flex-wrap: wrap;
                    animation-delay: 200ms;
                }

                .filter-tab {
                    padding: 0.625rem 1.5rem;
                    border-radius: 2rem;
                    border: none;
                    font-size: 0.875rem;
                    font-weight: 700;
                    letter-spacing: 0.02em;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    background: rgba(255, 255, 255, 0.05);
                    color: rgba(255, 255, 255, 0.7);
                }

                .filter-tab:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                }

                .filter-tab.active {
                    background: var(--tangerine);
                    color: var(--navy-bg);
                    transform: scale(1.05);
                    box-shadow: 0 8px 20px rgba(252, 163, 17, 0.3);
                }

                .table-card {
                    background: white;
                    border-radius: 2rem;
                    box-shadow: 0 10px 50px rgba(20, 33, 61, 0.1);
                    border: 1px solid rgba(229, 229, 229, 0.8);
                    overflow: hidden;
                    animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    animation-delay: 300ms;
                    min-height: 400px;
                }

                .table-header {
                    padding: 2rem 2rem 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .table-header h2 {
                    font-family: var(--font-display);
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--navy-bg);
                    margin: 0;
                }

                .count-badge {
                    background: var(--navy-bg);
                    color: white;
                    font-size: 0.75rem;
                    font-weight: 700;
                    padding: 0.25rem 0.625rem;
                    border-radius: 2rem;
                }

                .table-wrapper {
                    overflow-x: auto;
                }

                .documents-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .documents-table thead th {
                    padding: 1.5rem 1rem;
                    text-align: left;
                    font-size: 0.625rem;
                    font-weight: 700;
                    color: rgba(20, 33, 61, 0.4);
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    border-bottom: 1px solid rgba(20, 33, 61, 0.05);
                }

                .documents-table thead th:first-child {
                    padding-left: 2rem;
                }

                .documents-table thead th:last-child {
                    padding-right: 2rem;
                }

                .documents-table tbody tr {
                    border-bottom: 1px solid rgba(20, 33, 61, 0.05);
                    transition: all 0.3s;
                    animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) backwards;
                }

                .documents-table tbody tr:hover {
                    background: rgba(252, 163, 17, 0.03);
                }

                .documents-table td {
                    padding: 1.5rem 1rem;
                    color: var(--navy-bg);
                }

                .documents-table td:first-child {
                    padding-left: 2rem;
                }

                .documents-table td:last-child {
                    padding-right: 2rem;
                }

                .text-right {
                    text-align: right;
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.375rem 0.75rem;
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
                    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }

                .status-badge.failed {
                    background: rgba(245, 101, 101, 0.1);
                    color: #742a2a;
                    border-color: rgba(245, 101, 101, 0.2);
                }

                .file-cell {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .file-icon {
                    padding: 0.75rem;
                    background: #f7fafc;
                    color: var(--navy-bg);
                    border-radius: 1rem;
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .documents-table tbody tr:hover .file-icon {
                    background: white;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    transform: scale(1.1);
                }

                .file-name {
                    font-weight: 700;
                    font-size: 0.9375rem;
                }

                .text-secondary {
                    color: #718096;
                    font-weight: 500;
                }

                .text-muted {
                    color: #a0aec0;
                    font-size: 0.75rem;
                    font-weight: 500;
                }

                .amount {
                    font-weight: 700;
                    color: var(--navy-bg);
                    font-size: 0.9375rem;
                }

                .view-btn {
                    padding: 0.5rem 1.25rem;
                    background: white;
                    color: var(--navy-bg);
                    border: 1px solid #e2e8f0;
                    border-radius: 2rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    opacity: 0;
                    transform: translateX(8px);
                }

                .documents-table tbody tr:hover .view-btn {
                    opacity: 1;
                    transform: translateX(0);
                }

                .view-btn:hover {
                    background: #f7fafc;
                    border-color: #cbd5e1;
                }

                .empty-state {
                    text-align: center;
                    padding: 4rem 2rem;
                    color: #a0aec0;
                }

                .empty-state svg {
                    color: #e2e8f0;
                    margin-bottom: 1rem;
                }

                .empty-state h3 {
                    color: var(--navy-bg);
                    font-size: 1.25rem;
                    margin: 0.5rem 0;
                }

                .empty-state p {
                    color: #a0aec0;
                    margin: 0;
                }

                @media (max-width: 1024px) {
                    .title {
                        font-size: 3rem;
                    }

                    .table-wrapper {
                        overflow-x: scroll;
                    }
                }

                @media (max-width: 768px) {
                    .dashboard-content {
                        padding: 2rem 1rem;
                    }

                    .title {
                        font-size: 2.5rem;
                    }

                    .subtitle {
                        font-size: 1rem;
                    }

                    .table-card {
                        border-radius: 1.5rem;
                    }
                }
            `}</style>
    </div>
  );
}
