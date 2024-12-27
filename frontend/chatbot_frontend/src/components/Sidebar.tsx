import * as React from 'react'
import { Button } from './ui/button'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { RefreshCw } from 'lucide-react'

interface Chat {
  id: string
  title: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

export interface SidebarProps {
  chats: Chat[]
  selectedChatId: string
  onNewChat: () => void
  onSelectChat: (chatId: string) => void
  onLogout: () => void
}

const Sidebar: React.FC<SidebarProps> = ({ chats, selectedChatId, onNewChat, onSelectChat, onLogout }) => {
  return (
    <aside className="flex flex-col w-64 border-r bg-white">
      {/* New chat button */}
      <div className="p-4">
        <Button 
          variant="secondary" 
          className="w-full flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-medium"
          onClick={onNewChat}
        >
          <RefreshCw className="w-4 h-4" />
          New chat
        </Button>
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-auto">
        <p className="text-xs font-semibold text-gray-500 px-4 py-2">Today</p>
        <div className="px-2">
          {chats.map(chat => (
            <Button
              key={chat.id}
              variant="ghost"
              className={`w-full justify-start text-sm text-gray-700 hover:bg-gray-100 py-3 px-2 ${
                chat.id === selectedChatId ? 'bg-gray-100' : ''
              }`}
              onClick={() => onSelectChat(chat.id)}
            >
              {chat.title}
            </Button>
          ))}
        </div>
      </div>

      {/* Profile section */}
      <div className="p-4 border-t mt-auto">
        <Button
          variant="ghost"
          className="w-full flex items-center gap-2 justify-start hover:bg-gray-100 py-2"
        >
          <Avatar className="w-8 h-8">
            <AvatarImage src="/default-avatar.png" alt="User Avatar" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <span className="text-sm">My Profile</span>
        </Button>
        <Button
          variant="ghost"
          className="w-full flex items-center gap-2 justify-start hover:bg-gray-100 py-2 mt-2 text-red-600"
          onClick={onLogout}
        >
          <span className="text-sm">Logout</span>
        </Button>
      </div>
    </aside>
  )
}

export default Sidebar
