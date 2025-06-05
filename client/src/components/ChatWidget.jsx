import React, { useState, useEffect, useRef } from 'react'
import './ChatWidget.css'

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      onMarkAsRead()
      // Focus input when chat opens
      setTimeout(() => chatInputRef.current?.focus(), 100)
    }
  }, [isOpen, onMarkAsRead])

  const handleSendMessage = (e) => {
    e.preventDefault()
    const trimmedMessage = messageText.trim()
    if (trimmedMessage && trimmedMessage.length > 0) {
      onSendMessage(trimmedMessage)
      setMessageText('')
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })
  }

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

            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <p>No messages yet. Say hello to your study partner! 👋</p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div 
                    key={message.id || index} 
                    className={`message ${message.userId === currentUser.id ? 'own-message' : 'partner-message'}`}
                  >
                    <div className="message-content">
                      <div className="message-header">
                        <span className="message-author">
                          {message.userId === currentUser.id ? 'You' : message.userName}
                        </span>
                        <span className="message-time">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                      <div className="message-text">
                        {message.text || '[Empty message]'}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

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