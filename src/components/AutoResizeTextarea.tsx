import React, { useEffect, useLayoutEffect, useRef } from 'react';

export interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
}

export const AutoResizeTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AutoResizeTextareaProps
>(({ value, onChange, minRows = 2, className = '', style, rows, ...rest }, externalRef) => {
  const internalRef = useRef<HTMLTextAreaElement | null>(null);

  // Combine external and internal refs
  const setRef = (node: HTMLTextAreaElement | null) => {
    internalRef.current = node;
    if (typeof externalRef === 'function') {
      externalRef(node);
    } else if (externalRef) {
      (externalRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
    }
  };

  const adjustHeight = () => {
    const el = internalRef.current;
    if (!el) return;
    // Reset to auto to get the exact scrollHeight of the content
    el.style.height = 'auto';
    // Calculate new height, ensuring it doesn't shrink below a sensible base
    const baseMin = (minRows || rows || 2) * 20;
    const targetHeight = Math.max(el.scrollHeight, baseMin);
    el.style.height = `${targetHeight}px`;
  };

  useLayoutEffect(() => {
    adjustHeight();
  }, [value]);

  useEffect(() => {
    // Re-calculate after CSS styles/fonts load or modals animate in
    const rafId = requestAnimationFrame(adjustHeight);
    const timer = setTimeout(adjustHeight, 50);

    const handleWindowResize = () => {
      adjustHeight();
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight();
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <textarea
      ref={setRef}
      value={value}
      onChange={handleChange}
      style={{
        resize: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...style,
      }}
      className={className}
      rows={rows || minRows}
      {...rest}
    />
  );
});

AutoResizeTextarea.displayName = 'AutoResizeTextarea';

