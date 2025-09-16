'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useEditPermission } from '@/context/EditPermissionContext';
import { FiLock, FiUnlock } from 'react-icons/fi';

export default function SimpleRoomControl() {
  const { isTeacher, globalCanEdit, toggleRoomPermission, students } = useEditPermission();
  const [isToggling, setIsToggling] = useState(false);
  const [displayState, setDisplayState] = useState(globalCanEdit);

  // Sync display state with actual state (with smooth transitions)
  useEffect(() => {
    // Add small delay for smooth visual transitions
    const timer = setTimeout(() => {
      setDisplayState(globalCanEdit);
    }, isToggling ? 0 : 100);

    return () => clearTimeout(timer);
  }, [globalCanEdit, isToggling]);

  console.log('[ICON] Rendered with globalCanEdit =', globalCanEdit);

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

    console.log(`🎯 [RBAC] Toggling room permission. Current: ${globalCanEdit} → ${newCanEdit}`);

    toggleRoomPermission((err, response) => {
      if (err) {
        console.error(`❌ [RBAC] Toggle failed:`, err);
        // Revert optimistic update on error
        setDisplayState(globalCanEdit);
        showToast(`Failed to toggle: ${err}`, 'error');
      } else {
        console.log(`✅ [RBAC] Toggle successful:`, response);
        // Server response will update state via events
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
      className="fixed top-4 left-4 z-40 bg-zinc-900/95 backdrop-blur-sm rounded-xl shadow-xl border border-white/5 p-5 min-w-[300px]"
    >
      {/* Header with Enhanced Badge */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Room Control</h3>
        <motion.div
          animate={{
            backgroundColor: displayState ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: displayState ? 'rgb(74, 222, 128)' : 'rgb(248, 113, 113)'
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="px-3 py-1.5 rounded-full text-xs font-medium border border-current/20"
        >
          {displayState ? '✏️ Editable' : '👁️ Read-Only'}
        </motion.div>
      </div>

      {/* Enhanced Status */}
      <motion.div
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="text-zinc-400 text-sm mb-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-zinc-500">👥</span>
          <span>{students.length} student{students.length !== 1 ? 's' : ''}</span>
        </div>
        <motion.div
          key={displayState ? 'editable' : 'readonly'}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-zinc-300 font-medium"
        >
          {displayState
            ? 'All students can edit the code'
            : 'Students can only view the code'
          }
        </motion.div>
      </motion.div>

      {/* Enhanced Toggle Button - Teacher Only */}
      {isTeacher && (
        <motion.button
          whileHover={!isToggling ? { scale: 1.02 } : {}}
          whileTap={!isToggling ? { scale: 0.97 } : {}}
          onClick={handleToggle}
          disabled={isToggling}
          className="w-full py-3 px-5 rounded-lg font-semibold border border-slate-600/50 bg-gradient-to-r from-zinc-800 to-zinc-700 text-white flex items-center justify-center gap-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm hover:shadow-md hover:from-zinc-700 hover:to-zinc-600 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            cursor: isToggling ? 'not-allowed' : 'pointer',
            minWidth: '160px'
          }}
          aria-label="Toggle room permission"
          title={displayState ? "Click to make room read-only" : "Click to make room editable"}
        >
          <motion.div
            animate={{ rotate: isToggling ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className="w-4 h-4"
          >
            {globalCanEdit ? <FiUnlock className="w-4 h-4" /> : <FiLock className="w-4 h-4" />}
          </motion.div>
          <span>Change Permission</span>
        </motion.button>
      )}

      {/* Divider */}
      <div className="w-full h-px bg-zinc-700/50 my-3"></div>
      
      {/* Enhanced Current Mode Display */}
      <motion.div
        key={globalCanEdit ? 'editable' : 'viewonly'}
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-sm text-zinc-400 text-center"
      >
        <span className="text-zinc-500">Current Mode:</span>{' '}
        <span className="font-medium text-zinc-300">
          {globalCanEdit ? 'Editable' : 'View Only'}
        </span>
      </motion.div>

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

      {/* Enhanced Info Section */}
      <div className="mt-4 text-xs text-zinc-500 bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/30">
        <div className="flex items-start gap-3">
          <span className="text-blue-400 text-sm">💡</span>
          <div>
            <p className="font-semibold mb-2 text-zinc-300">Role-Based Access Control</p>
            <p className="leading-relaxed">Teachers can always edit. This controls whether students can edit.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
