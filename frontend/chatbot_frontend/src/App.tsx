import { useState, useEffect, useRef } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import ChatMessage from './components/ChatMessage'
import { Input } from "./components/ui/input"
import { Button } from "./components/ui/button"
import { ScrollArea } from "./components/ui/scroll-area"
import { Send, Mic, RotateCcw } from "lucide-react"
import Sidebar from './components/Sidebar'
import LoginForm from './components/LoginForm'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github.css'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Chat {
  id: string
  title: string
  messages: Message[]
}

function App() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [chats, setChats] = useState<Chat[]>([{
    id: Date.now().toString(),
    title: 'AI Assistant Introduces Itself Briefly',
    messages: [{
      role: 'assistant',
      content: 'Hello! How can I help you today?'
    }]
  }])
  const [selectedChatId, setSelectedChatId] = useState<string>(chats[0].id)
  const [input, setInput] = useState('')

  // Cleanup function for EventSource
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: []
    }
    setChats(prev => [...prev, newChat])
    setSelectedChatId(newChat.id)
  }

  const switchChat = (chatId: string) => {
    setSelectedChatId(chatId)
  }

  const currentChat = chats.find(chat => chat.id === selectedChatId)

  const handleSend = async () => {
    if (!input.trim()) return

    // Create new chat if none is selected
    if (!currentChat) {
      const newChat: Chat = {
        id: Date.now().toString(),
        title: "New Chat",
        messages: [{
          role: 'assistant',
          content: 'Hello! How can I help you today?'
        }]
      }
      setChats(prev => [...prev, newChat])
      setSelectedChatId(newChat.id)
      // Wait for state updates
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    const newMessage: Message = {
      role: 'user',
      content: input
    }

    // Get the current chat after potential creation
    const activeChat = chats.find(chat => chat.id === selectedChatId)
    if (!activeChat) {
      console.error('No active chat found')
      return
    }

    setChats(prevChats => prevChats.map(chat => {
      if (chat.id === selectedChatId) {
        const updatedMessages = [...chat.messages, newMessage]
        // Update title if this is the first message
        if (chat.messages.length === 0) {
          const title = newMessage.content.slice(0, 30) + (newMessage.content.length > 30 ? '...' : '')
          return { ...chat, messages: updatedMessages, title }
        }
        return { ...chat, messages: updatedMessages }
      }
      return chat
    }))
    setInput('')

    try {
      // Close any existing EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Create placeholder for assistant's response
      const assistantMessage: Message = {
        role: 'assistant',
        content: ''
      }
      setChats(prevChats => prevChats.map(chat =>
        chat.id === selectedChatId
          ? { ...chat, messages: [...chat.messages, assistantMessage] }
          : chat
      ))

      // Create EventSource for streaming response
      const messages = [...activeChat.messages, newMessage].map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Create new EventSource with token in URL
      const url = new URL(`${import.meta.env.VITE_API_URL}/chat/stream`);
      url.searchParams.append('messages', JSON.stringify(messages));
      
      // Ensure token is available and properly formatted
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Remove 'Bearer ' prefix if present and encode
      const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
      console.log('Clean token (first 10 chars):', cleanToken.substring(0, 10));
      url.searchParams.append('token', cleanToken);
      
      const eventSource = new EventSource(url.toString());
      eventSourceRef.current = eventSource;

      // Handle incoming messages
      eventSource.onmessage = (event) => {
        const data = event.data;
        if (data === '') {
          eventSource.close();
          return;
        }
        setChats(prevChats => prevChats.map(chat =>
          chat.id === selectedChatId
            ? {
                ...chat,
                messages: chat.messages.map((msg, idx) =>
                  idx === chat.messages.length - 1
                    ? { ...msg, content: msg.content + (msg.content && !msg.content.endsWith(' ') ? ' ' : '') + data }
                    : msg
                )
              }
            : chat
        ));
      };

      // Handle errors
      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        setChats(prevChats => prevChats.map(chat =>
          chat.id === selectedChatId
            ? {
                ...chat,
                messages: chat.messages.map((msg, idx) =>
                  idx === chat.messages.length - 1
                    ? { ...msg, content: msg.content || 'Sorry, I encountered an error while processing your request.' }
                    : msg
                )
              }
            : chat
        ));
      };
    } catch (error) {
      console.error('Error:', error);
      setChats(prevChats => prevChats.map(chat => 
        chat.id === selectedChatId 
          ? { ...chat, messages: [...chat.messages, {
              role: 'assistant',
              content: 'Sorry, I encountered an error while processing your request.'
            }] }
          : chat
      ));
    }
  }

  const handleLogin = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('token', newToken);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
    setChats([{
      id: Date.now().toString(),
      title: 'AI Assistant Introduces Itself Briefly',
      messages: [{
        role: 'assistant',
        content: 'Hello! How can I help you today?'
      }]
    }]);
    setSelectedChatId(chats[0].id);
  };

  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <LoginForm onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      <Sidebar 
        chats={chats}
        selectedChatId={selectedChatId}
        onNewChat={createNewChat}
        onSelectChat={switchChat}
        onLogout={handleLogout}
      />
      <main className="flex-1 flex flex-col">
        {!currentChat?.messages.length && (
          <div className="px-8 py-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Hi, I'm DeepSeek.</h1>
            <p className="text-sm text-gray-500">How can I help you today?</p>
          </div>
        )}

        {/* Chat messages */}
        <ScrollArea className="flex-1 px-8">
          <div className="space-y-8 py-6">
            {currentChat?.messages.map((message: Message, index: number) => (
              <ChatMessage
                key={index}
                role={message.role}
                content={message.content}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Input + Action buttons */}
        <div className="border-t bg-white py-4">
          <div className="max-w-4xl mx-auto px-8 flex items-center gap-3">
            <Input
              value={input}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
              placeholder="Message DeepSeek"
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              className="flex-1 shadow-sm"
            />
            <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
              <Mic className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSend} className="text-gray-500 hover:text-gray-700">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App;
