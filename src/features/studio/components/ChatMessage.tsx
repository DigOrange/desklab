import { ChatMessage as ChatMessageType, Citation } from '../../../types';
import './ChatMessage.css';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  onCitationClick?: (citation: Citation) => void;
}

export function ChatMessage({ message, isStreaming, onCitationClick }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const hasCitations = message.citations && message.citations.length > 0;

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar">
        <span className="material-icon">
          {isUser ? 'person' : 'smart_toy'}
        </span>
      </div>
      <div className="message-content">
        <div className="message-header">
          <span className="message-role">{isUser ? '你' : 'AI 助手'}</span>
        </div>
        <div className="message-text">
          {message.content}
          {isStreaming && <span className="streaming-cursor">|</span>}
        </div>
        {hasCitations && (
          <div className="message-citations">
            <div className="citations-label">
              <span className="material-icon">link</span>
              引用来源
            </div>
            <div className="citations-list">
              {message.citations!.map((citation) => (
                <button
                  key={citation.index}
                  className="citation-chip"
                  onClick={() => onCitationClick?.(citation)}
                  title={`跳转到 ${citation.sourceName}`}
                >
                  <span className="citation-index">[{citation.index}]</span>
                  <span className="citation-name">{citation.sourceName}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
