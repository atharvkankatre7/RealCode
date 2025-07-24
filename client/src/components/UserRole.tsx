"use client"

import React from 'react';
import { motion } from 'framer-motion';
import { FiUser, FiEye, FiEdit3, FiShield } from 'react-icons/fi';

interface UserRoleProps {
  role: 'teacher' | 'student' | null;
  canEdit: boolean;
  className?: string;
}

export default function UserRole({ role, canEdit, className = '' }: UserRoleProps) {
  if (!role) {
    return null;
  }

  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';

  // Determine display text and styling
  const getDisplayInfo = () => {
    if (isTeacher) {
      return {
        text: 'Teacher',
        icon: FiShield,
        bgColor: 'bg-blue-500/20',
        textColor: 'text-blue-400',
        borderColor: 'border-blue-500/30'
      };
    } else if (isStudent && canEdit) {
      return {
        text: 'Student',
        icon: FiEdit3,
        bgColor: 'bg-green-500/20',
        textColor: 'text-green-400',
        borderColor: 'border-green-500/30'
      };
    } else {
      return {
        text: 'View-only',
        icon: FiEye,
        bgColor: 'bg-gray-500/20',
        textColor: 'text-gray-400',
        borderColor: 'border-gray-500/30'
      };
    }
  };

  const displayInfo = getDisplayInfo();
  const IconComponent = displayInfo.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border
        ${displayInfo.bgColor} ${displayInfo.textColor} ${displayInfo.borderColor}
        ${className}
      `}
    >
      <IconComponent className="w-4 h-4" />
      <span className="text-sm font-medium">{displayInfo.text}</span>
    </motion.div>
  );
}

// Additional component for user count display
interface UserCountProps {
  count: number;
  className?: string;
}

export function UserCount({ count, className = '' }: UserCountProps) {
  return (
    <motion.div
      key={count}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
        bg-zinc-800 border border-zinc-700 text-zinc-300
        ${className}
      `}
    >
      <FiUser className="w-4 h-4" />
      <span className="text-sm font-medium">
        {count} {count === 1 ? 'user' : 'users'} online
      </span>
    </motion.div>
  );
}

// Combined component for role and count
interface UserInfoProps {
  role: 'teacher' | 'student' | null;
  canEdit: boolean;
  userCount: number;
  className?: string;
}

export function UserInfo({ role, canEdit, userCount, className = '' }: UserInfoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <UserRole role={role} canEdit={canEdit} />
      <UserCount count={userCount} />
    </div>
  );
}
