import * as React from 'react'
import { Avatar, AvatarFallback } from './ui/avatar'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github-dark.css'
import python from 'highlight.js/lib/languages/python'
import type { FC, ComponentPropsWithoutRef } from 'react'

// Register Python language for syntax highlighting
import hljs from 'highlight.js/lib/core'
hljs.registerLanguage('python', python)

type CodeProps = ComponentPropsWithoutRef<'code'> & {
  inline?: boolean
}

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
}

const ChatMessage: FC<ChatMessageProps> = ({ role, content }) => {
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
        className={`p-3 rounded-2xl max-w-xl prose prose-pre:bg-gray-800 prose-pre:text-white prose-pre:p-0 ${
          role === 'assistant' 
            ? 'bg-gray-100 text-gray-900' 
            : 'bg-indigo-600 text-white prose-invert'
        } prose-code:before:hidden prose-code:after:hidden`}
      >
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[
            [rehypeKatex, { 
              strict: false,
              throwOnError: false,
              trust: true,
              macros: {
                "\\eqref": "\\href{#1}{}",
              }
            }],
            [rehypeHighlight, { 
              detect: true,
              ignoreMissing: true,
              subset: ['python'],
              plainText: ['python']
            }],
            rehypeRaw
          ]}
          components={{
            code: ({ className, children, inline, ...props }: CodeProps) => {
              const match = /language-(\w+)/.exec(className || '')
              return !inline ? (
                <pre className="!p-0 !my-4">
                  <code
                    className={`block overflow-x-auto p-4 rounded-lg ${
                      match ? `language-${match[1]}` : ''
                    }`}
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </code>
                </pre>
              ) : (
                <code
                  className={`px-1.5 py-0.5 rounded-md text-sm ${
                    role === 'assistant' ? 'bg-gray-200' : 'bg-indigo-700'
                  }`}
                  {...props}
                >
                  {children}
                </code>
              )
            }
          }}
          className="prose prose-pre:my-0 prose-code:before:content-none prose-code:after:content-none max-w-none prose-pre:bg-gray-800 prose-pre:rounded-lg"
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}

export default ChatMessage
