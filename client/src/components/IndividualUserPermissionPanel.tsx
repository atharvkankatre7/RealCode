'use client';

import React, { useState, useEffect } from 'react';
import { FiUser, FiEdit3, FiEye, FiLock, FiUnlock, FiX, FiUsers } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditPermission } from '@/context/EditPermissionContext';
import { useSocketService } from '@/hooks/useSocketService';

interface IndividualUserPermissionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IndividualUserPermissionPanel({ isOpen, onClose }: IndividualUserPermissionPanelProps) {
  const { isTeacher, students, globalCanEdit, setUserPermission, removeUserPermission } = useEditPermission();
  const { socketService } = useSocketService();
  const [isUpdating, setIsUpdating] = useState(false);

  // Request fresh student list when panel opens
  useEffect(() => {
    if (isOpen && isTeacher && socketService) {
      console.log('🔍 [DEBUG] Panel opened, requesting fresh student list');
      console.log('🔍 [DEBUG] Current students state:', students);
      
      // Request updated student list from server
      const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : null;
      if (roomId) {
        const socket = socketService.getSocket && socketService.getSocket();
        if (socket) {
          // First, try to get the current room state
          socket.emit('request-room-state', { roomId }, (response: any) => {
            console.log('📥 [DEBUG] Room state response:', response);
            if (response && response.success && response.state) {
              console.log('📊 [DEBUG] Room state users:', response.state.users);
              console.log('📊 [DEBUG] Room state permissions:', response.state.permissions);
              
              // Extract students from the room state
              const studentsFromState = response.state.users
                .filter((u: any) => u.role === 'student')
                .map((u: any) => ({
                  socketId: u.socketId,
                  username: u.username,
                  userId: u.userId,
                  canEdit: u.canEdit || false,
                  hasIndividualPermission: false, // Will be updated by server
                  permissionGrantedBy: undefined,
                  joinedAt: new Date().toISOString(),
                  lastActivity: new Date().toISOString()
                }));
              console.log('👥 [DEBUG] Extracted students from room state:', studentsFromState);
              
              // Also show all users for debugging
              const allUsers = response.state.users;
              console.log('👥 [DEBUG] All users in room:', allUsers);
              console.log('👥 [DEBUG] Teachers:', allUsers.filter((u: any) => u.role === 'teacher'));
              console.log('👥 [DEBUG] Students:', allUsers.filter((u: any) => u.role === 'student'));
            }
          });
          
          // Also request student list specifically
          socket.emit('request-student-list', { roomId });
          console.log('📤 [DEBUG] Emitted request-student-list for room:', roomId);
        }
      }
    }
  }, [isOpen, isTeacher, socketService]); // Removed 'students' dependency to prevent infinite loop

  // Don't show for non-teachers - moved after all hooks
  if (!isTeacher) {
    console.log('❌ [DEBUG] IndividualUserPermissionPanel: User is not a teacher. isTeacher:', isTeacher);
    return null;
  }

  console.log('✅ [DEBUG] IndividualUserPermissionPanel: User is a teacher. Students:', students);

  const handleTogglePermission = async (userId: string, currentCanEdit: boolean) => {
    if (isUpdating) return;
    
    console.log('🔍 [DEBUG] handleTogglePermission called:', {
      userId,
      currentCanEdit,
      isTeacher,
      students: students.map(s => ({ userId: s.userId, username: s.username, canEdit: s.canEdit }))
    });
    
    setIsUpdating(true);
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setIsUpdating(false);
      showToast('Operation timed out. Please try again.', 'error');
    }, 10000); // 10 second timeout
    
    try {
      // If user has individual permission, toggle it
      // If user doesn't have individual permission, grant the opposite of room-wide
      const newCanEdit = !currentCanEdit;
      
      console.log('🔍 [DEBUG] About to call setUserPermission:', { userId, newCanEdit });
      
      // Use a promise wrapper to handle the callback-based setUserPermission
      const result = await new Promise<{ success: boolean; error?: any }>((resolve) => {
        setUserPermission(userId, newCanEdit, 'Permission toggled by teacher', (err, response) => {
          console.log('🔍 [DEBUG] setUserPermission callback received:', { err, response });
          if (err) {
            resolve({ success: false, error: err });
          } else {
            resolve({ success: true });
          }
        });
      });
      
      clearTimeout(timeoutId);
      
      if (result.success) {
        showToast(`Permission ${newCanEdit ? 'granted' : 'revoked'} successfully`, 'success');
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error toggling permission:', error);
      showToast(`Failed to toggle permission: ${error}`, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemovePermission = async (userId: string) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setIsUpdating(false);
      showToast('Operation timed out. Please try again.', 'error');
    }, 10000); // 10 second timeout
    
    try {
      // Use a promise wrapper to handle the callback-based removeUserPermission
      const result = await new Promise<{ success: boolean; error?: any }>((resolve) => {
        removeUserPermission(userId, (err, response) => {
          if (err) {
            resolve({ success: false, error: err });
          } else {
            resolve({ success: true });
          }
        });
      });
      
      clearTimeout(timeoutId);
      
      if (result.success) {
        showToast('Permission removed successfully', 'success');
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error removing permission:', error);
      showToast(`Failed to remove permission: ${error}`, 'error');
    } finally {
      setIsUpdating(false);
    }
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

  const getPermissionStatus = (student: any) => {
    if (student.hasIndividualPermission) {
      return {
        icon: student.canEdit ? FiEdit3 : FiEye,
        label: student.canEdit ? 'Can Edit' : 'View Only',
        color: student.canEdit ? 'text-emerald-500' : 'text-amber-500',
        bgColor: student.canEdit ? 'bg-emerald-500/20' : 'bg-amber-500/20',
        buttonColor: student.canEdit ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600',
        buttonText: student.canEdit ? 'Switch to View Only' : 'Switch to Edit',
        description: 'Individual permission (overrides room setting)'
      };
    } else {
      return {
        icon: student.canEdit ? FiEdit3 : FiEye,
        label: student.canEdit ? 'Room Edit' : 'Room View',
        color: student.canEdit ? 'text-emerald-500' : 'text-zinc-500',
        bgColor: student.canEdit ? 'bg-emerald-500/20' : 'bg-zinc-500/20',
        buttonColor: 'bg-emerald-500 hover:bg-emerald-600',
        buttonText: student.canEdit ? 'Switch to View Only' : 'Switch to Edit',
        description: `Following room-wide setting (${globalCanEdit ? 'Edit' : 'View'})`
      };
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl shadow-2xl border border-zinc-600/50 max-w-2xl w-full max-h-[80vh] overflow-hidden mx-auto my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-600/50 bg-gradient-to-r from-zinc-800/50 to-zinc-700/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                  <FiUsers className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white tracking-wide">Individual User Permissions</h2>
                  <p className="text-zinc-400 text-sm mt-0.5">
                    Manage access permissions for your classroom
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-zinc-700/50 rounded-lg transition-all duration-200 hover:scale-105"
              >
                <FiX className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 overflow-y-auto max-h-[65vh]">
              {/* Global Permission Status */}
              <div className="mb-6 p-5 bg-zinc-800/30 rounded-xl border border-zinc-600/20 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      globalCanEdit ? 'bg-emerald-100' : 'bg-amber-100'
                    } shadow-sm`}>
                      {globalCanEdit ? <FiEdit3 className="w-5 h-5 text-emerald-600" /> : <FiEye className="w-5 h-5 text-amber-600" />}
                    </div>
                    <div>
                      <h3 className="text-base font-medium text-white">Room-Wide Permission</h3>
                      <p className="text-zinc-400 text-sm">
                        {globalCanEdit ? 'All students can edit by default' : 'All students are view-only by default'}
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                    globalCanEdit 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {globalCanEdit ? '✏️ Edit' : '👁️ View'}
                  </div>
                </div>
                <div className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-600/20">
                  <p className="text-zinc-300 text-xs leading-relaxed">
                    <span className="text-emerald-400 font-medium">💡</span> Individual permissions can override the room-wide setting.
                  </p>
                </div>
              </div>

                             {students.length === 0 ? (
                 <div className="text-center py-8">
                   <div className="w-16 h-16 bg-zinc-700/50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                     <FiUsers className="w-8 h-8 text-zinc-400" />
                   </div>
                   <h3 className="text-lg font-medium text-white mb-2">No Students Yet</h3>
                   <p className="text-zinc-400 text-sm mb-4">Students will appear here once they join the room</p>
                   <div className="inline-block p-3 bg-zinc-800/30 rounded-lg border border-zinc-600/20">
                     <p className="text-zinc-400 text-xs font-medium mb-2">Room Information</p>
                     <div className="space-y-1 text-xs text-zinc-500">
                       <p>Room ID: {typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : 'Unknown'}</p>
                       <p>Students: {students.length}</p>
                       <p>Your Role: {isTeacher ? 'Teacher' : 'Student'}</p>
                     </div>
                   </div>
                 </div>
              ) : (
                                 <div className="space-y-4">
                   {students.map((student, index) => {
                     const status = getPermissionStatus(student);
                     const IconComponent = status.icon;
                     
                     return (
                       <motion.div
                         key={student.userId}
                         initial={{ opacity: 0, y: 20 }}
                         animate={{ opacity: 1, y: 0 }}
                         transition={{ delay: index * 0.1 }}
                         className="bg-zinc-800/30 rounded-xl p-5 border border-zinc-600/20 shadow-sm hover:shadow-md transition-all duration-200 hover:border-zinc-500/30"
                       >
                         <div className="flex items-center justify-between mb-4">
                           <div className="flex items-center gap-3">
                             <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm ${
                               student.canEdit 
                                 ? 'bg-emerald-100' 
                                 : 'bg-blue-100'
                             }`}>
                               <FiUser className="w-5 h-5 text-zinc-600" />
                             </div>
                             <div>
                               <h3 className="text-base font-semibold text-white">{student.username}</h3>
                               <p className="text-zinc-500 text-xs font-mono" title="User identifier">
                                 @{student.username.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')}
                               </p>
                               <p className="text-zinc-400 text-xs mt-1">{status.description}</p>
                             </div>
                           </div>
                           
                           <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${status.bgColor} ${status.color} border ${
                             student.canEdit ? 'border-emerald-500/30' : 'border-blue-500/30'
                           }`}>
                             <IconComponent className="w-3 h-3 inline mr-1.5" />
                             {status.label}
                           </div>
                         </div>

                                                 <div className="flex items-center gap-3">
                           {/* Main Toggle Button */}
                           <button
                             onClick={() => handleTogglePermission(student.userId, student.canEdit)}
                             disabled={isUpdating}
                             className={`flex-1 flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white transition-all duration-200 hover:bg-emerald-600 ${status.buttonColor} ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'shadow-sm hover:shadow-md'}`}
                           >
                             {isUpdating ? (
                               <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                             ) : (
                               <>
                                 {student.canEdit ? <FiEye className="w-4 h-4" /> : <FiEdit3 className="w-4 h-4" />}
                                 <span>{status.buttonText}</span>
                               </>
                             )}
                           </button>

                           {/* Remove Individual Permission Button */}
                           {student.hasIndividualPermission && (
                             <button
                               onClick={() => handleRemovePermission(student.userId)}
                               disabled={isUpdating}
                               className="h-9 px-3 rounded-lg text-sm font-medium bg-zinc-600 hover:bg-zinc-500 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                               title="Remove individual permission (use room-wide setting)"
                             >
                               <FiX className="w-4 h-4" />
                             </button>
                           )}
                         </div>

                                                 {/* Permission Details */}
                         {student.hasIndividualPermission && (
                           <div className="mt-3 p-3 bg-zinc-700/20 rounded-lg border border-zinc-600/10">
                             <div className="flex items-center gap-2 mb-2">
                               <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                               <p className="text-zinc-300 text-xs font-medium">Individual Permission Active</p>
                             </div>
                             <div className="grid grid-cols-2 gap-3 text-xs">
                               <div>
                                 <p className="text-zinc-500">Status:</p>
                                 <p className="text-zinc-300 font-medium">{student.canEdit ? 'Can Edit' : 'View Only'}</p>
                               </div>
                                                               {student.permissionGrantedBy && (
                                  <div>
                                    <p className="text-zinc-500">Granted by:</p>
                                    <p className="text-zinc-300 font-medium">{student.permissionGrantedBy}</p>
                                  </div>
                                )}
                             </div>
                           </div>
                         )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-600/30 bg-zinc-800/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-zinc-400 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                    <span>Individual permissions override room-wide settings</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                    <span>Click buttons to toggle permissions</span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="h-9 px-4 bg-zinc-600 hover:bg-zinc-500 text-white rounded-lg transition-all duration-200 font-medium shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
