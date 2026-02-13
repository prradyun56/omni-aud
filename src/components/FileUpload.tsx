'use client';

import { useState, useCallback } from 'react';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onUploadComplete?: (documentId: string) => void;
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadStatus('idle');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadStatus('success');
        if (onUploadComplete && data.documentId) {
          onUploadComplete(data.documentId);
        }
      } else {
        setUploadStatus('error');
        setErrorMessage(data.error || 'Upload failed');
      }
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage('Network error occurred');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="dropzone-wrapper">
      <div
        className={`dropzone ${isDragging ? 'dragging' : ''} ${uploadStatus}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="glow-effect" />
        
        <input
          type="file"
          id="file-input"
          className="file-input"
          onChange={handleFileSelect}
          accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.mp3,.mp4,.wav"
          disabled={isUploading}
        />

        <label htmlFor="file-input" className="dropzone-content">
          <div className="icon-container">
            <Upload size={36} className="upload-icon" />
          </div>
          
          <h3 className="dropzone-title">
            {isUploading
              ? 'Uploading...'
              : uploadStatus === 'success'
                ? 'Upload Successful!'
                : 'Upload Financial Audio'
            }
          </h3>

          <p className="dropzone-description">
            {uploadStatus === 'error'
              ? errorMessage
              : "Drag & drop a WAV file. We'll handle the rest."
            }
          </p>

          {!isUploading && uploadStatus === 'idle' && (
            <div className="format-badges">
              {['WAV'].map((format) => (
                <span key={format} className="format-badge">
                  {format}
                </span>
              ))}
            </div>
          )}
        </label>
      </div>

      <style jsx>{`
        .dropzone-wrapper {
          max-width: 900px;
          margin: 0 auto;
        }

        .dropzone {
          position: relative;
          cursor: pointer;
          border: 3px dashed rgba(255, 255, 255, 0.2);
          border-radius: 2.5rem;
          padding: 4rem 3rem;
          text-align: center;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          background: rgba(255, 255, 255, 0.05);
        }

        .dropzone:hover {
          border-color: var(--tangerine);
          background: rgba(255, 255, 255, 0.1);
          transform: scale(1.01);
        }

        .dropzone.dragging {
          border-color: var(--tangerine);
          background: rgba(252, 163, 17, 0.05);
          transform: scale(1.02);
        }

        .dropzone.success {
          border-color: var(--success);
          background: rgba(72, 187, 120, 0.05);
        }

        .dropzone.error {
          border-color: var(--error);
          background: rgba(245, 101, 101, 0.05);
        }

        .glow-effect {
          position: absolute;
          inset: 0;
          background: rgba(252, 163, 17, 0.2);
          border-radius: 2.5rem;
          filter: blur(100px);
          opacity: 0;
          transition: opacity 0.7s;
          pointer-events: none;
        }

        .dropzone:hover .glow-effect {
          opacity: 0.4;
        }

        .file-input {
          display: none;
        }

        .dropzone-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          cursor: pointer;
        }

        .icon-container {
          width: 5rem;
          height: 5rem;
          background: white;
          border-radius: 1.5rem;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          transform: rotate(3deg);
        }

        .dropzone:hover .icon-container {
          transform: rotate(6deg) scale(1.1) translateY(-8px);
        }

        .upload-icon {
          color: var(--tangerine);
        }

        .dropzone-title {
          font-family: var(--font-display);
          font-size: 2rem;
          font-weight: 700;
          color: white;
          margin: 0;
          letter-spacing: -0.02em;
        }

        .dropzone-description {
          font-size: 1.125rem;
          color: var(--text-gray);
          opacity: 0.9;
          margin: 0;
          max-width: 32rem;
          line-height: 1.6;
          font-weight: 300;
        }

        .format-badges {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 0.5rem;
        }

        .format-badge {
          padding: 0.375rem 1rem;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          color: white;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          border-radius: 2rem;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        @media (max-width: 768px) {
          .dropzone {
            padding: 3rem 2rem;
          }

          .dropzone-title {
            font-size: 1.5rem;
          }

          .dropzone-description {
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
}