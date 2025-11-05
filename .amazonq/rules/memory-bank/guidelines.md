# Development Guidelines

## Code Quality Standards

### Naming Conventions
- **React Components**: PascalCase (e.g., `Swap`, `ConnectButton`, `FeeModeExplainer`)
- **Files**: Match component names - `Swap.jsx`, `Market.jsx`
- **Variables**: camelCase (e.g., `fromChain`, `tokenIn`, `amountOut`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `BACKEND_URL`, `TOAST_LIMIT`, `PYTH_HERMES_URL`)
- **CSS Classes**: kebab-case with utility prefixes (e.g., `zt-ink`, `zt-violet`, `glass-strong`)
- **API Endpoints**: lowercase with hyphens (e.g., `/api/quote`, `/api/execute`)
- **Python Functions**: snake_case (e.g., `get_quote`, `execute_dex_swap`, `get_working_rpc`)
- **Python Classes**: PascalCase (e.g., `DEXIntegrationService`, `SwapHistory`)

### File Organization
- **Frontend**: Group by feature type (pages/, components/, hooks/, config/, lib/)
- **Backend**: Flat structure with service-oriented files (server.py, dex_integration_service.py)
- **Imports**: Group by external, internal, relative - separated by blank lines
- **Component Structure**: Imports → Constants → Component → Export

### Code Formatting
- **Indentation**: 2 spaces for JavaScript/JSX, 4 spaces for Python
- **Quotes**: Single quotes for JavaScript, double quotes for Python
- **Line Length**: Keep reasonable (no strict limit, but break long lines logically)
- **Trailing Commas**: Use in multi-line arrays/objects
- **Semicolons**: Use consistently in JavaScript

## React Patterns

### Component Structure
```javascript
// 1. Imports (external, then internal)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// 2. Constants outside component
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const chains = [...];

// 3. Component definition
const ComponentName = () => {
  // 4. Hooks (useState, useEffect, custom hooks)
  const navigate = useNavigate();
  const [state, setState] = useState(initial);
  
  // 5. Effects
  useEffect(() => {
    // effect logic
  }, [deps]);
  
  // 6. Event handlers
  const handleAction = async () => {
    // handler logic
  };
  
  // 7. Render
  return (
    <div>...</div>
  );
};

// 8. Export
export default ComponentName;
```

### State Management
- Use `useState` for local component state
- Destructure multiple state values: `const { address, isConnected, chain } = useAccount();`
- Initialize state with appropriate defaults: `useState('')`, `useState(null)`, `useState(false)`
- Use derived state with `useMemo` when needed (though not heavily used in this codebase)

### Event Handlers
- Prefix with `handle`: `handleGetQuote`, `handleExecute`, `handleSwap`
- Use async/await for API calls
- Always wrap in try-catch blocks
- Show user feedback with `toast.success()` or `toast.error()`
- Set loading states before/after async operations

### Error Handling Pattern
```javascript
const handleAction = async () => {
  setLoading(true);
  try {
    const response = await axios.post(url, data);
    if (response.data.success) {
      toast.success('Success message');
    } else {
      toast.error(response.data.reason || 'Fallback error');
    }
  } catch (error) {
    console.error('Action error:', error);
    toast.error('Failed to perform action');
  } finally {
    setLoading(false);
  }
};
```

### Conditional Rendering
- Use ternary for simple conditions: `{loading ? <Loader /> : 'Text'}`
- Use `&&` for single condition: `{isNative && <InfoBanner />}`
- Use early returns for complex conditions
- Use `className` with template literals for dynamic classes

### Data Fetching
- Use `axios` for HTTP requests
- Construct URLs from environment variables: `${BACKEND_URL}/api/endpoint`
- Pass data in request body: `axios.post(url, { intent })`
- Handle both success and error responses
- Use `httpx.AsyncClient()` in Python backend for async requests

## Python Backend Patterns

### FastAPI Structure
```python
# 1. Imports
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, validator
import logging

# 2. Configuration
load_dotenv()
app = FastAPI()
api_router = APIRouter(prefix="/api")

# 3. Models
class RequestModel(BaseModel):
    field: str
    
    @validator('field')
    def validate_field(cls, v):
        # validation logic
        return v

# 4. Routes
@api_router.post("/endpoint")
async def endpoint(request: RequestModel):
    try:
        # logic
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 5. Include router
app.include_router(api_router)
```

### Validation
- Use Pydantic models for request/response validation
- Add `@validator` decorators for custom validation
- Validate addresses with regex: `r'^0x[a-fA-F0-9]{40}$'`
- Validate positive numbers: `if v <= 0: raise ValueError(...)`
- Validate enums: `if v not in ['OPTION1', 'OPTION2']: raise ValueError(...)`

### Error Handling
- Use try-except blocks around risky operations
- Log errors: `logging.error(f"Operation failed: {e}")`
- Return structured error responses: `{"success": False, "error": str(e)}`
- Raise HTTPException for API errors: `raise HTTPException(status_code=400, detail=message)`

### Database Operations
- Check if database is available before operations: `if db is not None:`
- Use async operations: `await db.collection.insert_one(doc)`
- Handle exceptions gracefully with fallbacks
- Convert datetime to ISO format for storage: `doc['timestamp'].isoformat()`

### Web3 Integration
```python
# 1. Initialize Web3
w3 = Web3(Web3.HTTPProvider(rpc_url))

# 2. Check connection
if not w3.is_connected():
    return error

# 3. Create account
account = Account.from_key(private_key)

# 4. Build transaction
tx = contract.functions.method(args).build_transaction({
    'from': account.address,
    'gas': 300000,
    'gasPrice': w3.eth.gas_price,
    'nonce': w3.eth.get_transaction_count(account.address)
})

# 5. Sign and send
signed_tx = w3.eth.account.sign_transaction(tx, private_key)
tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)

# 6. Wait for receipt
receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
```

## Styling Patterns

### Tailwind CSS Usage
- Use custom color variables: `text-zt-paper`, `bg-zt-ink`, `border-zt-violet`
- Use custom glass effects: `glass`, `glass-strong`
- Use custom animations: `hover-glow`, `hover-lift`
- Combine utilities: `flex items-center gap-2`
- Responsive design: `hidden md:block`, `grid-cols-2 lg:grid-cols-3`

### Component Styling
- Container: `max-w-7xl mx-auto px-6 py-12`
- Cards: `glass-strong p-8 rounded-3xl`
- Buttons: `btn-primary`, `btn-secondary` with hover effects
- Inputs: `glass p-4 rounded-xl bg-transparent outline-none`
- Headers: `border-b border-white/10 backdrop-blur-sm`

### Color Palette
- Background: `bg-zt-ink` (#0B0D12)
- Text: `text-zt-paper` (#F5F7FA)
- Primary: `text-zt-violet` (#7A4DFF)
- Accent: `text-zt-aqua` (#44E0C6)
- Opacity variants: `/70`, `/60`, `/50`, `/30`, `/20`, `/10`, `/5`

## Testing Patterns

### Test IDs
- Add `data-testid` to interactive elements
- Format: `{element-type}-{action}-{target}` (e.g., `get-quote-btn`, `token-in-select`)
- Use for buttons: `data-testid="execute-swap-btn"`
- Use for inputs: `data-testid="amount-in-input"`
- Use for selects: `data-testid="from-chain-select"`

## API Design

### Request/Response Format
```javascript
// Request
{
  intent: {
    user: "0x...",
    tokenIn: "ETH",
    amtIn: 0.01,
    tokenOut: "POL",
    minOut: 0.0095,
    dstChainId: 80002,
    feeMode: "INPUT",
    feeCap: 3.0,
    deadline: 1234567890,
    nonce: 1234567890
  }
}

// Response
{
  success: true,
  relayer: "0x...",
  estimatedFee: "0.5",
  feeUSD: "$0.50",
  oracleSource: "Pyth",
  netOut: 205.5,
  reason: null
}
```

### Endpoint Patterns
- Use POST for mutations: `/api/quote`, `/api/execute`
- Use GET for queries: `/api/history`, `/api/stats`
- Return consistent structure: `{ success: boolean, ...data }`
- Include error details: `{ success: false, reason: "error message" }`

## Configuration Management

### Environment Variables
- Frontend: Prefix with `REACT_APP_` (e.g., `REACT_APP_BACKEND_URL`)
- Backend: No prefix (e.g., `MONGO_URL`, `RELAYER_PRIVATE_KEY`)
- Load with `dotenv`: `load_dotenv(ROOT_DIR / '.env')`
- Access: `process.env.REACT_APP_VAR` (JS), `os.getenv('VAR')` (Python)
- Provide defaults: `os.getenv('VAR', 'default_value')`

### Configuration Files
- Token lists: JSON files in `config/` or `src/config/tokenlists/`
- Chain configs: Hardcoded constants in components or config files
- Contract addresses: Environment variables or config files
- RPC URLs: Arrays with fallbacks for reliability

## Logging

### Frontend
- Use `console.error()` for errors before showing toast
- Format: `console.error('Action error:', error);`
- Log important state changes during development

### Backend
- Use Python `logging` module
- Format: `logging.error(f"Operation failed: {e}")`
- Log levels: INFO for normal operations, ERROR for failures
- Configure format: `'%(asctime)s - %(name)s - %(levelname)s - %(message)s'`

## Security Practices

### Input Validation
- Validate all user inputs on both frontend and backend
- Check address format: `re.match(r'^0x[a-fA-F0-9]{40}$', address)`
- Validate numeric ranges: `if amount <= 0 or amount > 1e12:`
- Sanitize before database operations

### CORS Configuration
- Specify allowed origins explicitly
- Use environment variable: `CORS_ORIGINS='http://localhost:3000'`
- Enable credentials: `allow_credentials=True`
- Restrict methods: `allow_methods=["GET", "POST"]`

### Private Key Management
- Never hardcode private keys
- Use environment variables: `os.getenv('RELAYER_PRIVATE_KEY')`
- Check existence before use: `if not self.private_key: return error`
- Never log or expose in responses

## Common Idioms

### Async/Await Pattern
```javascript
// Frontend
const fetchData = async () => {
  try {
    const response = await axios.post(url, data);
    return response.data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

// Backend
async def fetch_data():
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data)
        return response.json()
```

### Conditional Class Names
```javascript
className={`base-class ${
  condition1 ? 'class-a' :
  condition2 ? 'class-b' :
  'class-default'
}`}
```

### Array Mapping
```javascript
{items.map(item => (
  <Component key={item.id} {...item} />
))}
```

### Object Destructuring
```javascript
const { address, isConnected, chain } = useAccount();
const { data, error, loading } = useQuery();
```

### Optional Chaining
```javascript
const value = response.data?.field?.nested || 'default';
const explorerUrl = quote.explorerUrl || '#';
```

## Documentation

### Code Comments
- Use comments sparingly - prefer self-documenting code
- Add comments for complex logic or non-obvious decisions
- Use JSDoc for utility functions
- Add TODO comments for future improvements

### Inline Documentation
```javascript
// CRITICAL: Use backend's netOut for correct price conversion
if (quoteData.netOut !== undefined) {
  setAmountOut(quoteData.netOut.toFixed(6));
}
```

### API Documentation
- Document request/response formats in docstrings
- Example: `"""Get quote with any-token fee mode support"""`
- Include parameter descriptions in Pydantic models
