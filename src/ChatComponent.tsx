import React from 'react';
import { ChatInput, Messages } from 'lm-studio-react'; // Assuming this is the name of the package

const ChatComponent = () => {
  return (
    <div className="chat-container">
      <ChatInput />
      <Messages />
    </div>
  );
};

export default ChatComponent;