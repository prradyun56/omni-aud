'use client';

import { Activity, ShieldCheck, Heart, FileText } from 'lucide-react';

interface CallAnalysisCardProps {
    intent?: string;
    financialEvents?: string[];
    emotionalState?: string;
    complianceNotes?: string[];
}

export default function CallAnalysisCard({
    intent,
    financialEvents = [],
    emotionalState,
    complianceNotes = []
}: CallAnalysisCardProps) {
    if (!intent && !emotionalState) return null;

    return (
        <div className="analysis-card">
            <div className="card-header">
                <Activity size={20} className="header-icon" />
                <h3>Call Analysis Summary</h3>
            </div>

            <div className="card-content">
                {/* Intent */}
                <div className="analysis-section">
                    <label>INTENT</label>
                    <p className="intent-text">{intent || 'Analysis pending...'}</p>
                </div>

                {/* Financial Events */}
                {financialEvents.length > 0 && (
                    <div className="analysis-section">
                        <label>FINANCIAL EVENTS</label>
                        <ul className="events-list">
                            {financialEvents.map((event, idx) => (
                                <li key={idx}>
                                    <div className="bullet" />
                                    <span>{event}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Emotional State */}
                <div className="analysis-section">
                    <label>EMOTIONAL STATE</label>
                    <div className="emotion-box">
                        <Heart size={16} className="emotion-icon" />
                        <p>{emotionalState || 'Not analyzed'}</p>
                    </div>
                </div>

                {/* Compliance Notes */}
                {complianceNotes.length > 0 && (
                    <div className="analysis-section">
                        <label>COMPLIANCE NOTES</label>
                        <div className="compliance-box">
                            <ShieldCheck size={16} className="compliance-icon" />
                            <ul>
                                {complianceNotes.map((note, idx) => (
                                    <li key={idx}>{note}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
        .analysis-card {
          background: white;
          border-radius: 1.5rem;
          padding: 1.5rem;
          border: 1px solid rgba(252, 163, 17, 0.2);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
          animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #f0f0f0;
        }

        .header-icon {
          color: var(--tangerine);
        }

        .card-header h3 {
          font-family: var(--font-display);
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--navy-bg);
          margin: 0;
        }

        .card-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .analysis-section label {
          display: block;
          font-size: 0.625rem;
          font-weight: 700;
          color: rgba(20, 33, 61, 0.5);
          letter-spacing: 0.1em;
          margin-bottom: 0.5rem;
        }

        .intent-text {
          font-family: var(--font-display);
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--navy-bg);
          margin: 0;
          line-height: 1.4;
        }

        .events-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .events-list li {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          font-size: 0.875rem;
          color: #4a5568;
          line-height: 1.5;
        }

        .bullet {
          width: 0.375rem;
          height: 0.375rem;
          background: var(--tangerine);
          border-radius: 50%;
          margin-top: 0.4rem;
          flex-shrink: 0;
        }

        .emotion-box {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(252, 163, 17, 0.1);
          padding: 0.75rem 1rem;
          border-radius: 1rem;
          border: 1px solid rgba(252, 163, 17, 0.2);
        }

        .emotion-icon {
          color: var(--tangerine-darker);
        }

        .emotion-box p {
          margin: 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--navy-bg);
        }

        .compliance-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          padding: 1rem;
          border-radius: 1rem;
          display: flex;
          gap: 0.75rem;
        }

        .compliance-icon {
          color: #16a34a;
          margin-top: 0.2rem;
        }

        .compliance-box ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .compliance-box li {
          font-size: 0.8125rem;
          color: #166534;
          line-height: 1.4;
        }
      `}</style>
        </div>
    );
}
