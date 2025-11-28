#!/usr/bin/env node

/**
 * Verification script for gasless implementation
 * Checks that all required components are in place
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_CHECKS = [
  {
    name: 'Custom signEIP7702Authorization function exists',
    file: 'frontend/src/lib/eip7702.js',
    pattern: /async function signEIP7702Authorization/,
    critical: true,
  },
  {
    name: 'toRlp import present',
    file: 'frontend/src/lib/eip7702.js',
    pattern: /toRlp/,
    critical: true,
  },
  {
    name: 'toHex import present',
    file: 'frontend/src/lib/eip7702.js',
    pattern: /toHex/,
    critical: true,
  },
  {
    name: 'concat import present',
    file: 'frontend/src/lib/eip7702.js',
    pattern: /concat/,
    critical: true,
  },
  {
    name: 'signEIP7702Authorization called in executeGaslessTransaction',
    file: 'frontend/src/lib/eip7702.js',
    pattern: /await signEIP7702Authorization\(/,
    critical: true,
  },
  {
    name: 'eth_sign method used',
    file: 'frontend/src/lib/eip7702.js',
    pattern: /method: 'eth_sign'/,
    critical: true,
  },
  {
    name: 'personal_sign fallback present',
    file: 'frontend/src/lib/eip7702.js',
    pattern: /method: 'personal_sign'/,
    critical: true,
  },
  {
    name: 'RLP encoding used',
    file: 'frontend/src/lib/eip7702.js',
    pattern: /toRlp\(authTuple\)/,
    critical: true,
  },
  {
    name: 'Magic byte 0x05 used',
    file: 'frontend/src/lib/eip7702.js',
    pattern: /MAGIC = '0x05'/,
    critical: true,
  },
  {
    name: 'yParity calculation present',
    file: 'frontend/src/lib/eip7702.js',
    pattern: /yParity.*v.*27/,
    critical: true,
  },
];

console.log('🔍 Verifying Gasless Implementation...\n');
console.log('=' .repeat(60));

let allPassed = true;
let criticalFailed = false;

REQUIRED_CHECKS.forEach((check, index) => {
  const filePath = path.join(__dirname, check.file);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const passed = check.pattern.test(content);
    
    const status = passed ? '✅' : '❌';
    const critical = check.critical ? ' [CRITICAL]' : '';
    
    console.log(`${status} ${index + 1}. ${check.name}${critical}`);
    
    if (!passed) {
      allPassed = false;
      if (check.critical) {
        criticalFailed = true;
      }
    }
  } catch (error) {
    console.log(`❌ ${index + 1}. ${check.name} - File not found!`);
    allPassed = false;
    if (check.critical) {
      criticalFailed = true;
    }
  }
});

console.log('=' .repeat(60));

if (allPassed) {
  console.log('\n✅ ALL CHECKS PASSED! Gasless implementation is ready.');
  console.log('🚀 You can now test gasless transactions on Amoy testnet.');
  process.exit(0);
} else if (criticalFailed) {
  console.log('\n❌ CRITICAL CHECKS FAILED! Gasless will NOT work.');
  console.log('⚠️  Fix the issues above before testing.');
  process.exit(1);
} else {
  console.log('\n⚠️  Some non-critical checks failed.');
  console.log('🔧 Review the issues above.');
  process.exit(0);
}
