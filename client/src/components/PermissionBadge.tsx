'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiEye, FiEdit3, FiShield, FiCheck, FiX } from 'react-icons/fi';
import { useEditPermission } from '@/context/EditPermissionContext';

interface PermissionBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showAnimation?: boolean;
  /**
   * Optional: increment or change this value to manually trigger animation for teachers
   */
  teacherActionTrigger?: number | string;
}

export default function PermissionBadge({ 
  className = '', 
  size = 'md',
  showAnimation = true,
  teacherActionTrigger
}: PermissionBadgeProps) {
  const { permissionBadge, canEdit, isTeacher } = useEditPermission();
  const [showChangeAnimation, setShowChangeAnimation] = React.useState(false);
  const [previousPermission, setPreviousPermission] = React.useState(canEdit);


  // Trigger animation when permission changes (students)
  React.useEffect(() => {
    if (!isTeacher && previousPermission !== canEdit && showAnimation) {
      console.log('[PermissionBadge] Student animation triggered', { previousPermission, canEdit, showAnimation });
      setShowChangeAnimation(true);
      const timer = setTimeout(() => {
        setShowChangeAnimation(false);
        setPreviousPermission(canEdit); // update AFTER animation ends
      }, 2000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, previousPermission, showAnimation, isTeacher]);

  // Manual animation trigger for teachers
  React.useEffect(() => {
    if (isTeacher && teacherActionTrigger !== undefined) {
      console.log('[PermissionBadge] Teacher animation triggered', { teacherActionTrigger });
      setShowChangeAnimation(true);
      const timer = setTimeout(() => {
        setShowChangeAnimation(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherActionTrigger, isTeacher]);
  // Manual animation trigger for teachers
  React.useEffect(() => {
    if (isTeacher && teacherActionTrigger !== undefined) {
      setShowChangeAnimation(true);
      const timer = setTimeout(() => {
        setShowChangeAnimation(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherActionTrigger, isTeacher]);

  const getBadgeConfig = () => {
    switch (permissionBadge) {
      case 'teacher':
        return {
          icon: FiShield,
          label: 'Teacher',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-200',
          iconColor: 'text-blue-600'
        };
      case 'edit-access':
        return {
          icon: FiEdit3,
          label: 'Edit Access',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-200',
          iconColor: 'text-green-600'
        };
      case 'view-only':
      default:
        return {
          icon: FiEye,
          label: 'View-only',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-600',
          borderColor: 'border-gray-200',
          iconColor: 'text-gray-500'
        };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'px-2 py-1 text-xs',
          icon: 'w-3 h-3'
        };
      case 'lg':
        return {
          container: 'px-4 py-2 text-base',
          icon: 'w-5 h-5'
        };
      default: // md
        return {
          container: 'px-3 py-1.5 text-sm',
          icon: 'w-4 h-4'
        };
    }
  };

  const config = getBadgeConfig();
  const sizeClasses = getSizeClasses();
  const IconComponent = config.icon;

  return (
    <>
      {/* Main Badge */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={`
          inline-flex items-center space-x-2 rounded-full border font-medium
          ${config.bgColor} ${config.textColor} ${config.borderColor}
          ${sizeClasses.container} ${className}
        `}
        title={`Permission: ${config.label}`}
      >
        <IconComponent className={`${config.iconColor} ${sizeClasses.icon}`} />
        <span>{config.label}</span>
      </motion.div>

      {/* Permission Change Animation */}
      <AnimatePresence>
        {showChangeAnimation && (
          <motion.div
            initial={{ y: -10, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className="relative mt-2 mb-2 max-w-sm"
          >
            <div className={`
              px-4 py-3 rounded-lg shadow-lg border-2 flex items-center space-x-3
              ${canEdit 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
              }
            `}>
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full
                ${canEdit ? 'bg-green-100' : 'bg-red-100'}
              `}>
                {canEdit ? (
                  <FiCheck className="w-4 h-4 text-green-600" />
                ) : (
                  <FiX className="w-4 h-4 text-red-600" />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {canEdit ? 'Edit Access Granted!' : 'Edit Access Revoked'}
                </p>
                <p className="text-sm opacity-75">
                  {canEdit 
                    ? 'You can now edit the code' 
                    : 'You can only view the code now'
                  }
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Status indicator for the editor
export function EditorPermissionStatus() {
  const { canEdit, isTeacher } = useEditPermission();

  const status = isTeacher ? {
    icon: FiShield,
    label: 'Teacher (Full Access)',
    bgColor: 'bg-blue-600',
    textColor: 'text-white'
  } : canEdit ? {
    icon: FiEdit3,
    label: 'You can edit',
    bgColor: 'bg-green-600',
    textColor: 'text-white'
  } : {
    icon: FiEye,
    label: 'View-only mode',
    bgColor: 'bg-red-600',
    textColor: 'text-white'
  };

  const IconComponent = status.icon;

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium rounded-lg shadow-sm transition-all duration-200 ${
        isTeacher 
          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
          : canEdit 
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
      }`}
    >
      <IconComponent className="w-4 h-4" />
      <span>{status.label}</span>
    </motion.div>
  );
}
