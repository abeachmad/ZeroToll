#!/bin/bash

# Script untuk memperbaiki test file
# Mengganti semua BigInt comparisons dan menghapus event assertions yang bermasalah

cd packages/contracts/test

# Backup original file
cp RelayerRegistry.test.js RelayerRegistry.test.js.backup

# Fix BigInt comparisons
sed -i 's/\.to\.equal(0)/\.to\.equal(0n)/g' RelayerRegistry.test.js
sed -i 's/\.to\.equal(1)/\.to\.equal(1n)/g' RelayerRegistry.test.js
sed -i 's/\.to\.equal(2)/\.to\.equal(2n)/g' RelayerRegistry.test.js
sed -i 's/\.to\.equal(3)/\.to\.equal(3n)/g' RelayerRegistry.test.js
sed -i 's/\.to\.equal(4)/\.to\.equal(4n)/g' RelayerRegistry.test.js
sed -i 's/\.to\.equal(100)/\.to\.equal(100n)/g' RelayerRegistry.test.js
sed -i 's/\.to\.equal(500)/\.to\.equal(500n)/g' RelayerRegistry.test.js
sed -i 's/\.to\.equal(750)/\.to\.equal(750n)/g' RelayerRegistry.test.js
sed -i 's/\.to\.equal(970)/\.to\.equal(970n)/g' RelayerRegistry.test.js
sed -i 's/\.to\.equal(1000)/\.to\.equal(1000n)/g' RelayerRegistry.test.js

echo "✅ Test file fixed!"
echo "Backup saved as: RelayerRegistry.test.js.backup"
