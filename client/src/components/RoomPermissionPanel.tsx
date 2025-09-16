'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUsers, FiSettings } from 'react-icons/fi';
import { useEditPermission } from '@/context/EditPermissionContext';
import IndividualUserPermissionPanel from './IndividualUserPermissionPanel';

interface RoomPermissionPanelProps {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

export default function RoomPermissionPanel({ isExpanded, setIsExpanded }: RoomPermissionPanelProps) {
  const { isTeacher, globalCanEdit, toggleRoomPermission, isPermissionChanging } = useEditPermission();
  const [isToggling, setIsToggling] = useState(false);
  const [showIndividualPermissions, setShowIndividualPermissions] = useState(false);

  // RBAC: Simple room permission toggle
  const handleRoomPermissionToggle = useCallback(() => {
    if (!isTeacher || isToggling || isPermissionChanging) return;

    setIsToggling(true);
    console.log(`🎯 [RBAC] Toggling room permission. Current: ${globalCanEdit}`);

    toggleRoomPermission((err, response) => {
      if (err) {
        console.error(`❌ [RBAC] Toggle failed:`, err);
        showToast(`Failed to toggle room permission: ${err}`, 'error');
      } else {
        console.log(`✅ [RBAC] Toggle successful:`, response);
        showToast(
          response?.canEdit
            ? '✅ Room editing enabled for all students'
            : '🔒 Room editing disabled for all students',
          'success'
        );
      }
      setIsToggling(false);
    });
  }, [isTeacher, globalCanEdit, isToggling, isPermissionChanging, toggleRoomPermission]);

  // Simple toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white font-medium transition-all duration-300 ${
      type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`;
    toast.textContent = message;
    toast.style.transform = 'translateX(100%)';

    document.body.appendChild(toast);

    setTimeout(() => toast.style.transform = 'translateX(0)', 10);
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 4000);
  };

  // Don't show panel for students
  if (!isTeacher) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 z-40">
      {/* Toggle Button */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-zinc-900 text-white px-4 py-2 rounded-2xl shadow-md hover:bg-zinc-800 transition-colors flex items-center gap-2"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="text-sm font-medium">Room Permissions</span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          ▼
        </motion.div>
      </motion.button>

      {/* Permission Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mt-2 bg-zinc-900 rounded-2xl shadow-md p-4 min-w-[300px]"
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-white font-medium">Room Edit Mode</h3>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  globalCanEdit ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {globalCanEdit ? 'Enabled' : 'Disabled'}
                </div>
              </div>

              {/* Description */}
              <p className="text-zinc-400 text-sm">
                {globalCanEdit 
                  ? 'All students can currently edit the code.'
                  : 'Students can only view the code (read-only mode).'
                }
              </p>

              {/* Toggle Button */}
              <motion.button
                onClick={handleRoomPermissionToggle}
                disabled={isToggling || isPermissionChanging}
                className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
                  globalCanEdit
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                } ${(isToggling || isPermissionChanging) ? 'opacity-50 cursor-not-allowed' : ''}`}
                whileHover={!(isToggling || isPermissionChanging) ? { scale: 1.02 } : {}}
                whileTap={!(isToggling || isPermissionChanging) ? { scale: 0.98 } : {}}
              >
                {(isToggling || isPermissionChanging) ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Updating...</span>
                  </div>
                ) : (
                  <span>
                    {globalCanEdit ? '🔒 Disable Editing' : '✏️ Enable Editing'}
                  </span>
                )}
              </motion.button>

              {/* Individual User Permissions Button */}
              <motion.button
                onClick={() => setShowIndividualPermissions(true)}
                className="w-full py-3 px-4 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <FiUsers className="w-4 h-4" />
                Manage Individual Permissions
              </motion.button>

              {/* Info */}
              <div className="text-xs text-zinc-500 bg-zinc-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <span>💡</span>
                  <div>
                    <p className="font-medium mb-1">Role-Based Access Control</p>
                    <p>Teachers can always edit. This setting controls whether students can edit the code.</p>
                    <p className="mt-1 text-blue-400">Individual permissions can override room-wide settings.</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Individual User Permission Panel */}
      <IndividualUserPermissionPanel
        isOpen={showIndividualPermissions}
        onClose={() => setShowIndividualPermissions(false)}
      />
    </div>
  );
}
