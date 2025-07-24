/**
 * Utility function to format code using the browser's built-in formatting capabilities
 * This is a simple implementation that works for most languages
 * @param code The code to format
 * @param language The language of the code
 * @returns The formatted code
 */
export function formatCode(code: string, language: string): string {
  try {
    // Use the browser's built-in formatting capabilities
    if (language === 'javascript' || language === 'typescript') {
      // For JavaScript and TypeScript, we can use JSON.stringify with indentation
      // This is a simple approach that works for basic formatting
      // First, we need to wrap the code in a function to make it valid JSON
      const wrappedCode = `(function() { ${code} })`;
      
      try {
        // Try to evaluate the code to check if it's valid
        // eslint-disable-next-line no-eval
        eval(wrappedCode);
        
        // If it's valid, we can format it using Function constructor and toString
        const formattedCode = new Function(`return ${wrappedCode}`)().toString();
        
        // Remove the function wrapper
        return formattedCode
          .replace(/^\(function\(\)\s*\{\s*/, '') // Remove opening wrapper
          .replace(/\s*\}\)$/, ''); // Remove closing wrapper
      } catch (e) {
        // If there's a syntax error, just return the original code
        console.warn('Could not format code due to syntax error:', e);
        return code;
      }
    } else if (language === 'html') {
      // For HTML, we can use a simple regex-based formatter
      // This is a very basic implementation
      return formatHTML(code);
    } else if (language === 'css') {
      // For CSS, we can use a simple regex-based formatter
      // This is a very basic implementation
      return formatCSS(code);
    } else {
      // For other languages, just return the original code
      return code;
    }
  } catch (error) {
    console.error('Error formatting code:', error);
    return code; // Return the original code if there's an error
  }
}

/**
 * Simple HTML formatter using regex
 * @param html The HTML code to format
 * @returns The formatted HTML code
 */
function formatHTML(html: string): string {
  // This is a very basic implementation
  // Replace multiple spaces with a single space
  let formatted = html.replace(/\s+/g, ' ');
  
  // Add newlines after closing tags
  formatted = formatted.replace(/>\s*</g, '>\n<');
  
  // Add indentation
  const lines = formatted.split('\n');
  let indentLevel = 0;
  const indentSize = 2;
  
  return lines.map(line => {
    // Decrease indent for closing tags
    if (line.match(/<\/[^>]+>/)) {
      indentLevel = Math.max(0, indentLevel - 1);
    }
    
    // Add indentation
    const indented = ' '.repeat(indentLevel * indentSize) + line.trim();
    
    // Increase indent for opening tags (not self-closing)
    if (line.match(/<[^/][^>]*>/) && !line.match(/\/>/)) {
      indentLevel++;
    }
    
    return indented;
  }).join('\n');
}

/**
 * Simple CSS formatter using regex
 * @param css The CSS code to format
 * @returns The formatted CSS code
 */
function formatCSS(css: string): string {
  // This is a very basic implementation
  // Replace multiple spaces with a single space
  let formatted = css.replace(/\s+/g, ' ');
  
  // Add newlines after semicolons and braces
  formatted = formatted.replace(/;\s*/g, ';\n');
  formatted = formatted.replace(/\{\s*/g, ' {\n');
  formatted = formatted.replace(/\}\s*/g, '}\n\n');
  
  // Add indentation
  const lines = formatted.split('\n');
  let indentLevel = 0;
  const indentSize = 2;
  
  return lines.map(line => {
    // Decrease indent for closing braces
    if (line.match(/\}/)) {
      indentLevel = Math.max(0, indentLevel - 1);
    }
    
    // Add indentation
    const indented = ' '.repeat(indentLevel * indentSize) + line.trim();
    
    // Increase indent for opening braces
    if (line.match(/\{/)) {
      indentLevel++;
    }
    
    return indented;
  }).join('\n');
}
