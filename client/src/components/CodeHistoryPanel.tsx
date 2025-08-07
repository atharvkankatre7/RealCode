"use client"

import React, { useState, useEffect } from 'react';
import { FiSave, FiDownload, FiTrash2, FiEye, FiX, FiSearch, FiClock, FiTag } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-toastify';

interface CodeFile {
  _id: string;
  title: string;
  code: string;
  language: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface CodeHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadCode: (code: string, language: string) => void;
  currentCode: string;
  currentLanguage: string;
}

const CodeHistoryPanel: React.FC<CodeHistoryPanelProps> = ({
  isOpen,
  onClose,
  onLoadCode,
  currentCode,
  currentLanguage
}) => {
  const { user } = useAuth();
  const [codeFiles, setCodeFiles] = useState<CodeFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState<CodeFile | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saveTags, setSaveTags] = useState('');

  // Fetch code history
  const fetchCodeHistory = async () => {
    if (!user?.email) return;
    
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5002/api/code-history/${encodeURIComponent(user.email)}`);
      if (response.ok) {
        const data = await response.json();
        setCodeFiles(data.codeHistory || []);
      } else {
        console.error('Failed to fetch code history');
      }
    } catch (error) {
      console.error('Error fetching code history:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save current code
  const saveCurrentCode = async () => {
    if (!user?.email || !currentCode.trim()) {
      toast.error('No code to save');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('http://localhost:5002/api/code-history/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.email,
          title: saveTitle || 'Untitled Code',
          code: currentCode,
          language: currentLanguage,
          description: saveDescription,
          tags: saveTags.split(',').map(tag => tag.trim()).filter(tag => tag)
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Code saved successfully!');
        setShowSaveModal(false);
        setSaveTitle('');
        setSaveDescription('');
        setSaveTags('');
        fetchCodeHistory(); // Refresh the list
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save code');
      }
    } catch (error) {
      console.error('Error saving code:', error);
      toast.error('Failed to save code');
    } finally {
      setSaving(false);
    }
  };

  // Delete code file
  const deleteCodeFile = async (fileId: string) => {
    if (!user?.email) return;

    if (!confirm('Are you sure you want to delete this code file?')) return;

    try {
      const response = await fetch(`http://localhost:5002/api/code-history/file/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.email })
      });

      if (response.ok) {
        toast.success('Code file deleted successfully!');
        fetchCodeHistory(); // Refresh the list
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete code file');
      }
    } catch (error) {
      console.error('Error deleting code file:', error);
      toast.error('Failed to delete code file');
    }
  };

  // Download code file
  const downloadCodeFile = (file: CodeFile) => {
    const extension = getFileExtension(file.language);
    const filename = `${file.title}.${extension}`;
    
    const blob = new Blob([file.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`Downloaded ${filename}`);
  };

  // Get file extension based on language
  const getFileExtension = (language: string): string => {
    const extensions: { [key: string]: string } = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      csharp: 'cs',
      ruby: 'rb',
      go: 'go',
      rust: 'rs',
      php: 'php'
    };
    return extensions[language] || 'txt';
  };

  // Load code into editor
  const loadCode = (file: CodeFile) => {
    onLoadCode(file.code, file.language);
    toast.success(`Loaded ${file.title}`);
    onClose();
  };

  // Filter files based on search term
  const filteredFiles = codeFiles.filter(file =>
    file.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
    file.language.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    if (isOpen && user?.email) {
      fetchCodeHistory();
    }
  }, [isOpen, user?.email]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-zinc-900 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-xl font-bold text-white">Code History</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              disabled={saving}
            >
              <FiSave className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Current Code'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-zinc-700">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by title, description, tags, or language..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-white">Loading code history...</div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              {filteredFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <FiClock className="w-16 h-16 mb-4" />
                  <p className="text-lg">No saved code files yet</p>
                  <p className="text-sm">Save your first code file to get started!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                  {filteredFiles.map((file) => (
                    <div
                      key={file._id}
                      className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 hover:border-zinc-600 transition-colors"
                    >
                      {/* File Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold truncate">{file.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                              {file.language}
                            </span>
                            <span className="text-gray-400 text-xs">
                              {formatDate(file.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      {file.description && (
                        <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                          {file.description}
                        </p>
                      )}

                      {/* Tags */}
                      {file.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {file.tags.slice(0, 3).map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-zinc-700 text-gray-300 text-xs rounded flex items-center gap-1"
                            >
                              <FiTag className="w-3 h-3" />
                              {tag}
                            </span>
                          ))}
                          {file.tags.length > 3 && (
                            <span className="px-2 py-1 bg-zinc-700 text-gray-300 text-xs rounded">
                              +{file.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Code Preview */}
                      <div className="bg-zinc-900 rounded p-2 mb-3">
                        <pre className="text-gray-300 text-xs line-clamp-3 overflow-hidden">
                          {file.code}
                        </pre>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadCode(file)}
                          className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                          title="Load into editor"
                        >
                          <FiEye className="w-3 h-3" />
                          Load
                        </button>
                        <button
                          onClick={() => downloadCodeFile(file)}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                          title="Download file"
                        >
                          <FiDownload className="w-3 h-3" />
                          Download
                        </button>
                        <button
                          onClick={() => deleteCodeFile(file._id)}
                          className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                          title="Delete file"
                        >
                          <FiTrash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-700 text-center text-gray-400 text-sm">
          {codeFiles.length}/20 files saved • Most recent first
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-75">
          <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Save Code to History</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="Enter a title for your code"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="Optional description of what this code does"
                  rows={3}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Tags
                </label>
                <input
                  type="text"
                  value={saveTags}
                  onChange={(e) => setSaveTags(e.target.value)}
                  placeholder="Enter tags separated by commas (e.g., algorithm, sorting, practice)"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={saveCurrentCode}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
                disabled={saving || !saveTitle.trim()}
              >
                {saving ? 'Saving...' : 'Save Code'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeHistoryPanel;
