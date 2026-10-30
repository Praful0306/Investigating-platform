import { useEffect } from 'react';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · AI Mystery Room` : 'AI Mystery Room — every case is new';
  }, [title]);
}
