import React from 'react';
import { useEditPermission } from '@/context/EditPermissionContext';
import { FiUser } from 'react-icons/fi';

interface UserListPanelProps {
  typingUser?: string | null;
}

const roleEmoji: Record<string, string> = {
  teacher: '👨‍🏫',
  student: '👨‍🎓',
};

const UserListPanel: React.FC<UserListPanelProps> = ({ typingUser }) => {
  const { users } = useEditPermission();

  return (
    <div className="flex flex-row items-center gap-4">
      {users.map((user) => (
        <div key={user.userId} className="flex items-center gap-1 px-2 py-1 rounded">
          <span className="text-lg">
            {roleEmoji[user.role] || <FiUser />}
          </span>
          <span className="font-medium text-white text-sm">{user.username}</span>
          <span className={`ml-1 px-2 py-0.5 rounded text-xs font-semibold ${user.role === 'teacher' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>{user.role}</span>
          {typingUser === user.username && (
            <span className="ml-2 text-yellow-400 animate-pulse text-xs">typing...</span>
          )}
        </div>
      ))}
    </div>
  );
};

export default UserListPanel; 