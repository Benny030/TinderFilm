import { useState, useEffect, type FormEvent } from 'react';

type UseRoomOptions = {
  roomId: string;
};

export function useRoom({ roomId }: UseRoomOptions) {
  const [statusMessage, setStatusMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');

  return {
    statusMessage,
    setStatusMessage,
    copyMessage,
    setCopyMessage,
  };
}