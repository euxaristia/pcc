#!/usr/bin/env node

/**
 * Alpine Linux Build Environment Setup for ARM64 Cross-Compilation
 * Automatically detects environment and configures appropriate toolchain
 */

const { execSync, spawn } = require('child_process');
const { existsSync, mkdirSync, writeFileSync } = require('fs');

// Environment detection utilities
class BuildEnvironment {
  private env = {};
  
  detectEnvironment() {
    console.log('🔍 Detecting build environment...');
    
    // Detect OS
    try {
      const osRelease = execSync('uname -r', { encoding: 'utf8' }).stdout.toString().trim();
      this.env.osRelease = osRelease;
      this.env.osType = 'Alpine Linux';
      console.log(`✅ OS Detected: ${osRelease}`);
    } catch (error) {
      console.log('⚠️ OS detection failed, assuming Alpine Linux');
      this.env.osType = 'Alpine Linux';
    }
    
    // Detect architecture
    try {
      const arch = execSync('uname -m', { encoding: 'utf8' }).stdout.toString().trim();
      this.env.hostArch = arch;
      console.log(`✅ Host Architecture: ${arch}`);
    } catch (error) {
      this.env.hostArch = 'x86_64';
      console.log('⚠️ Architecture detection failed, assuming x86_64');
    }
    
    // Check for cross-compilation packages
    const crossCompilers = ['aarch64-none-elf-gcc', 'aarch64-none-elf-ld', 'binutils-aarch64-none-elf'];
    const availablePackages = crossCompilers.filter(cmd => {
      try {
        execSync('which ' + cmd, { stdio: 'ignore' });
        return true;
      } catch (error) {
        return false;
      }
    });
    
    console.log(`📦 Cross-compiler status:`, availablePackages);
    
    return this.env;
  }
  
  setupAlpineEnvironment(targetArch = 'arm64') {
    console.log(`🏗 Setting up Alpine Linux environment for ${targetArch} target...`);
    
    try {
      // Check if running as root
      const uid = process.getuid();
      if (uid !== 0) {
        console.log('⚠️ Warning: Should run as root for package installation');
      }
      
      // Add Alpine community repository if not present
      const reposFile = '/etc/apk/repositories';
      if (!existsSync(reposFile)) {
        execSync('echo "https://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories');
      }
      
      // Update package index
      execSync('apk update', { stdio: 'inherit' });
      
      // Install cross-compilation toolchain
      const packages = [
        'build-base',
        'alpine-sdk',
        'alpine-sdk-build-base', 
        'alpine-sdk-dev',
        'aarch64-none-elf-gcc',
        'aarch64-none-elf-ld',
        'binutils-aarch64-none-elf',
        'make',
        'git'
      ];
      
      for (const pkg of packages) {
        console.log(`📦 Installing ${pkg}...`);
        execSync(`apk add ${pkg}`, { stdio: 'inherit' });
      }
      
      // Verify installation
      const verification = packages.every(cmd => {
        try {
          execSync(`which ${cmd}`, { stdio: 'ignore' });
          return true;
        } catch (error) {
          return false;
        }
      });
      
      if (!verification) {
        throw new Error(`Failed to install required packages`);
      }
      
      console.log('✅ Alpine Linux environment setup complete');
      console.log(`🔧 Toolchain ready for ${targetArch} cross-compilation`);
      
      return true;
    } catch (error) {
      console.error('❌ Alpine Linux setup failed:', error.message);
      return false;
    }
  }
  
  generateBuildScript(sourceFile: string, targetArch = 'arm64') {
    const elfFile = sourceFile.replace(/\.c$/, '.o');
    const executable = sourceFile.replace(/\.c$/, '');
    
    return `#!/bin/bash
# Auto-generated build script for pcc - ARM64 Alpine Linux
export CC=aarch64-none-elf-gcc
export CFLAGS="-march=armv8-a -O2 -pipe"
export CROSS_COMPILE=aarch64-none-elf-

echo "🔧 Building ${executable} for ${targetArch}..."
pcc --arch=${targetArch} --output ${elfFile} ${sourceFile}

echo "🔧 Linking ${executable}..."
aarch64-none-elf-ld -o ${executable} ${elfFile} -static

echo "🏗 ARM64 Alpine Linux build complete!"
echo "Generated ${elfFile} (${targetArch} ELF file)"
    `;
  }
}

// Main setup routine
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node setup-alpine-arm64.js [detect|setup]');
    process.exit(1);
  }
  
  const command = args[0];
  const env = new BuildEnvironment();
  
  try {
    const detected = env.detectEnvironment();
    console.log(`📊 Environment detected:`, detected);
    
    if (command === 'detect') {
      console.log('🔍 Environment Detection Results:');
      console.log(`  OS Type: ${detected.osType}`);
      console.log(`  OS Release: ${detected.osRelease}`);
      console.log(`  Host Architecture: ${detected.hostArch}`);
      return;
    }
    
    if (command === 'setup') {
      console.log('🏗 Setting up Alpine Linux environment...');
      const success = env.setupAlpineEnvironment('arm64');
      
      if (success) {
        console.log('✅ Alpine Linux ARM64 environment ready');
        console.log('🔧 Use: pcc --arch=arm64 source.c --output program');
        console.log('🔧 Available targets: arm64, aarch64, armv8-a, armv8');
      } else {
        console.error('❌ Alpine Linux setup failed');
        process.exit(1);
      }
      
      return;
    }
    
    console.log('❌ Unknown command:', command);
    console.log('Available commands: detect, setup');
    process.exit(1);
  } catch (error) {
    console.error('❌ Setup script failed:', error.message);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  main();
}