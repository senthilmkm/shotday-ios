import React from 'react';
import { LockedFeatureScreen } from './LockedFeatureScreen';
import { useProAccess } from '../hooks/useProAccess';

interface ProtectedFeatureProps {
  title: string;
  body: string;
  onClose?: () => void;
  children: React.ReactElement;
}

export function ProtectedFeature({
  title,
  body,
  onClose,
  children,
}: ProtectedFeatureProps): React.ReactElement {
  const { hasProAccess, openPaywall } = useProAccess();

  if (hasProAccess) {
    return children;
  }

  return (
    <LockedFeatureScreen
      title={title}
      body={body}
      onUpgrade={openPaywall}
      onClose={onClose}
    />
  );
}
