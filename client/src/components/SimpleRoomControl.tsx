'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useEditPermission } from '@/context/EditPermissionContext';
import { FiLock, FiUnlock } from 'react-icons/fi';

export default function SimpleRoomControl() {
  const { isTeacher, canEdit, toggleRoomPermission, students } = useEditPermission();
  const [isToggling, setIsToggling] = useState(false);
  const [displayState, setDisplayState] = useState(canEdit);

  // Sync display state with actual state (with smooth transitions)
  useEffect(() => {
    // Add small delay for smooth visual transitions
    const timer = setTimeout(() => {
      setDisplayState(canEdit);
    }, isToggling ? 0 : 100);

    return () => clearTimeout(timer);
  }, [canEdit, isToggling]);

  console.log('[ICON] Rendered with canEdit =', canEdit);

  // Only show for teachers
  if (!isTeacher) {
    return null;
  }

  const handleToggle = () => {
    // Security check: Only teachers can toggle
    if (!isTeacher) {
      console.warn('❌ [RBAC_SECURITY] Non-teacher attempted to toggle room permission');
      showToast('Only teachers can change room permissions', 'error');
      return;
    }

    if (isToggling) return;

    setIsToggling(true);

    // Optimistic UI update for immediate feedback
    const newCanEdit = !displayState;
    setDisplayState(newCanEdit);

    console.log(`🎯 [RBAC] Toggling room permission. Current: ${canEdit} → ${newCanEdit}`);

    toggleRoomPermission((err, response) => {
      if (err) {
        console.error(`❌ [RBAC] Toggle failed:`, err);
        // Revert optimistic update on error
        setDisplayState(canEdit);
        showToast(`Failed to toggle: ${err}`, 'error');
      } else {
        console.log(`✅ [RBAC] Toggle successful:`, response);
        // Server response will update canEdit, which will sync displayState
        showToast(
          response?.canEdit
            ? '✅ Students can now edit'
            : '🔒 Students are now read-only',
          'success'
        );
      }
      setIsToggling(false);
    });
  };

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
    }, 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-4 left-4 z-40 bg-zinc-900 rounded-xl shadow-lg border border-zinc-700 p-4 min-w-[280px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium">Room Control</h3>
        <motion.div
          animate={{
            backgroundColor: displayState ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: displayState ? 'rgb(74, 222, 128)' : 'rgb(248, 113, 113)'
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="px-2 py-1 rounded-full text-xs font-medium"
        >
          {displayState ? 'Editable' : 'Read-Only'}
        </motion.div>
      </div>

      {/* Status */}
      <motion.p
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="text-zinc-400 text-sm mb-4"
      >
        {students.length} student{students.length !== 1 ? 's' : ''} • {' '}
        <motion.span
          key={displayState ? 'editable' : 'readonly'}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {displayState
            ? 'All students can edit the code'
            : 'Students can only view the code'
          }
        </motion.span>
      </motion.p>

      {/* Toggle Button - Teacher Only */}
      {isTeacher && (
        <motion.button
          whileHover={!isToggling ? { scale: 1.02 } : {}}
          whileTap={!isToggling ? { scale: 0.97 } : {}}
          onClick={handleToggle}
          disabled={isToggling}
          animate={{
            backgroundColor: 'rgba(39, 39, 42, 1)',
            borderColor: 'rgba(71, 85, 105, 1)',
            color: 'white',
            opacity: isToggling ? 0.6 : 1
          }}
          transition={{ duration: 0.15, ease: "easeInOut" }}
          className="w-full py-2 px-4 rounded-md font-semibold border border-slate-600 bg-zinc-800 text-white flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm hover:bg-zinc-700 active:scale-[.97] transition-all duration-150"
          style={{
            cursor: isToggling ? 'not-allowed' : 'pointer',
            minWidth: '160px'
          }}
          aria-label="Toggle room permission"
          title="Change permission for this room"
        >
          <span key={canEdit ? 'unlock' : 'lock'} className="w-5 h-5">
            {canEdit ? <FiUnlock className="w-5 h-5" /> : <FiLock className="w-5 h-5" />}
          </span>
          Change Permission
        </motion.button>
      )}

      {/* Optional: Show current mode for teacher verification */}
      <p className="text-sm text-zinc-400 mt-2">
        Current Mode: {canEdit ? 'Editable' : 'View Only'}
      </p>

      {/* Student Info Panel */}
      {!isTeacher && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full py-3 px-4 rounded-lg bg-zinc-800 border border-zinc-700"
        >
          <div className="flex items-center justify-center gap-2 text-zinc-400">
            <span className="text-sm">Room controlled by teacher</span>
            <div className={`w-2 h-2 rounded-full ${
              displayState ? 'bg-green-400' : 'bg-red-400'
            }`} />
          </div>
        </motion.div>
      )}

      {/* Info */}
      <div className="mt-3 text-xs text-zinc-500 bg-zinc-800 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <span>💡</span>
          <div>
            <p className="font-medium mb-1">Role-Based Access Control</p>
            <p>Teachers can always edit. This controls whether students can edit.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
