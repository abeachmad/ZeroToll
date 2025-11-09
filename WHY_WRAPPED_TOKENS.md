# 🤔 Kenapa Pakai WETH/WPOL Instead of Native ETH/POL?

**Pertanyaan Bagus!** Mari saya jelaskan secara detail kenapa wrapped tokens lebih baik.

---

## 📊 **FAKTANYA: Pyth Punya Price Feed untuk Native Token**

```javascript
// Pyth Network price feeds
priceIds: {
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'POL/USD': '0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472',
}

// Contoh query:
const ethPrice = await pythOracle.getPrice(ETH_USD_FEED);
// Result: $3402.07 ✅
```

**Jadi kenapa tidak pakai native langsung?** 🤔

---

## ❌ **MASALAH DENGAN NATIVE TOKEN**

### **1. Native Token BUKAN ERC20** 

```solidity
// ❌ TIDAK BISA - Native ETH tidak punya interface ERC20
IERC20(address(0)).transfer(recipient, amount);  // Error!
IERC20(address(0)).approve(router, amount);      // Error!
IERC20(address(0)).balanceOf(user);              // Error!

// ✅ BISA - WETH adalah ERC20 standar
IERC20(WETH).transfer(recipient, amount);        // OK ✅
IERC20(WETH).approve(router, amount);            // OK ✅
IERC20(WETH).balanceOf(user);                    // OK ✅
```

**Implikasi:**
- Router/Adapter harus handle 2 case berbeda (native vs ERC20)
- Approval mechanism tidak work untuk native
- Transfer logic berbeda (call vs transferFrom)

---

### **2. Smart Contract Complexity**

#### **Dengan Native Token (Complex ❌):**
```solidity
function swap(address tokenIn, address tokenOut, uint256 amountIn) external payable {
    if (tokenIn == address(0)) {
        // Case 1: Native ETH sebagai input
        require(msg.value == amountIn, "Wrong ETH amount");
        // Tidak bisa pull dari user, harus kirim via msg.value
        
    } else {
        // Case 2: ERC20 sebagai input
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        require(msg.value == 0, "Don't send ETH");
    }
    
    // Calculate output...
    
    if (tokenOut == address(0)) {
        // Case 3: Native ETH sebagai output
        (bool success, ) = recipient.call{value: amountOut}("");
        require(success, "ETH transfer failed");
        
    } else {
        // Case 4: ERC20 sebagai output
        IERC20(tokenOut).safeTransfer(recipient, amountOut);
    }
}
```

**Masalah:**
- 4 different code paths (2x2 combinations)
- Lebih banyak bug potential
- Gas lebih mahal (if-else branching)
- Harder to test (need to test all combinations)

#### **Dengan Wrapped Token (Simple ✅):**
```solidity
function swap(address tokenIn, address tokenOut, uint256 amountIn) external {
    // ✅ SIMPLE - Always ERC20
    IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
    
    // Calculate output...
    
    IERC20(tokenOut).safeTransfer(recipient, amountOut);
}

// ✅ Hanya 1 code path
// ✅ Lebih simple, less bugs
// ✅ Gas efficient
// ✅ Easy to test
```

---

### **3. Approval Mechanism**

```javascript
// ❌ NATIVE - User tidak bisa approve native ETH
// User harus kirim exact amount via transaction
const tx = await router.swap(ETH, USDC, amount, {
  value: amount  // ⚠️ Harus kirim langsung
});

// Problem: Bagaimana jika swap gagal? ETH sudah terkirim!
```

```javascript
// ✅ WRAPPED - User approve dulu, swap kemudian
await weth.approve(router, amount);  // Step 1: Approve
await router.swap(WETH, USDC, amount);  // Step 2: Swap

// ✅ Jika swap gagal, WETH tidak terkirim (safer!)
// ✅ User bisa approve unlimited (better UX)
```

---

### **4. DeFi Composability**

```solidity
// ❌ NATIVE - Tidak kompatibel dengan DEX
Uniswap.swap(address(0), USDC, amount);  // Error! Uniswap tidak terima native

// ✅ WRAPPED - Kompatibel dengan semua DEX
Uniswap.swap(WETH, USDC, amount);  // OK ✅
SushiSwap.swap(WETH, DAI, amount);  // OK ✅
Curve.exchange(WETH, USDT, amount);  // OK ✅
```

**SEMUA DEX menggunakan WETH/WPOL, bukan native!** Ini standard industri.

---

### **5. Atomic Swaps & Flash Loans**

```solidity
// ❌ NATIVE - Tidak bisa atomic multi-step
function complexStrategy() external payable {
    // Step 1: Swap ETH → USDC (kirim ETH)
    router.swap{value: 1 ether}(ETH, USDC, 1 ether);
    
    // Step 2: Swap USDC → DAI (tidak ada ETH lagi!)
    // ❌ Masalah: ETH sudah terkirim di step 1, tidak bisa rollback
}

// ✅ WRAPPED - Bisa atomic multi-step
function complexStrategy() external {
    weth.approve(router, type(uint256).max);  // Approve once
    
    // Step 1: Swap WETH → USDC
    router.swap(WETH, USDC, 1 ether);
    
    // Step 2: Swap USDC → DAI
    router.swap(USDC, DAI, amount);
    
    // ✅ Semua atomic, bisa rollback jika gagal
}
```

---

## ✅ **KEUNTUNGAN WRAPPED TOKENS**

### **1. Standardisasi (ERC20)**
```solidity
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

// ✅ WETH/WPOL implement full ERC20 interface
// ✅ Work dengan semua tools/libraries (OpenZeppelin, etc.)
// ✅ Compatible dengan semua DEX
```

### **2. Gas Efficiency**
```solidity
// Native: 4 code paths = More gas
if (tokenIn == address(0)) { ... } 
else if (tokenOut == address(0)) { ... }

// Wrapped: 1 code path = Less gas
IERC20(tokenIn).transferFrom(...);  // Always same
```

### **3. Safety**
```javascript
// Native: Funds sent immediately (risky)
router.swap{value: 1 ether}(ETH, USDC, ...);
// ⚠️ ETH already sent, swap might fail!

// Wrapped: Approve first, transfer only if success
await weth.approve(router, amount);
await router.swap(WETH, USDC, ...);
// ✅ WETH only transferred if swap succeeds
```

### **4. Better UX**
```javascript
// Native: User harus tahu exact amount di-advance
const tx = await swap({value: exactAmount});

// Wrapped: User approve once, swap many times
await weth.approve(router, UNLIMITED);
await router.swap(WETH, USDC, 1);   // Swap 1
await router.swap(WETH, DAI, 2);    // Swap 2
await router.swap(WETH, LINK, 3);   // Swap 3
// ✅ No need multiple approvals
```

---

## 🔄 **WRAPPING IS TRIVIAL**

### **User Experience:**
```javascript
// Frontend automatically wraps/unwraps
async function swapNativeToToken(amountETH) {
    // 1. Wrap ETH → WETH (1 transaction)
    await weth.deposit({value: amountETH});
    
    // 2. Approve WETH
    await weth.approve(router, amountETH);
    
    // 3. Swap WETH → USDC
    await router.swap(WETH, USDC, amountETH);
    
    // Total: 3 steps (can batch 2+3 into 1)
}

async function swapTokenToNative(amountUSDC) {
    // 1. Swap USDC → WETH
    await router.swap(USDC, WETH, amountUSDC);
    
    // 2. Unwrap WETH → ETH (1 transaction)
    await weth.withdraw(amountWETH);
    
    // Total: 2 steps
}
```

**Frontend dapat auto-handle wrapping!** User tidak perlu tahu detail teknis.

---

## 📊 **REAL WORLD EXAMPLE**

### **Uniswap V2/V3:**
```solidity
// Uniswap TIDAK menerima native ETH
// Semua pair menggunakan WETH

// Pair addresses:
WETH/USDC: 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640
WETH/DAI:  0x60594a405d53811d3BC4766596EFD80fd545A270
WETH/USDT: 0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36

// ✅ Semua pakai WETH, bukan ETH
```

### **SushiSwap:**
```solidity
// Same - semua pair pakai WETH
WETH/USDC: 0x397FF1542f962076d0BFE58eA045FfA2d347ACa0
```

### **Curve:**
```solidity
// Same - even stablecoin pools pakai WETH untuk ETH exposure
```

**Kesimpulan: ENTIRE DeFi ecosystem pakai wrapped tokens!**

---

## 🎯 **IMPLEMENTASI ZEROTOLL**

### **Current Design (Correct ✅):**
```javascript
// Tokens traded
const tokens = {
    sepolia: {
        WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',  // ✅ Wrapped
        USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
    },
    amoy: {
        WPOL: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9',  // ✅ Wrapped
        USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582'
    }
};

// Oracle price feeds
const priceIds = {
    'ETH/USD': '0xff61491a...',  // ✅ Pyth feed available
    'POL/USD': '0xffd11c5a...',  // ✅ Pyth feed available
};

// Contract usage
await oracle.setPriceIds([WETH], [ETH_USD_FEED]);
// ✅ WETH price = ETH price (1:1 peg)
```

### **Alternative Design (Complex ❌):**
```solidity
// Jika pakai native
function swap(address tokenIn, address tokenOut, uint256 amountIn) 
    external payable 
{
    if (tokenIn == address(0)) {
        require(msg.value == amountIn, "ETH mismatch");
        // Handle native input
    } else if (tokenOut == address(0)) {
        // Handle native output
        (bool success, ) = msg.sender.call{value: amountOut}("");
        require(success);
    } else {
        // Handle ERC20
    }
}

// ❌ More code
// ❌ More bugs
// ❌ Harder to maintain
```

---

## 💡 **KESIMPULAN**

### **Kenapa WETH/WPOL, bukan ETH/POL:**

1. ✅ **ERC20 Standard** - Compatible dengan semua DeFi protocols
2. ✅ **Simpler Code** - 1 code path instead of 4
3. ✅ **Safer** - Approval mechanism prevents loss
4. ✅ **Gas Efficient** - Less branching = cheaper
5. ✅ **Industry Standard** - Semua DEX pakai wrapped
6. ✅ **Same Price** - WETH = ETH (1:1 peg via Pyth)
7. ✅ **Better UX** - Approve once, swap many times

### **WETH/WPOL price = ETH/POL price:**

```javascript
// Pyth Oracle
const ethPrice = await oracle.getPrice(ETH_USD_FEED);   // $3402.07
const wethPrice = await oracle.getPrice(WETH_ADDRESS);  // $3402.07

// ✅ SAMA! WETH is just wrapped ETH (1:1 convertible)
```

### **User Experience:**

```
User sees: "Swap ETH → USDC"

Backend does:
1. Wrap ETH → WETH (automatic)
2. Swap WETH → USDC (using WETH price = ETH price)
3. (Optional) Unwrap if user wants native back

✅ User tidak perlu tahu WETH exists
✅ Frontend handle wrapping seamlessly
✅ Contract tetap simple & safe
```

---

## 🚀 **RECOMMENDATION**

**KEEP USING WRAPPED TOKENS!** Ini bukan kekurangan, tapi **best practice industry standard**.

**Alternative (if you insist on native):**
```solidity
// Add wrapper layer
function swapNative(address tokenOut, uint256 minOut) external payable {
    // 1. Wrap native → WETH
    IWETH(WETH).deposit{value: msg.value}();
    
    // 2. Call main swap function
    swap(WETH, tokenOut, msg.value, minOut, msg.sender, deadline);
}

// ✅ Best of both worlds:
// - Users can send native ETH
// - Contract internally uses WETH (safer)
```

**Tapi ini OPTIONAL!** Current design sudah optimal. 🎯
