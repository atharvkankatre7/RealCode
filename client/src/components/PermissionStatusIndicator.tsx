'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FiEye, FiEdit3, FiShield, FiLock, FiUnlock } from 'react-icons/fi';
import { useEditPermission } from '@/context/EditPermissionContext';

interface PermissionStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function PermissionStatusIndicator({ 
  className = '', 
  showLabel = true,
  size = 'md'
}: PermissionStatusIndicatorProps) {
  const { canEdit, isTeacher } = useEditPermission();

  const getStatusConfig = () => {
    if (isTeacher) {
      return {
        icon: FiShield,
        label: 'Teacher',
        description: 'Full access',
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        iconColor: 'text-blue-600',
        borderColor: 'border-blue-200'
      };
    }

    if (canEdit) {
      return {
        icon: FiEdit3,
        label: 'Editor',
        description: 'Can edit code',
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        iconColor: 'text-green-600',
        borderColor: 'border-green-200'
      };
    }

    return {
      icon: FiEye,
      label: 'View-only',
      description: 'Read-only access',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-600',
      iconColor: 'text-gray-500',
      borderColor: 'border-gray-200'
    };
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'px-2 py-1',
          icon: 'w-3 h-3',
          text: 'text-xs',
          description: 'text-xs'
        };
      case 'lg':
        return {
          container: 'px-4 py-3',
          icon: 'w-5 h-5',
          text: 'text-sm font-medium',
          description: 'text-sm'
        };
      default: // md
        return {
          container: 'px-3 py-2',
          icon: 'w-4 h-4',
          text: 'text-sm',
          description: 'text-xs'
        };
    }
  };

  const status = getStatusConfig();
  const sizeClasses = getSizeClasses();
  const IconComponent = status.icon;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={`
        inline-flex items-center space-x-2 rounded-full border
        ${status.bgColor} ${status.borderColor} ${sizeClasses.container}
        ${className}
      `}
      title={`${status.label}: ${status.description}`}
    >
      <IconComponent className={`${status.iconColor} ${sizeClasses.icon}`} />
      
      {showLabel && (
        <div className="flex flex-col">
          <span className={`${status.textColor} ${sizeClasses.text} leading-tight`}>
            {status.label}
          </span>
          {size === 'lg' && (
            <span className={`${status.textColor} opacity-75 ${sizeClasses.description} leading-tight`}>
              {status.description}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// Compact version for toolbar/header use
export function PermissionStatusBadge({ className = '' }: { className?: string }) {
  const { canEdit, isTeacher } = useEditPermission();

  const getStatusIcon = () => {
    if (isTeacher) return '🛡️';
    return canEdit ? '✏️' : '👁️';
  };

  const getStatusText = () => {
    if (isTeacher) return 'Teacher';
    return canEdit ? 'Editor' : 'View-only';
  };

  const getStatusColor = () => {
    if (isTeacher) return 'bg-blue-500';
    return canEdit ? 'bg-green-500' : 'bg-gray-500';
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={`
        inline-flex items-center space-x-1 px-2 py-1 rounded-full text-white text-xs font-medium
        ${getStatusColor()} ${className}
      `}
      title={`Permission: ${getStatusText()}`}
    >
      <span>{getStatusIcon()}</span>
      <span>{getStatusText()}</span>
    </motion.div>
  );
}

// Animated permission change indicator
export function PermissionChangeIndicator() {
  const { canEdit, isTeacher } = useEditPermission();
  const [previousPermission, setPreviousPermission] = React.useState(canEdit);
  const [showChange, setShowChange] = React.useState(false);

  React.useEffect(() => {
    if (previousPermission !== canEdit && !isTeacher) {
      setShowChange(true);
      const timer = setTimeout(() => {
        setShowChange(false);
        setPreviousPermission(canEdit);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [canEdit, isTeacher, previousPermission]);

  if (!showChange || isTeacher) return null;

  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
      className={`
        fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border-2
        ${canEdit 
          ? 'bg-green-50 border-green-200 text-green-800' 
          : 'bg-red-50 border-red-200 text-red-800'
        }
      `}
    >
      <div className="flex items-center space-x-2">
        {canEdit ? (
          <FiUnlock className="w-5 h-5 text-green-600" />
        ) : (
          <FiLock className="w-5 h-5 text-red-600" />
        )}
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
  );
}
