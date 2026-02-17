export interface Macro {
  name: string;
  args?: string[];
  body: string;
}

import { readFileSync } from 'fs';

export interface PreprocessorOptions {
  includePaths?: string[];
  defines?: Record<string, string>;
}

export class Preprocessor {
  private macros: Map<string, Macro> = new Map();
  private includePaths: string[];
  private lines: string[] = [];
  private output: string[] = [];
  private position: number = 0;
  private fileName: string = '<input>';
  private ifStack: boolean[] = [];
  private skipBlock: boolean = false;
  private includedFiles: Set<string> = new Set();

  constructor(options: PreprocessorOptions = {}) {
    this.includePaths = options.includePaths || [];
    
    // Add default macros
    this.macros.set('__STDC__', { name: '__STDC__', body: '1' });
    this.macros.set('__STDC_VERSION__', { name: '__STDC_VERSION__', body: '201710L' });
    this.macros.set('__GNUC__', { name: '__GNUC__', body: '11' });
    this.macros.set('__linux__', { name: '__linux__', body: '1' });
    this.macros.set('__x86_64__', { name: '__x86_64__', body: '1' });
    
    // Add user-defined macros
    if (options.defines) {
      for (const [name, value] of Object.entries(options.defines)) {
        this.macros.set(name, { name, body: value });
      }
    }
  }

  preprocess(source: string, fileName: string = '<input>'): string {
    this.fileName = fileName;
    
    // Handle backslash line continuations first
    let normalized = source.replace(/\\\n/g, '');
    
    // Remove C-style comments /* ... */
    normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Remove C++ style comments //
    normalized = normalized.replace(/\/\/.*$/gm, '');
    
    this.lines = normalized.split('\n');
    this.output = [];
    this.position = 0;
    this.ifStack = [];
    this.skipBlock = false;

    while (this.position < this.lines.length) {
      const line = this.lines[this.position];
      this.position++;

      if (this.skipBlock) {
        // Still inside skipped block, check for #endif
        if (line.trim().startsWith('#endif')) {
          this.ifStack.pop();
          if (this.ifStack.length === 0) {
            this.skipBlock = false;
          }
        }
        continue;
      }

      // Handle preprocessor directives
      const trimmed = line.trim();
      
      if (trimmed.startsWith('#define')) {
        this.handleDefine(trimmed);
      } else if (trimmed.startsWith('#undef')) {
        this.handleUndef(trimmed);
      } else if (trimmed.startsWith('#ifdef')) {
        this.handleIfdef(trimmed, true);
      } else if (trimmed.startsWith('#ifndef')) {
        this.handleIfdef(trimmed, false);
      } else if (trimmed.startsWith('#endif')) {
        // End of conditional
      } else if (trimmed.startsWith('#else')) {
        // Else - skip remaining content
        this.skipBlock = true;
      } else if (trimmed.startsWith('#include')) {
        const included = this.handleInclude(trimmed);
        if (included) {
          this.output.push(included);
        }
      } else if (trimmed.startsWith('#if') || trimmed.startsWith('#elif')) {
        // Skip #if/#elif blocks for simplicity
        this.ifStack.push(false);
        this.skipBlock = true;
      } else if (trimmed.startsWith('#')) {
        // Unknown directive, skip
      } else {
        // Regular code - expand macros
        const expanded = this.expandMacros(line);
        if (expanded.trim() || this.output.length > 0) {
          this.output.push(expanded);
        }
      }
    }

    return this.output.join('\n');
  }

  private handleDefine(line: string): void {
    // Parse #define NAME value or #define NAME(args) value
    let rest = line.slice(8).trim(); // Remove '#define '
    
    // Remove comments from the define
    rest = rest.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//, '');
    
    // Check for function-like macro - parenthesis must immediately follow name (no whitespace)
    const funcMatch = rest.match(/^(\w+)\(([^)]*)\)\s*(.*)$/);
    if (funcMatch) {
      const name = funcMatch[1];
      const args = funcMatch[2].split(',').map(a => a.trim()).filter(a => a);
      const body = funcMatch[3].trim();
      this.macros.set(name, { name, args, body });
      return;
    }

    // Object-like macro
    const match = rest.match(/^(\w+)\s*(.*)$/);
    if (match) {
      const name = match[1];
      const body = match[2] || '';
      this.macros.set(name, { name, body });
    }
  }

  private handleUndef(line: string): void {
    const rest = line.slice(7).trim(); // Remove '#undef '
    const match = rest.match(/^(\w+)/);
    if (match) {
      this.macros.delete(match[1]);
    }
  }

  private handleIfdef(line: string, isIfdef: boolean): void {
    const rest = line.slice(isIfdef ? 7 : 8).trim(); // #ifdef or #ifndef
    const match = rest.match(/^(\w+)/);
    if (match) {
      const defined = this.macros.has(match[1]);
      const shouldSkip = isIfdef ? !defined : defined;
      this.ifStack.push(shouldSkip);
      if (shouldSkip) {
        this.skipBlock = true;
      }
    }
  }

  private handleInclude(line: string): string | null {
    // Parse #include "file" or #include <file>
    const match = line.match(/#include\s+["<](.+?)[">]/);
    if (!match) return null;

    const fileName = match[1];
    const isSystemInclude = line.includes('<');

    // Try to find the file
    const searchPaths = isSystemInclude 
      ? [...this.includePaths, '/home/euxaristia/Projects/pcc/include', '.']
      : ['.', '/home/euxaristia/Projects/pcc/include', ...this.includePaths];

    for (const path of searchPaths) {
      const fullPath = path === '.' 
        ? fileName 
        : `${path}/${fileName}`;
      
      // Skip if already included
      if (this.includedFiles.has(fullPath)) {
        console.error('DEBUG: Skipping already included:', fullPath);
        return '';
      }
      console.error('DEBUG: Including:', fullPath);
      
      try {
        const content = readFileSync(fullPath, 'utf-8');
        
        // Mark as included
        this.includedFiles.add(fullPath);
        
        // Process the included content through the preprocessor
        return this.preprocessInclude(content, fullPath);
      } catch (e) {
        // Try next path
      }
    }

    // Fallback: just comment it out
    return `// Included: ${fileName}`;
  }
  
  private preprocessInclude(source: string, fileName: string): string {
    // Handle backslash line continuations
    let normalized = source.replace(/\\\n/g, '');
    
    // Remove C-style comments /* ... */
    normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Remove C++ style comments //
    normalized = normalized.replace(/\/\/.*$/gm, '');
    
    const lines = normalized.split('\n');
    const output: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip preprocessor directives in included files (they'll be handled when defined)
      // But process actual code and expand macros
      if (trimmed.startsWith('#define')) {
        this.handleDefine(trimmed);
        continue; // Don't output #define lines
      } else if (trimmed.startsWith('#undef')) {
        this.handleUndef(trimmed);
        continue;
      } else if (trimmed.startsWith('#include')) {
        // Recursively include
        const included = this.handleInclude(trimmed);
        if (included) {
          output.push(included);
        }
        continue;
      } else if (trimmed.startsWith('#if') || trimmed.startsWith('#ifdef') || 
                 trimmed.startsWith('#ifndef') || trimmed.startsWith('#elif') ||
                 trimmed.startsWith('#endif') || trimmed.startsWith('#else')) {
        // Skip conditional directives in included files for simplicity
        continue;
      } else if (trimmed.startsWith('#')) {
        // Unknown directive, skip
        continue;
      }
      
      // Regular code - expand macros and output
      const expanded = this.expandMacros(line);
      if (expanded.trim() || output.length > 0) {
        output.push(expanded);
      }
    }
    
    return output.join('\n');
  }

  private expandMacros(line: string): string {
    // Don't expand macros inside macro definitions
    if (line.trim().startsWith('#define')) {
      return line;
    }
    
    let result = line;
    let changed = true;
    let iterations = 0;
    const maxIterations = 10;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      // Replace object-like macros
      for (const [name, macro] of this.macros) {
        if (macro.args) {
          continue; // Skip function-like macros for now
        }

        const regex = new RegExp(`\\b${name}\\b`, 'g');
        if (regex.test(result)) {
          result = result.replace(regex, macro.body);
          changed = true;
        }
      }

      // Handle simple function-like macros: name(args)
      for (const [name, macro] of this.macros) {
        if (!macro.args) continue;
        
        // Match function-like macro invocation: name(args)
        // Use word boundary to prevent partial matches (e.g., likely matching inside unlikely)
        const funcRegex = new RegExp(`\\b${name}\\s*\\(([^)]*)\\)`);
        const match = funcRegex.exec(result);
        if (match) {
          const args = match[1].split(',').map(a => a.trim());
          let body = macro.body;
          
          // Replace arguments in body
          for (let i = 0; i < macro.args.length && i < args.length; i++) {
            const regex = new RegExp(`(?<![a-zA-Z0-9_])${macro.args[i]}(?![a-zA-Z0-9_])`, 'g');
            body = body.replace(regex, args[i]);
          }
          
          // Only replace the first occurrence
          result = result.replace(funcRegex, body);
          changed = true;
        }
      }
    }

    return result;
  }

  getMacros(): Map<string, Macro> {
    return this.macros;
  }
}
