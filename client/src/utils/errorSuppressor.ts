// Global error handler to suppress browser extension errors
// This prevents Chrome extension errors from cluttering the console

export function initializeErrorSuppressor() {
  // Suppress extension-related errors
  const originalError = console.error;
  console.error = function(...args: any[]) {
    const message = args[0]?.toString?.() || '';
    
    // Extension-related error patterns to suppress
    const extensionErrorPatterns = [
      'A listener indicated an asynchronous response by returning true',
      'message channel closed before a response was received',
      'Extension context invalidated',
      'chrome-extension://',
      'moz-extension://',
      'Could not establish connection',
      'Receiving end does not exist',
      'The message port closed before a response was received',
    ];
    
    // Check if this is an extension error
    const isExtensionError = extensionErrorPatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
    
    // Only log non-extension errors
    if (!isExtensionError) {
      originalError.apply(console, args);
    }
  };

  // Suppress unhandled promise rejections from extensions
  const originalUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = function(event: PromiseRejectionEvent) {
    const reason = event.reason?.toString?.() || '';
    
    // Extension-related rejection patterns
    const extensionRejectionPatterns = [
      'message channel closed',
      'listener indicated an asynchronous response',
      'extension context invalidated',
      'chrome-extension',
      'moz-extension',
    ];
    
    const isExtensionRejection = extensionRejectionPatterns.some(pattern => 
      reason.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (isExtensionRejection) {
      event.preventDefault(); // Suppress the error
      return;
    }
    
    // Call original handler for non-extension errors
    if (originalUnhandledRejection) {
      originalUnhandledRejection.call(window, event);
    }
  };

  console.log('🔇 Extension error suppressor initialized');
}

// Also export individual suppressors for specific use cases
export function suppressExtensionErrors() {
  // Wrapper for async operations that might trigger extension errors
  return function<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      try {
        const result = fn(...args);
        if (result && typeof result.catch === 'function') {
          return result.catch((error: any) => {
            const errorMessage = error?.message || error?.toString() || '';
            if (errorMessage.includes('message channel closed') || 
                errorMessage.includes('listener indicated an asynchronous response')) {
              // Suppress extension errors silently
              return Promise.resolve();
            }
            throw error; // Re-throw non-extension errors
          });
        }
        return result;
      } catch (error: any) {
        const errorMessage = error?.message || error?.toString() || '';
        if (errorMessage.includes('message channel closed') || 
            errorMessage.includes('listener indicated an asynchronous response')) {
          // Suppress extension errors silently
          return;
        }
        throw error; // Re-throw non-extension errors
      }
    }) as T;
  };
}