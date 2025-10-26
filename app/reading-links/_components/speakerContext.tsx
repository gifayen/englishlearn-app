'use client';
import React from 'react';

export type SpeakerValue = {
  speak: (text: string) => void;
  stop?: () => void;
  rate?: number;
  voicePref?: 'female' | 'male' | 'auto';
};

const SpeakerCtx = React.createContext<SpeakerValue | null>(null);

export function SpeakerProvider({
  value,
  children,
}: {
  value: SpeakerValue;
  children: React.ReactNode;
}) {
  return <SpeakerCtx.Provider value={value}>{children}</SpeakerCtx.Provider>;
}

export function useSpeakerCtx() {
  return React.useContext(SpeakerCtx);
}
