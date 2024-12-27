import * as React from 'react'
import { Avatar, AvatarFallback } from './ui/avatar'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
}

const ChatMessage: React.FC<ChatMessageProps> = ({ role, content }) => {
  return (
    <div className={`flex items-start gap-4 ${role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}>
      <Avatar className={`mt-0.5 ${
        role === 'assistant' 
          ? 'bg-blue-100 text-blue-600' 
          : 'bg-gray-100 text-gray-600'
      }`}>
        <AvatarFallback className="font-medium">
          {role === 'assistant' ? 'D' : 'U'}
        </AvatarFallback>
      </Avatar>
      <div 
        className={`p-3 rounded-2xl max-w-xl ${
          role === 'assistant' 
            ? 'bg-gray-100 text-gray-900' 
            : 'bg-indigo-600 text-white'
        }`}
      >
        {content}
      </div>
    </div>
  )
}

export default ChatMessage
