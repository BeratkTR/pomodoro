import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './ChatWidget.css'
import socketService from '../services/socketService'

// Memoized message component to prevent unnecessary re-renders
const MessageItem = React.memo(({ message, currentUser, formatTime, renderMessageStatus }) => (
  <div 
    className={`message ${message.userId === currentUser.id ? 'own-message' : 'partner-message'}`}
  >
    <div className="message-content">
      <div className="message-header">
        <span className="message-author">
          {message.userId === currentUser.id ? 'You' : message.userName}
        </span>
        <div className="message-time-status">
          <span className="message-time">
            {formatTime(message.timestamp)}
          </span>
          {renderMessageStatus(message)}
        </div>
      </div>
      <div className="message-text">
        {message.text || '[Empty message]'}
      </div>
    </div>
  </div>
))

const ChatWidget = ({ 
  isOpen, 
  onToggle, 
  messages, 
  onSendMessage, 
  currentUser, 
  unreadCount,
  onMarkAsRead 
}) => {
  const [messageText, setMessageText] = useState('')
  const messagesEndRef = useRef(null)
  const chatInputRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const [displayedMessageCount, setDisplayedMessageCount] = useState(50)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [showJumpToBottom, setShowJumpToBottom] = useState(false)
  const scrollTimeoutRef = useRef(null)



  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "instant" })
    }
  }, [])

  // Handle scroll events - load more messages when scrolled to top and show/hide jump button
  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current && !isLoadingMore) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
      
      // Show/hide jump to bottom button
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100
      setShowJumpToBottom(!isNearBottom)
      
      // If user scrolled to within 50px of the top, load more messages
      if (scrollTop < 50 && displayedMessageCount < messages.length) {
        setIsLoadingMore(true)
        
        // Store current scroll position
        const currentScrollHeight = messagesContainerRef.current.scrollHeight
        
        // Load 50 more messages
        setTimeout(() => {
          setDisplayedMessageCount(prev => Math.min(prev + 50, messages.length))
          
          // Restore scroll position after loading more messages
          setTimeout(() => {
            if (messagesContainerRef.current) {
              const newScrollHeight = messagesContainerRef.current.scrollHeight
              const scrollDifference = newScrollHeight - currentScrollHeight
              messagesContainerRef.current.scrollTop = scrollTop + scrollDifference
            }
            setIsLoadingMore(false)
          }, 50)
        }, 100)
      }
    }
  }, [displayedMessageCount, messages.length, isLoadingMore])

  // Add ESC key listener to close chat when open
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onToggle()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onToggle])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      // Only adjust displayedMessageCount if we're currently showing recent messages
      if (displayedMessageCount >= messages.length - 5) {
        // If showing recent messages, ensure new messages are included
        setDisplayedMessageCount(messages.length)
      }
      
      // Check if user is near the bottom
      if (messagesContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100
        
        // If user is near bottom, auto-scroll
        if (isNearBottom) {
          setTimeout(() => scrollToBottom(true), 50)
        }
      }
    }
  }, [messages.length, displayedMessageCount, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      onMarkAsRead()
      // Mark messages as read on server
      socketService.markMessagesAsRead()
      // Always scroll to bottom when chat opens
      setTimeout(() => {
        // Reset to show last 50 messages when opening
        setDisplayedMessageCount(Math.min(50, messages.length))
        scrollToBottom(true)
        chatInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen, onMarkAsRead, scrollToBottom])

  const handleSendMessage = (e) => {
    e.preventDefault()
    const trimmedMessage = messageText.trim()
    if (trimmedMessage && trimmedMessage.length > 0) {
      onSendMessage(trimmedMessage)
      setMessageText('')
      // Always scroll to bottom when user sends a message and show recent messages
      setDisplayedMessageCount(Math.min(50, messages.length))
      setTimeout(() => scrollToBottom(true), 50)
    }
  }

  const formatTime = useCallback((timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })
  }, [])

  const renderMessageStatus = useCallback((message) => {
    // Only show status for own messages
    if (message.userId !== currentUser.id) {
      return null
    }

    // Default status for messages without status field (backward compatibility)
    const status = message.status || { sent: true, read: false }
    const { sent, read } = status

    if (read) {
      // Blue tick for read messages
      return (
        <span className="message-status read" title="Read">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8L6 12L14 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      )
    } else if (sent) {
      // Gray tick for sent but not read messages
      return (
        <span className="message-status sent" title="Sent">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8L6 12L14 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      )
    }

    return null
  }, [currentUser.id])

  // Memoize message list with pagination
  const messageList = useMemo(() => {
    // Show the last N messages based on displayedMessageCount
    const totalMessages = messages.length
    const startIndex = Math.max(0, totalMessages - displayedMessageCount)
    const displayMessages = messages.slice(startIndex)
    
    return displayMessages.map((message, index) => (
      <MessageItem 
        key={message.id || `${message.timestamp}-${index}`} 
        message={message}
        currentUser={currentUser}
        formatTime={formatTime}
        renderMessageStatus={renderMessageStatus}
      />
    ))
  }, [messages, displayedMessageCount, currentUser, formatTime, renderMessageStatus])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  return (
    <>
      {/* Chat Widget Toggle Button */}
      <div className="chat-widget-container">
        <button 
          className="chat-toggle-btn" 
          onClick={onToggle}
          aria-label="Toggle chat"
        >
          <span className="chat-icon">💬</span>
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount}</span>
          )}
        </button>

        {/* Chat Interface */}
        {isOpen && (
          <div className="chat-interface">
            <div className="chat-header">
              <h3>Room Chat</h3>
              <button 
                className="chat-close-btn" 
                onClick={onToggle}
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>

            <div 
              className="chat-messages"
              ref={messagesContainerRef}
              onScroll={handleScroll}
            >
              {/* Show loading indicator when loading more messages */}
              {isLoadingMore && (
                <div className="scroll-indicator">
                  <div className="scroll-indicator-content">
                    📜 Loading older messages...
                  </div>
                </div>
              )}
              
              {messages.length === 0 ? (
                <div className="no-messages">
                  <p>No messages yet. Say hello to your study partner! 👋</p>
                </div>
              ) : (
                <>
                  {messageList}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
            
            {/* Jump to bottom button */}
            {showJumpToBottom && (
              <div className="jump-to-bottom">
                <button 
                  className="jump-to-bottom-btn"
                  onClick={() => {
                    setDisplayedMessageCount(Math.min(50, messages.length))
                    setTimeout(() => scrollToBottom(true), 50)
                  }}
                >
                  ↓ Jump to latest messages
                </button>
              </div>
            )}

            <form className="chat-input-form" onSubmit={handleSendMessage}>
              <input
                ref={chatInputRef}
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                className="chat-input"
                maxLength={500}
              />
              <button 
                type="submit" 
                className="send-btn"
                disabled={!messageText.trim()}
              >
                <span>Send</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  )
}

export default ChatWidget 