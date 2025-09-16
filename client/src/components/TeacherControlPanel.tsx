'use client';

import React, { useState, useEffect } from 'react';
import { FiEdit3, FiEye, FiUsers, FiLock, FiUnlock } from 'react-icons/fi';
import PermissionBadge from './PermissionBadge';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditPermission } from '@/context/EditPermissionContext';
import { useSocketService } from '@/hooks/useSocketService';

export default function TeacherControlPanel() {
    const { isTeacher, students, globalCanEdit, toggleRoomPermission } = useEditPermission();
    const { isReady, isConnected } = useSocketService();
    const [pending, setPending] = useState(false);

    // State to trigger PermissionBadge animation for teachers
    const [teacherActionCount, setTeacherActionCount] = useState(0);

    // Debug log on every render
    console.log('🚨 Button Rendered | globalCanEdit =', globalCanEdit);

    useEffect(() => {
        console.log('Teacher Button - globalCanEdit =', globalCanEdit);
    }, [globalCanEdit]);

    const handleRoomToggle = () => {
        console.log('[DEBUG][Teacher] Toggle button clicked. isTeacher:', isTeacher, 'pending:', pending, 'isReady:', isReady, 'isConnected:', isConnected);
        if (!isTeacher || pending || !isReady || !isConnected) return;
        setPending(true);
        toggleRoomPermission((err, response) => {
            if (err) {
                console.error('[DEBUG][Teacher] Toggle failed:', err);
            } else {
                console.log('[DEBUG][Teacher] Toggle success:', response);
            }
            setPending(false);
        });
    };

    if (!isTeacher) {
        return null;
    }

    // PermissionToggleButton with local state fallback (for debugging)
    function PermissionToggleButton() {
        const [localEditState, setLocalEditState] = useState(globalCanEdit);
        useEffect(() => {
            setLocalEditState(globalCanEdit);
        }, [globalCanEdit]);
        console.log('[Button] Local State =', localEditState);
        return (
            <button
                onClick={() => {
                    handleRoomToggle();
                    // optimistic update (optional)
                    setLocalEditState((prev) => !prev);
                }}
                className={`transition px-4 py-2 rounded-md font-semibold text-white ${
                    localEditState ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                } ${pending ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={pending || !isReady || !isConnected}
            >
                {localEditState ? 'Disable Editing' : 'Enable Editing'}
            </button>
        );
    }

    return (
        <div className="bg-zinc-900 rounded-lg shadow-lg border border-zinc-700 w-full p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <FiUsers className="text-white w-6 h-6" />
                    <h2 className="text-lg font-bold text-white">Room Control</h2>
                </div>
                <div className="bg-white/20 rounded-lg px-3 py-1">
                    <span className="text-white text-sm font-medium">
                        {students.length} {students.length === 1 ? 'Student' : 'Students'}
                    </span>
                </div>
            </div>

            <AnimatePresence>
                {(!isReady || !isConnected) && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 mb-4 rounded-md"
                    >
                        <div className="flex items-center space-x-2 text-yellow-400 text-sm">
                            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                            <span>Connecting...</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-medium mb-1">Room Edit Mode</h3>
                        <p className="text-zinc-400 text-sm">
                            {globalCanEdit ? 'All students can edit.' : 'Students can only view.'}
                        </p>
                    </div>
                    <div key={String(globalCanEdit)}>
                        <PermissionToggleButton />
                    </div>
                </div>
            </div>
            {/* Debug: show globalCanEdit live */}
            <p className="text-xs text-gray-500 mt-1">globalCanEdit: {String(globalCanEdit)}</p>
            {/* Teacher Permission Badge with animation */}
            <div className="mb-4 flex justify-end">
                <PermissionBadge teacherActionTrigger={teacherActionCount} />
            </div>
        </div>
    );
}
