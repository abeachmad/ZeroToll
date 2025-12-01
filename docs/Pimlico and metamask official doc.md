have you learn this ofc pimlico docs:

https://docs.pimlico.io/guides/how-to/accounts/use-metamask-account

How to use MetaMask Smart Accounts with permissionless.js

MetaMask maintains their own in-house SDK built closely on top of viem that you can use for the account system while still plugging in all the other components from permissionless.js. Take a look at their documentation for more information.

The MetaMask Delegation Toolkit is a collection of tools for creating MetaMask Smart Accounts. A smart account can delegate to another signer with granular permission sharing. It is built over ERC-7710 and ERC-7715 to support a standardized minimal interface. Requesting ERC-7715 permissions and redeeming ERC-7710 delegations are experimental features.

There are two types of accounts involved in delegation:

Delegator account: A smart account that supports programmable account behavior and advanced features such as multi-signature approvals, automated transaction batching, and custom security policies.

Delegate account: An account (smart account or EOA) that receives the delegation from the delegator account to perform actions on behalf of the delegator account.

You can use both accounts with permissionless.js.

Installation

We will be using MetaMask's official SDK to create a smart account.

npm

yarn

pnpm

bun

npm install permissionless viem @metamask/delegation-toolkit

Delegator Account

Create the clients

First we must create the public, (optionally) pimlico paymaster clients that will be used to interact with the MetaMask smart account.

export const publicClient = createPublicClient({

	transport: http("https://sepolia.rpc.thirdweb.com"),

});

 

export const paymasterClient = createPimlicoClient({

	transport: http("https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY"),

	entryPoint: {

		address: entryPoint07Address,

		version: "0.7",

	},

});

Create the signer

MetaMask Smart Accounts can work with a variety of signing algorithms such as ECDSA, passkeys, and multisig.

For example, to create a signer based on a private key:

import { privateKeyToAccount } from "viem/accounts";

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { entryPoint07Address } from "viem/account-abstraction";

 

const owner = privateKeyToAccount("0xPRIVATE_KEY");

Create the delegator smart account

For a full list of options for creating a MetaMask smart account, take a look at the MetaMask's documentation page for toMetaMaskSmartAccount.

With a signer, you can create a MetaMask smart account as such:

import {

	Implementation,

	toMetaMaskSmartAccount,

} from "@metamask/delegation-toolkit";

 

const delegatorSmartAccount = await toMetaMaskSmartAccount({

	client: publicClient,

	implementation: Implementation.Hybrid,

	deployParams: [owner.address, [], [], []],

	deploySalt: "0x",

	signatory: { account: owner },

});

 

Create the smart account client

const smartAccountClient = createSmartAccountClient({

	account: delegatorSmartAccount,

	chain: sepolia,

	paymaster: paymasterClient,

	bundlerTransport: http(

		"https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY",

	),

	userOperation: {

		estimateFeesPerGas: async () =>

			(await paymasterClient.getUserOperationGasPrice()).fast,

	},

});

Send a transaction

Transactions using permissionless.js simply wrap around user operations. This means you can switch to permissionless.js from your existing viem EOA codebase with minimal-to-no changes.

const txHash = await smartAccountClient.sendTransaction({

	to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",

	value: parseEther("0.1"),

});

This also means you can also use viem Contract instances to transact without any modifications.

const nftContract = getContract({

	address: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",

	abi: tokenAbi,

	client: {

		public: publicClient,

		wallet: smartAccountClient,

	},

});

 

const txHash = await nftContract.write.mint([

	"0x_MY_ADDRESS_TO_MINT_TOKENS",

	parseEther("1"),

]);

You can also send an array of transactions in a single batch.

const userOpHash = await smartAccountClient.sendUserOperation({

	calls: [

		{

			to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",

			value: parseEther("0.1"),

			data: "0x",

		},

		{

			to: "0x1440ec793aE50fA046B95bFeCa5aF475b6003f9e",

			value: parseEther("0.1"),

			data: "0x1234",

		},

	],

});

Delegate Account

A delegate account is an account that receives the delegation from the delegator account to perform actions on behalf of the delegator account. To create a delegate account, we will follow the following steps:

Create a delegate signer

Create the delegate smart account

Create a delegation using delegator smart account

Sign the delegation

Send transactions using delegate smart account with signed delegation

Create the clients

First we must create the public, (optionally) pimlico paymaster clients that will be used to interact with the MetaMask smart account.

export const publicClient = createPublicClient({

	transport: http("https://sepolia.rpc.thirdweb.com"),

});

 

export const paymasterClient = createPimlicoClient({

	transport: http("https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY"),

	entryPoint: {

		address: entryPoint07Address,

		version: "0.7",

	},

});

Create the signer

MetaMask Smart Accounts can work with a variety of signing algorithms such as ECDSA, passkeys, and multisig.

For example, to create a signer based on a private key:

const delegateSigner = privateKeyToAccount("0xPRIVATE_KEY");

Create the delegate smart account

For a full list of options for creating a MetaMask smart account, take a look at the MetaMask's documentation page for toMetaMaskSmartAccount.

With a delegate signer, you can create a MetaMask delegate account as such:

const delegateSmartAccount = await toMetaMaskSmartAccount({

	client: publicClient,

	implementation: Implementation.Hybrid,

	deployParams: [delegateSigner.address, [], [], []],

	deploySalt: "0x",

	signatory: { account: delegateSigner },

});

Create a delegation

This example passes an empty caveats array, which means the delegate can perform any action on the delegator's behalf. We recommend restricting the delegation by adding caveat enforcers.

import { createDelegation } from "@metamask/delegation-toolkit";

 

const delegation = createDelegation({

	to: delegateSmartAccount.address,

	from: delegatorSmartAccount.address,

	caveats: [],

});

Sign the delegation

const signature = await delegatorSmartAccount.signDelegation({

	delegation,

});

 

const signedDelegation = {

	...delegation,

	signature,

};

Create the smart account client

const delegateSmartAccountClient = createSmartAccountClient({

	account: delegateSmartAccount,

	chain: sepolia,

	paymaster: paymasterClient,

	bundlerTransport: http(

		"https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY",

	),

	userOperation: {

		estimateFeesPerGas: async () =>

			(await paymasterClient.getUserOperationGasPrice()).fast,

	},

});

Send transactions using signed delegation

import { DelegationManager } from "@metamask/delegation-toolkit/contracts";

import { SINGLE_DEFAULT_MODE } from "@metamask/delegation-toolkit/utils";

import { createExecution } from "@metamask/delegation-toolkit";

 

const delegations = [signedDelegation];

 

// Actual execution to be performed by the delegate account

const executions = [

	createExecution({

		target: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",

		callData: encodeFunctionData({

			abi: tokenAbi,

			functionName: "mint",

			args: ["0x_MY_ADDRESS_TO_MINT_TOKENS", parseEther("1")],

		}),

	}),

];

 

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({

	delegations: [delegations],

	modes: [SINGLE_DEFAULT_MODE],

	executions: [executions],

});

 

const txHash = await delegateSmartAccountClient.sendTransaction({

	calls: [

		{

			to: delegateSmartAccount.address,

			data: redeemDelegationCalldata,

		},

	],

});

have you also learn from metamask ofc docs:

# Configure the Smart Accounts Kit

The Smart Accounts Kit is highly configurable, providing support for custom [bundlers and paymasters](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/#configure-the-bundler).

You can also configure the [toolkit environment](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/#optional-configure-the-toolkit-environment) to interact with the [Delegation Framework](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-framework).

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Configure the bundler​

The toolkit uses Viem's Account Abstraction API to configure custom bundlers and paymasters.

This provides a robust and flexible foundation for creating and managing [MetaMask Smart Accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/).

See Viem's [account abstraction documentation](https://viem.sh/account-abstraction) for more information on the API's features, methods, and best practices.

To use the bundler and paymaster clients with the toolkit, create instances of these clients and configure them as follows:

```

import {

  createPaymasterClient,

  createBundlerClient,

} from "viem/account-abstraction";

import { http } from "viem";

import { sepolia as chain } from "viem/chains"; 

// Replace these URLs with your actual bundler and paymaster endpoints.

const bundlerUrl = "https://your-bundler-url.com";

const paymasterUrl = "https://your-paymaster-url.com";

// The paymaster is optional.

const paymasterClient = createPaymasterClient({

  transport: http(paymasterUrl),

});

const bundlerClient = createBundlerClient({

  transport: http(bundlerUrl),

  paymaster: paymasterClient,

  chain,

});

```

Replace the bundler and paymaster URLs with your bundler and paymaster endpoints.

For example, you can use endpoints from [Pimlico](https://docs.pimlico.io/references/bundler), [Infura](https://docs.metamask.io/services/), or [ZeroDev](https://docs.zerodev.app/meta-infra/intro).

Providing a paymaster is optional when configuring your bundler client. However, if you choose not to use a paymaster, the smart contract account must have enough funds to pay gas fees.

## (Optional) Configure the toolkit environment​

The toolkit environment (`SmartAccountsEnvironment`) defines the contract addresses necessary for interacting with the [Delegation Framework](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-framework) on a specific network.

It serves several key purposes:

- It provides a centralized configuration for all the contract addresses required by the Delegation Framework.

- It enables easy switching between different networks (for example, Mainnet and testnet) or custom deployments.

- It ensures consistency across different parts of the application that interact with the Delegation Framework.

### Resolve the environment​

When you create a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/), the toolkit automatically

resolves the environment based on the version it requires and the chain configured.

If no environment is found for the specified chain, it throws an error.

```

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { delegatorSmartAccount } from "./config.ts";

const environment: SmartAccountsEnvironment = delegatorSmartAccount.environment; 

```

See the changelog of the toolkit version you are using (in the left sidebar) for supported chains.

Alternatively, you can use the [getSmartAccountsEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#getsmartaccountsenvironment) function to resolve the environment.

This function is especially useful if your delegator is not a smart account when

creating a [redelegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-types).

```

import { 

  getSmartAccountsEnvironment, 

  SmartAccountsEnvironment, 

} from "@metamask/smart-accounts-kit"; 

// Resolves the SmartAccountsEnvironment for Sepolia

const environment: SmartAccountsEnvironment = getSmartAccountsEnvironment(11155111);

```

### Deploy a custom environment​

You can deploy the contracts using any method, but the toolkit provides a convenient [deployDelegatorEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#deploydelegatorenvironment) function. This function simplifies deploying the Delegation Framework contracts to your desired EVM chain.

This function requires a Viem [Public Client](https://viem.sh/docs/clients/public), [Wallet Client](https://viem.sh/docs/clients/wallet), and [Chain](https://viem.sh/docs/glossary/types#chain)

to deploy the contracts and resolve the `SmartAccountsEnvironment`.

Your wallet must have a sufficient native token balance to deploy the contracts.

```

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { deployDeleGatorEnvironment } from "@metamask/smart-accounts-kit/utils";

const environment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain

);

```

You can also override specific contracts when calling `deployDelegatorEnvironment`.

For example, if you've already deployed the `EntryPoint` contract on the target chain, you can pass the contract address to the function.

```

// The config.ts is the same as in the previous example.

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { deployDeleGatorEnvironment } from "@metamask/smart-accounts-kit/utils";

const environment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain,

+ {

+   EntryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032"

+ }

);

```

Once the contracts are deployed, you can use them to override the environment.

### Override the environment​

To override the environment, the toolkit provides an [overrideDeployedEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#overridedeployedenvironment) function to resolve

`SmartAccountsEnvironment` with specified contracts for the given chain and contract version.

```

// The config.ts is the same as in the previous example.

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { 

  overrideDeployedEnvironment,

  deployDeleGatorEnvironment 

} from "@metamask/smart-accounts-kit";

const environment: SmartAccountsEnvironment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain

);

overrideDeployedEnvironment(

  chain.id,

  "1.3.0",

  environment,

);

```

If you've already deployed the contracts using a different method, you can create a `DelegatorEnvironment` instance with the required contract addresses, and pass it to the function.

```

- import { walletClient, publicClient } from "./config.ts";

- import { sepolia as chain } from "viem/chains";

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { 

  overrideDeployedEnvironment,

- deployDeleGatorEnvironment

} from "@metamask/smart-accounts-kit";

- const environment: SmartAccountsEnvironment = await deployDeleGatorEnvironment(

-  walletClient, 

-  publicClient, 

-  chain

- );

+ const environment: SmartAccountsEnvironment = {

+  SimpleFactory: "0x124..",

+  // ...

+  implementations: {

+    // ...

+  },

+ };

overrideDeployedEnvironment(

  chain.id,

  "1.3.0",

  environment

);

```

Make sure to specify the Delegation Framework version required by the toolkit.

See the changelog of the toolkit version you are using (in the left sidebar) for its required Framework version.

# Create a smart account

You can enable users to create a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) directly in your dapp.

This page provides examples of using [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) with Viem Core SDK to create different types of smart accounts with different signature schemes.

An account's supported *signatories* can sign data on behalf of the smart account.

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Create a Hybrid smart account​

A Hybrid smart account supports both an externally owned account (EOA) owner and any number of passkey (WebAuthn) signers.

You can create a Hybrid smart account with the following types of signers.

### Create a Hybrid smart account with an Account signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount), and Viem's [privateKeyToAccount and generatePrivateKey](https://viem.sh/docs/accounts/local/privateKeyToAccount), to create a Hybrid smart account with a signer from a randomly generated private key:

```

import { publicClient } from "./client.ts"

import { account } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [account.address, [], [], []],

  deploySalt: "0x",

  signer: { account },

});

```

### Create a Hybrid smart account with a Wallet Client signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) to create a Hybrid smart account with a Wallet Client signer:

```

import { publicClient } from "./client.ts"

import { walletClient } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const addresses = await walletClient.getAddresses();

const owner = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [owner, [], [], []],

  deploySalt: "0x",

  signer: { walletClient },

});

```

### Create a Hybrid smart account with a passkey signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [toWebAuthnAccount](https://viem.sh/account-abstraction/accounts/webauthn) to create a Hybrid smart account with a passkey (WebAuthn) signer:

To work with WebAuthn, install the [Ox SDK](https://oxlib.sh/).

```

import { publicClient } from "./client.ts"

import { webAuthnAccount, credential } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

import { Address, PublicKey } from "ox";

import { toHex } from "viem";

// Deserialize compressed public key

const publicKey = PublicKey.fromHex(credential.publicKey);

// Convert public key to address

const owner = Address.fromPublicKey(publicKey);

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [owner, [toHex(credential.id)], [publicKey.x], [publicKey.y]],

  deploySalt: "0x",

  signer: { webAuthnAccount, keyId: toHex(credential.id) },

});

```

## Create a Multisig smart account​

A [Multisig smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#multisig-smart-account) supports multiple EOA signers with a configurable threshold for execution.

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) to create a Multsig smart account with a combination of account signers and Wallet Client signers:

```

import { publicClient } from "./client.ts";

import { account, walletClient } from "./signers.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const owners = [ account.address, walletClient.address ];

const signer = [ { account }, { walletClient } ];

const threshold = 2n

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.MultiSig,

  deployParams: [owners, threshold],

  deploySalt: "0x",

  signer,

});

```

The number of signers in the signatories must be at least equal to the threshold for valid signature generation.

## Create a Stateless 7702 smart account​

A [Stateless 7702 smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#stateless-7702-smart-account) represents an EOA that has been upgraded to support MetaMask Smart Accounts

functionality as defined by [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702).

This implementation does not handle the upgrade process; see the [EIP-7702 quickstart](https://docs.metamask.io/smart-accounts-kit/get-started/smart-account-quickstart/eip7702/) to learn how to upgrade.

You can create a Stateless 7702 smart account with the following types of signatories.

### Create a Stateless 7702 smart account with an account signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [privateKeyToAccount](https://viem.sh/docs/accounts/local/privateKeyToAccount) to create a Stateless 7702 smart account with a signer from a private key:

```

import { publicClient } from "./client.ts";

import { account } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Stateless7702,

  address: account.address // Address of the upgraded EOA

  signer: { account },

});

```

### Create a Stateless 7702 smart account with a Wallet Client signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) to create a Stateless 7702 smart account with a Wallet Client signer:

```

import { publicClient } from "./client.ts";

import { walletClient } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const addresses = await walletClient.getAddresses();

const address = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Stateless7702,

  address, // Address of the upgraded EOA

  signer: { walletClient },

});

```

## Next steps​

With a MetaMask smart account, you can perform the following functions:

- In conjunction with [Viem Account Abstraction clients](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/), [deploy the smart account](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/deploy-smart-account/)

and [send user operations](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-user-operation/).

- [Create delegations](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/) that can be used to grant specific rights and permissions to other accounts.

Smart accounts that create delegations are called *delegator accounts*.

# Deploy a smart account

You can deploy MetaMask Smart Accounts in two different ways. You can either deploy a smart account automatically when sending

the first user operation, or manually deploy the account.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Deploy with the first user operation​

When you send the first user operation from a smart account, the Smart Accounts Kit checks whether the account is already deployed. If the account

is not deployed, the toolkit adds the `initCode` to the user operation to deploy the account within the

same operation. Internally, the `initCode` is encoded using the `factory` and `factoryData`.

```

import { bundlerClient, smartAccount } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001"),

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas

});

```

## Deploy manually​

To deploy a smart account manually, call the [getFactoryArgs](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#getfactoryargs)

method from the smart account to retrieve the `factory` and `factoryData`. This allows you to use a relay account to sponsor the deployment without needing a paymaster.

The `factory` represents the contract address responsible for deploying the smart account, while `factoryData` contains the

calldata that will be executed by the `factory` to deploy the smart account.

The relay account can be either an externally owned account (EOA) or another smart account. This example uses an EOA.

```

import { walletClient, smartAccount } from "./config.ts";

const { factory, factoryData } = await smartAccount.getFactoryArgs();

// Deploy smart account using relay account.

const hash = await walletClient.sendTransaction({

  to: factory,

  data: factoryData,

})

```

## Next steps​

- Learn more about [sending user operations](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-user-operation/).

- To sponsor gas for end users, see how to [send a gasless transaction](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-gasless-transaction/).

# Send a user operation

User operations are the [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) counterpart to traditional blockchain transactions.

They incorporate significant enhancements that improve user experience and provide greater

flexibility in account management and transaction execution.

Viem's Account Abstraction API allows a developer to specify an array of `Calls` that will be executed as a user operation via Viem's [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation) method.

The MetaMask Smart Accounts Kit encodes and executes the provided calls.

User operations are not directly sent to the network.

Instead, they are sent to a bundler, which validates, optimizes, and aggregates them before network submission.

See [Viem's Bundler Client](https://viem.sh/account-abstraction/clients/bundler) for details on how to interact with the bundler.

If a user operation is sent from a MetaMask smart account that has not been deployed, the toolkit configures the user operation to automatically deploy the account.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Send a user operation​

The following is a simplified example of sending a user operation using Viem Core SDK. Viem Core SDK offers more granular control for developers who require it.

In the example, a user operation is created with the necessary gas limits.

This user operation is passed to a bundler instance, and the `EntryPoint` address is retrieved from the client.

```

import { bundlerClient, smartAccount } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001")

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas

});

```

### Estimate fee per gas​

Different bundlers have different ways to estimate `maxFeePerGas` and `maxPriorityFeePerGas`, and can reject requests with insufficient values.

The following example updates the previous example to estimate the fees.

This example uses constant values, but the [Hello Gator example](https://github.com/MetaMask/hello-gator) uses Pimlico's Alto bundler,

which fetches user operation gas price using the RPC method [pimlico_getUserOperationPrice](https://docs.pimlico.io/infra/bundler/endpoints/pimlico_getUserOperationGasPrice).

To estimate the gas fee for Pimlico's bundler, install the [permissionless.js SDK](https://docs.pimlico.io/references/permissionless/).

```

+ import { createPimlicoClient } from "permissionless/clients/pimlico";

import { parseEther } from "viem";

import { bundlerClient, smartAccount } from "./config.ts" // The config.ts is the same as in the previous example.

- const maxFeePerGas = 1n;

- const maxPriorityFeePerGas = 1n;

+ const pimlicoClient = createPimlicoClient({

+   transport: http("https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>"), // You can get the API Key from the Pimlico dashboard.

+ });

+

+ const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("1")

    }

  ],

-  maxFeePerGas,

-  maxPriorityFeePerGas

+  ...fee

});

```

### Wait for the transaction receipt​

After submitting the user operation, it's crucial to wait for the receipt to ensure that it has been successfully included in the blockchain. Use the `waitForUserOperationReceipt` method provided by the bundler client.

```

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { bundlerClient, smartAccount } from "./config.ts" // The config.ts is the same as in the previous example.

const pimlicoClient = createPimlicoClient({

  transport: http("https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>"), // You can get the API Key from the Pimlico dashboard.

});

const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("1")

    }

  ],

  ...fee

});

+ const { receipt } = await bundlerClient.waitForUserOperationReceipt({

+   hash: userOperationHash

+ });

+

+ console.log(receipt.transactionHash);

```

## Next steps​

To sponsor gas for end users, see how to [send a gasless transaction](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-gasless-transaction/).

# Send a gasless transaction

MetaMask Smart Accounts support gas sponsorship, which simplifies onboarding by abstracting gas fees away from end users.

You can use any paymaster service provider, such as [Pimlico](https://docs.pimlico.io/references/paymaster) or [ZeroDev](https://docs.zerodev.app/meta-infra/rpcs), or plug in your own custom paymaster.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Send a gasless transaction​

The following example demonstrates how to use Viem's [Paymaster Client](https://viem.sh/account-abstraction/clients/paymaster) to send gasless transactions.

You can provide the paymaster client using the paymaster property in the [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation#paymaster-optional) method, or in the [Bundler Client](https://viem.sh/account-abstraction/clients/bundler#paymaster-optional).

In this example, the paymaster client is passed to the `sendUserOperation` method.

```

import { bundlerClient, smartAccount, paymasterClient } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001")

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas,

  paymaster: paymasterClient,

});

```

# Generate a multisig signature

The Smart Accounts Kit supports [Multisig smart accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#multisig-smart-account),

allowing you to add multiple externally owned accounts (EOA)

signers with a configurable execution threshold. When the threshold

is greater than 1, you can collect signatures from the required signers

and use the [aggregateSignature](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#aggregatesignature) function to combine them

into a single aggregated signature.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a Multisig smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/#create-a-multisig-smart-account)

## Generate a multisig signature​

The following example configures a Multisig smart account with two different signers: Alice

and Bob. The account has a threshold of 2, meaning that signatures from

both parties are required for any execution.

```

import { 

  bundlerClient, 

  aliceSmartAccount, 

  bobSmartAccount,

  aliceAccount,

  bobAccount,

} from "./config.ts";

import { aggregateSignature } from "@metamask/smart-accounts-kit";

const userOperation = await bundlerClient.prepareUserOperation({

  account: aliceSmartAccount,

  calls: [

    {

      target: zeroAddress,

      value: 0n,

      data: "0x",

    }

  ]

});

const aliceSignature = await aliceSmartAccount.signUserOperation(userOperation);

const bobSignature = await bobSmartAccount.signUserOperation(userOperation);

const aggregatedSignature = aggregateSignature({

  signatures: [{

    signer: aliceAccount.address,

    signature: aliceSignature,

    type: "ECDSA",

  }, {

    signer: bobAccount.address,

    signature: bobSignature,

    type: "ECDSA",

  }],

});

```

# Perform executions on a smart account's behalf

[Delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/) is the ability for a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) to grant permission to another account to perform executions on its behalf.

In this guide, you'll create a delegator account (Alice) and a delegate account (Bob), and grant Bob permission to perform executions on Alice's behalf.

You'll complete the delegation lifecycle (create, sign, and redeem a delegation).

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Steps​

### 1. Create a Public Client​

Create a [Viem Public Client](https://viem.sh/docs/clients/public) using Viem's `createPublicClient` function.

You will configure Alice's account (the delegator) and the Bundler Client with the Public Client, which you can use to query the signer's account state and interact with smart contracts.

```

import { createPublicClient, http } from "viem"

import { sepolia as chain } from "viem/chains"

const publicClient = createPublicClient({

  chain,

  transport: http(),

})

```

### 2. Create a Bundler Client​

Create a [Viem Bundler Client](https://viem.sh/account-abstraction/clients/bundler) using Viem's `createBundlerClient` function.

You can use the bundler service to estimate gas for user operations and submit transactions to the network.

```

import { createBundlerClient } from "viem/account-abstraction"

const bundlerClient = createBundlerClient({

  client: publicClient,

  transport: http("https://your-bundler-rpc.com"),

})

```

### 3. Create a delegator account​

Create an account to represent Alice, the delegator who will create a delegation.

The delegator must be a MetaMask smart account; use the toolkit's [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) method to create the delegator account.

A Hybrid smart account is a flexible smart account implementation that supports both an externally owned account (EOA) owner and any number of P256 (passkey) signers.

This examples configures a [Hybrid smart account with an Account signer](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/#create-a-hybrid-smart-account-with-an-account-signer):

```

import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

import { privateKeyToAccount } from "viem/accounts"

const delegatorAccount = privateKeyToAccount("0x...")

const delegatorSmartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [delegatorAccount.address, [], [], []],

  deploySalt: "0x",

  signer: { account: delegatorAccount },

})

```

See [how to configure other smart account types](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/).

### 4. Create a delegate account​

Create an account to represent Bob, the delegate who will receive the delegation. The delegate can be a smart account or an externally owned account (EOA):

```

import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

import { privateKeyToAccount } from "viem/accounts"

const delegateAccount = privateKeyToAccount("0x...")

const delegateSmartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid, // Hybrid smart account

  deployParams: [delegateAccount.address, [], [], []],

  deploySalt: "0x",

  signer: { account: delegateAccount },

})

```

### 5. Create a delegation​

Create a [root delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-types) from Alice to Bob.

With a root delegation, Alice is delegating her own authority away, as opposed to *redelegating* permissions she received from a previous delegation.

Use the toolkit's [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation) method to create a root delegation. When creating

delegation, you need to configure the scope of the delegation to define the initial authority.

This example uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-transfer-scope) scope, allowing Alice to delegate to Bob the ability to spend her USDC, with a

specified limit on the total amount.

Before creating a delegation, ensure that the delegator account (in this example, Alice's account) has been deployed. If the account is not deployed, redeeming the delegation will fail.

```

import { createDelegation } from "@metamask/smart-accounts-kit"

import { parseUnits } from "viem"

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const delegation = createDelegation({

  to: delegateSmartAccount.address, // This example uses a delegate smart account

  from: delegatorSmartAccount.address,

  environment: delegatorSmartAccount.environment

  scope: {

    type: "erc20TransferAmount",

    tokenAddress,

    // 10 USDC 

    maxAmount: parseUnits("10", 6),

  },

})

```

### 6. Sign the delegation​

Sign the delegation with Alice's account, using the [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#signdelegation) method from `MetaMaskSmartAccount`. Alternatively, you can use the toolkit's [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#signdelegation) utility method. Bob will later use the signed delegation to perform actions on Alice's behalf.

```

const signature = await delegatorSmartAccount.signDelegation({

  delegation,

})

const signedDelegation = {

  ...delegation,

  signature,

}

```

### 7. Redeem the delegation​

Bob can now redeem the delegation. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on Alice's behalf.

To prepare the calldata for the redeem transaction, use the [redeemDelegations](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#redeemdelegations) method from `DelegationManager`.

Since Bob is redeeming a single delegation chain, use the [SingleDefault](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#execution-modes) execution mode.

Bob can redeem the delegation by submitting a user operation if his account is a smart account, or a regular transaction if his account is an EOA. In this example, Bob transfers 1 USDC from Alice’s account to his own.

```

import { createExecution, ExecutionMode } from "@metamask/smart-accounts-kit"

import { DelegationManager } from "@metamask/smart-accounts-kit/contracts"

import { zeroAddress } from "viem"

import { callData } from "./config.ts"

const delegations = [signedDelegation]

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const executions = createExecution({ target: tokenAddress, callData })

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({

  delegations: [delegations],

  modes: [ExecutionMode.SingleDefault],

  executions: [executions],

})

const userOperationHash = await bundlerClient.sendUserOperation({

  account: delegateSmartAccount,

  calls: [

    {

      to: delegateSmartAccount.address,

      data: redeemDelegationCalldata,

    },

  ],

  maxFeePerGas: 1n,

  maxPriorityFeePerGas: 1n,

})

```

## Next steps​

- See [how to configure different scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/) to define the initial authority of a delegation.

- See [how to further refine the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

- See [how to disable a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/disable-delegation/) to revoke permissions.

# Use delegation scopes

When [creating a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/), you can configure a scope to define the delegation's initial authority and help prevent delegation misuse.

You can further constrain this initial authority by [adding caveats to a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/).

The Smart Accounts Kit currently supports three categories of scopes:

| Scope type | Description |

| --- | --- |

| Spending limit scopes | Restricts the spending of native, ERC-20, and ERC-721 tokens based on defined conditions. |

| Function call scope | Restricts the delegation to specific contract methods, contract addresses, or calldata. |

| Ownership transfer scope | Restricts the delegation to only allow ownership transfers, specifically the transferOwnership function for a specified contract. |

# Use spending limit scopes

Spending limit scopes define how much a delegate can spend in native, ERC-20, or ERC-721 tokens.

You can set transfer limits with or without time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## ERC-20 periodic scope​

This scope ensures a per-period limit for ERC-20 token transfers.

You set the amount, period, and start data.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day.

Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20PeriodTransfer",

    tokenAddress: "0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da",

    // USDC has 6 decimal places.

    periodAmount: parseUnits("10", 6),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 streaming scope​

This scopes ensures a linear streaming transfer limit for ERC-20 tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20Streaming",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    amountPerSecond: parseUnits("0.1", 6),

    initialAmount: parseUnits("10", 6),

    maxAmount: parseUnits("100", 6),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 transfer scope​

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions.

Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    maxAmount: parseUnits("10", 6),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-721 scope​

This scope limits the delegation to ERC-721 token transfers only.

For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer.

See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const delegation = createDelegation({

  scope: {

    type: "erc721Transfer",

    tokenAddress: "0x3fF528De37cd95b67845C1c55303e7685c72F319",

    tokenId: 1n,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token periodic scope​

This scope ensures a per-period limit for native token transfers.

You set the amount, period, and start date.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

Bob can transfer a total of 0.01 ETH per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenPeriodTransfer",

    periodAmount: parseEther("0.01"),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token streaming scope​

This scopes ensures a linear streaming transfer limit for native tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenStreaming",

    amountPerSecond: parseEther("0.001"),

    initialAmount: parseEther("0.01"),

    maxAmount: parseEther("0.1"),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token transfer scope​

This scope ensures that native token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

Bob may use the 0.1 ETH in a single transaction or make multiple transactions, as long as the total does not exceed 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

const delegation = createDelegation({

  scope: {

    type: "nativeTokenTransferAmount",

    maxAmount: parseEther("0.001"),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Use spending limit scopes

Spending limit scopes define how much a delegate can spend in native, ERC-20, or ERC-721 tokens.

You can set transfer limits with or without time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## ERC-20 periodic scope​

This scope ensures a per-period limit for ERC-20 token transfers.

You set the amount, period, and start data.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day.

Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20PeriodTransfer",

    tokenAddress: "0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da",

    // USDC has 6 decimal places.

    periodAmount: parseUnits("10", 6),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 streaming scope​

This scopes ensures a linear streaming transfer limit for ERC-20 tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20Streaming",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    amountPerSecond: parseUnits("0.1", 6),

    initialAmount: parseUnits("10", 6),

    maxAmount: parseUnits("100", 6),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 transfer scope​

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions.

Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    maxAmount: parseUnits("10", 6),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-721 scope​

This scope limits the delegation to ERC-721 token transfers only.

For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer.

See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const delegation = createDelegation({

  scope: {

    type: "erc721Transfer",

    tokenAddress: "0x3fF528De37cd95b67845C1c55303e7685c72F319",

    tokenId: 1n,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token periodic scope​

This scope ensures a per-period limit for native token transfers.

You set the amount, period, and start date.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

Bob can transfer a total of 0.01 ETH per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenPeriodTransfer",

    periodAmount: parseEther("0.01"),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token streaming scope​

This scopes ensures a linear streaming transfer limit for native tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenStreaming",

    amountPerSecond: parseEther("0.001"),

    initialAmount: parseEther("0.01"),

    maxAmount: parseEther("0.1"),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token transfer scope​

This scope ensures that native token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

Bob may use the 0.1 ETH in a single transaction or make multiple transactions, as long as the total does not exceed 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

const delegation = createDelegation({

  scope: {

    type: "nativeTokenTransferAmount",

    maxAmount: parseEther("0.001"),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Use the ownership transfer scope

The ownership transfer scope restricts a delegation to ownership transfer calls only.

For example, Alice has deployed a smart contract, and she delegates to Bob the ability to transfer ownership of that contract.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## Ownership transfer scope​

This scope requires a `contractAddress`, which represents the address of the deployed contract.

Internally, this scope uses the [ownershipTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#ownershiptransfer) caveat enforcer.

See the [ownership transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#ownership-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const contractAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const delegation = createDelegation({

  scope: {

    type: "ownershipTransfer",

    contractAddress,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Constrain a delegation scope

[Delegation scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/) define the delegation's initial authority and help prevent delegation misuse.

You can further constrain these scopes and limit the delegation's authority by applying [caveat enforcers](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/caveat-enforcers/).

## Prerequisites​

[Configure a delegation scope.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/)

## Apply a caveat enforcer​

For example, Alice creates a delegation with an [ERC-20 transfer scope](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-transfer-scope) that allows Bob to spend up to 10 USDC.

If Alice wants to further restrict the scope to limit Bob's delegation to be valid for only seven days,

she can apply the [timestamp](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#timestamp) caveat enforcer.

The following example creates a delegation using [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation), applies the ERC-20 transfer scope with a spending limit of 10 USDC, and applies the `timestamp` caveat enforcer to restrict the delegation's validity to a seven-day period:

```

import { createDelegation } from "@metamask/smart-accounts-kit";

// Convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// Seven days after current time.

const beforeThreshold = currentTime + 604800;

const caveats = [{

  type: "timestamp",

  afterThreshold: currentTime,

  beforeThreshold, 

}];

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    maxAmount: 10000n,

  },

  // Apply caveats to the delegation.

  caveats,

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

- See the [caveats reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/) for the full list of caveat types and their parameters.

- For more specific or custom control, you can also [create custom caveat enforcers](https://docs.metamask.io/tutorials/create-custom-caveat-enforcer/)

and apply them to delegations.

# Check the delegation state

When using [spending limit delegation scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/) or relevant [caveat enforcers](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/),

you might need to check the remaining transferrable amount in a delegation.

For example, if a delegation allows a user to spend 10 USDC per week and they have already spent 10 - n USDC in the current period,

you can determine how much of the allowance is still available for transfer.

Use the `CaveatEnforcerClient` to check the available balances for specific scopes or caveats.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

- [Create a delegation with an ERC-20 periodic scope.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-periodic-scope)

## Create a CaveatEnforcerClient​

To check the delegation state, create a [CaveatEnforcerClient](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/).

This client allows you to interact with the caveat enforcers of the delegation, and read the required state.

```

import { environment, publicClient as client } from './config.ts'

import { createCaveatEnforcerClient } from '@metamask/smart-accounts-kit'

const caveatEnforcerClient = createCaveatEnforcerClient({

  environment,

  client,

})

```

## Read the caveat enforcer state​

This example uses the [getErc20PeriodTransferEnforcerAvailableAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/#geterc20periodtransferenforceravailableamount) method to read the state and retrieve the remaining amount for the current transfer period.

```

import { delegation } './config.ts'

// Returns the available amount for current period. 

const { availableAmount } = await caveatEnforcerClient.getErc20PeriodTransferEnforcerAvailableAmount({

  delegation,

})

```

## Next steps​

See the [Caveat Enforcer Client reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/) for the full list of available methods.

# Perform executions on a MetaMask user's behalf

[Advanced Permissions (ERC-7115)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) are fine-grained permissions that your dapp can request from a MetaMask user to execute transactions on their

behalf. For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course

of a month. Once the permission is granted, your dapp can use the allocated 10 USDC each day to

purchase ETH directly from the MetaMask user's account.

In this guide, you'll request an ERC-20 periodic transfer permission from a MetaMask user to transfer 1 USDC every day on their behalf.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Install MetaMask Flask 13.5.0 or later.](https://docs.metamask.io/snaps/get-started/install-flask/)

### 1. Set up a Wallet Client​

Set up a [Viem Wallet Client](https://viem.sh/docs/clients/wallet) using Viem's `createWalletClient` function. This client will

help you interact with MetaMask Flask.

Then, extend the Wallet Client functionality using `erc7715ProviderActions`. These actions enable you to request Advanced Permissions from the user.

```

import { createWalletClient, custom } from "viem";

import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";

const walletClient = createWalletClient({

  transport: custom(window.ethereum),

}).extend(erc7715ProviderActions());

```

### 2. Set up a Public Client​

Set up a [Viem Public Client](https://viem.sh/docs/clients/public) using Viem's `createPublicClient` function.

This client will help you query the account state and interact with the blockchain network.

```

import { createPublicClient, http } from "viem";

import { sepolia as chain } from "viem/chains";

 

const publicClient = createPublicClient({

  chain,

  transport: http(),

});

```

### 3. Set up a session account​

Set up a session account which can either be a smart account or an externally owned account (EOA)

to request Advanced Permissions. The requested permissions are granted to the session account, which

is responsible for executing transactions on behalf of the user.

```

import { privateKeyToAccount } from "viem/accounts";

import { 

  toMetaMaskSmartAccount, 

  Implementation 

} from "@metamask/smart-accounts-kit";

const privateKey = "0x...";

const account = privateKeyToAccount(privateKey);

const sessionAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [account.address, [], [], []],

  deploySalt: "0x",

  signer: { account },

});

```

### 4. Check the EOA account code​

Advanced Permissions support the automatic upgrading of a MetaMask user's account to a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/),

when using MetaMask Flask version 13.9.0 or later. For earlier versions, you must ensure that the

user is upgraded to a smart account before requesting Advanced Permissions.

If the user has not yet been upgraded, you can handle the upgrade [programmatically](https://docs.metamask.io/wallet/how-to/send-transactions/send-batch-transactions/#about-atomic-batch-transactions) or ask the

user to [switch to a smart account manually](https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account/#how-to-switch-to-a-metamask-smart-account).

MetaMask's Advanced Permissions (ERC-7115) implementation requires the user to be upgraded to a MetaMask

Smart Account because, under the hood, you're requesting a signature for an [ERC-7710 delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/).

ERC-7710 delegation is one of the core features supported only by MetaMask Smart Accounts.

```

import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { sepolia as chain } from "viem/chains";

const addresses = await walletClient.requestAddresses();

const address = addresses[0];

// Get the EOA account code

const code = await publicClient.getCode({

  address,

});

if (code) {

  // The address to which EOA has delegated. According to EIP-7702, 0xef0100 || address

  // represents the delegation. 

  // 

  // You need to remove the first 8 characters (0xef0100) to get the delegator address.

  const delegatorAddress = `0x${code.substring(8)}`;

  const statelessDelegatorAddress = getSmartAccountsEnvironment(chain.id)

  .implementations

  .EIP7702StatelessDeleGatorImpl;

  // If account is not upgraded to MetaMask smart account, you can

  // either upgrade programmatically or ask the user to switch to a smart account manually.

  const isAccountUpgraded = delegatorAddress.toLowerCase() === statelessDelegatorAddress.toLowerCase();

}

```

### 5. Request Advanced Permissions​

Request Advanced Permissions from the user using the Wallet Client's `requestExecutionPermissions` action.

In this example, you'll request an

[ERC-20 periodic permission](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/#erc-20-periodic-permission).

See the [requestExecutionPermissions](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#requestexecutionpermissions) API reference for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

// Since current time is in seconds, we need to convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // The requested permissions will granted to the

      // session account.

      address: sessionAccount.address,

    },

  },

  permission: {

    type: "erc20-token-periodic",

    data: {

      tokenAddress,

      // 1 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6

      periodAmount: parseUnits("10", 6),

      // 1 day in seconds

      periodDuration: 86400,

      justification?: "Permission to transfer 1 USDC every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

### 6. Set up a Viem client​

Set up a Viem client depending on your session account type.

For a smart account, set up a [Viem Bundler Client](https://viem.sh/account-abstraction/clients/bundler)

using Viem's `createBundlerClient` function. This lets you use the bundler service

to estimate gas for user operations and submit transactions to the network.

For an EOA, set up a [Viem Wallet Client](https://viem.sh/docs/clients/wallet)

using Viem's `createWalletClient` function. This lets you send transactions directly to the network.

The toolkit provides public actions for both of the clients which can be used to redeem Advanced Permissions, and execute transactions on a user's behalf.

```

import { createBundlerClient } from "viem/account-abstraction";

import { erc7710BundlerActions } from "@metamask/smart-accounts-kit/actions";

const bundlerClient = createBundlerClient({

  client: publicClient,

  transport: http("https://your-bundler-rpc.com"),

  // Allows you to use the same Bundler Client as paymaster.

  paymaster: true

}).extend(erc7710BundlerActions());

```

### 7. Redeem Advanced Permissions​

The session account can now redeem the permissions. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on the user's behalf.

To redeem the permissions, use the client action based on your session account type.

A smart account uses the Bundler Client's `sendUserOperationWithDelegation` action,

and an EOA uses the Wallet Client's `sendTransactionWithDelegation` action.

See the [sendUserOperationWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/bundler-client/#senduseroperationwithdelegation) and [sendTransactionWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#sendtransactionwithdelegation) API reference for more information.

```

import { calldata } from "./config.ts";

// These properties must be extracted from the permission response.

const permissionsContext = grantedPermissions[0].context;

const delegationManager = grantedPermissions[0].signerMeta.delegationManager;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// Calls without permissionsContext and delegationManager will be executed 

// as a normal user operation.

const userOperationHash = await bundlerClient.sendUserOperationWithDelegation({

  publicClient,

  account: sessionAccount,

  calls: [

    {

      to: tokenAddress,

      data: calldata,

      permissionsContext,

      delegationManager,

    },

  ],

  // Appropriate values must be used for fee-per-gas. 

  maxFeePerGas: 1n,

  maxPriorityFeePerGas: 1n,

});

```

## Next steps​

See how to configure different [ERC-20 token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/) and

[native token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/native-token/).

# Use ERC-20 token permissions

[Advanced Permissions (ERC-7715)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) supports ERC-20 token permission types that allow you to request fine-grained

permissions for ERC-20 token transfers with time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a session account.](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/#3-set-up-a-session-account)

## ERC-20 periodic permission​

This permission type ensures a per-period limit for ERC-20 token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 10 USDC on their behalf each day. The dapp can transfer a total of

10 USDC per day; the limit resets at the beginning of the next day.

See the [ERC-20 periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-periodic-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "erc20-token-periodic",

    data: {

      tokenAddress,

      // 10 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6.

      periodAmount: parseUnits("10", 6),

      // 1 day in seconds.

      periodDuration: 86400,

      justification?: "Permission to transfer 1 USDC every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

## ERC-20 stream permission​

This permission type ensures a linear streaming transfer limit for ERC-20 tokens. Token transfers are blocked until the

defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the

configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.1 USDC per second, starting with an initial amount

of 1 USDC, up to a maximum of 2 USDC.

See the [ERC-20 stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-stream-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "erc20-token-stream",

    data: {

      tokenAddress,

      // 0.1 USDC in WEI format. Since USDC has 6 decimals, 0.1 * 10^6.

      amountPerSecond: parseUnits("0.1", 6),

      // 1 USDC in WEI format. Since USDC has 6 decimals, 1 * 10^6.

      initialAmount: parseUnits("1", 6),

      // 2 USDC in WEI format. Since USDC has 6 decimals, 2 * 10^6.

      maxAmount: parseUnits("2", 6),

      startTime: currentTime,

      justification: "Permission to use 0.1 USDC per second",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

# Use native token permissions

[Advanced Permissions (ERC-7115)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) supports native token permission types that allow you to request fine-grained

permissions for native token transfers with time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a session account.](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/#3-set-up-a-session-account)

## Native token periodic permission​

This permission type ensures a per-period limit for native token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 0.001 ETH on their behalf each day. The dapp can transfer a total of

0.001 USDC per day; the limit resets at the beginning of the next day.

See the [native token periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-periodic-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseEther } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "native-token-periodic",

    data: {

      // 0.001 ETH in wei format.

      periodAmount: parseEther("0.001"),

      // 1 hour in seconds.

      periodDuration: 86400,

      startTime: currentTime,

      justification: "Permission to use 0.001 ETH every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

## Native token stream permission​

This permission type ensures a linear streaming transfer limit for native tokens. Token transfers are blocked until the

defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the

configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.0001 ETH per second, starting with an initial amount

of 0.1 ETH, up to a maximum of 1 ETH.

See the [native token stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-stream-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseEther } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "native-token-stream",

    data: {

      // 0.0001 ETH in wei format.

      amountPerSecond: parseEther("0.0001"),

      // 0.1 ETH in wei format.

      initialAmount: parseEther("0.1"),

      // 1 ETH in wei format.

      maxAmount: parseEther("1"),

      startTime: currentTime,

      justification: "Permission to use 0.0001 ETH per second",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

# Send your first gasless transaction

A paymaster is a vital component in the ERC-4337 standard, responsible for covering transaction costs on behalf of the user. There are various types of paymasters, such as gasless paymasters, ERC-20 paymasters, and more.

In this guide, we'll talk about how you can use the Pimlico gasless Paymaster with Web3Auth Account Abstraction Provider to sponsor the transaction for your users without requiring the user to pay gas fees.

For those who want to skip straight to the code, you can find it on [GitHub](https://github.com/Web3Auth/web3auth-examples/tree/main/other/smart-account-example).

## Prerequisites​

- Pimlico Account: Since we'll be using the Pimlico paymaster, you'll need to have an API key from Pimlico. You can get a free API key from [Pimlico Dashboard](https://dashboard.pimlico.io/).

- Web3Auth Dashboard: If you haven't already, sign up on the Web3Auth platform. It is free and gives you access to the Web3Auth's base plan. Head to Web3Auth's documentation page for detailed [instructions on setting up the Web3Auth Dashboard](https://docs.metamask.io/embedded-wallets/dashboard/).

- Web3Auth PnP Web SDK: This guide assumes that you already know how to integrate the PnP Web SDK in your project. If not, you can learn how to [integrate Web3Auth in your Web app](https://docs.metamask.io/embedded-wallets/sdk/react/).

## Integrate AccountAbstractionProvider​

Once, you have set up the Web3Auth Dashboard, and created a new project, it's time to integrate Web3Auth Account Abstraction Provider in your Web application. For the implementation, we'll use the [@web3auth/account-abstraction-provider](https://www.npmjs.com/package/@web3auth/account-abstraction-provider). The provider simplifies the entire process by managing the complex logic behind configuring the account abstraction provider, bundler, and preparing user operations.

If you are already using the Web3Auth Pnp SDK in your project, you just need to configure the AccountAbstractionProvider with the paymaster details, and pass it to the Web3Auth instance. No other changes are required.

### Installation​

```

npm install --save @web3auth/account-abstraction-provider

```

### Configure Paymaster​

The AccountAbstractionProvider requires specific configurations to function correctly. One key configuration is the paymaster. Web3Auth supports custom paymaster configurations, allowing you to deploy your own paymaster and integrate it with the provider.

You can choose from a variety of paymaster services available in the ecosystem. In this guide, we'll be configuring the Pimlico's paymaster. However, it's important to note that paymaster support is not limited to the Pimlico, giving you the flexibility to integrate any compatible paymaster service that suits your requirements.

For the simplicity, we have only use `SafeSmartAccount`, but you choose your favorite smart account provider from the available ones. [Learn how to configure the smart account](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/smart-accounts/).

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from '@web3auth/account-abstraction-provider'

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: '0xaa36a7',

  rpcTarget: 'https://rpc.sepolia.org',

  displayName: 'Ethereum Sepolia Testnet',

  blockExplorerUrl: 'https://sepolia.etherscan.io',

  ticker: 'ETH',

  tickerName: 'Ethereum',

  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',

}

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

    smartAccountInit: new SafeSmartAccount(),

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

})

```

## Configure Web3Auth​

Once you have configured your `AccountAbstractionProvider`, you can now plug it in your Web3Auth Modal/No Modal instance. If you are using the external wallets like MetaMask, Coinbase, etc, you can define whether you want to use the AccountAbstractionProvider, or EthereumPrivateKeyProvider by setting the `useAAWithExternalWallet` in `IWeb3AuthCoreOptions`.

If you are setting `useAAWithExternalWallet` to `true`, it'll create a new Smart Account for your user, where the signer/creator of the Smart Account would be the external wallet.

If you are setting `useAAWithExternalWallet` to `false`, it'll skip creating a new Smart Account, and directly use the external wallet to sign the transactions.

```

import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

import { Web3Auth } from "@web3auth/modal";

const privateKeyProvider = new EthereumPrivateKeyProvider({

  // Use the chain config we declared earlier

  config: { chainConfig },

});

const web3auth = new Web3Auth({

  clientId: "YOUR_WEB3AUTH_CLIENT_ID", // Pass your Web3Auth Client ID, ideally using an environment variable

  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,

  privateKeyProvider,

  // Use the account abstraction provider we configured earlier

  accountAbstractionProvider

  // This will allow you to use EthereumPrivateKeyProvider for

  // external wallets, while use the AccountAbstractionProvider

  // for Web3Auth embedded wallets.

  useAAWithExternalWallet: false,

});

```

## Configure Signer​

The Web3Auth Smart Account feature is compatible with popular signer SDKs, including wagmi, ethers, and viem. You can choose your preferred package to configure the signer.

You can retreive the provider to configure the signer from Web3Auth instance.

Wagmi does not require any special configuration to use the signer with smart accounts. Once you have set up your Web3Auth provider and connected your wallet, Wagmi's hooks (such as useSigner or useAccount) will automatically use the smart account as the signer. You can interact with smart accounts using Wagmi just like you would with a regular EOA (Externally Owned Account) signer—no additional setup is needed.

```

import { createWalletClient } from 'viem'

// Use your Web3Auth instance to retreive the provider.

const provider = web3auth.provider

const walletClient = createWalletClient({

  transport: custom(provider),

})

```

## Send a transaction​

Developers can use their preferred signer or Wagmi hooks to initiate on-chain transactions, while Web3Auth manages the creation and submission of the UserOperation. Only the `to`, `data`, and `value` fields need to be provided. Any additional parameters will be ignored and automatically overridden.

To ensure reliable execution, the bundler client sets maxFeePerGas and maxPriorityFeePerGas values. If custom values are required, developers can use the [Viem's BundlerClient](https://viem.sh/account-abstraction/clients/bundler#bundler-client) to manually construct and send the user operation.

Since Smart Accounts are deployed smart contracts, the user's first transaction also triggers the on-chain deployment of their wallet.

```

import { useSendTransaction } from 'wagmi'

const { data: hash, sendTransaction } = useSendTransaction()

// Convert 1 ether to WEI format

const value = web3.utils.toWei(1)

sendTransaction({ to: 'DESTINATION_ADDRESS', value, data: '0x' })

const {

  data: receipt,

  isLoading: isConfirming,

  isSuccess: isConfirmed,

} = useWaitForTransactionReceipt({

  hash,

})

```

## Conclusion​

Voila, you have successfully sent your first gasless transaction using the Pimlico paymaster with Web3Auth Account Abstraction Provider. To learn more about advance features of the Account Abstraction Provider like performing batch transactions, using ERC-20 paymaster you can refer to the [Account Abstraction Provider](https://docs.metamask.io/embedded-wallets/sdk/react/) documentation.

# Smart Accounts

Effortlessly create and manage smart accounts for your users with just a few lines of code, using our Smart Account feature. Smart accounts offer enhanced control and programmability, enabling powerful features that traditional wallets can't provide.

**Key features of Smart Accounts include:**

- **Gas Abstraction:** Cover transaction fees for users, or allow users to pay for their own transactions using ERC-20 tokens.

- **Batch Transactions:** Perform multiple transactions in a single call.

- **Automated Transactions:** Allow users to automate actions, like swapping ETH to USDT when ETH hits a specific price.

- **Custom Spending Limits:** Allow users to set tailored spending limits.

> For more information about ERC-4337 and its components, check out our detailed blog post.

For more information about ERC-4337 and its components, [check out our detailed blog post](https://blog.web3auth.io/an-ultimate-guide-to-web3-wallets-externally-owned-account-and-smart-contract-wallet/#introduction-to-eip-4337).

Our smart account integration streamlines your setup, allowing you to create and manage smart accounts using your favorite libraries like Viem, Ethers, and Wagmi. You don't need to rely on third-party packages to effortlessly create ERC-4337 compatible Smart Contract Wallets (SCWs), giving users the ability to perform batch transactions and efficiently manage gas sponsorship.

This is a paid feature and the minimum [pricing plan](https://web3auth.io/pricing.html) to use this

SDK in a production environment is the **Growth Plan**. You can use this feature in Web3Auth

Sapphire Devnet network for free.

## Enabling Smart Accounts​

To enable this feature, you need to configure Smart Accounts from your project in the [Web3Auth Developer Dashboard](https://dashboard.web3auth.io/).

### Dashboard Configuration​

To enable Smart Accounts, navigate to the Smart Accounts section in the Web3Auth dashboard, and enable the "Set up Smart Accounts" toggle. Web3Auth currently supports [MetaMaskSmartAccount](https://docs.gator.metamask.io/how-to/create-delegator-account#create-a-metamasksmartaccount) as a Smart Account provider.

## Installation​

To use native account abstraction, you'll need to install the

[@web3auth/account-abstraction-provider](https://www.npmjs.com/package/@web3auth/account-abstraction-provider),

which allows you to create and interact with Smart Contract Wallets (SCWs). This provider simplifies

the entire process by managing the complex logic behind configuring the account abstraction

provider, bundler, and preparing user operations.

```

npm install --save @web3auth/account-abstraction-provider

```

## Configure​

When instantiating the Account Abstraction Provider, you can pass configuration objects to the

constructor. These configuration options allow you to select the desired Account Abstraction (AA)

provider, as well as configure the bundler and paymaster, giving you flexibility and control over

the provider.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

Please note this is the important step for setting the Web3Auth account abstraction provider.

- [Configure Smart Account provider](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#configure-smart-account-provider)

- [Configure Bundler](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#configure-bundler)

- [Configure Sponsored Paymaster](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#sponsored-paymaster)

- [Configure ERC-20 Paymaster](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#erc-20-paymaster)

## Configure Smart Account Provider​

Web3Auth offers the flexibility to choose your preferred Account Abstraction (AA) provider.

Currently, we support Safe, Kernel, Biconomy, and Trust.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Configure Bundler​

Web3Auth enables you to configure your bundler and define the paymaster context. The bundler

aggregates the UserOperations and submits them on-chain via a global entry point contract.

Bundler support is not limited to the examples below—you can use any bundler of your choice.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Configure Paymaster​

You can configure the paymaster of your choice to sponsor gas fees for your users, along with the paymaster context. The paymaster context lets you set additional parameters, such as choosing the token for ERC-20 paymasters, defining gas policies, and more.

### Sponsored Paymaster​

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

### ERC-20 Paymaster​

When using an ERC-20 paymaster, ensure you include the approval transaction, as Web3Auth does not

handle the approval internally.

For Pimlico, you can specify the token you want to use in the paymasterContext. If you want to set

up sponsorship policies, you can define those in the paymasterContext as well.

[Checkout the supported tokens for ERC-20 Paymaster on Pimlico](https://docs.pimlico.io/infra/paymaster/erc20-paymaster/supported-tokens).

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

      paymasterContext: {

        token: "SUPPORTED_TOKEN_CONTRACT_ADDRESS",

      },

    },

    smartAccountInit: new SafeSmartAccount(),

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Set up​

### Configure Web3Auth Instance​

```

import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider'

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from '@web3auth/account-abstraction-provider'

import Web3Auth, { WEB3AUTH_NETWORK } from '@web3auth/react-native-sdk'

import * as WebBrowser from '@toruslabs/react-native-web-browser'

import EncryptedStorage from 'react-native-encrypted-storage'

import { CHAIN_NAMESPACES } from '@web3auth/base'

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: '0xaa36a7',

  rpcTarget: 'https://rpc.sepolia.org',

  displayName: 'Ethereum Sepolia Testnet',

  blockExplorerUrl: 'https://sepolia.etherscan.io',

  ticker: 'ETH',

  tickerName: 'Ethereum',

  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',

}

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

    smartAccountInit: new SafeSmartAccount(),

  },

})

const privateKeyProvider = new EthereumPrivateKeyProvider({

  config: { chainConfig },

})

const web3auth = new Web3Auth(WebBrowser, EncryptedStorage, {

  clientId,

  redirectUrl,

  network: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET, // or other networks

  privateKeyProvider,

  accountAbstractionProvider: aaProvider,

})

```

### Configure Signer​

The Web3Auth Smart Account feature is compatible with popular signer SDKs, including wagmi, ethers,

and viem. You can choose your preferred package to configure the signer.

You can retreive the provider to configure the signer from Web3Auth instance.

Wagmi does not require any special configuration to use the signer with smart accounts. Once you

have set up your Web3Auth provider and connected your wallet, Wagmi's hooks (such as useSigner or

useAccount) will automatically use the smart account as the signer. You can interact with smart

accounts using Wagmi just like you would with a regular EOA (Externally Owned Account) signer—no

additional setup is needed.

```

import { createWalletClient } from "viem";

// Use your Web3Auth instance to retreive the provider.

const provider = web3auth.provider;

const walletClient = createWalletClient({

  transport: custom(provider),

});

```

## Smart Account Address​

Once the signers or Wagmi configuration is set up, it can be used to retrieve the user's Smart

Account address.

```

import { useAccount } from "wagmi";

const { address } = useAccount();

const smartAccountAddress = address;

```

## Send Transaction​

Developers can use their preferred signer or Wagmi hooks to initiate on-chain transactions, while

Web3Auth manages the creation and submission of the UserOperation. Only the `to`, `data`, and

`value` fields need to be provided. Any additional parameters will be ignored and automatically

overridden.

To ensure reliable execution, the bundler client sets maxFeePerGas and maxPriorityFeePerGas values.

If custom values are required, developers can use the

[Viem's BundlerClient](https://viem.sh/account-abstraction/clients/bundler#bundler-client) to

manually construct and send the user operation.

Since Smart Accounts are deployed smart contracts, the user's first transaction also triggers the

on-chain deployment of their wallet.

```

import { useSendTransaction } from "wagmi";

const { data: hash, sendTransaction } = useSendTransaction();

// Convert 1 ether to WEI format

const value = web3.utils.toWei(1);

sendTransaction({ to: "DESTINATION_ADDRESS", value, data: "0x" });

const {

  data: receipt,

  isLoading: isConfirming,

  isSuccess: isConfirmed,

} = useWaitForTransactionReceipt({

  hash,

});

```

## Advanced Smart Account Operations​

To learn more about supported transaction methods, and how to perform batch transactions, [checkout our detailed documentation of AccountAbstractionProvider](https://docs.metamask.io/embedded-wallets/sdk/react/).

# Advanced Permissions (ERC-7715)

The Smart Accounts Kit supports Advanced Permissions ([ERC-7715](https://eips.ethereum.org/EIPS/eip-7715)), which lets you request fine-grained permissions from a MetaMask user to execute transactions on their behalf.

For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course of a month.

Once the permission is granted, your dapp can use the allocated 10 USDC each day to purchase ETH directly from the MetaMask user's account.

Advanced Permissions eliminate the need for users to approve every transaction, which is useful for highly interactive dapps.

It also enables dapps to execute transactions for users without an active wallet connection.

This feature requires [MetaMask Flask 13.5.0](https://docs.metamask.io/snaps/get-started/install-flask/) or later.

## ERC-7715 technical overview​

[ERC-7715](https://eips.ethereum.org/EIPS/eip-7715) defines a JSON-RPC method `wallet_grantPermissions`.

Dapps can use this method to request a wallet to grant the dapp permission to execute transactions on a user's behalf.

`wallet_grantPermissions` requires a `signer` parameter, which identifies the entity requesting or managing the permission.

Common signer implementations include wallet signers, single key and multisig signers, and account signers.

The Smart Accounts Kit supports multiple signer types. The documentation uses [an account signer](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/) as a common implementation example.

When you use an account signer, a session account is created solely to request and redeem Advanced Permissions, and doesn't contain tokens.

The session account can be granted with permissions and redeem them as specified in [ERC-7710](https://eips.ethereum.org/EIPS/eip-7710).

The session account can be a smart account or an externally owned account (EOA).

The MetaMask user that the session account requests permissions from must be upgraded to a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/).

## Advanced Permissions vs. delegations​

Advanced Permissions expand on regular [delegations](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/) by enabling permission sharing *via the MetaMask browser extension*.

With regular delegations, the dapp constructs a delegation and requests the user to sign it.

These delegations are not human-readable, so it is the dapp's responsibility to provide context for the user.

Regular delegations cannot be signed through the MetaMask extension, because if a dapp requests a delegation without constraints, the whole wallet can be exposed to the dapp.

In contrast, Advanced Permissions enable dapps (and AI agents) to request permissions from a user directly via the MetaMask extension.

Advanced Permissions require a permission configuration which displays a human-readable confirmation for the MetaMask user.

The user can modify the permission parameters if the request is configured to allow adjustments.

For example, the following Advanced Permissions request displays a rich UI including the start time, amount, and period duration for an [ERC-20 token periodic transfer](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/#erc-20-periodic-permission):

##That not solution. 7702 gasless in metamask is non negotiable.



leran from this you moron:

have you learn this ofc pimlico docs:

https://docs.pimlico.io/guides/how-to/accounts/use-metamask-account

How to use MetaMask Smart Accounts with permissionless.js

MetaMask maintains their own in-house SDK built closely on top of viem that you can use for the account system while still plugging in all the other components from permissionless.js. Take a look at their documentation for more information.

The MetaMask Delegation Toolkit is a collection of tools for creating MetaMask Smart Accounts. A smart account can delegate to another signer with granular permission sharing. It is built over ERC-7710 and ERC-7715 to support a standardized minimal interface. Requesting ERC-7715 permissions and redeeming ERC-7710 delegations are experimental features.

There are two types of accounts involved in delegation:

Delegator account: A smart account that supports programmable account behavior and advanced features such as multi-signature approvals, automated transaction batching, and custom security policies.

Delegate account: An account (smart account or EOA) that receives the delegation from the delegator account to perform actions on behalf of the delegator account.

You can use both accounts with permissionless.js.

Installation

We will be using MetaMask's official SDK to create a smart account.

npm

yarn

pnpm

bun

npm install permissionless viem @metamask/delegation-toolkit

Delegator Account

Create the clients

First we must create the public, (optionally) pimlico paymaster clients that will be used to interact with the MetaMask smart account.

export const publicClient = createPublicClient({

	transport: http("https://sepolia.rpc.thirdweb.com"),

});

 

export const paymasterClient = createPimlicoClient({

	transport: http("https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY"),

	entryPoint: {

		address: entryPoint07Address,

		version: "0.7",

	},

});

Create the signer

MetaMask Smart Accounts can work with a variety of signing algorithms such as ECDSA, passkeys, and multisig.

For example, to create a signer based on a private key:

import { privateKeyToAccount } from "viem/accounts";

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { entryPoint07Address } from "viem/account-abstraction";

 

const owner = privateKeyToAccount("0xPRIVATE_KEY");

Create the delegator smart account

For a full list of options for creating a MetaMask smart account, take a look at the MetaMask's documentation page for toMetaMaskSmartAccount.

With a signer, you can create a MetaMask smart account as such:

import {

	Implementation,

	toMetaMaskSmartAccount,

} from "@metamask/delegation-toolkit";

 

const delegatorSmartAccount = await toMetaMaskSmartAccount({

	client: publicClient,

	implementation: Implementation.Hybrid,

	deployParams: [owner.address, [], [], []],

	deploySalt: "0x",

	signatory: { account: owner },

});

 

Create the smart account client

const smartAccountClient = createSmartAccountClient({

	account: delegatorSmartAccount,

	chain: sepolia,

	paymaster: paymasterClient,

	bundlerTransport: http(

		"https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY",

	),

	userOperation: {

		estimateFeesPerGas: async () =>

			(await paymasterClient.getUserOperationGasPrice()).fast,

	},

});

Send a transaction

Transactions using permissionless.js simply wrap around user operations. This means you can switch to permissionless.js from your existing viem EOA codebase with minimal-to-no changes.

const txHash = await smartAccountClient.sendTransaction({

	to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",

	value: parseEther("0.1"),

});

This also means you can also use viem Contract instances to transact without any modifications.

const nftContract = getContract({

	address: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",

	abi: tokenAbi,

	client: {

		public: publicClient,

		wallet: smartAccountClient,

	},

});

 

const txHash = await nftContract.write.mint([

	"0x_MY_ADDRESS_TO_MINT_TOKENS",

	parseEther("1"),

]);

You can also send an array of transactions in a single batch.

const userOpHash = await smartAccountClient.sendUserOperation({

	calls: [

		{

			to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",

			value: parseEther("0.1"),

			data: "0x",

		},

		{

			to: "0x1440ec793aE50fA046B95bFeCa5aF475b6003f9e",

			value: parseEther("0.1"),

			data: "0x1234",

		},

	],

});

Delegate Account

A delegate account is an account that receives the delegation from the delegator account to perform actions on behalf of the delegator account. To create a delegate account, we will follow the following steps:

Create a delegate signer

Create the delegate smart account

Create a delegation using delegator smart account

Sign the delegation

Send transactions using delegate smart account with signed delegation

Create the clients

First we must create the public, (optionally) pimlico paymaster clients that will be used to interact with the MetaMask smart account.

export const publicClient = createPublicClient({

	transport: http("https://sepolia.rpc.thirdweb.com"),

});

 

export const paymasterClient = createPimlicoClient({

	transport: http("https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY"),

	entryPoint: {

		address: entryPoint07Address,

		version: "0.7",

	},

});

Create the signer

MetaMask Smart Accounts can work with a variety of signing algorithms such as ECDSA, passkeys, and multisig.

For example, to create a signer based on a private key:

const delegateSigner = privateKeyToAccount("0xPRIVATE_KEY");

Create the delegate smart account

For a full list of options for creating a MetaMask smart account, take a look at the MetaMask's documentation page for toMetaMaskSmartAccount.

With a delegate signer, you can create a MetaMask delegate account as such:

const delegateSmartAccount = await toMetaMaskSmartAccount({

	client: publicClient,

	implementation: Implementation.Hybrid,

	deployParams: [delegateSigner.address, [], [], []],

	deploySalt: "0x",

	signatory: { account: delegateSigner },

});

Create a delegation

This example passes an empty caveats array, which means the delegate can perform any action on the delegator's behalf. We recommend restricting the delegation by adding caveat enforcers.

import { createDelegation } from "@metamask/delegation-toolkit";

 

const delegation = createDelegation({

	to: delegateSmartAccount.address,

	from: delegatorSmartAccount.address,

	caveats: [],

});

Sign the delegation

const signature = await delegatorSmartAccount.signDelegation({

	delegation,

});

 

const signedDelegation = {

	...delegation,

	signature,

};

Create the smart account client

const delegateSmartAccountClient = createSmartAccountClient({

	account: delegateSmartAccount,

	chain: sepolia,

	paymaster: paymasterClient,

	bundlerTransport: http(

		"https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY",

	),

	userOperation: {

		estimateFeesPerGas: async () =>

			(await paymasterClient.getUserOperationGasPrice()).fast,

	},

});

Send transactions using signed delegation

import { DelegationManager } from "@metamask/delegation-toolkit/contracts";

import { SINGLE_DEFAULT_MODE } from "@metamask/delegation-toolkit/utils";

import { createExecution } from "@metamask/delegation-toolkit";

 

const delegations = [signedDelegation];

 

// Actual execution to be performed by the delegate account

const executions = [

	createExecution({

		target: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",

		callData: encodeFunctionData({

			abi: tokenAbi,

			functionName: "mint",

			args: ["0x_MY_ADDRESS_TO_MINT_TOKENS", parseEther("1")],

		}),

	}),

];

 

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({

	delegations: [delegations],

	modes: [SINGLE_DEFAULT_MODE],

	executions: [executions],

});

 

const txHash = await delegateSmartAccountClient.sendTransaction({

	calls: [

		{

			to: delegateSmartAccount.address,

			data: redeemDelegationCalldata,

		},

	],

});

have you also learn from metamask ofc docs:

# Configure the Smart Accounts Kit

The Smart Accounts Kit is highly configurable, providing support for custom [bundlers and paymasters](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/#configure-the-bundler).

You can also configure the [toolkit environment](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/#optional-configure-the-toolkit-environment) to interact with the [Delegation Framework](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-framework).

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Configure the bundler​

The toolkit uses Viem's Account Abstraction API to configure custom bundlers and paymasters.

This provides a robust and flexible foundation for creating and managing [MetaMask Smart Accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/).

See Viem's [account abstraction documentation](https://viem.sh/account-abstraction) for more information on the API's features, methods, and best practices.

To use the bundler and paymaster clients with the toolkit, create instances of these clients and configure them as follows:

```

import {

  createPaymasterClient,

  createBundlerClient,

} from "viem/account-abstraction";

import { http } from "viem";

import { sepolia as chain } from "viem/chains"; 

// Replace these URLs with your actual bundler and paymaster endpoints.

const bundlerUrl = "https://your-bundler-url.com";

const paymasterUrl = "https://your-paymaster-url.com";

// The paymaster is optional.

const paymasterClient = createPaymasterClient({

  transport: http(paymasterUrl),

});

const bundlerClient = createBundlerClient({

  transport: http(bundlerUrl),

  paymaster: paymasterClient,

  chain,

});

```

Replace the bundler and paymaster URLs with your bundler and paymaster endpoints.

For example, you can use endpoints from [Pimlico](https://docs.pimlico.io/references/bundler), [Infura](https://docs.metamask.io/services/), or [ZeroDev](https://docs.zerodev.app/meta-infra/intro).

Providing a paymaster is optional when configuring your bundler client. However, if you choose not to use a paymaster, the smart contract account must have enough funds to pay gas fees.

## (Optional) Configure the toolkit environment​

The toolkit environment (`SmartAccountsEnvironment`) defines the contract addresses necessary for interacting with the [Delegation Framework](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-framework) on a specific network.

It serves several key purposes:

- It provides a centralized configuration for all the contract addresses required by the Delegation Framework.

- It enables easy switching between different networks (for example, Mainnet and testnet) or custom deployments.

- It ensures consistency across different parts of the application that interact with the Delegation Framework.

### Resolve the environment​

When you create a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/), the toolkit automatically

resolves the environment based on the version it requires and the chain configured.

If no environment is found for the specified chain, it throws an error.

```

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { delegatorSmartAccount } from "./config.ts";

const environment: SmartAccountsEnvironment = delegatorSmartAccount.environment; 

```

See the changelog of the toolkit version you are using (in the left sidebar) for supported chains.

Alternatively, you can use the [getSmartAccountsEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#getsmartaccountsenvironment) function to resolve the environment.

This function is especially useful if your delegator is not a smart account when

creating a [redelegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-types).

```

import { 

  getSmartAccountsEnvironment, 

  SmartAccountsEnvironment, 

} from "@metamask/smart-accounts-kit"; 

// Resolves the SmartAccountsEnvironment for Sepolia

const environment: SmartAccountsEnvironment = getSmartAccountsEnvironment(11155111);

```

### Deploy a custom environment​

You can deploy the contracts using any method, but the toolkit provides a convenient [deployDelegatorEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#deploydelegatorenvironment) function. This function simplifies deploying the Delegation Framework contracts to your desired EVM chain.

This function requires a Viem [Public Client](https://viem.sh/docs/clients/public), [Wallet Client](https://viem.sh/docs/clients/wallet), and [Chain](https://viem.sh/docs/glossary/types#chain)

to deploy the contracts and resolve the `SmartAccountsEnvironment`.

Your wallet must have a sufficient native token balance to deploy the contracts.

```

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { deployDeleGatorEnvironment } from "@metamask/smart-accounts-kit/utils";

const environment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain

);

```

You can also override specific contracts when calling `deployDelegatorEnvironment`.

For example, if you've already deployed the `EntryPoint` contract on the target chain, you can pass the contract address to the function.

```

// The config.ts is the same as in the previous example.

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { deployDeleGatorEnvironment } from "@metamask/smart-accounts-kit/utils";

const environment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain,

+ {

+   EntryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032"

+ }

);

```

Once the contracts are deployed, you can use them to override the environment.

### Override the environment​

To override the environment, the toolkit provides an [overrideDeployedEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#overridedeployedenvironment) function to resolve

`SmartAccountsEnvironment` with specified contracts for the given chain and contract version.

```

// The config.ts is the same as in the previous example.

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { 

  overrideDeployedEnvironment,

  deployDeleGatorEnvironment 

} from "@metamask/smart-accounts-kit";

const environment: SmartAccountsEnvironment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain

);

overrideDeployedEnvironment(

  chain.id,

  "1.3.0",

  environment,

);

```

If you've already deployed the contracts using a different method, you can create a `DelegatorEnvironment` instance with the required contract addresses, and pass it to the function.

```

- import { walletClient, publicClient } from "./config.ts";

- import { sepolia as chain } from "viem/chains";

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { 

  overrideDeployedEnvironment,

- deployDeleGatorEnvironment

} from "@metamask/smart-accounts-kit";

- const environment: SmartAccountsEnvironment = await deployDeleGatorEnvironment(

-  walletClient, 

-  publicClient, 

-  chain

- );

+ const environment: SmartAccountsEnvironment = {

+  SimpleFactory: "0x124..",

+  // ...

+  implementations: {

+    // ...

+  },

+ };

overrideDeployedEnvironment(

  chain.id,

  "1.3.0",

  environment

);

```

Make sure to specify the Delegation Framework version required by the toolkit.

See the changelog of the toolkit version you are using (in the left sidebar) for its required Framework version.

# Create a smart account

You can enable users to create a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) directly in your dapp.

This page provides examples of using [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) with Viem Core SDK to create different types of smart accounts with different signature schemes.

An account's supported *signatories* can sign data on behalf of the smart account.

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Create a Hybrid smart account​

A Hybrid smart account supports both an externally owned account (EOA) owner and any number of passkey (WebAuthn) signers.

You can create a Hybrid smart account with the following types of signers.

### Create a Hybrid smart account with an Account signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount), and Viem's [privateKeyToAccount and generatePrivateKey](https://viem.sh/docs/accounts/local/privateKeyToAccount), to create a Hybrid smart account with a signer from a randomly generated private key:

```

import { publicClient } from "./client.ts"

import { account } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [account.address, [], [], []],

  deploySalt: "0x",

  signer: { account },

});

```

### Create a Hybrid smart account with a Wallet Client signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) to create a Hybrid smart account with a Wallet Client signer:

```

import { publicClient } from "./client.ts"

import { walletClient } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const addresses = await walletClient.getAddresses();

const owner = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [owner, [], [], []],

  deploySalt: "0x",

  signer: { walletClient },

});

```

### Create a Hybrid smart account with a passkey signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [toWebAuthnAccount](https://viem.sh/account-abstraction/accounts/webauthn) to create a Hybrid smart account with a passkey (WebAuthn) signer:

To work with WebAuthn, install the [Ox SDK](https://oxlib.sh/).

```

import { publicClient } from "./client.ts"

import { webAuthnAccount, credential } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

import { Address, PublicKey } from "ox";

import { toHex } from "viem";

// Deserialize compressed public key

const publicKey = PublicKey.fromHex(credential.publicKey);

// Convert public key to address

const owner = Address.fromPublicKey(publicKey);

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [owner, [toHex(credential.id)], [publicKey.x], [publicKey.y]],

  deploySalt: "0x",

  signer: { webAuthnAccount, keyId: toHex(credential.id) },

});

```

## Create a Multisig smart account​

A [Multisig smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#multisig-smart-account) supports multiple EOA signers with a configurable threshold for execution.

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) to create a Multsig smart account with a combination of account signers and Wallet Client signers:

```

import { publicClient } from "./client.ts";

import { account, walletClient } from "./signers.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const owners = [ account.address, walletClient.address ];

const signer = [ { account }, { walletClient } ];

const threshold = 2n

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.MultiSig,

  deployParams: [owners, threshold],

  deploySalt: "0x",

  signer,

});

```

The number of signers in the signatories must be at least equal to the threshold for valid signature generation.

## Create a Stateless 7702 smart account​

A [Stateless 7702 smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#stateless-7702-smart-account) represents an EOA that has been upgraded to support MetaMask Smart Accounts

functionality as defined by [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702).

This implementation does not handle the upgrade process; see the [EIP-7702 quickstart](https://docs.metamask.io/smart-accounts-kit/get-started/smart-account-quickstart/eip7702/) to learn how to upgrade.

You can create a Stateless 7702 smart account with the following types of signatories.

### Create a Stateless 7702 smart account with an account signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [privateKeyToAccount](https://viem.sh/docs/accounts/local/privateKeyToAccount) to create a Stateless 7702 smart account with a signer from a private key:

```

import { publicClient } from "./client.ts";

import { account } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Stateless7702,

  address: account.address // Address of the upgraded EOA

  signer: { account },

});

```

### Create a Stateless 7702 smart account with a Wallet Client signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) to create a Stateless 7702 smart account with a Wallet Client signer:

```

import { publicClient } from "./client.ts";

import { walletClient } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const addresses = await walletClient.getAddresses();

const address = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Stateless7702,

  address, // Address of the upgraded EOA

  signer: { walletClient },

});

```

## Next steps​

With a MetaMask smart account, you can perform the following functions:

- In conjunction with [Viem Account Abstraction clients](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/), [deploy the smart account](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/deploy-smart-account/)

and [send user operations](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-user-operation/).

- [Create delegations](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/) that can be used to grant specific rights and permissions to other accounts.

Smart accounts that create delegations are called *delegator accounts*.

# Deploy a smart account

You can deploy MetaMask Smart Accounts in two different ways. You can either deploy a smart account automatically when sending

the first user operation, or manually deploy the account.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Deploy with the first user operation​

When you send the first user operation from a smart account, the Smart Accounts Kit checks whether the account is already deployed. If the account

is not deployed, the toolkit adds the `initCode` to the user operation to deploy the account within the

same operation. Internally, the `initCode` is encoded using the `factory` and `factoryData`.

```

import { bundlerClient, smartAccount } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001"),

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas

});

```

## Deploy manually​

To deploy a smart account manually, call the [getFactoryArgs](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#getfactoryargs)

method from the smart account to retrieve the `factory` and `factoryData`. This allows you to use a relay account to sponsor the deployment without needing a paymaster.

The `factory` represents the contract address responsible for deploying the smart account, while `factoryData` contains the

calldata that will be executed by the `factory` to deploy the smart account.

The relay account can be either an externally owned account (EOA) or another smart account. This example uses an EOA.

```

import { walletClient, smartAccount } from "./config.ts";

const { factory, factoryData } = await smartAccount.getFactoryArgs();

// Deploy smart account using relay account.

const hash = await walletClient.sendTransaction({

  to: factory,

  data: factoryData,

})

```

## Next steps​

- Learn more about [sending user operations](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-user-operation/).

- To sponsor gas for end users, see how to [send a gasless transaction](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-gasless-transaction/).

# Send a user operation

User operations are the [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) counterpart to traditional blockchain transactions.

They incorporate significant enhancements that improve user experience and provide greater

flexibility in account management and transaction execution.

Viem's Account Abstraction API allows a developer to specify an array of `Calls` that will be executed as a user operation via Viem's [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation) method.

The MetaMask Smart Accounts Kit encodes and executes the provided calls.

User operations are not directly sent to the network.

Instead, they are sent to a bundler, which validates, optimizes, and aggregates them before network submission.

See [Viem's Bundler Client](https://viem.sh/account-abstraction/clients/bundler) for details on how to interact with the bundler.

If a user operation is sent from a MetaMask smart account that has not been deployed, the toolkit configures the user operation to automatically deploy the account.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Send a user operation​

The following is a simplified example of sending a user operation using Viem Core SDK. Viem Core SDK offers more granular control for developers who require it.

In the example, a user operation is created with the necessary gas limits.

This user operation is passed to a bundler instance, and the `EntryPoint` address is retrieved from the client.

```

import { bundlerClient, smartAccount } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001")

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas

});

```

### Estimate fee per gas​

Different bundlers have different ways to estimate `maxFeePerGas` and `maxPriorityFeePerGas`, and can reject requests with insufficient values.

The following example updates the previous example to estimate the fees.

This example uses constant values, but the [Hello Gator example](https://github.com/MetaMask/hello-gator) uses Pimlico's Alto bundler,

which fetches user operation gas price using the RPC method [pimlico_getUserOperationPrice](https://docs.pimlico.io/infra/bundler/endpoints/pimlico_getUserOperationGasPrice).

To estimate the gas fee for Pimlico's bundler, install the [permissionless.js SDK](https://docs.pimlico.io/references/permissionless/).

```

+ import { createPimlicoClient } from "permissionless/clients/pimlico";

import { parseEther } from "viem";

import { bundlerClient, smartAccount } from "./config.ts" // The config.ts is the same as in the previous example.

- const maxFeePerGas = 1n;

- const maxPriorityFeePerGas = 1n;

+ const pimlicoClient = createPimlicoClient({

+   transport: http("https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>"), // You can get the API Key from the Pimlico dashboard.

+ });

+

+ const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("1")

    }

  ],

-  maxFeePerGas,

-  maxPriorityFeePerGas

+  ...fee

});

```

### Wait for the transaction receipt​

After submitting the user operation, it's crucial to wait for the receipt to ensure that it has been successfully included in the blockchain. Use the `waitForUserOperationReceipt` method provided by the bundler client.

```

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { bundlerClient, smartAccount } from "./config.ts" // The config.ts is the same as in the previous example.

const pimlicoClient = createPimlicoClient({

  transport: http("https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>"), // You can get the API Key from the Pimlico dashboard.

});

const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("1")

    }

  ],

  ...fee

});

+ const { receipt } = await bundlerClient.waitForUserOperationReceipt({

+   hash: userOperationHash

+ });

+

+ console.log(receipt.transactionHash);

```

## Next steps​

To sponsor gas for end users, see how to [send a gasless transaction](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-gasless-transaction/).

# Send a gasless transaction

MetaMask Smart Accounts support gas sponsorship, which simplifies onboarding by abstracting gas fees away from end users.

You can use any paymaster service provider, such as [Pimlico](https://docs.pimlico.io/references/paymaster) or [ZeroDev](https://docs.zerodev.app/meta-infra/rpcs), or plug in your own custom paymaster.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Send a gasless transaction​

The following example demonstrates how to use Viem's [Paymaster Client](https://viem.sh/account-abstraction/clients/paymaster) to send gasless transactions.

You can provide the paymaster client using the paymaster property in the [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation#paymaster-optional) method, or in the [Bundler Client](https://viem.sh/account-abstraction/clients/bundler#paymaster-optional).

In this example, the paymaster client is passed to the `sendUserOperation` method.

```

import { bundlerClient, smartAccount, paymasterClient } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001")

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas,

  paymaster: paymasterClient,

});

```

# Generate a multisig signature

The Smart Accounts Kit supports [Multisig smart accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#multisig-smart-account),

allowing you to add multiple externally owned accounts (EOA)

signers with a configurable execution threshold. When the threshold

is greater than 1, you can collect signatures from the required signers

and use the [aggregateSignature](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#aggregatesignature) function to combine them

into a single aggregated signature.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a Multisig smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/#create-a-multisig-smart-account)

## Generate a multisig signature​

The following example configures a Multisig smart account with two different signers: Alice

and Bob. The account has a threshold of 2, meaning that signatures from

both parties are required for any execution.

```

import { 

  bundlerClient, 

  aliceSmartAccount, 

  bobSmartAccount,

  aliceAccount,

  bobAccount,

} from "./config.ts";

import { aggregateSignature } from "@metamask/smart-accounts-kit";

const userOperation = await bundlerClient.prepareUserOperation({

  account: aliceSmartAccount,

  calls: [

    {

      target: zeroAddress,

      value: 0n,

      data: "0x",

    }

  ]

});

const aliceSignature = await aliceSmartAccount.signUserOperation(userOperation);

const bobSignature = await bobSmartAccount.signUserOperation(userOperation);

const aggregatedSignature = aggregateSignature({

  signatures: [{

    signer: aliceAccount.address,

    signature: aliceSignature,

    type: "ECDSA",

  }, {

    signer: bobAccount.address,

    signature: bobSignature,

    type: "ECDSA",

  }],

});

```

# Perform executions on a smart account's behalf

[Delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/) is the ability for a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) to grant permission to another account to perform executions on its behalf.

In this guide, you'll create a delegator account (Alice) and a delegate account (Bob), and grant Bob permission to perform executions on Alice's behalf.

You'll complete the delegation lifecycle (create, sign, and redeem a delegation).

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Steps​

### 1. Create a Public Client​

Create a [Viem Public Client](https://viem.sh/docs/clients/public) using Viem's `createPublicClient` function.

You will configure Alice's account (the delegator) and the Bundler Client with the Public Client, which you can use to query the signer's account state and interact with smart contracts.

```

import { createPublicClient, http } from "viem"

import { sepolia as chain } from "viem/chains"

const publicClient = createPublicClient({

  chain,

  transport: http(),

})

```

### 2. Create a Bundler Client​

Create a [Viem Bundler Client](https://viem.sh/account-abstraction/clients/bundler) using Viem's `createBundlerClient` function.

You can use the bundler service to estimate gas for user operations and submit transactions to the network.

```

import { createBundlerClient } from "viem/account-abstraction"

const bundlerClient = createBundlerClient({

  client: publicClient,

  transport: http("https://your-bundler-rpc.com"),

})

```

### 3. Create a delegator account​

Create an account to represent Alice, the delegator who will create a delegation.

The delegator must be a MetaMask smart account; use the toolkit's [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) method to create the delegator account.

A Hybrid smart account is a flexible smart account implementation that supports both an externally owned account (EOA) owner and any number of P256 (passkey) signers.

This examples configures a [Hybrid smart account with an Account signer](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/#create-a-hybrid-smart-account-with-an-account-signer):

```

import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

import { privateKeyToAccount } from "viem/accounts"

const delegatorAccount = privateKeyToAccount("0x...")

const delegatorSmartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [delegatorAccount.address, [], [], []],

  deploySalt: "0x",

  signer: { account: delegatorAccount },

})

```

See [how to configure other smart account types](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/).

### 4. Create a delegate account​

Create an account to represent Bob, the delegate who will receive the delegation. The delegate can be a smart account or an externally owned account (EOA):

```

import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

import { privateKeyToAccount } from "viem/accounts"

const delegateAccount = privateKeyToAccount("0x...")

const delegateSmartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid, // Hybrid smart account

  deployParams: [delegateAccount.address, [], [], []],

  deploySalt: "0x",

  signer: { account: delegateAccount },

})

```

### 5. Create a delegation​

Create a [root delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-types) from Alice to Bob.

With a root delegation, Alice is delegating her own authority away, as opposed to *redelegating* permissions she received from a previous delegation.

Use the toolkit's [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation) method to create a root delegation. When creating

delegation, you need to configure the scope of the delegation to define the initial authority.

This example uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-transfer-scope) scope, allowing Alice to delegate to Bob the ability to spend her USDC, with a

specified limit on the total amount.

Before creating a delegation, ensure that the delegator account (in this example, Alice's account) has been deployed. If the account is not deployed, redeeming the delegation will fail.

```

import { createDelegation } from "@metamask/smart-accounts-kit"

import { parseUnits } from "viem"

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const delegation = createDelegation({

  to: delegateSmartAccount.address, // This example uses a delegate smart account

  from: delegatorSmartAccount.address,

  environment: delegatorSmartAccount.environment

  scope: {

    type: "erc20TransferAmount",

    tokenAddress,

    // 10 USDC 

    maxAmount: parseUnits("10", 6),

  },

})

```

### 6. Sign the delegation​

Sign the delegation with Alice's account, using the [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#signdelegation) method from `MetaMaskSmartAccount`. Alternatively, you can use the toolkit's [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#signdelegation) utility method. Bob will later use the signed delegation to perform actions on Alice's behalf.

```

const signature = await delegatorSmartAccount.signDelegation({

  delegation,

})

const signedDelegation = {

  ...delegation,

  signature,

}

```

### 7. Redeem the delegation​

Bob can now redeem the delegation. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on Alice's behalf.

To prepare the calldata for the redeem transaction, use the [redeemDelegations](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#redeemdelegations) method from `DelegationManager`.

Since Bob is redeeming a single delegation chain, use the [SingleDefault](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#execution-modes) execution mode.

Bob can redeem the delegation by submitting a user operation if his account is a smart account, or a regular transaction if his account is an EOA. In this example, Bob transfers 1 USDC from Alice’s account to his own.

```

import { createExecution, ExecutionMode } from "@metamask/smart-accounts-kit"

import { DelegationManager } from "@metamask/smart-accounts-kit/contracts"

import { zeroAddress } from "viem"

import { callData } from "./config.ts"

const delegations = [signedDelegation]

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const executions = createExecution({ target: tokenAddress, callData })

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({

  delegations: [delegations],

  modes: [ExecutionMode.SingleDefault],

  executions: [executions],

})

const userOperationHash = await bundlerClient.sendUserOperation({

  account: delegateSmartAccount,

  calls: [

    {

      to: delegateSmartAccount.address,

      data: redeemDelegationCalldata,

    },

  ],

  maxFeePerGas: 1n,

  maxPriorityFeePerGas: 1n,

})

```

## Next steps​

- See [how to configure different scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/) to define the initial authority of a delegation.

- See [how to further refine the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

- See [how to disable a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/disable-delegation/) to revoke permissions.

# Use delegation scopes

When [creating a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/), you can configure a scope to define the delegation's initial authority and help prevent delegation misuse.

You can further constrain this initial authority by [adding caveats to a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/).

The Smart Accounts Kit currently supports three categories of scopes:

| Scope type | Description |

| --- | --- |

| Spending limit scopes | Restricts the spending of native, ERC-20, and ERC-721 tokens based on defined conditions. |

| Function call scope | Restricts the delegation to specific contract methods, contract addresses, or calldata. |

| Ownership transfer scope | Restricts the delegation to only allow ownership transfers, specifically the transferOwnership function for a specified contract. |

# Use spending limit scopes

Spending limit scopes define how much a delegate can spend in native, ERC-20, or ERC-721 tokens.

You can set transfer limits with or without time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## ERC-20 periodic scope​

This scope ensures a per-period limit for ERC-20 token transfers.

You set the amount, period, and start data.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day.

Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20PeriodTransfer",

    tokenAddress: "0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da",

    // USDC has 6 decimal places.

    periodAmount: parseUnits("10", 6),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 streaming scope​

This scopes ensures a linear streaming transfer limit for ERC-20 tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20Streaming",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    amountPerSecond: parseUnits("0.1", 6),

    initialAmount: parseUnits("10", 6),

    maxAmount: parseUnits("100", 6),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 transfer scope​

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions.

Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    maxAmount: parseUnits("10", 6),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-721 scope​

This scope limits the delegation to ERC-721 token transfers only.

For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer.

See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const delegation = createDelegation({

  scope: {

    type: "erc721Transfer",

    tokenAddress: "0x3fF528De37cd95b67845C1c55303e7685c72F319",

    tokenId: 1n,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token periodic scope​

This scope ensures a per-period limit for native token transfers.

You set the amount, period, and start date.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

Bob can transfer a total of 0.01 ETH per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenPeriodTransfer",

    periodAmount: parseEther("0.01"),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token streaming scope​

This scopes ensures a linear streaming transfer limit for native tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenStreaming",

    amountPerSecond: parseEther("0.001"),

    initialAmount: parseEther("0.01"),

    maxAmount: parseEther("0.1"),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token transfer scope​

This scope ensures that native token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

Bob may use the 0.1 ETH in a single transaction or make multiple transactions, as long as the total does not exceed 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

const delegation = createDelegation({

  scope: {

    type: "nativeTokenTransferAmount",

    maxAmount: parseEther("0.001"),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Use spending limit scopes

Spending limit scopes define how much a delegate can spend in native, ERC-20, or ERC-721 tokens.

You can set transfer limits with or without time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## ERC-20 periodic scope​

This scope ensures a per-period limit for ERC-20 token transfers.

You set the amount, period, and start data.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day.

Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20PeriodTransfer",

    tokenAddress: "0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da",

    // USDC has 6 decimal places.

    periodAmount: parseUnits("10", 6),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 streaming scope​

This scopes ensures a linear streaming transfer limit for ERC-20 tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20Streaming",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    amountPerSecond: parseUnits("0.1", 6),

    initialAmount: parseUnits("10", 6),

    maxAmount: parseUnits("100", 6),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 transfer scope​

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions.

Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    maxAmount: parseUnits("10", 6),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-721 scope​

This scope limits the delegation to ERC-721 token transfers only.

For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer.

See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const delegation = createDelegation({

  scope: {

    type: "erc721Transfer",

    tokenAddress: "0x3fF528De37cd95b67845C1c55303e7685c72F319",

    tokenId: 1n,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token periodic scope​

This scope ensures a per-period limit for native token transfers.

You set the amount, period, and start date.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

Bob can transfer a total of 0.01 ETH per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenPeriodTransfer",

    periodAmount: parseEther("0.01"),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token streaming scope​

This scopes ensures a linear streaming transfer limit for native tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenStreaming",

    amountPerSecond: parseEther("0.001"),

    initialAmount: parseEther("0.01"),

    maxAmount: parseEther("0.1"),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token transfer scope​

This scope ensures that native token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

Bob may use the 0.1 ETH in a single transaction or make multiple transactions, as long as the total does not exceed 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

const delegation = createDelegation({

  scope: {

    type: "nativeTokenTransferAmount",

    maxAmount: parseEther("0.001"),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Use the ownership transfer scope

The ownership transfer scope restricts a delegation to ownership transfer calls only.

For example, Alice has deployed a smart contract, and she delegates to Bob the ability to transfer ownership of that contract.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## Ownership transfer scope​

This scope requires a `contractAddress`, which represents the address of the deployed contract.

Internally, this scope uses the [ownershipTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#ownershiptransfer) caveat enforcer.

See the [ownership transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#ownership-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const contractAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const delegation = createDelegation({

  scope: {

    type: "ownershipTransfer",

    contractAddress,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Constrain a delegation scope

[Delegation scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/) define the delegation's initial authority and help prevent delegation misuse.

You can further constrain these scopes and limit the delegation's authority by applying [caveat enforcers](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/caveat-enforcers/).

## Prerequisites​

[Configure a delegation scope.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/)

## Apply a caveat enforcer​

For example, Alice creates a delegation with an [ERC-20 transfer scope](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-transfer-scope) that allows Bob to spend up to 10 USDC.

If Alice wants to further restrict the scope to limit Bob's delegation to be valid for only seven days,

she can apply the [timestamp](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#timestamp) caveat enforcer.

The following example creates a delegation using [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation), applies the ERC-20 transfer scope with a spending limit of 10 USDC, and applies the `timestamp` caveat enforcer to restrict the delegation's validity to a seven-day period:

```

import { createDelegation } from "@metamask/smart-accounts-kit";

// Convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// Seven days after current time.

const beforeThreshold = currentTime + 604800;

const caveats = [{

  type: "timestamp",

  afterThreshold: currentTime,

  beforeThreshold, 

}];

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    maxAmount: 10000n,

  },

  // Apply caveats to the delegation.

  caveats,

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

- See the [caveats reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/) for the full list of caveat types and their parameters.

- For more specific or custom control, you can also [create custom caveat enforcers](https://docs.metamask.io/tutorials/create-custom-caveat-enforcer/)

and apply them to delegations.

# Check the delegation state

When using [spending limit delegation scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/) or relevant [caveat enforcers](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/),

you might need to check the remaining transferrable amount in a delegation.

For example, if a delegation allows a user to spend 10 USDC per week and they have already spent 10 - n USDC in the current period,

you can determine how much of the allowance is still available for transfer.

Use the `CaveatEnforcerClient` to check the available balances for specific scopes or caveats.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

- [Create a delegation with an ERC-20 periodic scope.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-periodic-scope)

## Create a CaveatEnforcerClient​

To check the delegation state, create a [CaveatEnforcerClient](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/).

This client allows you to interact with the caveat enforcers of the delegation, and read the required state.

```

import { environment, publicClient as client } from './config.ts'

import { createCaveatEnforcerClient } from '@metamask/smart-accounts-kit'

const caveatEnforcerClient = createCaveatEnforcerClient({

  environment,

  client,

})

```

## Read the caveat enforcer state​

This example uses the [getErc20PeriodTransferEnforcerAvailableAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/#geterc20periodtransferenforceravailableamount) method to read the state and retrieve the remaining amount for the current transfer period.

```

import { delegation } './config.ts'

// Returns the available amount for current period. 

const { availableAmount } = await caveatEnforcerClient.getErc20PeriodTransferEnforcerAvailableAmount({

  delegation,

})

```

## Next steps​

See the [Caveat Enforcer Client reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/) for the full list of available methods.

# Perform executions on a MetaMask user's behalf

[Advanced Permissions (ERC-7115)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) are fine-grained permissions that your dapp can request from a MetaMask user to execute transactions on their

behalf. For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course

of a month. Once the permission is granted, your dapp can use the allocated 10 USDC each day to

purchase ETH directly from the MetaMask user's account.

In this guide, you'll request an ERC-20 periodic transfer permission from a MetaMask user to transfer 1 USDC every day on their behalf.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Install MetaMask Flask 13.5.0 or later.](https://docs.metamask.io/snaps/get-started/install-flask/)

### 1. Set up a Wallet Client​

Set up a [Viem Wallet Client](https://viem.sh/docs/clients/wallet) using Viem's `createWalletClient` function. This client will

help you interact with MetaMask Flask.

Then, extend the Wallet Client functionality using `erc7715ProviderActions`. These actions enable you to request Advanced Permissions from the user.

```

import { createWalletClient, custom } from "viem";

import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";

const walletClient = createWalletClient({

  transport: custom(window.ethereum),

}).extend(erc7715ProviderActions());

```

### 2. Set up a Public Client​

Set up a [Viem Public Client](https://viem.sh/docs/clients/public) using Viem's `createPublicClient` function.

This client will help you query the account state and interact with the blockchain network.

```

import { createPublicClient, http } from "viem";

import { sepolia as chain } from "viem/chains";

 

const publicClient = createPublicClient({

  chain,

  transport: http(),

});

```

### 3. Set up a session account​

Set up a session account which can either be a smart account or an externally owned account (EOA)

to request Advanced Permissions. The requested permissions are granted to the session account, which

is responsible for executing transactions on behalf of the user.

```

import { privateKeyToAccount } from "viem/accounts";

import { 

  toMetaMaskSmartAccount, 

  Implementation 

} from "@metamask/smart-accounts-kit";

const privateKey = "0x...";

const account = privateKeyToAccount(privateKey);

const sessionAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [account.address, [], [], []],

  deploySalt: "0x",

  signer: { account },

});

```

### 4. Check the EOA account code​

Advanced Permissions support the automatic upgrading of a MetaMask user's account to a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/),

when using MetaMask Flask version 13.9.0 or later. For earlier versions, you must ensure that the

user is upgraded to a smart account before requesting Advanced Permissions.

If the user has not yet been upgraded, you can handle the upgrade [programmatically](https://docs.metamask.io/wallet/how-to/send-transactions/send-batch-transactions/#about-atomic-batch-transactions) or ask the

user to [switch to a smart account manually](https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account/#how-to-switch-to-a-metamask-smart-account).

MetaMask's Advanced Permissions (ERC-7115) implementation requires the user to be upgraded to a MetaMask

Smart Account because, under the hood, you're requesting a signature for an [ERC-7710 delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/).

ERC-7710 delegation is one of the core features supported only by MetaMask Smart Accounts.

```

import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { sepolia as chain } from "viem/chains";

const addresses = await walletClient.requestAddresses();

const address = addresses[0];

// Get the EOA account code

const code = await publicClient.getCode({

  address,

});

if (code) {

  // The address to which EOA has delegated. According to EIP-7702, 0xef0100 || address

  // represents the delegation. 

  // 

  // You need to remove the first 8 characters (0xef0100) to get the delegator address.

  const delegatorAddress = `0x${code.substring(8)}`;

  const statelessDelegatorAddress = getSmartAccountsEnvironment(chain.id)

  .implementations

  .EIP7702StatelessDeleGatorImpl;

  // If account is not upgraded to MetaMask smart account, you can

  // either upgrade programmatically or ask the user to switch to a smart account manually.

  const isAccountUpgraded = delegatorAddress.toLowerCase() === statelessDelegatorAddress.toLowerCase();

}

```

### 5. Request Advanced Permissions​

Request Advanced Permissions from the user using the Wallet Client's `requestExecutionPermissions` action.

In this example, you'll request an

[ERC-20 periodic permission](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/#erc-20-periodic-permission).

See the [requestExecutionPermissions](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#requestexecutionpermissions) API reference for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

// Since current time is in seconds, we need to convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // The requested permissions will granted to the

      // session account.

      address: sessionAccount.address,

    },

  },

  permission: {

    type: "erc20-token-periodic",

    data: {

      tokenAddress,

      // 1 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6

      periodAmount: parseUnits("10", 6),

      // 1 day in seconds

      periodDuration: 86400,

      justification?: "Permission to transfer 1 USDC every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

### 6. Set up a Viem client​

Set up a Viem client depending on your session account type.

For a smart account, set up a [Viem Bundler Client](https://viem.sh/account-abstraction/clients/bundler)

using Viem's `createBundlerClient` function. This lets you use the bundler service

to estimate gas for user operations and submit transactions to the network.

For an EOA, set up a [Viem Wallet Client](https://viem.sh/docs/clients/wallet)

using Viem's `createWalletClient` function. This lets you send transactions directly to the network.

The toolkit provides public actions for both of the clients which can be used to redeem Advanced Permissions, and execute transactions on a user's behalf.

```

import { createBundlerClient } from "viem/account-abstraction";

import { erc7710BundlerActions } from "@metamask/smart-accounts-kit/actions";

const bundlerClient = createBundlerClient({

  client: publicClient,

  transport: http("https://your-bundler-rpc.com"),

  // Allows you to use the same Bundler Client as paymaster.

  paymaster: true

}).extend(erc7710BundlerActions());

```

### 7. Redeem Advanced Permissions​

The session account can now redeem the permissions. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on the user's behalf.

To redeem the permissions, use the client action based on your session account type.

A smart account uses the Bundler Client's `sendUserOperationWithDelegation` action,

and an EOA uses the Wallet Client's `sendTransactionWithDelegation` action.

See the [sendUserOperationWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/bundler-client/#senduseroperationwithdelegation) and [sendTransactionWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#sendtransactionwithdelegation) API reference for more information.

```

import { calldata } from "./config.ts";

// These properties must be extracted from the permission response.

const permissionsContext = grantedPermissions[0].context;

const delegationManager = grantedPermissions[0].signerMeta.delegationManager;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// Calls without permissionsContext and delegationManager will be executed 

// as a normal user operation.

const userOperationHash = await bundlerClient.sendUserOperationWithDelegation({

  publicClient,

  account: sessionAccount,

  calls: [

    {

      to: tokenAddress,

      data: calldata,

      permissionsContext,

      delegationManager,

    },

  ],

  // Appropriate values must be used for fee-per-gas. 

  maxFeePerGas: 1n,

  maxPriorityFeePerGas: 1n,

});

```

## Next steps​

See how to configure different [ERC-20 token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/) and

[native token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/native-token/).

# Use ERC-20 token permissions

[Advanced Permissions (ERC-7715)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) supports ERC-20 token permission types that allow you to request fine-grained

permissions for ERC-20 token transfers with time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a session account.](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/#3-set-up-a-session-account)

## ERC-20 periodic permission​

This permission type ensures a per-period limit for ERC-20 token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 10 USDC on their behalf each day. The dapp can transfer a total of

10 USDC per day; the limit resets at the beginning of the next day.

See the [ERC-20 periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-periodic-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "erc20-token-periodic",

    data: {

      tokenAddress,

      // 10 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6.

      periodAmount: parseUnits("10", 6),

      // 1 day in seconds.

      periodDuration: 86400,

      justification?: "Permission to transfer 1 USDC every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

## ERC-20 stream permission​

This permission type ensures a linear streaming transfer limit for ERC-20 tokens. Token transfers are blocked until the

defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the

configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.1 USDC per second, starting with an initial amount

of 1 USDC, up to a maximum of 2 USDC.

See the [ERC-20 stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-stream-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "erc20-token-stream",

    data: {

      tokenAddress,

      // 0.1 USDC in WEI format. Since USDC has 6 decimals, 0.1 * 10^6.

      amountPerSecond: parseUnits("0.1", 6),

      // 1 USDC in WEI format. Since USDC has 6 decimals, 1 * 10^6.

      initialAmount: parseUnits("1", 6),

      // 2 USDC in WEI format. Since USDC has 6 decimals, 2 * 10^6.

      maxAmount: parseUnits("2", 6),

      startTime: currentTime,

      justification: "Permission to use 0.1 USDC per second",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

# Use native token permissions

[Advanced Permissions (ERC-7115)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) supports native token permission types that allow you to request fine-grained

permissions for native token transfers with time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a session account.](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/#3-set-up-a-session-account)

## Native token periodic permission​

This permission type ensures a per-period limit for native token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 0.001 ETH on their behalf each day. The dapp can transfer a total of

0.001 USDC per day; the limit resets at the beginning of the next day.

See the [native token periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-periodic-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseEther } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "native-token-periodic",

    data: {

      // 0.001 ETH in wei format.

      periodAmount: parseEther("0.001"),

      // 1 hour in seconds.

      periodDuration: 86400,

      startTime: currentTime,

      justification: "Permission to use 0.001 ETH every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

## Native token stream permission​

This permission type ensures a linear streaming transfer limit for native tokens. Token transfers are blocked until the

defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the

configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.0001 ETH per second, starting with an initial amount

of 0.1 ETH, up to a maximum of 1 ETH.

See the [native token stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-stream-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseEther } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "native-token-stream",

    data: {

      // 0.0001 ETH in wei format.

      amountPerSecond: parseEther("0.0001"),

      // 0.1 ETH in wei format.

      initialAmount: parseEther("0.1"),

      // 1 ETH in wei format.

      maxAmount: parseEther("1"),

      startTime: currentTime,

      justification: "Permission to use 0.0001 ETH per second",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

# Send your first gasless transaction

A paymaster is a vital component in the ERC-4337 standard, responsible for covering transaction costs on behalf of the user. There are various types of paymasters, such as gasless paymasters, ERC-20 paymasters, and more.

In this guide, we'll talk about how you can use the Pimlico gasless Paymaster with Web3Auth Account Abstraction Provider to sponsor the transaction for your users without requiring the user to pay gas fees.

For those who want to skip straight to the code, you can find it on [GitHub](https://github.com/Web3Auth/web3auth-examples/tree/main/other/smart-account-example).

## Prerequisites​

- Pimlico Account: Since we'll be using the Pimlico paymaster, you'll need to have an API key from Pimlico. You can get a free API key from [Pimlico Dashboard](https://dashboard.pimlico.io/).

- Web3Auth Dashboard: If you haven't already, sign up on the Web3Auth platform. It is free and gives you access to the Web3Auth's base plan. Head to Web3Auth's documentation page for detailed [instructions on setting up the Web3Auth Dashboard](https://docs.metamask.io/embedded-wallets/dashboard/).

- Web3Auth PnP Web SDK: This guide assumes that you already know how to integrate the PnP Web SDK in your project. If not, you can learn how to [integrate Web3Auth in your Web app](https://docs.metamask.io/embedded-wallets/sdk/react/).

## Integrate AccountAbstractionProvider​

Once, you have set up the Web3Auth Dashboard, and created a new project, it's time to integrate Web3Auth Account Abstraction Provider in your Web application. For the implementation, we'll use the [@web3auth/account-abstraction-provider](https://www.npmjs.com/package/@web3auth/account-abstraction-provider). The provider simplifies the entire process by managing the complex logic behind configuring the account abstraction provider, bundler, and preparing user operations.

If you are already using the Web3Auth Pnp SDK in your project, you just need to configure the AccountAbstractionProvider with the paymaster details, and pass it to the Web3Auth instance. No other changes are required.

### Installation​

```

npm install --save @web3auth/account-abstraction-provider

```

### Configure Paymaster​

The AccountAbstractionProvider requires specific configurations to function correctly. One key configuration is the paymaster. Web3Auth supports custom paymaster configurations, allowing you to deploy your own paymaster and integrate it with the provider.

You can choose from a variety of paymaster services available in the ecosystem. In this guide, we'll be configuring the Pimlico's paymaster. However, it's important to note that paymaster support is not limited to the Pimlico, giving you the flexibility to integrate any compatible paymaster service that suits your requirements.

For the simplicity, we have only use `SafeSmartAccount`, but you choose your favorite smart account provider from the available ones. [Learn how to configure the smart account](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/smart-accounts/).

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from '@web3auth/account-abstraction-provider'

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: '0xaa36a7',

  rpcTarget: 'https://rpc.sepolia.org',

  displayName: 'Ethereum Sepolia Testnet',

  blockExplorerUrl: 'https://sepolia.etherscan.io',

  ticker: 'ETH',

  tickerName: 'Ethereum',

  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',

}

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

    smartAccountInit: new SafeSmartAccount(),

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

})

```

## Configure Web3Auth​

Once you have configured your `AccountAbstractionProvider`, you can now plug it in your Web3Auth Modal/No Modal instance. If you are using the external wallets like MetaMask, Coinbase, etc, you can define whether you want to use the AccountAbstractionProvider, or EthereumPrivateKeyProvider by setting the `useAAWithExternalWallet` in `IWeb3AuthCoreOptions`.

If you are setting `useAAWithExternalWallet` to `true`, it'll create a new Smart Account for your user, where the signer/creator of the Smart Account would be the external wallet.

If you are setting `useAAWithExternalWallet` to `false`, it'll skip creating a new Smart Account, and directly use the external wallet to sign the transactions.

```

import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

import { Web3Auth } from "@web3auth/modal";

const privateKeyProvider = new EthereumPrivateKeyProvider({

  // Use the chain config we declared earlier

  config: { chainConfig },

});

const web3auth = new Web3Auth({

  clientId: "YOUR_WEB3AUTH_CLIENT_ID", // Pass your Web3Auth Client ID, ideally using an environment variable

  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,

  privateKeyProvider,

  // Use the account abstraction provider we configured earlier

  accountAbstractionProvider

  // This will allow you to use EthereumPrivateKeyProvider for

  // external wallets, while use the AccountAbstractionProvider

  // for Web3Auth embedded wallets.

  useAAWithExternalWallet: false,

});

```

## Configure Signer​

The Web3Auth Smart Account feature is compatible with popular signer SDKs, including wagmi, ethers, and viem. You can choose your preferred package to configure the signer.

You can retreive the provider to configure the signer from Web3Auth instance.

Wagmi does not require any special configuration to use the signer with smart accounts. Once you have set up your Web3Auth provider and connected your wallet, Wagmi's hooks (such as useSigner or useAccount) will automatically use the smart account as the signer. You can interact with smart accounts using Wagmi just like you would with a regular EOA (Externally Owned Account) signer—no additional setup is needed.

```

import { createWalletClient } from 'viem'

// Use your Web3Auth instance to retreive the provider.

const provider = web3auth.provider

const walletClient = createWalletClient({

  transport: custom(provider),

})

```

## Send a transaction​

Developers can use their preferred signer or Wagmi hooks to initiate on-chain transactions, while Web3Auth manages the creation and submission of the UserOperation. Only the `to`, `data`, and `value` fields need to be provided. Any additional parameters will be ignored and automatically overridden.

To ensure reliable execution, the bundler client sets maxFeePerGas and maxPriorityFeePerGas values. If custom values are required, developers can use the [Viem's BundlerClient](https://viem.sh/account-abstraction/clients/bundler#bundler-client) to manually construct and send the user operation.

Since Smart Accounts are deployed smart contracts, the user's first transaction also triggers the on-chain deployment of their wallet.

```

import { useSendTransaction } from 'wagmi'

const { data: hash, sendTransaction } = useSendTransaction()

// Convert 1 ether to WEI format

const value = web3.utils.toWei(1)

sendTransaction({ to: 'DESTINATION_ADDRESS', value, data: '0x' })

const {

  data: receipt,

  isLoading: isConfirming,

  isSuccess: isConfirmed,

} = useWaitForTransactionReceipt({

  hash,

})

```

## Conclusion​

Voila, you have successfully sent your first gasless transaction using the Pimlico paymaster with Web3Auth Account Abstraction Provider. To learn more about advance features of the Account Abstraction Provider like performing batch transactions, using ERC-20 paymaster you can refer to the [Account Abstraction Provider](https://docs.metamask.io/embedded-wallets/sdk/react/) documentation.

# Smart Accounts

Effortlessly create and manage smart accounts for your users with just a few lines of code, using our Smart Account feature. Smart accounts offer enhanced control and programmability, enabling powerful features that traditional wallets can't provide.

**Key features of Smart Accounts include:**

- **Gas Abstraction:** Cover transaction fees for users, or allow users to pay for their own transactions using ERC-20 tokens.

- **Batch Transactions:** Perform multiple transactions in a single call.

- **Automated Transactions:** Allow users to automate actions, like swapping ETH to USDT when ETH hits a specific price.

- **Custom Spending Limits:** Allow users to set tailored spending limits.

> For more information about ERC-4337 and its components, check out our detailed blog post.

For more information about ERC-4337 and its components, [check out our detailed blog post](https://blog.web3auth.io/an-ultimate-guide-to-web3-wallets-externally-owned-account-and-smart-contract-wallet/#introduction-to-eip-4337).

Our smart account integration streamlines your setup, allowing you to create and manage smart accounts using your favorite libraries like Viem, Ethers, and Wagmi. You don't need to rely on third-party packages to effortlessly create ERC-4337 compatible Smart Contract Wallets (SCWs), giving users the ability to perform batch transactions and efficiently manage gas sponsorship.

This is a paid feature and the minimum [pricing plan](https://web3auth.io/pricing.html) to use this

SDK in a production environment is the **Growth Plan**. You can use this feature in Web3Auth

Sapphire Devnet network for free.

## Enabling Smart Accounts​

To enable this feature, you need to configure Smart Accounts from your project in the [Web3Auth Developer Dashboard](https://dashboard.web3auth.io/).

### Dashboard Configuration​

To enable Smart Accounts, navigate to the Smart Accounts section in the Web3Auth dashboard, and enable the "Set up Smart Accounts" toggle. Web3Auth currently supports [MetaMaskSmartAccount](https://docs.gator.metamask.io/how-to/create-delegator-account#create-a-metamasksmartaccount) as a Smart Account provider.

## Installation​

To use native account abstraction, you'll need to install the

[@web3auth/account-abstraction-provider](https://www.npmjs.com/package/@web3auth/account-abstraction-provider),

which allows you to create and interact with Smart Contract Wallets (SCWs). This provider simplifies

the entire process by managing the complex logic behind configuring the account abstraction

provider, bundler, and preparing user operations.

```

npm install --save @web3auth/account-abstraction-provider

```

## Configure​

When instantiating the Account Abstraction Provider, you can pass configuration objects to the

constructor. These configuration options allow you to select the desired Account Abstraction (AA)

provider, as well as configure the bundler and paymaster, giving you flexibility and control over

the provider.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

Please note this is the important step for setting the Web3Auth account abstraction provider.

- [Configure Smart Account provider](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#configure-smart-account-provider)

- [Configure Bundler](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#configure-bundler)

- [Configure Sponsored Paymaster](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#sponsored-paymaster)

- [Configure ERC-20 Paymaster](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#erc-20-paymaster)

## Configure Smart Account Provider​

Web3Auth offers the flexibility to choose your preferred Account Abstraction (AA) provider.

Currently, we support Safe, Kernel, Biconomy, and Trust.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Configure Bundler​

Web3Auth enables you to configure your bundler and define the paymaster context. The bundler

aggregates the UserOperations and submits them on-chain via a global entry point contract.

Bundler support is not limited to the examples below—you can use any bundler of your choice.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Configure Paymaster​

You can configure the paymaster of your choice to sponsor gas fees for your users, along with the paymaster context. The paymaster context lets you set additional parameters, such as choosing the token for ERC-20 paymasters, defining gas policies, and more.

### Sponsored Paymaster​

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

### ERC-20 Paymaster​

When using an ERC-20 paymaster, ensure you include the approval transaction, as Web3Auth does not

handle the approval internally.

For Pimlico, you can specify the token you want to use in the paymasterContext. If you want to set

up sponsorship policies, you can define those in the paymasterContext as well.

[Checkout the supported tokens for ERC-20 Paymaster on Pimlico](https://docs.pimlico.io/infra/paymaster/erc20-paymaster/supported-tokens).

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

      paymasterContext: {

        token: "SUPPORTED_TOKEN_CONTRACT_ADDRESS",

      },

    },

    smartAccountInit: new SafeSmartAccount(),

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Set up​

### Configure Web3Auth Instance​

```

import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider'

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from '@web3auth/account-abstraction-provider'

import Web3Auth, { WEB3AUTH_NETWORK } from '@web3auth/react-native-sdk'

import * as WebBrowser from '@toruslabs/react-native-web-browser'

import EncryptedStorage from 'react-native-encrypted-storage'

import { CHAIN_NAMESPACES } from '@web3auth/base'

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: '0xaa36a7',

  rpcTarget: 'https://rpc.sepolia.org',

  displayName: 'Ethereum Sepolia Testnet',

  blockExplorerUrl: 'https://sepolia.etherscan.io',

  ticker: 'ETH',

  tickerName: 'Ethereum',

  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',

}

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

    smartAccountInit: new SafeSmartAccount(),

  },

})

const privateKeyProvider = new EthereumPrivateKeyProvider({

  config: { chainConfig },

})

const web3auth = new Web3Auth(WebBrowser, EncryptedStorage, {

  clientId,

  redirectUrl,

  network: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET, // or other networks

  privateKeyProvider,

  accountAbstractionProvider: aaProvider,

})

```

### Configure Signer​

The Web3Auth Smart Account feature is compatible with popular signer SDKs, including wagmi, ethers,

and viem. You can choose your preferred package to configure the signer.

You can retreive the provider to configure the signer from Web3Auth instance.

Wagmi does not require any special configuration to use the signer with smart accounts. Once you

have set up your Web3Auth provider and connected your wallet, Wagmi's hooks (such as useSigner or

useAccount) will automatically use the smart account as the signer. You can interact with smart

accounts using Wagmi just like you would with a regular EOA (Externally Owned Account) signer—no

additional setup is needed.

```

import { createWalletClient } from "viem";

// Use your Web3Auth instance to retreive the provider.

const provider = web3auth.provider;

const walletClient = createWalletClient({

  transport: custom(provider),

});

```

## Smart Account Address​

Once the signers or Wagmi configuration is set up, it can be used to retrieve the user's Smart

Account address.

```

import { useAccount } from "wagmi";

const { address } = useAccount();

const smartAccountAddress = address;

```

## Send Transaction​

Developers can use their preferred signer or Wagmi hooks to initiate on-chain transactions, while

Web3Auth manages the creation and submission of the UserOperation. Only the `to`, `data`, and

`value` fields need to be provided. Any additional parameters will be ignored and automatically

overridden.

To ensure reliable execution, the bundler client sets maxFeePerGas and maxPriorityFeePerGas values.

If custom values are required, developers can use the

[Viem's BundlerClient](https://viem.sh/account-abstraction/clients/bundler#bundler-client) to

manually construct and send the user operation.

Since Smart Accounts are deployed smart contracts, the user's first transaction also triggers the

on-chain deployment of their wallet.

```

import { useSendTransaction } from "wagmi";

const { data: hash, sendTransaction } = useSendTransaction();

// Convert 1 ether to WEI format

const value = web3.utils.toWei(1);

sendTransaction({ to: "DESTINATION_ADDRESS", value, data: "0x" });

const {

  data: receipt,

  isLoading: isConfirming,

  isSuccess: isConfirmed,

} = useWaitForTransactionReceipt({

  hash,

});

```

## Advanced Smart Account Operations​

To learn more about supported transaction methods, and how to perform batch transactions, [checkout our detailed documentation of AccountAbstractionProvider](https://docs.metamask.io/embedded-wallets/sdk/react/).

# Advanced Permissions (ERC-7715)

The Smart Accounts Kit supports Advanced Permissions ([ERC-7715](https://eips.ethereum.org/EIPS/eip-7715)), which lets you request fine-grained permissions from a MetaMask user to execute transactions on their behalf.

For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course of a month.

Once the permission is granted, your dapp can use the allocated 10 USDC each day to purchase ETH directly from the MetaMask user's account.

Advanced Permissions eliminate the need for users to approve every transaction, which is useful for highly interactive dapps.

It also enables dapps to execute transactions for users without an active wallet connection.

This feature requires [MetaMask Flask 13.5.0](https://docs.metamask.io/snaps/get-started/install-flask/) or later.

## ERC-7715 technical overview​

[ERC-7715](https://eips.ethereum.org/EIPS/eip-7715) defines a JSON-RPC method `wallet_grantPermissions`.

Dapps can use this method to request a wallet to grant the dapp permission to execute transactions on a user's behalf.

`wallet_grantPermissions` requires a `signer` parameter, which identifies the entity requesting or managing the permission.

Common signer implementations include wallet signers, single key and multisig signers, and account signers.

The Smart Accounts Kit supports multiple signer types. The documentation uses [an account signer](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/) as a common implementation example.

When you use an account signer, a session account is created solely to request and redeem Advanced Permissions, and doesn't contain tokens.

The session account can be granted with permissions and redeem them as specified in [ERC-7710](https://eips.ethereum.org/EIPS/eip-7710).

The session account can be a smart account or an externally owned account (EOA).

The MetaMask user that the session account requests permissions from must be upgraded to a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/).

## Advanced Permissions vs. delegations​

Advanced Permissions expand on regular [delegations](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/) by enabling permission sharing *via the MetaMask browser extension*.

With regular delegations, the dapp constructs a delegation and requests the user to sign it.

These delegations are not human-readable, so it is the dapp's responsibility to provide context for the user.

Regular delegations cannot be signed through the MetaMask extension, because if a dapp requests a delegation without constraints, the whole wallet can be exposed to the dapp.

In contrast, Advanced Permissions enable dapps (and AI agents) to request permissions from a user directly via the MetaMask extension.

Advanced Permissions require a permission configuration which displays a human-readable confirmation for the MetaMask user.

The user can modify the permission parameters if the request is configured to allow adjustments.

For example, the following Advanced Permissions request displays a rich UI including the start time, amount, and period duration for an [ERC-20 token periodic transfer](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/#erc-20-periodic-permission):

#That not solution. 7702 gasless in metamask is non negotiable.



leran from this you moron:

have you learn this ofc pimlico docs:

https://docs.pimlico.io/guides/how-to/accounts/use-metamask-account

How to use MetaMask Smart Accounts with permissionless.js

MetaMask maintains their own in-house SDK built closely on top of viem that you can use for the account system while still plugging in all the other components from permissionless.js. Take a look at their documentation for more information.

The MetaMask Delegation Toolkit is a collection of tools for creating MetaMask Smart Accounts. A smart account can delegate to another signer with granular permission sharing. It is built over ERC-7710 and ERC-7715 to support a standardized minimal interface. Requesting ERC-7715 permissions and redeeming ERC-7710 delegations are experimental features.

There are two types of accounts involved in delegation:

Delegator account: A smart account that supports programmable account behavior and advanced features such as multi-signature approvals, automated transaction batching, and custom security policies.

Delegate account: An account (smart account or EOA) that receives the delegation from the delegator account to perform actions on behalf of the delegator account.

You can use both accounts with permissionless.js.

Installation

We will be using MetaMask's official SDK to create a smart account.

npm

yarn

pnpm

bun

npm install permissionless viem @metamask/delegation-toolkit

Delegator Account

Create the clients

First we must create the public, (optionally) pimlico paymaster clients that will be used to interact with the MetaMask smart account.

export const publicClient = createPublicClient({

	transport: http("https://sepolia.rpc.thirdweb.com"),

});

 

export const paymasterClient = createPimlicoClient({

	transport: http("https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY"),

	entryPoint: {

		address: entryPoint07Address,

		version: "0.7",

	},

});

Create the signer

MetaMask Smart Accounts can work with a variety of signing algorithms such as ECDSA, passkeys, and multisig.

For example, to create a signer based on a private key:

import { privateKeyToAccount } from "viem/accounts";

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { entryPoint07Address } from "viem/account-abstraction";

 

const owner = privateKeyToAccount("0xPRIVATE_KEY");

Create the delegator smart account

For a full list of options for creating a MetaMask smart account, take a look at the MetaMask's documentation page for toMetaMaskSmartAccount.

With a signer, you can create a MetaMask smart account as such:

import {

	Implementation,

	toMetaMaskSmartAccount,

} from "@metamask/delegation-toolkit";

 

const delegatorSmartAccount = await toMetaMaskSmartAccount({

	client: publicClient,

	implementation: Implementation.Hybrid,

	deployParams: [owner.address, [], [], []],

	deploySalt: "0x",

	signatory: { account: owner },

});

 

Create the smart account client

const smartAccountClient = createSmartAccountClient({

	account: delegatorSmartAccount,

	chain: sepolia,

	paymaster: paymasterClient,

	bundlerTransport: http(

		"https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY",

	),

	userOperation: {

		estimateFeesPerGas: async () =>

			(await paymasterClient.getUserOperationGasPrice()).fast,

	},

});

Send a transaction

Transactions using permissionless.js simply wrap around user operations. This means you can switch to permissionless.js from your existing viem EOA codebase with minimal-to-no changes.

const txHash = await smartAccountClient.sendTransaction({

	to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",

	value: parseEther("0.1"),

});

This also means you can also use viem Contract instances to transact without any modifications.

const nftContract = getContract({

	address: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",

	abi: tokenAbi,

	client: {

		public: publicClient,

		wallet: smartAccountClient,

	},

});

 

const txHash = await nftContract.write.mint([

	"0x_MY_ADDRESS_TO_MINT_TOKENS",

	parseEther("1"),

]);

You can also send an array of transactions in a single batch.

const userOpHash = await smartAccountClient.sendUserOperation({

	calls: [

		{

			to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",

			value: parseEther("0.1"),

			data: "0x",

		},

		{

			to: "0x1440ec793aE50fA046B95bFeCa5aF475b6003f9e",

			value: parseEther("0.1"),

			data: "0x1234",

		},

	],

});

Delegate Account

A delegate account is an account that receives the delegation from the delegator account to perform actions on behalf of the delegator account. To create a delegate account, we will follow the following steps:

Create a delegate signer

Create the delegate smart account

Create a delegation using delegator smart account

Sign the delegation

Send transactions using delegate smart account with signed delegation

Create the clients

First we must create the public, (optionally) pimlico paymaster clients that will be used to interact with the MetaMask smart account.

export const publicClient = createPublicClient({

	transport: http("https://sepolia.rpc.thirdweb.com"),

});

 

export const paymasterClient = createPimlicoClient({

	transport: http("https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY"),

	entryPoint: {

		address: entryPoint07Address,

		version: "0.7",

	},

});

Create the signer

MetaMask Smart Accounts can work with a variety of signing algorithms such as ECDSA, passkeys, and multisig.

For example, to create a signer based on a private key:

const delegateSigner = privateKeyToAccount("0xPRIVATE_KEY");

Create the delegate smart account

For a full list of options for creating a MetaMask smart account, take a look at the MetaMask's documentation page for toMetaMaskSmartAccount.

With a delegate signer, you can create a MetaMask delegate account as such:

const delegateSmartAccount = await toMetaMaskSmartAccount({

	client: publicClient,

	implementation: Implementation.Hybrid,

	deployParams: [delegateSigner.address, [], [], []],

	deploySalt: "0x",

	signatory: { account: delegateSigner },

});

Create a delegation

This example passes an empty caveats array, which means the delegate can perform any action on the delegator's behalf. We recommend restricting the delegation by adding caveat enforcers.

import { createDelegation } from "@metamask/delegation-toolkit";

 

const delegation = createDelegation({

	to: delegateSmartAccount.address,

	from: delegatorSmartAccount.address,

	caveats: [],

});

Sign the delegation

const signature = await delegatorSmartAccount.signDelegation({

	delegation,

});

 

const signedDelegation = {

	...delegation,

	signature,

};

Create the smart account client

const delegateSmartAccountClient = createSmartAccountClient({

	account: delegateSmartAccount,

	chain: sepolia,

	paymaster: paymasterClient,

	bundlerTransport: http(

		"https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY",

	),

	userOperation: {

		estimateFeesPerGas: async () =>

			(await paymasterClient.getUserOperationGasPrice()).fast,

	},

});

Send transactions using signed delegation

import { DelegationManager } from "@metamask/delegation-toolkit/contracts";

import { SINGLE_DEFAULT_MODE } from "@metamask/delegation-toolkit/utils";

import { createExecution } from "@metamask/delegation-toolkit";

 

const delegations = [signedDelegation];

 

// Actual execution to be performed by the delegate account

const executions = [

	createExecution({

		target: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",

		callData: encodeFunctionData({

			abi: tokenAbi,

			functionName: "mint",

			args: ["0x_MY_ADDRESS_TO_MINT_TOKENS", parseEther("1")],

		}),

	}),

];

 

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({

	delegations: [delegations],

	modes: [SINGLE_DEFAULT_MODE],

	executions: [executions],

});

 

const txHash = await delegateSmartAccountClient.sendTransaction({

	calls: [

		{

			to: delegateSmartAccount.address,

			data: redeemDelegationCalldata,

		},

	],

});

have you also learn from metamask ofc docs:

# Configure the Smart Accounts Kit

The Smart Accounts Kit is highly configurable, providing support for custom [bundlers and paymasters](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/#configure-the-bundler).

You can also configure the [toolkit environment](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/#optional-configure-the-toolkit-environment) to interact with the [Delegation Framework](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-framework).

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Configure the bundler​

The toolkit uses Viem's Account Abstraction API to configure custom bundlers and paymasters.

This provides a robust and flexible foundation for creating and managing [MetaMask Smart Accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/).

See Viem's [account abstraction documentation](https://viem.sh/account-abstraction) for more information on the API's features, methods, and best practices.

To use the bundler and paymaster clients with the toolkit, create instances of these clients and configure them as follows:

```

import {

  createPaymasterClient,

  createBundlerClient,

} from "viem/account-abstraction";

import { http } from "viem";

import { sepolia as chain } from "viem/chains"; 

// Replace these URLs with your actual bundler and paymaster endpoints.

const bundlerUrl = "https://your-bundler-url.com";

const paymasterUrl = "https://your-paymaster-url.com";

// The paymaster is optional.

const paymasterClient = createPaymasterClient({

  transport: http(paymasterUrl),

});

const bundlerClient = createBundlerClient({

  transport: http(bundlerUrl),

  paymaster: paymasterClient,

  chain,

});

```

Replace the bundler and paymaster URLs with your bundler and paymaster endpoints.

For example, you can use endpoints from [Pimlico](https://docs.pimlico.io/references/bundler), [Infura](https://docs.metamask.io/services/), or [ZeroDev](https://docs.zerodev.app/meta-infra/intro).

Providing a paymaster is optional when configuring your bundler client. However, if you choose not to use a paymaster, the smart contract account must have enough funds to pay gas fees.

## (Optional) Configure the toolkit environment​

The toolkit environment (`SmartAccountsEnvironment`) defines the contract addresses necessary for interacting with the [Delegation Framework](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-framework) on a specific network.

It serves several key purposes:

- It provides a centralized configuration for all the contract addresses required by the Delegation Framework.

- It enables easy switching between different networks (for example, Mainnet and testnet) or custom deployments.

- It ensures consistency across different parts of the application that interact with the Delegation Framework.

### Resolve the environment​

When you create a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/), the toolkit automatically

resolves the environment based on the version it requires and the chain configured.

If no environment is found for the specified chain, it throws an error.

```

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { delegatorSmartAccount } from "./config.ts";

const environment: SmartAccountsEnvironment = delegatorSmartAccount.environment; 

```

See the changelog of the toolkit version you are using (in the left sidebar) for supported chains.

Alternatively, you can use the [getSmartAccountsEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#getsmartaccountsenvironment) function to resolve the environment.

This function is especially useful if your delegator is not a smart account when

creating a [redelegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-types).

```

import { 

  getSmartAccountsEnvironment, 

  SmartAccountsEnvironment, 

} from "@metamask/smart-accounts-kit"; 

// Resolves the SmartAccountsEnvironment for Sepolia

const environment: SmartAccountsEnvironment = getSmartAccountsEnvironment(11155111);

```

### Deploy a custom environment​

You can deploy the contracts using any method, but the toolkit provides a convenient [deployDelegatorEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#deploydelegatorenvironment) function. This function simplifies deploying the Delegation Framework contracts to your desired EVM chain.

This function requires a Viem [Public Client](https://viem.sh/docs/clients/public), [Wallet Client](https://viem.sh/docs/clients/wallet), and [Chain](https://viem.sh/docs/glossary/types#chain)

to deploy the contracts and resolve the `SmartAccountsEnvironment`.

Your wallet must have a sufficient native token balance to deploy the contracts.

```

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { deployDeleGatorEnvironment } from "@metamask/smart-accounts-kit/utils";

const environment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain

);

```

You can also override specific contracts when calling `deployDelegatorEnvironment`.

For example, if you've already deployed the `EntryPoint` contract on the target chain, you can pass the contract address to the function.

```

// The config.ts is the same as in the previous example.

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { deployDeleGatorEnvironment } from "@metamask/smart-accounts-kit/utils";

const environment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain,

+ {

+   EntryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032"

+ }

);

```

Once the contracts are deployed, you can use them to override the environment.

### Override the environment​

To override the environment, the toolkit provides an [overrideDeployedEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#overridedeployedenvironment) function to resolve

`SmartAccountsEnvironment` with specified contracts for the given chain and contract version.

```

// The config.ts is the same as in the previous example.

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { 

  overrideDeployedEnvironment,

  deployDeleGatorEnvironment 

} from "@metamask/smart-accounts-kit";

const environment: SmartAccountsEnvironment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain

);

overrideDeployedEnvironment(

  chain.id,

  "1.3.0",

  environment,

);

```

If you've already deployed the contracts using a different method, you can create a `DelegatorEnvironment` instance with the required contract addresses, and pass it to the function.

```

- import { walletClient, publicClient } from "./config.ts";

- import { sepolia as chain } from "viem/chains";

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { 

  overrideDeployedEnvironment,

- deployDeleGatorEnvironment

} from "@metamask/smart-accounts-kit";

- const environment: SmartAccountsEnvironment = await deployDeleGatorEnvironment(

-  walletClient, 

-  publicClient, 

-  chain

- );

+ const environment: SmartAccountsEnvironment = {

+  SimpleFactory: "0x124..",

+  // ...

+  implementations: {

+    // ...

+  },

+ };

overrideDeployedEnvironment(

  chain.id,

  "1.3.0",

  environment

);

```

Make sure to specify the Delegation Framework version required by the toolkit.

See the changelog of the toolkit version you are using (in the left sidebar) for its required Framework version.

# Create a smart account

You can enable users to create a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) directly in your dapp.

This page provides examples of using [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) with Viem Core SDK to create different types of smart accounts with different signature schemes.

An account's supported *signatories* can sign data on behalf of the smart account.

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Create a Hybrid smart account​

A Hybrid smart account supports both an externally owned account (EOA) owner and any number of passkey (WebAuthn) signers.

You can create a Hybrid smart account with the following types of signers.

### Create a Hybrid smart account with an Account signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount), and Viem's [privateKeyToAccount and generatePrivateKey](https://viem.sh/docs/accounts/local/privateKeyToAccount), to create a Hybrid smart account with a signer from a randomly generated private key:

```

import { publicClient } from "./client.ts"

import { account } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [account.address, [], [], []],

  deploySalt: "0x",

  signer: { account },

});

```

### Create a Hybrid smart account with a Wallet Client signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) to create a Hybrid smart account with a Wallet Client signer:

```

import { publicClient } from "./client.ts"

import { walletClient } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const addresses = await walletClient.getAddresses();

const owner = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [owner, [], [], []],

  deploySalt: "0x",

  signer: { walletClient },

});

```

### Create a Hybrid smart account with a passkey signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [toWebAuthnAccount](https://viem.sh/account-abstraction/accounts/webauthn) to create a Hybrid smart account with a passkey (WebAuthn) signer:

To work with WebAuthn, install the [Ox SDK](https://oxlib.sh/).

```

import { publicClient } from "./client.ts"

import { webAuthnAccount, credential } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

import { Address, PublicKey } from "ox";

import { toHex } from "viem";

// Deserialize compressed public key

const publicKey = PublicKey.fromHex(credential.publicKey);

// Convert public key to address

const owner = Address.fromPublicKey(publicKey);

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [owner, [toHex(credential.id)], [publicKey.x], [publicKey.y]],

  deploySalt: "0x",

  signer: { webAuthnAccount, keyId: toHex(credential.id) },

});

```

## Create a Multisig smart account​

A [Multisig smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#multisig-smart-account) supports multiple EOA signers with a configurable threshold for execution.

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) to create a Multsig smart account with a combination of account signers and Wallet Client signers:

```

import { publicClient } from "./client.ts";

import { account, walletClient } from "./signers.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const owners = [ account.address, walletClient.address ];

const signer = [ { account }, { walletClient } ];

const threshold = 2n

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.MultiSig,

  deployParams: [owners, threshold],

  deploySalt: "0x",

  signer,

});

```

The number of signers in the signatories must be at least equal to the threshold for valid signature generation.

## Create a Stateless 7702 smart account​

A [Stateless 7702 smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#stateless-7702-smart-account) represents an EOA that has been upgraded to support MetaMask Smart Accounts

functionality as defined by [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702).

This implementation does not handle the upgrade process; see the [EIP-7702 quickstart](https://docs.metamask.io/smart-accounts-kit/get-started/smart-account-quickstart/eip7702/) to learn how to upgrade.

You can create a Stateless 7702 smart account with the following types of signatories.

### Create a Stateless 7702 smart account with an account signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [privateKeyToAccount](https://viem.sh/docs/accounts/local/privateKeyToAccount) to create a Stateless 7702 smart account with a signer from a private key:

```

import { publicClient } from "./client.ts";

import { account } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Stateless7702,

  address: account.address // Address of the upgraded EOA

  signer: { account },

});

```

### Create a Stateless 7702 smart account with a Wallet Client signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) to create a Stateless 7702 smart account with a Wallet Client signer:

```

import { publicClient } from "./client.ts";

import { walletClient } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const addresses = await walletClient.getAddresses();

const address = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Stateless7702,

  address, // Address of the upgraded EOA

  signer: { walletClient },

});

```

## Next steps​

With a MetaMask smart account, you can perform the following functions:

- In conjunction with [Viem Account Abstraction clients](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/), [deploy the smart account](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/deploy-smart-account/)

and [send user operations](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-user-operation/).

- [Create delegations](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/) that can be used to grant specific rights and permissions to other accounts.

Smart accounts that create delegations are called *delegator accounts*.

# Deploy a smart account

You can deploy MetaMask Smart Accounts in two different ways. You can either deploy a smart account automatically when sending

the first user operation, or manually deploy the account.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Deploy with the first user operation​

When you send the first user operation from a smart account, the Smart Accounts Kit checks whether the account is already deployed. If the account

is not deployed, the toolkit adds the `initCode` to the user operation to deploy the account within the

same operation. Internally, the `initCode` is encoded using the `factory` and `factoryData`.

```

import { bundlerClient, smartAccount } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001"),

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas

});

```

## Deploy manually​

To deploy a smart account manually, call the [getFactoryArgs](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#getfactoryargs)

method from the smart account to retrieve the `factory` and `factoryData`. This allows you to use a relay account to sponsor the deployment without needing a paymaster.

The `factory` represents the contract address responsible for deploying the smart account, while `factoryData` contains the

calldata that will be executed by the `factory` to deploy the smart account.

The relay account can be either an externally owned account (EOA) or another smart account. This example uses an EOA.

```

import { walletClient, smartAccount } from "./config.ts";

const { factory, factoryData } = await smartAccount.getFactoryArgs();

// Deploy smart account using relay account.

const hash = await walletClient.sendTransaction({

  to: factory,

  data: factoryData,

})

```

## Next steps​

- Learn more about [sending user operations](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-user-operation/).

- To sponsor gas for end users, see how to [send a gasless transaction](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-gasless-transaction/).

# Send a user operation

User operations are the [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) counterpart to traditional blockchain transactions.

They incorporate significant enhancements that improve user experience and provide greater

flexibility in account management and transaction execution.

Viem's Account Abstraction API allows a developer to specify an array of `Calls` that will be executed as a user operation via Viem's [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation) method.

The MetaMask Smart Accounts Kit encodes and executes the provided calls.

User operations are not directly sent to the network.

Instead, they are sent to a bundler, which validates, optimizes, and aggregates them before network submission.

See [Viem's Bundler Client](https://viem.sh/account-abstraction/clients/bundler) for details on how to interact with the bundler.

If a user operation is sent from a MetaMask smart account that has not been deployed, the toolkit configures the user operation to automatically deploy the account.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Send a user operation​

The following is a simplified example of sending a user operation using Viem Core SDK. Viem Core SDK offers more granular control for developers who require it.

In the example, a user operation is created with the necessary gas limits.

This user operation is passed to a bundler instance, and the `EntryPoint` address is retrieved from the client.

```

import { bundlerClient, smartAccount } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001")

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas

});

```

### Estimate fee per gas​

Different bundlers have different ways to estimate `maxFeePerGas` and `maxPriorityFeePerGas`, and can reject requests with insufficient values.

The following example updates the previous example to estimate the fees.

This example uses constant values, but the [Hello Gator example](https://github.com/MetaMask/hello-gator) uses Pimlico's Alto bundler,

which fetches user operation gas price using the RPC method [pimlico_getUserOperationPrice](https://docs.pimlico.io/infra/bundler/endpoints/pimlico_getUserOperationGasPrice).

To estimate the gas fee for Pimlico's bundler, install the [permissionless.js SDK](https://docs.pimlico.io/references/permissionless/).

```

+ import { createPimlicoClient } from "permissionless/clients/pimlico";

import { parseEther } from "viem";

import { bundlerClient, smartAccount } from "./config.ts" // The config.ts is the same as in the previous example.

- const maxFeePerGas = 1n;

- const maxPriorityFeePerGas = 1n;

+ const pimlicoClient = createPimlicoClient({

+   transport: http("https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>"), // You can get the API Key from the Pimlico dashboard.

+ });

+

+ const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("1")

    }

  ],

-  maxFeePerGas,

-  maxPriorityFeePerGas

+  ...fee

});

```

### Wait for the transaction receipt​

After submitting the user operation, it's crucial to wait for the receipt to ensure that it has been successfully included in the blockchain. Use the `waitForUserOperationReceipt` method provided by the bundler client.

```

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { bundlerClient, smartAccount } from "./config.ts" // The config.ts is the same as in the previous example.

const pimlicoClient = createPimlicoClient({

  transport: http("https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>"), // You can get the API Key from the Pimlico dashboard.

});

const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("1")

    }

  ],

  ...fee

});

+ const { receipt } = await bundlerClient.waitForUserOperationReceipt({

+   hash: userOperationHash

+ });

+

+ console.log(receipt.transactionHash);

```

## Next steps​

To sponsor gas for end users, see how to [send a gasless transaction](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-gasless-transaction/).

# Send a gasless transaction

MetaMask Smart Accounts support gas sponsorship, which simplifies onboarding by abstracting gas fees away from end users.

You can use any paymaster service provider, such as [Pimlico](https://docs.pimlico.io/references/paymaster) or [ZeroDev](https://docs.zerodev.app/meta-infra/rpcs), or plug in your own custom paymaster.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Send a gasless transaction​

The following example demonstrates how to use Viem's [Paymaster Client](https://viem.sh/account-abstraction/clients/paymaster) to send gasless transactions.

You can provide the paymaster client using the paymaster property in the [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation#paymaster-optional) method, or in the [Bundler Client](https://viem.sh/account-abstraction/clients/bundler#paymaster-optional).

In this example, the paymaster client is passed to the `sendUserOperation` method.

```

import { bundlerClient, smartAccount, paymasterClient } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001")

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas,

  paymaster: paymasterClient,

});

```

# Generate a multisig signature

The Smart Accounts Kit supports [Multisig smart accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#multisig-smart-account),

allowing you to add multiple externally owned accounts (EOA)

signers with a configurable execution threshold. When the threshold

is greater than 1, you can collect signatures from the required signers

and use the [aggregateSignature](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#aggregatesignature) function to combine them

into a single aggregated signature.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a Multisig smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/#create-a-multisig-smart-account)

## Generate a multisig signature​

The following example configures a Multisig smart account with two different signers: Alice

and Bob. The account has a threshold of 2, meaning that signatures from

both parties are required for any execution.

```

import { 

  bundlerClient, 

  aliceSmartAccount, 

  bobSmartAccount,

  aliceAccount,

  bobAccount,

} from "./config.ts";

import { aggregateSignature } from "@metamask/smart-accounts-kit";

const userOperation = await bundlerClient.prepareUserOperation({

  account: aliceSmartAccount,

  calls: [

    {

      target: zeroAddress,

      value: 0n,

      data: "0x",

    }

  ]

});

const aliceSignature = await aliceSmartAccount.signUserOperation(userOperation);

const bobSignature = await bobSmartAccount.signUserOperation(userOperation);

const aggregatedSignature = aggregateSignature({

  signatures: [{

    signer: aliceAccount.address,

    signature: aliceSignature,

    type: "ECDSA",

  }, {

    signer: bobAccount.address,

    signature: bobSignature,

    type: "ECDSA",

  }],

});

```

# Perform executions on a smart account's behalf

[Delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/) is the ability for a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) to grant permission to another account to perform executions on its behalf.

In this guide, you'll create a delegator account (Alice) and a delegate account (Bob), and grant Bob permission to perform executions on Alice's behalf.

You'll complete the delegation lifecycle (create, sign, and redeem a delegation).

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Steps​

### 1. Create a Public Client​

Create a [Viem Public Client](https://viem.sh/docs/clients/public) using Viem's `createPublicClient` function.

You will configure Alice's account (the delegator) and the Bundler Client with the Public Client, which you can use to query the signer's account state and interact with smart contracts.

```

import { createPublicClient, http } from "viem"

import { sepolia as chain } from "viem/chains"

const publicClient = createPublicClient({

  chain,

  transport: http(),

})

```

### 2. Create a Bundler Client​

Create a [Viem Bundler Client](https://viem.sh/account-abstraction/clients/bundler) using Viem's `createBundlerClient` function.

You can use the bundler service to estimate gas for user operations and submit transactions to the network.

```

import { createBundlerClient } from "viem/account-abstraction"

const bundlerClient = createBundlerClient({

  client: publicClient,

  transport: http("https://your-bundler-rpc.com"),

})

```

### 3. Create a delegator account​

Create an account to represent Alice, the delegator who will create a delegation.

The delegator must be a MetaMask smart account; use the toolkit's [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) method to create the delegator account.

A Hybrid smart account is a flexible smart account implementation that supports both an externally owned account (EOA) owner and any number of P256 (passkey) signers.

This examples configures a [Hybrid smart account with an Account signer](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/#create-a-hybrid-smart-account-with-an-account-signer):

```

import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

import { privateKeyToAccount } from "viem/accounts"

const delegatorAccount = privateKeyToAccount("0x...")

const delegatorSmartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [delegatorAccount.address, [], [], []],

  deploySalt: "0x",

  signer: { account: delegatorAccount },

})

```

See [how to configure other smart account types](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/).

### 4. Create a delegate account​

Create an account to represent Bob, the delegate who will receive the delegation. The delegate can be a smart account or an externally owned account (EOA):

```

import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

import { privateKeyToAccount } from "viem/accounts"

const delegateAccount = privateKeyToAccount("0x...")

const delegateSmartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid, // Hybrid smart account

  deployParams: [delegateAccount.address, [], [], []],

  deploySalt: "0x",

  signer: { account: delegateAccount },

})

```

### 5. Create a delegation​

Create a [root delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-types) from Alice to Bob.

With a root delegation, Alice is delegating her own authority away, as opposed to *redelegating* permissions she received from a previous delegation.

Use the toolkit's [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation) method to create a root delegation. When creating

delegation, you need to configure the scope of the delegation to define the initial authority.

This example uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-transfer-scope) scope, allowing Alice to delegate to Bob the ability to spend her USDC, with a

specified limit on the total amount.

Before creating a delegation, ensure that the delegator account (in this example, Alice's account) has been deployed. If the account is not deployed, redeeming the delegation will fail.

```

import { createDelegation } from "@metamask/smart-accounts-kit"

import { parseUnits } from "viem"

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const delegation = createDelegation({

  to: delegateSmartAccount.address, // This example uses a delegate smart account

  from: delegatorSmartAccount.address,

  environment: delegatorSmartAccount.environment

  scope: {

    type: "erc20TransferAmount",

    tokenAddress,

    // 10 USDC 

    maxAmount: parseUnits("10", 6),

  },

})

```

### 6. Sign the delegation​

Sign the delegation with Alice's account, using the [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#signdelegation) method from `MetaMaskSmartAccount`. Alternatively, you can use the toolkit's [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#signdelegation) utility method. Bob will later use the signed delegation to perform actions on Alice's behalf.

```

const signature = await delegatorSmartAccount.signDelegation({

  delegation,

})

const signedDelegation = {

  ...delegation,

  signature,

}

```

### 7. Redeem the delegation​

Bob can now redeem the delegation. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on Alice's behalf.

To prepare the calldata for the redeem transaction, use the [redeemDelegations](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#redeemdelegations) method from `DelegationManager`.

Since Bob is redeeming a single delegation chain, use the [SingleDefault](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#execution-modes) execution mode.

Bob can redeem the delegation by submitting a user operation if his account is a smart account, or a regular transaction if his account is an EOA. In this example, Bob transfers 1 USDC from Alice’s account to his own.

```

import { createExecution, ExecutionMode } from "@metamask/smart-accounts-kit"

import { DelegationManager } from "@metamask/smart-accounts-kit/contracts"

import { zeroAddress } from "viem"

import { callData } from "./config.ts"

const delegations = [signedDelegation]

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const executions = createExecution({ target: tokenAddress, callData })

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({

  delegations: [delegations],

  modes: [ExecutionMode.SingleDefault],

  executions: [executions],

})

const userOperationHash = await bundlerClient.sendUserOperation({

  account: delegateSmartAccount,

  calls: [

    {

      to: delegateSmartAccount.address,

      data: redeemDelegationCalldata,

    },

  ],

  maxFeePerGas: 1n,

  maxPriorityFeePerGas: 1n,

})

```

## Next steps​

- See [how to configure different scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/) to define the initial authority of a delegation.

- See [how to further refine the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

- See [how to disable a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/disable-delegation/) to revoke permissions.

# Use delegation scopes

When [creating a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/), you can configure a scope to define the delegation's initial authority and help prevent delegation misuse.

You can further constrain this initial authority by [adding caveats to a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/).

The Smart Accounts Kit currently supports three categories of scopes:

| Scope type | Description |

| --- | --- |

| Spending limit scopes | Restricts the spending of native, ERC-20, and ERC-721 tokens based on defined conditions. |

| Function call scope | Restricts the delegation to specific contract methods, contract addresses, or calldata. |

| Ownership transfer scope | Restricts the delegation to only allow ownership transfers, specifically the transferOwnership function for a specified contract. |

# Use spending limit scopes

Spending limit scopes define how much a delegate can spend in native, ERC-20, or ERC-721 tokens.

You can set transfer limits with or without time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## ERC-20 periodic scope​

This scope ensures a per-period limit for ERC-20 token transfers.

You set the amount, period, and start data.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day.

Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20PeriodTransfer",

    tokenAddress: "0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da",

    // USDC has 6 decimal places.

    periodAmount: parseUnits("10", 6),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 streaming scope​

This scopes ensures a linear streaming transfer limit for ERC-20 tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20Streaming",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    amountPerSecond: parseUnits("0.1", 6),

    initialAmount: parseUnits("10", 6),

    maxAmount: parseUnits("100", 6),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 transfer scope​

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions.

Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    maxAmount: parseUnits("10", 6),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-721 scope​

This scope limits the delegation to ERC-721 token transfers only.

For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer.

See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const delegation = createDelegation({

  scope: {

    type: "erc721Transfer",

    tokenAddress: "0x3fF528De37cd95b67845C1c55303e7685c72F319",

    tokenId: 1n,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token periodic scope​

This scope ensures a per-period limit for native token transfers.

You set the amount, period, and start date.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

Bob can transfer a total of 0.01 ETH per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenPeriodTransfer",

    periodAmount: parseEther("0.01"),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token streaming scope​

This scopes ensures a linear streaming transfer limit for native tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenStreaming",

    amountPerSecond: parseEther("0.001"),

    initialAmount: parseEther("0.01"),

    maxAmount: parseEther("0.1"),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token transfer scope​

This scope ensures that native token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

Bob may use the 0.1 ETH in a single transaction or make multiple transactions, as long as the total does not exceed 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

const delegation = createDelegation({

  scope: {

    type: "nativeTokenTransferAmount",

    maxAmount: parseEther("0.001"),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Use spending limit scopes

Spending limit scopes define how much a delegate can spend in native, ERC-20, or ERC-721 tokens.

You can set transfer limits with or without time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## ERC-20 periodic scope​

This scope ensures a per-period limit for ERC-20 token transfers.

You set the amount, period, and start data.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day.

Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20PeriodTransfer",

    tokenAddress: "0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da",

    // USDC has 6 decimal places.

    periodAmount: parseUnits("10", 6),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 streaming scope​

This scopes ensures a linear streaming transfer limit for ERC-20 tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20Streaming",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    amountPerSecond: parseUnits("0.1", 6),

    initialAmount: parseUnits("10", 6),

    maxAmount: parseUnits("100", 6),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 transfer scope​

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions.

Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    maxAmount: parseUnits("10", 6),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-721 scope​

This scope limits the delegation to ERC-721 token transfers only.

For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer.

See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const delegation = createDelegation({

  scope: {

    type: "erc721Transfer",

    tokenAddress: "0x3fF528De37cd95b67845C1c55303e7685c72F319",

    tokenId: 1n,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token periodic scope​

This scope ensures a per-period limit for native token transfers.

You set the amount, period, and start date.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

Bob can transfer a total of 0.01 ETH per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenPeriodTransfer",

    periodAmount: parseEther("0.01"),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token streaming scope​

This scopes ensures a linear streaming transfer limit for native tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenStreaming",

    amountPerSecond: parseEther("0.001"),

    initialAmount: parseEther("0.01"),

    maxAmount: parseEther("0.1"),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token transfer scope​

This scope ensures that native token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

Bob may use the 0.1 ETH in a single transaction or make multiple transactions, as long as the total does not exceed 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

const delegation = createDelegation({

  scope: {

    type: "nativeTokenTransferAmount",

    maxAmount: parseEther("0.001"),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Use the ownership transfer scope

The ownership transfer scope restricts a delegation to ownership transfer calls only.

For example, Alice has deployed a smart contract, and she delegates to Bob the ability to transfer ownership of that contract.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## Ownership transfer scope​

This scope requires a `contractAddress`, which represents the address of the deployed contract.

Internally, this scope uses the [ownershipTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#ownershiptransfer) caveat enforcer.

See the [ownership transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#ownership-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const contractAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const delegation = createDelegation({

  scope: {

    type: "ownershipTransfer",

    contractAddress,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Constrain a delegation scope

[Delegation scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/) define the delegation's initial authority and help prevent delegation misuse.

You can further constrain these scopes and limit the delegation's authority by applying [caveat enforcers](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/caveat-enforcers/).

## Prerequisites​

[Configure a delegation scope.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/)

## Apply a caveat enforcer​

For example, Alice creates a delegation with an [ERC-20 transfer scope](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-transfer-scope) that allows Bob to spend up to 10 USDC.

If Alice wants to further restrict the scope to limit Bob's delegation to be valid for only seven days,

she can apply the [timestamp](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#timestamp) caveat enforcer.

The following example creates a delegation using [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation), applies the ERC-20 transfer scope with a spending limit of 10 USDC, and applies the `timestamp` caveat enforcer to restrict the delegation's validity to a seven-day period:

```

import { createDelegation } from "@metamask/smart-accounts-kit";

// Convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// Seven days after current time.

const beforeThreshold = currentTime + 604800;

const caveats = [{

  type: "timestamp",

  afterThreshold: currentTime,

  beforeThreshold, 

}];

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    maxAmount: 10000n,

  },

  // Apply caveats to the delegation.

  caveats,

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

- See the [caveats reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/) for the full list of caveat types and their parameters.

- For more specific or custom control, you can also [create custom caveat enforcers](https://docs.metamask.io/tutorials/create-custom-caveat-enforcer/)

and apply them to delegations.

# Check the delegation state

When using [spending limit delegation scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/) or relevant [caveat enforcers](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/),

you might need to check the remaining transferrable amount in a delegation.

For example, if a delegation allows a user to spend 10 USDC per week and they have already spent 10 - n USDC in the current period,

you can determine how much of the allowance is still available for transfer.

Use the `CaveatEnforcerClient` to check the available balances for specific scopes or caveats.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

- [Create a delegation with an ERC-20 periodic scope.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-periodic-scope)

## Create a CaveatEnforcerClient​

To check the delegation state, create a [CaveatEnforcerClient](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/).

This client allows you to interact with the caveat enforcers of the delegation, and read the required state.

```

import { environment, publicClient as client } from './config.ts'

import { createCaveatEnforcerClient } from '@metamask/smart-accounts-kit'

const caveatEnforcerClient = createCaveatEnforcerClient({

  environment,

  client,

})

```

## Read the caveat enforcer state​

This example uses the [getErc20PeriodTransferEnforcerAvailableAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/#geterc20periodtransferenforceravailableamount) method to read the state and retrieve the remaining amount for the current transfer period.

```

import { delegation } './config.ts'

// Returns the available amount for current period. 

const { availableAmount } = await caveatEnforcerClient.getErc20PeriodTransferEnforcerAvailableAmount({

  delegation,

})

```

## Next steps​

See the [Caveat Enforcer Client reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/) for the full list of available methods.

# Perform executions on a MetaMask user's behalf

[Advanced Permissions (ERC-7115)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) are fine-grained permissions that your dapp can request from a MetaMask user to execute transactions on their

behalf. For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course

of a month. Once the permission is granted, your dapp can use the allocated 10 USDC each day to

purchase ETH directly from the MetaMask user's account.

In this guide, you'll request an ERC-20 periodic transfer permission from a MetaMask user to transfer 1 USDC every day on their behalf.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Install MetaMask Flask 13.5.0 or later.](https://docs.metamask.io/snaps/get-started/install-flask/)

### 1. Set up a Wallet Client​

Set up a [Viem Wallet Client](https://viem.sh/docs/clients/wallet) using Viem's `createWalletClient` function. This client will

help you interact with MetaMask Flask.

Then, extend the Wallet Client functionality using `erc7715ProviderActions`. These actions enable you to request Advanced Permissions from the user.

```

import { createWalletClient, custom } from "viem";

import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";

const walletClient = createWalletClient({

  transport: custom(window.ethereum),

}).extend(erc7715ProviderActions());

```

### 2. Set up a Public Client​

Set up a [Viem Public Client](https://viem.sh/docs/clients/public) using Viem's `createPublicClient` function.

This client will help you query the account state and interact with the blockchain network.

```

import { createPublicClient, http } from "viem";

import { sepolia as chain } from "viem/chains";

 

const publicClient = createPublicClient({

  chain,

  transport: http(),

});

```

### 3. Set up a session account​

Set up a session account which can either be a smart account or an externally owned account (EOA)

to request Advanced Permissions. The requested permissions are granted to the session account, which

is responsible for executing transactions on behalf of the user.

```

import { privateKeyToAccount } from "viem/accounts";

import { 

  toMetaMaskSmartAccount, 

  Implementation 

} from "@metamask/smart-accounts-kit";

const privateKey = "0x...";

const account = privateKeyToAccount(privateKey);

const sessionAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [account.address, [], [], []],

  deploySalt: "0x",

  signer: { account },

});

```

### 4. Check the EOA account code​

Advanced Permissions support the automatic upgrading of a MetaMask user's account to a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/),

when using MetaMask Flask version 13.9.0 or later. For earlier versions, you must ensure that the

user is upgraded to a smart account before requesting Advanced Permissions.

If the user has not yet been upgraded, you can handle the upgrade [programmatically](https://docs.metamask.io/wallet/how-to/send-transactions/send-batch-transactions/#about-atomic-batch-transactions) or ask the

user to [switch to a smart account manually](https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account/#how-to-switch-to-a-metamask-smart-account).

MetaMask's Advanced Permissions (ERC-7115) implementation requires the user to be upgraded to a MetaMask

Smart Account because, under the hood, you're requesting a signature for an [ERC-7710 delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/).

ERC-7710 delegation is one of the core features supported only by MetaMask Smart Accounts.

```

import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { sepolia as chain } from "viem/chains";

const addresses = await walletClient.requestAddresses();

const address = addresses[0];

// Get the EOA account code

const code = await publicClient.getCode({

  address,

});

if (code) {

  // The address to which EOA has delegated. According to EIP-7702, 0xef0100 || address

  // represents the delegation. 

  // 

  // You need to remove the first 8 characters (0xef0100) to get the delegator address.

  const delegatorAddress = `0x${code.substring(8)}`;

  const statelessDelegatorAddress = getSmartAccountsEnvironment(chain.id)

  .implementations

  .EIP7702StatelessDeleGatorImpl;

  // If account is not upgraded to MetaMask smart account, you can

  // either upgrade programmatically or ask the user to switch to a smart account manually.

  const isAccountUpgraded = delegatorAddress.toLowerCase() === statelessDelegatorAddress.toLowerCase();

}

```

### 5. Request Advanced Permissions​

Request Advanced Permissions from the user using the Wallet Client's `requestExecutionPermissions` action.

In this example, you'll request an

[ERC-20 periodic permission](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/#erc-20-periodic-permission).

See the [requestExecutionPermissions](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#requestexecutionpermissions) API reference for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

// Since current time is in seconds, we need to convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // The requested permissions will granted to the

      // session account.

      address: sessionAccount.address,

    },

  },

  permission: {

    type: "erc20-token-periodic",

    data: {

      tokenAddress,

      // 1 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6

      periodAmount: parseUnits("10", 6),

      // 1 day in seconds

      periodDuration: 86400,

      justification?: "Permission to transfer 1 USDC every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

### 6. Set up a Viem client​

Set up a Viem client depending on your session account type.

For a smart account, set up a [Viem Bundler Client](https://viem.sh/account-abstraction/clients/bundler)

using Viem's `createBundlerClient` function. This lets you use the bundler service

to estimate gas for user operations and submit transactions to the network.

For an EOA, set up a [Viem Wallet Client](https://viem.sh/docs/clients/wallet)

using Viem's `createWalletClient` function. This lets you send transactions directly to the network.

The toolkit provides public actions for both of the clients which can be used to redeem Advanced Permissions, and execute transactions on a user's behalf.

```

import { createBundlerClient } from "viem/account-abstraction";

import { erc7710BundlerActions } from "@metamask/smart-accounts-kit/actions";

const bundlerClient = createBundlerClient({

  client: publicClient,

  transport: http("https://your-bundler-rpc.com"),

  // Allows you to use the same Bundler Client as paymaster.

  paymaster: true

}).extend(erc7710BundlerActions());

```

### 7. Redeem Advanced Permissions​

The session account can now redeem the permissions. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on the user's behalf.

To redeem the permissions, use the client action based on your session account type.

A smart account uses the Bundler Client's `sendUserOperationWithDelegation` action,

and an EOA uses the Wallet Client's `sendTransactionWithDelegation` action.

See the [sendUserOperationWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/bundler-client/#senduseroperationwithdelegation) and [sendTransactionWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#sendtransactionwithdelegation) API reference for more information.

```

import { calldata } from "./config.ts";

// These properties must be extracted from the permission response.

const permissionsContext = grantedPermissions[0].context;

const delegationManager = grantedPermissions[0].signerMeta.delegationManager;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// Calls without permissionsContext and delegationManager will be executed 

// as a normal user operation.

const userOperationHash = await bundlerClient.sendUserOperationWithDelegation({

  publicClient,

  account: sessionAccount,

  calls: [

    {

      to: tokenAddress,

      data: calldata,

      permissionsContext,

      delegationManager,

    },

  ],

  // Appropriate values must be used for fee-per-gas. 

  maxFeePerGas: 1n,

  maxPriorityFeePerGas: 1n,

});

```

## Next steps​

See how to configure different [ERC-20 token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/) and

[native token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/native-token/).

# Use ERC-20 token permissions

[Advanced Permissions (ERC-7715)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) supports ERC-20 token permission types that allow you to request fine-grained

permissions for ERC-20 token transfers with time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a session account.](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/#3-set-up-a-session-account)

## ERC-20 periodic permission​

This permission type ensures a per-period limit for ERC-20 token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 10 USDC on their behalf each day. The dapp can transfer a total of

10 USDC per day; the limit resets at the beginning of the next day.

See the [ERC-20 periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-periodic-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "erc20-token-periodic",

    data: {

      tokenAddress,

      // 10 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6.

      periodAmount: parseUnits("10", 6),

      // 1 day in seconds.

      periodDuration: 86400,

      justification?: "Permission to transfer 1 USDC every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

## ERC-20 stream permission​

This permission type ensures a linear streaming transfer limit for ERC-20 tokens. Token transfers are blocked until the

defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the

configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.1 USDC per second, starting with an initial amount

of 1 USDC, up to a maximum of 2 USDC.

See the [ERC-20 stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-stream-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "erc20-token-stream",

    data: {

      tokenAddress,

      // 0.1 USDC in WEI format. Since USDC has 6 decimals, 0.1 * 10^6.

      amountPerSecond: parseUnits("0.1", 6),

      // 1 USDC in WEI format. Since USDC has 6 decimals, 1 * 10^6.

      initialAmount: parseUnits("1", 6),

      // 2 USDC in WEI format. Since USDC has 6 decimals, 2 * 10^6.

      maxAmount: parseUnits("2", 6),

      startTime: currentTime,

      justification: "Permission to use 0.1 USDC per second",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

# Use native token permissions

[Advanced Permissions (ERC-7115)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) supports native token permission types that allow you to request fine-grained

permissions for native token transfers with time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a session account.](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/#3-set-up-a-session-account)

## Native token periodic permission​

This permission type ensures a per-period limit for native token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 0.001 ETH on their behalf each day. The dapp can transfer a total of

0.001 USDC per day; the limit resets at the beginning of the next day.

See the [native token periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-periodic-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseEther } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "native-token-periodic",

    data: {

      // 0.001 ETH in wei format.

      periodAmount: parseEther("0.001"),

      // 1 hour in seconds.

      periodDuration: 86400,

      startTime: currentTime,

      justification: "Permission to use 0.001 ETH every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

## Native token stream permission​

This permission type ensures a linear streaming transfer limit for native tokens. Token transfers are blocked until the

defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the

configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.0001 ETH per second, starting with an initial amount

of 0.1 ETH, up to a maximum of 1 ETH.

See the [native token stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-stream-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseEther } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "native-token-stream",

    data: {

      // 0.0001 ETH in wei format.

      amountPerSecond: parseEther("0.0001"),

      // 0.1 ETH in wei format.

      initialAmount: parseEther("0.1"),

      // 1 ETH in wei format.

      maxAmount: parseEther("1"),

      startTime: currentTime,

      justification: "Permission to use 0.0001 ETH per second",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

# Send your first gasless transaction

A paymaster is a vital component in the ERC-4337 standard, responsible for covering transaction costs on behalf of the user. There are various types of paymasters, such as gasless paymasters, ERC-20 paymasters, and more.

In this guide, we'll talk about how you can use the Pimlico gasless Paymaster with Web3Auth Account Abstraction Provider to sponsor the transaction for your users without requiring the user to pay gas fees.

For those who want to skip straight to the code, you can find it on [GitHub](https://github.com/Web3Auth/web3auth-examples/tree/main/other/smart-account-example).

## Prerequisites​

- Pimlico Account: Since we'll be using the Pimlico paymaster, you'll need to have an API key from Pimlico. You can get a free API key from [Pimlico Dashboard](https://dashboard.pimlico.io/).

- Web3Auth Dashboard: If you haven't already, sign up on the Web3Auth platform. It is free and gives you access to the Web3Auth's base plan. Head to Web3Auth's documentation page for detailed [instructions on setting up the Web3Auth Dashboard](https://docs.metamask.io/embedded-wallets/dashboard/).

- Web3Auth PnP Web SDK: This guide assumes that you already know how to integrate the PnP Web SDK in your project. If not, you can learn how to [integrate Web3Auth in your Web app](https://docs.metamask.io/embedded-wallets/sdk/react/).

## Integrate AccountAbstractionProvider​

Once, you have set up the Web3Auth Dashboard, and created a new project, it's time to integrate Web3Auth Account Abstraction Provider in your Web application. For the implementation, we'll use the [@web3auth/account-abstraction-provider](https://www.npmjs.com/package/@web3auth/account-abstraction-provider). The provider simplifies the entire process by managing the complex logic behind configuring the account abstraction provider, bundler, and preparing user operations.

If you are already using the Web3Auth Pnp SDK in your project, you just need to configure the AccountAbstractionProvider with the paymaster details, and pass it to the Web3Auth instance. No other changes are required.

### Installation​

```

npm install --save @web3auth/account-abstraction-provider

```

### Configure Paymaster​

The AccountAbstractionProvider requires specific configurations to function correctly. One key configuration is the paymaster. Web3Auth supports custom paymaster configurations, allowing you to deploy your own paymaster and integrate it with the provider.

You can choose from a variety of paymaster services available in the ecosystem. In this guide, we'll be configuring the Pimlico's paymaster. However, it's important to note that paymaster support is not limited to the Pimlico, giving you the flexibility to integrate any compatible paymaster service that suits your requirements.

For the simplicity, we have only use `SafeSmartAccount`, but you choose your favorite smart account provider from the available ones. [Learn how to configure the smart account](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/smart-accounts/).

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from '@web3auth/account-abstraction-provider'

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: '0xaa36a7',

  rpcTarget: 'https://rpc.sepolia.org',

  displayName: 'Ethereum Sepolia Testnet',

  blockExplorerUrl: 'https://sepolia.etherscan.io',

  ticker: 'ETH',

  tickerName: 'Ethereum',

  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',

}

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

    smartAccountInit: new SafeSmartAccount(),

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

})

```

## Configure Web3Auth​

Once you have configured your `AccountAbstractionProvider`, you can now plug it in your Web3Auth Modal/No Modal instance. If you are using the external wallets like MetaMask, Coinbase, etc, you can define whether you want to use the AccountAbstractionProvider, or EthereumPrivateKeyProvider by setting the `useAAWithExternalWallet` in `IWeb3AuthCoreOptions`.

If you are setting `useAAWithExternalWallet` to `true`, it'll create a new Smart Account for your user, where the signer/creator of the Smart Account would be the external wallet.

If you are setting `useAAWithExternalWallet` to `false`, it'll skip creating a new Smart Account, and directly use the external wallet to sign the transactions.

```

import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

import { Web3Auth } from "@web3auth/modal";

const privateKeyProvider = new EthereumPrivateKeyProvider({

  // Use the chain config we declared earlier

  config: { chainConfig },

});

const web3auth = new Web3Auth({

  clientId: "YOUR_WEB3AUTH_CLIENT_ID", // Pass your Web3Auth Client ID, ideally using an environment variable

  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,

  privateKeyProvider,

  // Use the account abstraction provider we configured earlier

  accountAbstractionProvider

  // This will allow you to use EthereumPrivateKeyProvider for

  // external wallets, while use the AccountAbstractionProvider

  // for Web3Auth embedded wallets.

  useAAWithExternalWallet: false,

});

```

## Configure Signer​

The Web3Auth Smart Account feature is compatible with popular signer SDKs, including wagmi, ethers, and viem. You can choose your preferred package to configure the signer.

You can retreive the provider to configure the signer from Web3Auth instance.

Wagmi does not require any special configuration to use the signer with smart accounts. Once you have set up your Web3Auth provider and connected your wallet, Wagmi's hooks (such as useSigner or useAccount) will automatically use the smart account as the signer. You can interact with smart accounts using Wagmi just like you would with a regular EOA (Externally Owned Account) signer—no additional setup is needed.

```

import { createWalletClient } from 'viem'

// Use your Web3Auth instance to retreive the provider.

const provider = web3auth.provider

const walletClient = createWalletClient({

  transport: custom(provider),

})

```

## Send a transaction​

Developers can use their preferred signer or Wagmi hooks to initiate on-chain transactions, while Web3Auth manages the creation and submission of the UserOperation. Only the `to`, `data`, and `value` fields need to be provided. Any additional parameters will be ignored and automatically overridden.

To ensure reliable execution, the bundler client sets maxFeePerGas and maxPriorityFeePerGas values. If custom values are required, developers can use the [Viem's BundlerClient](https://viem.sh/account-abstraction/clients/bundler#bundler-client) to manually construct and send the user operation.

Since Smart Accounts are deployed smart contracts, the user's first transaction also triggers the on-chain deployment of their wallet.

```

import { useSendTransaction } from 'wagmi'

const { data: hash, sendTransaction } = useSendTransaction()

// Convert 1 ether to WEI format

const value = web3.utils.toWei(1)

sendTransaction({ to: 'DESTINATION_ADDRESS', value, data: '0x' })

const {

  data: receipt,

  isLoading: isConfirming,

  isSuccess: isConfirmed,

} = useWaitForTransactionReceipt({

  hash,

})

```

## Conclusion​

Voila, you have successfully sent your first gasless transaction using the Pimlico paymaster with Web3Auth Account Abstraction Provider. To learn more about advance features of the Account Abstraction Provider like performing batch transactions, using ERC-20 paymaster you can refer to the [Account Abstraction Provider](https://docs.metamask.io/embedded-wallets/sdk/react/) documentation.

# Smart Accounts

Effortlessly create and manage smart accounts for your users with just a few lines of code, using our Smart Account feature. Smart accounts offer enhanced control and programmability, enabling powerful features that traditional wallets can't provide.

**Key features of Smart Accounts include:**

- **Gas Abstraction:** Cover transaction fees for users, or allow users to pay for their own transactions using ERC-20 tokens.

- **Batch Transactions:** Perform multiple transactions in a single call.

- **Automated Transactions:** Allow users to automate actions, like swapping ETH to USDT when ETH hits a specific price.

- **Custom Spending Limits:** Allow users to set tailored spending limits.

> For more information about ERC-4337 and its components, check out our detailed blog post.

For more information about ERC-4337 and its components, [check out our detailed blog post](https://blog.web3auth.io/an-ultimate-guide-to-web3-wallets-externally-owned-account-and-smart-contract-wallet/#introduction-to-eip-4337).

Our smart account integration streamlines your setup, allowing you to create and manage smart accounts using your favorite libraries like Viem, Ethers, and Wagmi. You don't need to rely on third-party packages to effortlessly create ERC-4337 compatible Smart Contract Wallets (SCWs), giving users the ability to perform batch transactions and efficiently manage gas sponsorship.

This is a paid feature and the minimum [pricing plan](https://web3auth.io/pricing.html) to use this

SDK in a production environment is the **Growth Plan**. You can use this feature in Web3Auth

Sapphire Devnet network for free.

## Enabling Smart Accounts​

To enable this feature, you need to configure Smart Accounts from your project in the [Web3Auth Developer Dashboard](https://dashboard.web3auth.io/).

### Dashboard Configuration​

To enable Smart Accounts, navigate to the Smart Accounts section in the Web3Auth dashboard, and enable the "Set up Smart Accounts" toggle. Web3Auth currently supports [MetaMaskSmartAccount](https://docs.gator.metamask.io/how-to/create-delegator-account#create-a-metamasksmartaccount) as a Smart Account provider.

## Installation​

To use native account abstraction, you'll need to install the

[@web3auth/account-abstraction-provider](https://www.npmjs.com/package/@web3auth/account-abstraction-provider),

which allows you to create and interact with Smart Contract Wallets (SCWs). This provider simplifies

the entire process by managing the complex logic behind configuring the account abstraction

provider, bundler, and preparing user operations.

```

npm install --save @web3auth/account-abstraction-provider

```

## Configure​

When instantiating the Account Abstraction Provider, you can pass configuration objects to the

constructor. These configuration options allow you to select the desired Account Abstraction (AA)

provider, as well as configure the bundler and paymaster, giving you flexibility and control over

the provider.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

Please note this is the important step for setting the Web3Auth account abstraction provider.

- [Configure Smart Account provider](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#configure-smart-account-provider)

- [Configure Bundler](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#configure-bundler)

- [Configure Sponsored Paymaster](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#sponsored-paymaster)

- [Configure ERC-20 Paymaster](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#erc-20-paymaster)

## Configure Smart Account Provider​

Web3Auth offers the flexibility to choose your preferred Account Abstraction (AA) provider.

Currently, we support Safe, Kernel, Biconomy, and Trust.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Configure Bundler​

Web3Auth enables you to configure your bundler and define the paymaster context. The bundler

aggregates the UserOperations and submits them on-chain via a global entry point contract.

Bundler support is not limited to the examples below—you can use any bundler of your choice.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Configure Paymaster​

You can configure the paymaster of your choice to sponsor gas fees for your users, along with the paymaster context. The paymaster context lets you set additional parameters, such as choosing the token for ERC-20 paymasters, defining gas policies, and more.

### Sponsored Paymaster​

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

### ERC-20 Paymaster​

When using an ERC-20 paymaster, ensure you include the approval transaction, as Web3Auth does not

handle the approval internally.

For Pimlico, you can specify the token you want to use in the paymasterContext. If you want to set

up sponsorship policies, you can define those in the paymasterContext as well.

[Checkout the supported tokens for ERC-20 Paymaster on Pimlico](https://docs.pimlico.io/infra/paymaster/erc20-paymaster/supported-tokens).

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

      paymasterContext: {

        token: "SUPPORTED_TOKEN_CONTRACT_ADDRESS",

      },

    },

    smartAccountInit: new SafeSmartAccount(),

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Set up​

### Configure Web3Auth Instance​

```

import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider'

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from '@web3auth/account-abstraction-provider'

import Web3Auth, { WEB3AUTH_NETWORK } from '@web3auth/react-native-sdk'

import * as WebBrowser from '@toruslabs/react-native-web-browser'

import EncryptedStorage from 'react-native-encrypted-storage'

import { CHAIN_NAMESPACES } from '@web3auth/base'

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: '0xaa36a7',

  rpcTarget: 'https://rpc.sepolia.org',

  displayName: 'Ethereum Sepolia Testnet',

  blockExplorerUrl: 'https://sepolia.etherscan.io',

  ticker: 'ETH',

  tickerName: 'Ethereum',

  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',

}

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

    smartAccountInit: new SafeSmartAccount(),

  },

})

const privateKeyProvider = new EthereumPrivateKeyProvider({

  config: { chainConfig },

})

const web3auth = new Web3Auth(WebBrowser, EncryptedStorage, {

  clientId,

  redirectUrl,

  network: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET, // or other networks

  privateKeyProvider,

  accountAbstractionProvider: aaProvider,

})

```

### Configure Signer​

The Web3Auth Smart Account feature is compatible with popular signer SDKs, including wagmi, ethers,

and viem. You can choose your preferred package to configure the signer.

You can retreive the provider to configure the signer from Web3Auth instance.

Wagmi does not require any special configuration to use the signer with smart accounts. Once you

have set up your Web3Auth provider and connected your wallet, Wagmi's hooks (such as useSigner or

useAccount) will automatically use the smart account as the signer. You can interact with smart

accounts using Wagmi just like you would with a regular EOA (Externally Owned Account) signer—no

additional setup is needed.

```

import { createWalletClient } from "viem";

// Use your Web3Auth instance to retreive the provider.

const provider = web3auth.provider;

const walletClient = createWalletClient({

  transport: custom(provider),

});

```

## Smart Account Address​

Once the signers or Wagmi configuration is set up, it can be used to retrieve the user's Smart

Account address.

```

import { useAccount } from "wagmi";

const { address } = useAccount();

const smartAccountAddress = address;

```

## Send Transaction​

Developers can use their preferred signer or Wagmi hooks to initiate on-chain transactions, while

Web3Auth manages the creation and submission of the UserOperation. Only the `to`, `data`, and

`value` fields need to be provided. Any additional parameters will be ignored and automatically

overridden.

To ensure reliable execution, the bundler client sets maxFeePerGas and maxPriorityFeePerGas values.

If custom values are required, developers can use the

[Viem's BundlerClient](https://viem.sh/account-abstraction/clients/bundler#bundler-client) to

manually construct and send the user operation.

Since Smart Accounts are deployed smart contracts, the user's first transaction also triggers the

on-chain deployment of their wallet.

```

import { useSendTransaction } from "wagmi";

const { data: hash, sendTransaction } = useSendTransaction();

// Convert 1 ether to WEI format

const value = web3.utils.toWei(1);

sendTransaction({ to: "DESTINATION_ADDRESS", value, data: "0x" });

const {

  data: receipt,

  isLoading: isConfirming,

  isSuccess: isConfirmed,

} = useWaitForTransactionReceipt({

  hash,

});

```

## Advanced Smart Account Operations​

To learn more about supported transaction methods, and how to perform batch transactions, [checkout our detailed documentation of AccountAbstractionProvider](https://docs.metamask.io/embedded-wallets/sdk/react/).

# Advanced Permissions (ERC-7715)

The Smart Accounts Kit supports Advanced Permissions ([ERC-7715](https://eips.ethereum.org/EIPS/eip-7715)), which lets you request fine-grained permissions from a MetaMask user to execute transactions on their behalf.

For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course of a month.

Once the permission is granted, your dapp can use the allocated 10 USDC each day to purchase ETH directly from the MetaMask user's account.

Advanced Permissions eliminate the need for users to approve every transaction, which is useful for highly interactive dapps.

It also enables dapps to execute transactions for users without an active wallet connection.

This feature requires [MetaMask Flask 13.5.0](https://docs.metamask.io/snaps/get-started/install-flask/) or later.

## ERC-7715 technical overview​

[ERC-7715](https://eips.ethereum.org/EIPS/eip-7715) defines a JSON-RPC method `wallet_grantPermissions`.

Dapps can use this method to request a wallet to grant the dapp permission to execute transactions on a user's behalf.

`wallet_grantPermissions` requires a `signer` parameter, which identifies the entity requesting or managing the permission.

Common signer implementations include wallet signers, single key and multisig signers, and account signers.

The Smart Accounts Kit supports multiple signer types. The documentation uses [an account signer](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/) as a common implementation example.

When you use an account signer, a session account is created solely to request and redeem Advanced Permissions, and doesn't contain tokens.

The session account can be granted with permissions and redeem them as specified in [ERC-7710](https://eips.ethereum.org/EIPS/eip-7710).

The session account can be a smart account or an externally owned account (EOA).

The MetaMask user that the session account requests permissions from must be upgraded to a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/).

## Advanced Permissions vs. delegations​

Advanced Permissions expand on regular [delegations](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/) by enabling permission sharing *via the MetaMask browser extension*.

With regular delegations, the dapp constructs a delegation and requests the user to sign it.

These delegations are not human-readable, so it is the dapp's responsibility to provide context for the user.

Regular delegations cannot be signed through the MetaMask extension, because if a dapp requests a delegation without constraints, the whole wallet can be exposed to the dapp.

In contrast, Advanced Permissions enable dapps (and AI agents) to request permissions from a user directly via the MetaMask extension.

Advanced Permissions require a permission configuration which displays a human-readable confirmation for the MetaMask user.

The user can modify the permission parameters if the request is configured to allow adjustments.

For example, the following Advanced Permissions request displays a rich UI including the start time, amount, and period duration for an [ERC-20 token periodic transfer](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/#erc-20-periodic-permission):

##That not solution. 7702 gasless in metamask is non negotiable.



leran from this you moron:

have you learn this ofc pimlico docs:

https://docs.pimlico.io/guides/how-to/accounts/use-metamask-account

How to use MetaMask Smart Accounts with permissionless.js

MetaMask maintains their own in-house SDK built closely on top of viem that you can use for the account system while still plugging in all the other components from permissionless.js. Take a look at their documentation for more information.

The MetaMask Delegation Toolkit is a collection of tools for creating MetaMask Smart Accounts. A smart account can delegate to another signer with granular permission sharing. It is built over ERC-7710 and ERC-7715 to support a standardized minimal interface. Requesting ERC-7715 permissions and redeeming ERC-7710 delegations are experimental features.

There are two types of accounts involved in delegation:

Delegator account: A smart account that supports programmable account behavior and advanced features such as multi-signature approvals, automated transaction batching, and custom security policies.

Delegate account: An account (smart account or EOA) that receives the delegation from the delegator account to perform actions on behalf of the delegator account.

You can use both accounts with permissionless.js.

Installation

We will be using MetaMask's official SDK to create a smart account.

npm

yarn

pnpm

bun

npm install permissionless viem @metamask/delegation-toolkit

Delegator Account

Create the clients

First we must create the public, (optionally) pimlico paymaster clients that will be used to interact with the MetaMask smart account.

export const publicClient = createPublicClient({

	transport: http("https://sepolia.rpc.thirdweb.com"),

});

 

export const paymasterClient = createPimlicoClient({

	transport: http("https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY"),

	entryPoint: {

		address: entryPoint07Address,

		version: "0.7",

	},

});

Create the signer

MetaMask Smart Accounts can work with a variety of signing algorithms such as ECDSA, passkeys, and multisig.

For example, to create a signer based on a private key:

import { privateKeyToAccount } from "viem/accounts";

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { entryPoint07Address } from "viem/account-abstraction";

 

const owner = privateKeyToAccount("0xPRIVATE_KEY");

Create the delegator smart account

For a full list of options for creating a MetaMask smart account, take a look at the MetaMask's documentation page for toMetaMaskSmartAccount.

With a signer, you can create a MetaMask smart account as such:

import {

	Implementation,

	toMetaMaskSmartAccount,

} from "@metamask/delegation-toolkit";

 

const delegatorSmartAccount = await toMetaMaskSmartAccount({

	client: publicClient,

	implementation: Implementation.Hybrid,

	deployParams: [owner.address, [], [], []],

	deploySalt: "0x",

	signatory: { account: owner },

});

 

Create the smart account client

const smartAccountClient = createSmartAccountClient({

	account: delegatorSmartAccount,

	chain: sepolia,

	paymaster: paymasterClient,

	bundlerTransport: http(

		"https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY",

	),

	userOperation: {

		estimateFeesPerGas: async () =>

			(await paymasterClient.getUserOperationGasPrice()).fast,

	},

});

Send a transaction

Transactions using permissionless.js simply wrap around user operations. This means you can switch to permissionless.js from your existing viem EOA codebase with minimal-to-no changes.

const txHash = await smartAccountClient.sendTransaction({

	to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",

	value: parseEther("0.1"),

});

This also means you can also use viem Contract instances to transact without any modifications.

const nftContract = getContract({

	address: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",

	abi: tokenAbi,

	client: {

		public: publicClient,

		wallet: smartAccountClient,

	},

});

 

const txHash = await nftContract.write.mint([

	"0x_MY_ADDRESS_TO_MINT_TOKENS",

	parseEther("1"),

]);

You can also send an array of transactions in a single batch.

const userOpHash = await smartAccountClient.sendUserOperation({

	calls: [

		{

			to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",

			value: parseEther("0.1"),

			data: "0x",

		},

		{

			to: "0x1440ec793aE50fA046B95bFeCa5aF475b6003f9e",

			value: parseEther("0.1"),

			data: "0x1234",

		},

	],

});

Delegate Account

A delegate account is an account that receives the delegation from the delegator account to perform actions on behalf of the delegator account. To create a delegate account, we will follow the following steps:

Create a delegate signer

Create the delegate smart account

Create a delegation using delegator smart account

Sign the delegation

Send transactions using delegate smart account with signed delegation

Create the clients

First we must create the public, (optionally) pimlico paymaster clients that will be used to interact with the MetaMask smart account.

export const publicClient = createPublicClient({

	transport: http("https://sepolia.rpc.thirdweb.com"),

});

 

export const paymasterClient = createPimlicoClient({

	transport: http("https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY"),

	entryPoint: {

		address: entryPoint07Address,

		version: "0.7",

	},

});

Create the signer

MetaMask Smart Accounts can work with a variety of signing algorithms such as ECDSA, passkeys, and multisig.

For example, to create a signer based on a private key:

const delegateSigner = privateKeyToAccount("0xPRIVATE_KEY");

Create the delegate smart account

For a full list of options for creating a MetaMask smart account, take a look at the MetaMask's documentation page for toMetaMaskSmartAccount.

With a delegate signer, you can create a MetaMask delegate account as such:

const delegateSmartAccount = await toMetaMaskSmartAccount({

	client: publicClient,

	implementation: Implementation.Hybrid,

	deployParams: [delegateSigner.address, [], [], []],

	deploySalt: "0x",

	signatory: { account: delegateSigner },

});

Create a delegation

This example passes an empty caveats array, which means the delegate can perform any action on the delegator's behalf. We recommend restricting the delegation by adding caveat enforcers.

import { createDelegation } from "@metamask/delegation-toolkit";

 

const delegation = createDelegation({

	to: delegateSmartAccount.address,

	from: delegatorSmartAccount.address,

	caveats: [],

});

Sign the delegation

const signature = await delegatorSmartAccount.signDelegation({

	delegation,

});

 

const signedDelegation = {

	...delegation,

	signature,

};

Create the smart account client

const delegateSmartAccountClient = createSmartAccountClient({

	account: delegateSmartAccount,

	chain: sepolia,

	paymaster: paymasterClient,

	bundlerTransport: http(

		"https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY",

	),

	userOperation: {

		estimateFeesPerGas: async () =>

			(await paymasterClient.getUserOperationGasPrice()).fast,

	},

});

Send transactions using signed delegation

import { DelegationManager } from "@metamask/delegation-toolkit/contracts";

import { SINGLE_DEFAULT_MODE } from "@metamask/delegation-toolkit/utils";

import { createExecution } from "@metamask/delegation-toolkit";

 

const delegations = [signedDelegation];

 

// Actual execution to be performed by the delegate account

const executions = [

	createExecution({

		target: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",

		callData: encodeFunctionData({

			abi: tokenAbi,

			functionName: "mint",

			args: ["0x_MY_ADDRESS_TO_MINT_TOKENS", parseEther("1")],

		}),

	}),

];

 

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({

	delegations: [delegations],

	modes: [SINGLE_DEFAULT_MODE],

	executions: [executions],

});

 

const txHash = await delegateSmartAccountClient.sendTransaction({

	calls: [

		{

			to: delegateSmartAccount.address,

			data: redeemDelegationCalldata,

		},

	],

});

have you also learn from metamask ofc docs:

# Configure the Smart Accounts Kit

The Smart Accounts Kit is highly configurable, providing support for custom [bundlers and paymasters](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/#configure-the-bundler).

You can also configure the [toolkit environment](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/#optional-configure-the-toolkit-environment) to interact with the [Delegation Framework](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-framework).

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Configure the bundler​

The toolkit uses Viem's Account Abstraction API to configure custom bundlers and paymasters.

This provides a robust and flexible foundation for creating and managing [MetaMask Smart Accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/).

See Viem's [account abstraction documentation](https://viem.sh/account-abstraction) for more information on the API's features, methods, and best practices.

To use the bundler and paymaster clients with the toolkit, create instances of these clients and configure them as follows:

```

import {

  createPaymasterClient,

  createBundlerClient,

} from "viem/account-abstraction";

import { http } from "viem";

import { sepolia as chain } from "viem/chains"; 

// Replace these URLs with your actual bundler and paymaster endpoints.

const bundlerUrl = "https://your-bundler-url.com";

const paymasterUrl = "https://your-paymaster-url.com";

// The paymaster is optional.

const paymasterClient = createPaymasterClient({

  transport: http(paymasterUrl),

});

const bundlerClient = createBundlerClient({

  transport: http(bundlerUrl),

  paymaster: paymasterClient,

  chain,

});

```

Replace the bundler and paymaster URLs with your bundler and paymaster endpoints.

For example, you can use endpoints from [Pimlico](https://docs.pimlico.io/references/bundler), [Infura](https://docs.metamask.io/services/), or [ZeroDev](https://docs.zerodev.app/meta-infra/intro).

Providing a paymaster is optional when configuring your bundler client. However, if you choose not to use a paymaster, the smart contract account must have enough funds to pay gas fees.

## (Optional) Configure the toolkit environment​

The toolkit environment (`SmartAccountsEnvironment`) defines the contract addresses necessary for interacting with the [Delegation Framework](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-framework) on a specific network.

It serves several key purposes:

- It provides a centralized configuration for all the contract addresses required by the Delegation Framework.

- It enables easy switching between different networks (for example, Mainnet and testnet) or custom deployments.

- It ensures consistency across different parts of the application that interact with the Delegation Framework.

### Resolve the environment​

When you create a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/), the toolkit automatically

resolves the environment based on the version it requires and the chain configured.

If no environment is found for the specified chain, it throws an error.

```

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { delegatorSmartAccount } from "./config.ts";

const environment: SmartAccountsEnvironment = delegatorSmartAccount.environment; 

```

See the changelog of the toolkit version you are using (in the left sidebar) for supported chains.

Alternatively, you can use the [getSmartAccountsEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#getsmartaccountsenvironment) function to resolve the environment.

This function is especially useful if your delegator is not a smart account when

creating a [redelegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-types).

```

import { 

  getSmartAccountsEnvironment, 

  SmartAccountsEnvironment, 

} from "@metamask/smart-accounts-kit"; 

// Resolves the SmartAccountsEnvironment for Sepolia

const environment: SmartAccountsEnvironment = getSmartAccountsEnvironment(11155111);

```

### Deploy a custom environment​

You can deploy the contracts using any method, but the toolkit provides a convenient [deployDelegatorEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#deploydelegatorenvironment) function. This function simplifies deploying the Delegation Framework contracts to your desired EVM chain.

This function requires a Viem [Public Client](https://viem.sh/docs/clients/public), [Wallet Client](https://viem.sh/docs/clients/wallet), and [Chain](https://viem.sh/docs/glossary/types#chain)

to deploy the contracts and resolve the `SmartAccountsEnvironment`.

Your wallet must have a sufficient native token balance to deploy the contracts.

```

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { deployDeleGatorEnvironment } from "@metamask/smart-accounts-kit/utils";

const environment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain

);

```

You can also override specific contracts when calling `deployDelegatorEnvironment`.

For example, if you've already deployed the `EntryPoint` contract on the target chain, you can pass the contract address to the function.

```

// The config.ts is the same as in the previous example.

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { deployDeleGatorEnvironment } from "@metamask/smart-accounts-kit/utils";

const environment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain,

+ {

+   EntryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032"

+ }

);

```

Once the contracts are deployed, you can use them to override the environment.

### Override the environment​

To override the environment, the toolkit provides an [overrideDeployedEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#overridedeployedenvironment) function to resolve

`SmartAccountsEnvironment` with specified contracts for the given chain and contract version.

```

// The config.ts is the same as in the previous example.

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { 

  overrideDeployedEnvironment,

  deployDeleGatorEnvironment 

} from "@metamask/smart-accounts-kit";

const environment: SmartAccountsEnvironment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain

);

overrideDeployedEnvironment(

  chain.id,

  "1.3.0",

  environment,

);

```

If you've already deployed the contracts using a different method, you can create a `DelegatorEnvironment` instance with the required contract addresses, and pass it to the function.

```

- import { walletClient, publicClient } from "./config.ts";

- import { sepolia as chain } from "viem/chains";

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { 

  overrideDeployedEnvironment,

- deployDeleGatorEnvironment

} from "@metamask/smart-accounts-kit";

- const environment: SmartAccountsEnvironment = await deployDeleGatorEnvironment(

-  walletClient, 

-  publicClient, 

-  chain

- );

+ const environment: SmartAccountsEnvironment = {

+  SimpleFactory: "0x124..",

+  // ...

+  implementations: {

+    // ...

+  },

+ };

overrideDeployedEnvironment(

  chain.id,

  "1.3.0",

  environment

);

```

Make sure to specify the Delegation Framework version required by the toolkit.

See the changelog of the toolkit version you are using (in the left sidebar) for its required Framework version.

# Create a smart account

You can enable users to create a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) directly in your dapp.

This page provides examples of using [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) with Viem Core SDK to create different types of smart accounts with different signature schemes.

An account's supported *signatories* can sign data on behalf of the smart account.

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Create a Hybrid smart account​

A Hybrid smart account supports both an externally owned account (EOA) owner and any number of passkey (WebAuthn) signers.

You can create a Hybrid smart account with the following types of signers.

### Create a Hybrid smart account with an Account signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount), and Viem's [privateKeyToAccount and generatePrivateKey](https://viem.sh/docs/accounts/local/privateKeyToAccount), to create a Hybrid smart account with a signer from a randomly generated private key:

```

import { publicClient } from "./client.ts"

import { account } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [account.address, [], [], []],

  deploySalt: "0x",

  signer: { account },

});

```

### Create a Hybrid smart account with a Wallet Client signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) to create a Hybrid smart account with a Wallet Client signer:

```

import { publicClient } from "./client.ts"

import { walletClient } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const addresses = await walletClient.getAddresses();

const owner = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [owner, [], [], []],

  deploySalt: "0x",

  signer: { walletClient },

});

```

### Create a Hybrid smart account with a passkey signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [toWebAuthnAccount](https://viem.sh/account-abstraction/accounts/webauthn) to create a Hybrid smart account with a passkey (WebAuthn) signer:

To work with WebAuthn, install the [Ox SDK](https://oxlib.sh/).

```

import { publicClient } from "./client.ts"

import { webAuthnAccount, credential } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

import { Address, PublicKey } from "ox";

import { toHex } from "viem";

// Deserialize compressed public key

const publicKey = PublicKey.fromHex(credential.publicKey);

// Convert public key to address

const owner = Address.fromPublicKey(publicKey);

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [owner, [toHex(credential.id)], [publicKey.x], [publicKey.y]],

  deploySalt: "0x",

  signer: { webAuthnAccount, keyId: toHex(credential.id) },

});

```

## Create a Multisig smart account​

A [Multisig smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#multisig-smart-account) supports multiple EOA signers with a configurable threshold for execution.

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) to create a Multsig smart account with a combination of account signers and Wallet Client signers:

```

import { publicClient } from "./client.ts";

import { account, walletClient } from "./signers.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const owners = [ account.address, walletClient.address ];

const signer = [ { account }, { walletClient } ];

const threshold = 2n

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.MultiSig,

  deployParams: [owners, threshold],

  deploySalt: "0x",

  signer,

});

```

The number of signers in the signatories must be at least equal to the threshold for valid signature generation.

## Create a Stateless 7702 smart account​

A [Stateless 7702 smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#stateless-7702-smart-account) represents an EOA that has been upgraded to support MetaMask Smart Accounts

functionality as defined by [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702).

This implementation does not handle the upgrade process; see the [EIP-7702 quickstart](https://docs.metamask.io/smart-accounts-kit/get-started/smart-account-quickstart/eip7702/) to learn how to upgrade.

You can create a Stateless 7702 smart account with the following types of signatories.

### Create a Stateless 7702 smart account with an account signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [privateKeyToAccount](https://viem.sh/docs/accounts/local/privateKeyToAccount) to create a Stateless 7702 smart account with a signer from a private key:

```

import { publicClient } from "./client.ts";

import { account } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Stateless7702,

  address: account.address // Address of the upgraded EOA

  signer: { account },

});

```

### Create a Stateless 7702 smart account with a Wallet Client signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) to create a Stateless 7702 smart account with a Wallet Client signer:

```

import { publicClient } from "./client.ts";

import { walletClient } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const addresses = await walletClient.getAddresses();

const address = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Stateless7702,

  address, // Address of the upgraded EOA

  signer: { walletClient },

});

```

## Next steps​

With a MetaMask smart account, you can perform the following functions:

- In conjunction with [Viem Account Abstraction clients](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/), [deploy the smart account](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/deploy-smart-account/)

and [send user operations](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-user-operation/).

- [Create delegations](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/) that can be used to grant specific rights and permissions to other accounts.

Smart accounts that create delegations are called *delegator accounts*.

# Deploy a smart account

You can deploy MetaMask Smart Accounts in two different ways. You can either deploy a smart account automatically when sending

the first user operation, or manually deploy the account.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Deploy with the first user operation​

When you send the first user operation from a smart account, the Smart Accounts Kit checks whether the account is already deployed. If the account

is not deployed, the toolkit adds the `initCode` to the user operation to deploy the account within the

same operation. Internally, the `initCode` is encoded using the `factory` and `factoryData`.

```

import { bundlerClient, smartAccount } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001"),

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas

});

```

## Deploy manually​

To deploy a smart account manually, call the [getFactoryArgs](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#getfactoryargs)

method from the smart account to retrieve the `factory` and `factoryData`. This allows you to use a relay account to sponsor the deployment without needing a paymaster.

The `factory` represents the contract address responsible for deploying the smart account, while `factoryData` contains the

calldata that will be executed by the `factory` to deploy the smart account.

The relay account can be either an externally owned account (EOA) or another smart account. This example uses an EOA.

```

import { walletClient, smartAccount } from "./config.ts";

const { factory, factoryData } = await smartAccount.getFactoryArgs();

// Deploy smart account using relay account.

const hash = await walletClient.sendTransaction({

  to: factory,

  data: factoryData,

})

```

## Next steps​

- Learn more about [sending user operations](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-user-operation/).

- To sponsor gas for end users, see how to [send a gasless transaction](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-gasless-transaction/).

# Send a user operation

User operations are the [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) counterpart to traditional blockchain transactions.

They incorporate significant enhancements that improve user experience and provide greater

flexibility in account management and transaction execution.

Viem's Account Abstraction API allows a developer to specify an array of `Calls` that will be executed as a user operation via Viem's [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation) method.

The MetaMask Smart Accounts Kit encodes and executes the provided calls.

User operations are not directly sent to the network.

Instead, they are sent to a bundler, which validates, optimizes, and aggregates them before network submission.

See [Viem's Bundler Client](https://viem.sh/account-abstraction/clients/bundler) for details on how to interact with the bundler.

If a user operation is sent from a MetaMask smart account that has not been deployed, the toolkit configures the user operation to automatically deploy the account.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Send a user operation​

The following is a simplified example of sending a user operation using Viem Core SDK. Viem Core SDK offers more granular control for developers who require it.

In the example, a user operation is created with the necessary gas limits.

This user operation is passed to a bundler instance, and the `EntryPoint` address is retrieved from the client.

```

import { bundlerClient, smartAccount } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001")

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas

});

```

### Estimate fee per gas​

Different bundlers have different ways to estimate `maxFeePerGas` and `maxPriorityFeePerGas`, and can reject requests with insufficient values.

The following example updates the previous example to estimate the fees.

This example uses constant values, but the [Hello Gator example](https://github.com/MetaMask/hello-gator) uses Pimlico's Alto bundler,

which fetches user operation gas price using the RPC method [pimlico_getUserOperationPrice](https://docs.pimlico.io/infra/bundler/endpoints/pimlico_getUserOperationGasPrice).

To estimate the gas fee for Pimlico's bundler, install the [permissionless.js SDK](https://docs.pimlico.io/references/permissionless/).

```

+ import { createPimlicoClient } from "permissionless/clients/pimlico";

import { parseEther } from "viem";

import { bundlerClient, smartAccount } from "./config.ts" // The config.ts is the same as in the previous example.

- const maxFeePerGas = 1n;

- const maxPriorityFeePerGas = 1n;

+ const pimlicoClient = createPimlicoClient({

+   transport: http("https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>"), // You can get the API Key from the Pimlico dashboard.

+ });

+

+ const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("1")

    }

  ],

-  maxFeePerGas,

-  maxPriorityFeePerGas

+  ...fee

});

```

### Wait for the transaction receipt​

After submitting the user operation, it's crucial to wait for the receipt to ensure that it has been successfully included in the blockchain. Use the `waitForUserOperationReceipt` method provided by the bundler client.

```

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { bundlerClient, smartAccount } from "./config.ts" // The config.ts is the same as in the previous example.

const pimlicoClient = createPimlicoClient({

  transport: http("https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>"), // You can get the API Key from the Pimlico dashboard.

});

const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("1")

    }

  ],

  ...fee

});

+ const { receipt } = await bundlerClient.waitForUserOperationReceipt({

+   hash: userOperationHash

+ });

+

+ console.log(receipt.transactionHash);

```

## Next steps​

To sponsor gas for end users, see how to [send a gasless transaction](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-gasless-transaction/).

# Send a gasless transaction

MetaMask Smart Accounts support gas sponsorship, which simplifies onboarding by abstracting gas fees away from end users.

You can use any paymaster service provider, such as [Pimlico](https://docs.pimlico.io/references/paymaster) or [ZeroDev](https://docs.zerodev.app/meta-infra/rpcs), or plug in your own custom paymaster.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Send a gasless transaction​

The following example demonstrates how to use Viem's [Paymaster Client](https://viem.sh/account-abstraction/clients/paymaster) to send gasless transactions.

You can provide the paymaster client using the paymaster property in the [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation#paymaster-optional) method, or in the [Bundler Client](https://viem.sh/account-abstraction/clients/bundler#paymaster-optional).

In this example, the paymaster client is passed to the `sendUserOperation` method.

```

import { bundlerClient, smartAccount, paymasterClient } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001")

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas,

  paymaster: paymasterClient,

});

```

# Generate a multisig signature

The Smart Accounts Kit supports [Multisig smart accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#multisig-smart-account),

allowing you to add multiple externally owned accounts (EOA)

signers with a configurable execution threshold. When the threshold

is greater than 1, you can collect signatures from the required signers

and use the [aggregateSignature](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#aggregatesignature) function to combine them

into a single aggregated signature.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a Multisig smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/#create-a-multisig-smart-account)

## Generate a multisig signature​

The following example configures a Multisig smart account with two different signers: Alice

and Bob. The account has a threshold of 2, meaning that signatures from

both parties are required for any execution.

```

import { 

  bundlerClient, 

  aliceSmartAccount, 

  bobSmartAccount,

  aliceAccount,

  bobAccount,

} from "./config.ts";

import { aggregateSignature } from "@metamask/smart-accounts-kit";

const userOperation = await bundlerClient.prepareUserOperation({

  account: aliceSmartAccount,

  calls: [

    {

      target: zeroAddress,

      value: 0n,

      data: "0x",

    }

  ]

});

const aliceSignature = await aliceSmartAccount.signUserOperation(userOperation);

const bobSignature = await bobSmartAccount.signUserOperation(userOperation);

const aggregatedSignature = aggregateSignature({

  signatures: [{

    signer: aliceAccount.address,

    signature: aliceSignature,

    type: "ECDSA",

  }, {

    signer: bobAccount.address,

    signature: bobSignature,

    type: "ECDSA",

  }],

});

```

# Perform executions on a smart account's behalf

[Delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/) is the ability for a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) to grant permission to another account to perform executions on its behalf.

In this guide, you'll create a delegator account (Alice) and a delegate account (Bob), and grant Bob permission to perform executions on Alice's behalf.

You'll complete the delegation lifecycle (create, sign, and redeem a delegation).

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Steps​

### 1. Create a Public Client​

Create a [Viem Public Client](https://viem.sh/docs/clients/public) using Viem's `createPublicClient` function.

You will configure Alice's account (the delegator) and the Bundler Client with the Public Client, which you can use to query the signer's account state and interact with smart contracts.

```

import { createPublicClient, http } from "viem"

import { sepolia as chain } from "viem/chains"

const publicClient = createPublicClient({

  chain,

  transport: http(),

})

```

### 2. Create a Bundler Client​

Create a [Viem Bundler Client](https://viem.sh/account-abstraction/clients/bundler) using Viem's `createBundlerClient` function.

You can use the bundler service to estimate gas for user operations and submit transactions to the network.

```

import { createBundlerClient } from "viem/account-abstraction"

const bundlerClient = createBundlerClient({

  client: publicClient,

  transport: http("https://your-bundler-rpc.com"),

})

```

### 3. Create a delegator account​

Create an account to represent Alice, the delegator who will create a delegation.

The delegator must be a MetaMask smart account; use the toolkit's [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) method to create the delegator account.

A Hybrid smart account is a flexible smart account implementation that supports both an externally owned account (EOA) owner and any number of P256 (passkey) signers.

This examples configures a [Hybrid smart account with an Account signer](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/#create-a-hybrid-smart-account-with-an-account-signer):

```

import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

import { privateKeyToAccount } from "viem/accounts"

const delegatorAccount = privateKeyToAccount("0x...")

const delegatorSmartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [delegatorAccount.address, [], [], []],

  deploySalt: "0x",

  signer: { account: delegatorAccount },

})

```

See [how to configure other smart account types](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/).

### 4. Create a delegate account​

Create an account to represent Bob, the delegate who will receive the delegation. The delegate can be a smart account or an externally owned account (EOA):

```

import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

import { privateKeyToAccount } from "viem/accounts"

const delegateAccount = privateKeyToAccount("0x...")

const delegateSmartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid, // Hybrid smart account

  deployParams: [delegateAccount.address, [], [], []],

  deploySalt: "0x",

  signer: { account: delegateAccount },

})

```

### 5. Create a delegation​

Create a [root delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-types) from Alice to Bob.

With a root delegation, Alice is delegating her own authority away, as opposed to *redelegating* permissions she received from a previous delegation.

Use the toolkit's [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation) method to create a root delegation. When creating

delegation, you need to configure the scope of the delegation to define the initial authority.

This example uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-transfer-scope) scope, allowing Alice to delegate to Bob the ability to spend her USDC, with a

specified limit on the total amount.

Before creating a delegation, ensure that the delegator account (in this example, Alice's account) has been deployed. If the account is not deployed, redeeming the delegation will fail.

```

import { createDelegation } from "@metamask/smart-accounts-kit"

import { parseUnits } from "viem"

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const delegation = createDelegation({

  to: delegateSmartAccount.address, // This example uses a delegate smart account

  from: delegatorSmartAccount.address,

  environment: delegatorSmartAccount.environment

  scope: {

    type: "erc20TransferAmount",

    tokenAddress,

    // 10 USDC 

    maxAmount: parseUnits("10", 6),

  },

})

```

### 6. Sign the delegation​

Sign the delegation with Alice's account, using the [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#signdelegation) method from `MetaMaskSmartAccount`. Alternatively, you can use the toolkit's [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#signdelegation) utility method. Bob will later use the signed delegation to perform actions on Alice's behalf.

```

const signature = await delegatorSmartAccount.signDelegation({

  delegation,

})

const signedDelegation = {

  ...delegation,

  signature,

}

```

### 7. Redeem the delegation​

Bob can now redeem the delegation. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on Alice's behalf.

To prepare the calldata for the redeem transaction, use the [redeemDelegations](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#redeemdelegations) method from `DelegationManager`.

Since Bob is redeeming a single delegation chain, use the [SingleDefault](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#execution-modes) execution mode.

Bob can redeem the delegation by submitting a user operation if his account is a smart account, or a regular transaction if his account is an EOA. In this example, Bob transfers 1 USDC from Alice’s account to his own.

```

import { createExecution, ExecutionMode } from "@metamask/smart-accounts-kit"

import { DelegationManager } from "@metamask/smart-accounts-kit/contracts"

import { zeroAddress } from "viem"

import { callData } from "./config.ts"

const delegations = [signedDelegation]

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const executions = createExecution({ target: tokenAddress, callData })

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({

  delegations: [delegations],

  modes: [ExecutionMode.SingleDefault],

  executions: [executions],

})

const userOperationHash = await bundlerClient.sendUserOperation({

  account: delegateSmartAccount,

  calls: [

    {

      to: delegateSmartAccount.address,

      data: redeemDelegationCalldata,

    },

  ],

  maxFeePerGas: 1n,

  maxPriorityFeePerGas: 1n,

})

```

## Next steps​

- See [how to configure different scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/) to define the initial authority of a delegation.

- See [how to further refine the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

- See [how to disable a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/disable-delegation/) to revoke permissions.

# Use delegation scopes

When [creating a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/), you can configure a scope to define the delegation's initial authority and help prevent delegation misuse.

You can further constrain this initial authority by [adding caveats to a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/).

The Smart Accounts Kit currently supports three categories of scopes:

| Scope type | Description |

| --- | --- |

| Spending limit scopes | Restricts the spending of native, ERC-20, and ERC-721 tokens based on defined conditions. |

| Function call scope | Restricts the delegation to specific contract methods, contract addresses, or calldata. |

| Ownership transfer scope | Restricts the delegation to only allow ownership transfers, specifically the transferOwnership function for a specified contract. |

# Use spending limit scopes

Spending limit scopes define how much a delegate can spend in native, ERC-20, or ERC-721 tokens.

You can set transfer limits with or without time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## ERC-20 periodic scope​

This scope ensures a per-period limit for ERC-20 token transfers.

You set the amount, period, and start data.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day.

Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20PeriodTransfer",

    tokenAddress: "0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da",

    // USDC has 6 decimal places.

    periodAmount: parseUnits("10", 6),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 streaming scope​

This scopes ensures a linear streaming transfer limit for ERC-20 tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20Streaming",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    amountPerSecond: parseUnits("0.1", 6),

    initialAmount: parseUnits("10", 6),

    maxAmount: parseUnits("100", 6),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 transfer scope​

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions.

Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    maxAmount: parseUnits("10", 6),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-721 scope​

This scope limits the delegation to ERC-721 token transfers only.

For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer.

See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const delegation = createDelegation({

  scope: {

    type: "erc721Transfer",

    tokenAddress: "0x3fF528De37cd95b67845C1c55303e7685c72F319",

    tokenId: 1n,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token periodic scope​

This scope ensures a per-period limit for native token transfers.

You set the amount, period, and start date.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

Bob can transfer a total of 0.01 ETH per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenPeriodTransfer",

    periodAmount: parseEther("0.01"),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token streaming scope​

This scopes ensures a linear streaming transfer limit for native tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenStreaming",

    amountPerSecond: parseEther("0.001"),

    initialAmount: parseEther("0.01"),

    maxAmount: parseEther("0.1"),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token transfer scope​

This scope ensures that native token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

Bob may use the 0.1 ETH in a single transaction or make multiple transactions, as long as the total does not exceed 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

const delegation = createDelegation({

  scope: {

    type: "nativeTokenTransferAmount",

    maxAmount: parseEther("0.001"),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Use spending limit scopes

Spending limit scopes define how much a delegate can spend in native, ERC-20, or ERC-721 tokens.

You can set transfer limits with or without time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## ERC-20 periodic scope​

This scope ensures a per-period limit for ERC-20 token transfers.

You set the amount, period, and start data.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day.

Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20PeriodTransfer",

    tokenAddress: "0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da",

    // USDC has 6 decimal places.

    periodAmount: parseUnits("10", 6),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 streaming scope​

This scopes ensures a linear streaming transfer limit for ERC-20 tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20Streaming",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    amountPerSecond: parseUnits("0.1", 6),

    initialAmount: parseUnits("10", 6),

    maxAmount: parseUnits("100", 6),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 transfer scope​

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions.

Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    maxAmount: parseUnits("10", 6),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-721 scope​

This scope limits the delegation to ERC-721 token transfers only.

For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer.

See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const delegation = createDelegation({

  scope: {

    type: "erc721Transfer",

    tokenAddress: "0x3fF528De37cd95b67845C1c55303e7685c72F319",

    tokenId: 1n,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token periodic scope​

This scope ensures a per-period limit for native token transfers.

You set the amount, period, and start date.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

Bob can transfer a total of 0.01 ETH per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenPeriodTransfer",

    periodAmount: parseEther("0.01"),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token streaming scope​

This scopes ensures a linear streaming transfer limit for native tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenStreaming",

    amountPerSecond: parseEther("0.001"),

    initialAmount: parseEther("0.01"),

    maxAmount: parseEther("0.1"),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token transfer scope​

This scope ensures that native token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

Bob may use the 0.1 ETH in a single transaction or make multiple transactions, as long as the total does not exceed 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

const delegation = createDelegation({

  scope: {

    type: "nativeTokenTransferAmount",

    maxAmount: parseEther("0.001"),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Use the ownership transfer scope

The ownership transfer scope restricts a delegation to ownership transfer calls only.

For example, Alice has deployed a smart contract, and she delegates to Bob the ability to transfer ownership of that contract.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## Ownership transfer scope​

This scope requires a `contractAddress`, which represents the address of the deployed contract.

Internally, this scope uses the [ownershipTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#ownershiptransfer) caveat enforcer.

See the [ownership transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#ownership-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const contractAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const delegation = createDelegation({

  scope: {

    type: "ownershipTransfer",

    contractAddress,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Constrain a delegation scope

[Delegation scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/) define the delegation's initial authority and help prevent delegation misuse.

You can further constrain these scopes and limit the delegation's authority by applying [caveat enforcers](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/caveat-enforcers/).

## Prerequisites​

[Configure a delegation scope.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/)

## Apply a caveat enforcer​

For example, Alice creates a delegation with an [ERC-20 transfer scope](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-transfer-scope) that allows Bob to spend up to 10 USDC.

If Alice wants to further restrict the scope to limit Bob's delegation to be valid for only seven days,

she can apply the [timestamp](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#timestamp) caveat enforcer.

The following example creates a delegation using [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation), applies the ERC-20 transfer scope with a spending limit of 10 USDC, and applies the `timestamp` caveat enforcer to restrict the delegation's validity to a seven-day period:

```

import { createDelegation } from "@metamask/smart-accounts-kit";

// Convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// Seven days after current time.

const beforeThreshold = currentTime + 604800;

const caveats = [{

  type: "timestamp",

  afterThreshold: currentTime,

  beforeThreshold, 

}];

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    maxAmount: 10000n,

  },

  // Apply caveats to the delegation.

  caveats,

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

- See the [caveats reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/) for the full list of caveat types and their parameters.

- For more specific or custom control, you can also [create custom caveat enforcers](https://docs.metamask.io/tutorials/create-custom-caveat-enforcer/)

and apply them to delegations.

# Check the delegation state

When using [spending limit delegation scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/) or relevant [caveat enforcers](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/),

you might need to check the remaining transferrable amount in a delegation.

For example, if a delegation allows a user to spend 10 USDC per week and they have already spent 10 - n USDC in the current period,

you can determine how much of the allowance is still available for transfer.

Use the `CaveatEnforcerClient` to check the available balances for specific scopes or caveats.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

- [Create a delegation with an ERC-20 periodic scope.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-periodic-scope)

## Create a CaveatEnforcerClient​

To check the delegation state, create a [CaveatEnforcerClient](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/).

This client allows you to interact with the caveat enforcers of the delegation, and read the required state.

```

import { environment, publicClient as client } from './config.ts'

import { createCaveatEnforcerClient } from '@metamask/smart-accounts-kit'

const caveatEnforcerClient = createCaveatEnforcerClient({

  environment,

  client,

})

```

## Read the caveat enforcer state​

This example uses the [getErc20PeriodTransferEnforcerAvailableAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/#geterc20periodtransferenforceravailableamount) method to read the state and retrieve the remaining amount for the current transfer period.

```

import { delegation } './config.ts'

// Returns the available amount for current period. 

const { availableAmount } = await caveatEnforcerClient.getErc20PeriodTransferEnforcerAvailableAmount({

  delegation,

})

```

## Next steps​

See the [Caveat Enforcer Client reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/) for the full list of available methods.

# Perform executions on a MetaMask user's behalf

[Advanced Permissions (ERC-7115)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) are fine-grained permissions that your dapp can request from a MetaMask user to execute transactions on their

behalf. For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course

of a month. Once the permission is granted, your dapp can use the allocated 10 USDC each day to

purchase ETH directly from the MetaMask user's account.

In this guide, you'll request an ERC-20 periodic transfer permission from a MetaMask user to transfer 1 USDC every day on their behalf.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Install MetaMask Flask 13.5.0 or later.](https://docs.metamask.io/snaps/get-started/install-flask/)

### 1. Set up a Wallet Client​

Set up a [Viem Wallet Client](https://viem.sh/docs/clients/wallet) using Viem's `createWalletClient` function. This client will

help you interact with MetaMask Flask.

Then, extend the Wallet Client functionality using `erc7715ProviderActions`. These actions enable you to request Advanced Permissions from the user.

```

import { createWalletClient, custom } from "viem";

import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";

const walletClient = createWalletClient({

  transport: custom(window.ethereum),

}).extend(erc7715ProviderActions());

```

### 2. Set up a Public Client​

Set up a [Viem Public Client](https://viem.sh/docs/clients/public) using Viem's `createPublicClient` function.

This client will help you query the account state and interact with the blockchain network.

```

import { createPublicClient, http } from "viem";

import { sepolia as chain } from "viem/chains";

 

const publicClient = createPublicClient({

  chain,

  transport: http(),

});

```

### 3. Set up a session account​

Set up a session account which can either be a smart account or an externally owned account (EOA)

to request Advanced Permissions. The requested permissions are granted to the session account, which

is responsible for executing transactions on behalf of the user.

```

import { privateKeyToAccount } from "viem/accounts";

import { 

  toMetaMaskSmartAccount, 

  Implementation 

} from "@metamask/smart-accounts-kit";

const privateKey = "0x...";

const account = privateKeyToAccount(privateKey);

const sessionAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [account.address, [], [], []],

  deploySalt: "0x",

  signer: { account },

});

```

### 4. Check the EOA account code​

Advanced Permissions support the automatic upgrading of a MetaMask user's account to a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/),

when using MetaMask Flask version 13.9.0 or later. For earlier versions, you must ensure that the

user is upgraded to a smart account before requesting Advanced Permissions.

If the user has not yet been upgraded, you can handle the upgrade [programmatically](https://docs.metamask.io/wallet/how-to/send-transactions/send-batch-transactions/#about-atomic-batch-transactions) or ask the

user to [switch to a smart account manually](https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account/#how-to-switch-to-a-metamask-smart-account).

MetaMask's Advanced Permissions (ERC-7115) implementation requires the user to be upgraded to a MetaMask

Smart Account because, under the hood, you're requesting a signature for an [ERC-7710 delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/).

ERC-7710 delegation is one of the core features supported only by MetaMask Smart Accounts.

```

import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { sepolia as chain } from "viem/chains";

const addresses = await walletClient.requestAddresses();

const address = addresses[0];

// Get the EOA account code

const code = await publicClient.getCode({

  address,

});

if (code) {

  // The address to which EOA has delegated. According to EIP-7702, 0xef0100 || address

  // represents the delegation. 

  // 

  // You need to remove the first 8 characters (0xef0100) to get the delegator address.

  const delegatorAddress = `0x${code.substring(8)}`;

  const statelessDelegatorAddress = getSmartAccountsEnvironment(chain.id)

  .implementations

  .EIP7702StatelessDeleGatorImpl;

  // If account is not upgraded to MetaMask smart account, you can

  // either upgrade programmatically or ask the user to switch to a smart account manually.

  const isAccountUpgraded = delegatorAddress.toLowerCase() === statelessDelegatorAddress.toLowerCase();

}

```

### 5. Request Advanced Permissions​

Request Advanced Permissions from the user using the Wallet Client's `requestExecutionPermissions` action.

In this example, you'll request an

[ERC-20 periodic permission](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/#erc-20-periodic-permission).

See the [requestExecutionPermissions](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#requestexecutionpermissions) API reference for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

// Since current time is in seconds, we need to convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // The requested permissions will granted to the

      // session account.

      address: sessionAccount.address,

    },

  },

  permission: {

    type: "erc20-token-periodic",

    data: {

      tokenAddress,

      // 1 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6

      periodAmount: parseUnits("10", 6),

      // 1 day in seconds

      periodDuration: 86400,

      justification?: "Permission to transfer 1 USDC every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

### 6. Set up a Viem client​

Set up a Viem client depending on your session account type.

For a smart account, set up a [Viem Bundler Client](https://viem.sh/account-abstraction/clients/bundler)

using Viem's `createBundlerClient` function. This lets you use the bundler service

to estimate gas for user operations and submit transactions to the network.

For an EOA, set up a [Viem Wallet Client](https://viem.sh/docs/clients/wallet)

using Viem's `createWalletClient` function. This lets you send transactions directly to the network.

The toolkit provides public actions for both of the clients which can be used to redeem Advanced Permissions, and execute transactions on a user's behalf.

```

import { createBundlerClient } from "viem/account-abstraction";

import { erc7710BundlerActions } from "@metamask/smart-accounts-kit/actions";

const bundlerClient = createBundlerClient({

  client: publicClient,

  transport: http("https://your-bundler-rpc.com"),

  // Allows you to use the same Bundler Client as paymaster.

  paymaster: true

}).extend(erc7710BundlerActions());

```

### 7. Redeem Advanced Permissions​

The session account can now redeem the permissions. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on the user's behalf.

To redeem the permissions, use the client action based on your session account type.

A smart account uses the Bundler Client's `sendUserOperationWithDelegation` action,

and an EOA uses the Wallet Client's `sendTransactionWithDelegation` action.

See the [sendUserOperationWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/bundler-client/#senduseroperationwithdelegation) and [sendTransactionWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#sendtransactionwithdelegation) API reference for more information.

```

import { calldata } from "./config.ts";

// These properties must be extracted from the permission response.

const permissionsContext = grantedPermissions[0].context;

const delegationManager = grantedPermissions[0].signerMeta.delegationManager;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// Calls without permissionsContext and delegationManager will be executed 

// as a normal user operation.

const userOperationHash = await bundlerClient.sendUserOperationWithDelegation({

  publicClient,

  account: sessionAccount,

  calls: [

    {

      to: tokenAddress,

      data: calldata,

      permissionsContext,

      delegationManager,

    },

  ],

  // Appropriate values must be used for fee-per-gas. 

  maxFeePerGas: 1n,

  maxPriorityFeePerGas: 1n,

});

```

## Next steps​

See how to configure different [ERC-20 token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/) and

[native token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/native-token/).

# Use ERC-20 token permissions

[Advanced Permissions (ERC-7715)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) supports ERC-20 token permission types that allow you to request fine-grained

permissions for ERC-20 token transfers with time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a session account.](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/#3-set-up-a-session-account)

## ERC-20 periodic permission​

This permission type ensures a per-period limit for ERC-20 token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 10 USDC on their behalf each day. The dapp can transfer a total of

10 USDC per day; the limit resets at the beginning of the next day.

See the [ERC-20 periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-periodic-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "erc20-token-periodic",

    data: {

      tokenAddress,

      // 10 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6.

      periodAmount: parseUnits("10", 6),

      // 1 day in seconds.

      periodDuration: 86400,

      justification?: "Permission to transfer 1 USDC every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

## ERC-20 stream permission​

This permission type ensures a linear streaming transfer limit for ERC-20 tokens. Token transfers are blocked until the

defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the

configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.1 USDC per second, starting with an initial amount

of 1 USDC, up to a maximum of 2 USDC.

See the [ERC-20 stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-stream-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "erc20-token-stream",

    data: {

      tokenAddress,

      // 0.1 USDC in WEI format. Since USDC has 6 decimals, 0.1 * 10^6.

      amountPerSecond: parseUnits("0.1", 6),

      // 1 USDC in WEI format. Since USDC has 6 decimals, 1 * 10^6.

      initialAmount: parseUnits("1", 6),

      // 2 USDC in WEI format. Since USDC has 6 decimals, 2 * 10^6.

      maxAmount: parseUnits("2", 6),

      startTime: currentTime,

      justification: "Permission to use 0.1 USDC per second",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

# Use native token permissions

[Advanced Permissions (ERC-7115)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) supports native token permission types that allow you to request fine-grained

permissions for native token transfers with time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a session account.](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/#3-set-up-a-session-account)

## Native token periodic permission​

This permission type ensures a per-period limit for native token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 0.001 ETH on their behalf each day. The dapp can transfer a total of

0.001 USDC per day; the limit resets at the beginning of the next day.

See the [native token periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-periodic-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseEther } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "native-token-periodic",

    data: {

      // 0.001 ETH in wei format.

      periodAmount: parseEther("0.001"),

      // 1 hour in seconds.

      periodDuration: 86400,

      startTime: currentTime,

      justification: "Permission to use 0.001 ETH every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

## Native token stream permission​

This permission type ensures a linear streaming transfer limit for native tokens. Token transfers are blocked until the

defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the

configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.0001 ETH per second, starting with an initial amount

of 0.1 ETH, up to a maximum of 1 ETH.

See the [native token stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-stream-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseEther } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "native-token-stream",

    data: {

      // 0.0001 ETH in wei format.

      amountPerSecond: parseEther("0.0001"),

      // 0.1 ETH in wei format.

      initialAmount: parseEther("0.1"),

      // 1 ETH in wei format.

      maxAmount: parseEther("1"),

      startTime: currentTime,

      justification: "Permission to use 0.0001 ETH per second",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

# Send your first gasless transaction

A paymaster is a vital component in the ERC-4337 standard, responsible for covering transaction costs on behalf of the user. There are various types of paymasters, such as gasless paymasters, ERC-20 paymasters, and more.

In this guide, we'll talk about how you can use the Pimlico gasless Paymaster with Web3Auth Account Abstraction Provider to sponsor the transaction for your users without requiring the user to pay gas fees.

For those who want to skip straight to the code, you can find it on [GitHub](https://github.com/Web3Auth/web3auth-examples/tree/main/other/smart-account-example).

## Prerequisites​

- Pimlico Account: Since we'll be using the Pimlico paymaster, you'll need to have an API key from Pimlico. You can get a free API key from [Pimlico Dashboard](https://dashboard.pimlico.io/).

- Web3Auth Dashboard: If you haven't already, sign up on the Web3Auth platform. It is free and gives you access to the Web3Auth's base plan. Head to Web3Auth's documentation page for detailed [instructions on setting up the Web3Auth Dashboard](https://docs.metamask.io/embedded-wallets/dashboard/).

- Web3Auth PnP Web SDK: This guide assumes that you already know how to integrate the PnP Web SDK in your project. If not, you can learn how to [integrate Web3Auth in your Web app](https://docs.metamask.io/embedded-wallets/sdk/react/).

## Integrate AccountAbstractionProvider​

Once, you have set up the Web3Auth Dashboard, and created a new project, it's time to integrate Web3Auth Account Abstraction Provider in your Web application. For the implementation, we'll use the [@web3auth/account-abstraction-provider](https://www.npmjs.com/package/@web3auth/account-abstraction-provider). The provider simplifies the entire process by managing the complex logic behind configuring the account abstraction provider, bundler, and preparing user operations.

If you are already using the Web3Auth Pnp SDK in your project, you just need to configure the AccountAbstractionProvider with the paymaster details, and pass it to the Web3Auth instance. No other changes are required.

### Installation​

```

npm install --save @web3auth/account-abstraction-provider

```

### Configure Paymaster​

The AccountAbstractionProvider requires specific configurations to function correctly. One key configuration is the paymaster. Web3Auth supports custom paymaster configurations, allowing you to deploy your own paymaster and integrate it with the provider.

You can choose from a variety of paymaster services available in the ecosystem. In this guide, we'll be configuring the Pimlico's paymaster. However, it's important to note that paymaster support is not limited to the Pimlico, giving you the flexibility to integrate any compatible paymaster service that suits your requirements.

For the simplicity, we have only use `SafeSmartAccount`, but you choose your favorite smart account provider from the available ones. [Learn how to configure the smart account](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/smart-accounts/).

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from '@web3auth/account-abstraction-provider'

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: '0xaa36a7',

  rpcTarget: 'https://rpc.sepolia.org',

  displayName: 'Ethereum Sepolia Testnet',

  blockExplorerUrl: 'https://sepolia.etherscan.io',

  ticker: 'ETH',

  tickerName: 'Ethereum',

  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',

}

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

    smartAccountInit: new SafeSmartAccount(),

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

})

```

## Configure Web3Auth​

Once you have configured your `AccountAbstractionProvider`, you can now plug it in your Web3Auth Modal/No Modal instance. If you are using the external wallets like MetaMask, Coinbase, etc, you can define whether you want to use the AccountAbstractionProvider, or EthereumPrivateKeyProvider by setting the `useAAWithExternalWallet` in `IWeb3AuthCoreOptions`.

If you are setting `useAAWithExternalWallet` to `true`, it'll create a new Smart Account for your user, where the signer/creator of the Smart Account would be the external wallet.

If you are setting `useAAWithExternalWallet` to `false`, it'll skip creating a new Smart Account, and directly use the external wallet to sign the transactions.

```

import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

import { Web3Auth } from "@web3auth/modal";

const privateKeyProvider = new EthereumPrivateKeyProvider({

  // Use the chain config we declared earlier

  config: { chainConfig },

});

const web3auth = new Web3Auth({

  clientId: "YOUR_WEB3AUTH_CLIENT_ID", // Pass your Web3Auth Client ID, ideally using an environment variable

  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,

  privateKeyProvider,

  // Use the account abstraction provider we configured earlier

  accountAbstractionProvider

  // This will allow you to use EthereumPrivateKeyProvider for

  // external wallets, while use the AccountAbstractionProvider

  // for Web3Auth embedded wallets.

  useAAWithExternalWallet: false,

});

```

## Configure Signer​

The Web3Auth Smart Account feature is compatible with popular signer SDKs, including wagmi, ethers, and viem. You can choose your preferred package to configure the signer.

You can retreive the provider to configure the signer from Web3Auth instance.

Wagmi does not require any special configuration to use the signer with smart accounts. Once you have set up your Web3Auth provider and connected your wallet, Wagmi's hooks (such as useSigner or useAccount) will automatically use the smart account as the signer. You can interact with smart accounts using Wagmi just like you would with a regular EOA (Externally Owned Account) signer—no additional setup is needed.

```

import { createWalletClient } from 'viem'

// Use your Web3Auth instance to retreive the provider.

const provider = web3auth.provider

const walletClient = createWalletClient({

  transport: custom(provider),

})

```

## Send a transaction​

Developers can use their preferred signer or Wagmi hooks to initiate on-chain transactions, while Web3Auth manages the creation and submission of the UserOperation. Only the `to`, `data`, and `value` fields need to be provided. Any additional parameters will be ignored and automatically overridden.

To ensure reliable execution, the bundler client sets maxFeePerGas and maxPriorityFeePerGas values. If custom values are required, developers can use the [Viem's BundlerClient](https://viem.sh/account-abstraction/clients/bundler#bundler-client) to manually construct and send the user operation.

Since Smart Accounts are deployed smart contracts, the user's first transaction also triggers the on-chain deployment of their wallet.

```

import { useSendTransaction } from 'wagmi'

const { data: hash, sendTransaction } = useSendTransaction()

// Convert 1 ether to WEI format

const value = web3.utils.toWei(1)

sendTransaction({ to: 'DESTINATION_ADDRESS', value, data: '0x' })

const {

  data: receipt,

  isLoading: isConfirming,

  isSuccess: isConfirmed,

} = useWaitForTransactionReceipt({

  hash,

})

```

## Conclusion​

Voila, you have successfully sent your first gasless transaction using the Pimlico paymaster with Web3Auth Account Abstraction Provider. To learn more about advance features of the Account Abstraction Provider like performing batch transactions, using ERC-20 paymaster you can refer to the [Account Abstraction Provider](https://docs.metamask.io/embedded-wallets/sdk/react/) documentation.

# Smart Accounts

Effortlessly create and manage smart accounts for your users with just a few lines of code, using our Smart Account feature. Smart accounts offer enhanced control and programmability, enabling powerful features that traditional wallets can't provide.

**Key features of Smart Accounts include:**

- **Gas Abstraction:** Cover transaction fees for users, or allow users to pay for their own transactions using ERC-20 tokens.

- **Batch Transactions:** Perform multiple transactions in a single call.

- **Automated Transactions:** Allow users to automate actions, like swapping ETH to USDT when ETH hits a specific price.

- **Custom Spending Limits:** Allow users to set tailored spending limits.

> For more information about ERC-4337 and its components, check out our detailed blog post.

For more information about ERC-4337 and its components, [check out our detailed blog post](https://blog.web3auth.io/an-ultimate-guide-to-web3-wallets-externally-owned-account-and-smart-contract-wallet/#introduction-to-eip-4337).

Our smart account integration streamlines your setup, allowing you to create and manage smart accounts using your favorite libraries like Viem, Ethers, and Wagmi. You don't need to rely on third-party packages to effortlessly create ERC-4337 compatible Smart Contract Wallets (SCWs), giving users the ability to perform batch transactions and efficiently manage gas sponsorship.

This is a paid feature and the minimum [pricing plan](https://web3auth.io/pricing.html) to use this

SDK in a production environment is the **Growth Plan**. You can use this feature in Web3Auth

Sapphire Devnet network for free.

## Enabling Smart Accounts​

To enable this feature, you need to configure Smart Accounts from your project in the [Web3Auth Developer Dashboard](https://dashboard.web3auth.io/).

### Dashboard Configuration​

To enable Smart Accounts, navigate to the Smart Accounts section in the Web3Auth dashboard, and enable the "Set up Smart Accounts" toggle. Web3Auth currently supports [MetaMaskSmartAccount](https://docs.gator.metamask.io/how-to/create-delegator-account#create-a-metamasksmartaccount) as a Smart Account provider.

## Installation​

To use native account abstraction, you'll need to install the

[@web3auth/account-abstraction-provider](https://www.npmjs.com/package/@web3auth/account-abstraction-provider),

which allows you to create and interact with Smart Contract Wallets (SCWs). This provider simplifies

the entire process by managing the complex logic behind configuring the account abstraction

provider, bundler, and preparing user operations.

```

npm install --save @web3auth/account-abstraction-provider

```

## Configure​

When instantiating the Account Abstraction Provider, you can pass configuration objects to the

constructor. These configuration options allow you to select the desired Account Abstraction (AA)

provider, as well as configure the bundler and paymaster, giving you flexibility and control over

the provider.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

Please note this is the important step for setting the Web3Auth account abstraction provider.

- [Configure Smart Account provider](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#configure-smart-account-provider)

- [Configure Bundler](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#configure-bundler)

- [Configure Sponsored Paymaster](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#sponsored-paymaster)

- [Configure ERC-20 Paymaster](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#erc-20-paymaster)

## Configure Smart Account Provider​

Web3Auth offers the flexibility to choose your preferred Account Abstraction (AA) provider.

Currently, we support Safe, Kernel, Biconomy, and Trust.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Configure Bundler​

Web3Auth enables you to configure your bundler and define the paymaster context. The bundler

aggregates the UserOperations and submits them on-chain via a global entry point contract.

Bundler support is not limited to the examples below—you can use any bundler of your choice.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Configure Paymaster​

You can configure the paymaster of your choice to sponsor gas fees for your users, along with the paymaster context. The paymaster context lets you set additional parameters, such as choosing the token for ERC-20 paymasters, defining gas policies, and more.

### Sponsored Paymaster​

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

### ERC-20 Paymaster​

When using an ERC-20 paymaster, ensure you include the approval transaction, as Web3Auth does not

handle the approval internally.

For Pimlico, you can specify the token you want to use in the paymasterContext. If you want to set

up sponsorship policies, you can define those in the paymasterContext as well.

[Checkout the supported tokens for ERC-20 Paymaster on Pimlico](https://docs.pimlico.io/infra/paymaster/erc20-paymaster/supported-tokens).

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

      paymasterContext: {

        token: "SUPPORTED_TOKEN_CONTRACT_ADDRESS",

      },

    },

    smartAccountInit: new SafeSmartAccount(),

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Set up​

### Configure Web3Auth Instance​

```

import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider'

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from '@web3auth/account-abstraction-provider'

import Web3Auth, { WEB3AUTH_NETWORK } from '@web3auth/react-native-sdk'

import * as WebBrowser from '@toruslabs/react-native-web-browser'

import EncryptedStorage from 'react-native-encrypted-storage'

import { CHAIN_NAMESPACES } from '@web3auth/base'

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: '0xaa36a7',

  rpcTarget: 'https://rpc.sepolia.org',

  displayName: 'Ethereum Sepolia Testnet',

  blockExplorerUrl: 'https://sepolia.etherscan.io',

  ticker: 'ETH',

  tickerName: 'Ethereum',

  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',

}

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

    smartAccountInit: new SafeSmartAccount(),

  },

})

const privateKeyProvider = new EthereumPrivateKeyProvider({

  config: { chainConfig },

})

const web3auth = new Web3Auth(WebBrowser, EncryptedStorage, {

  clientId,

  redirectUrl,

  network: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET, // or other networks

  privateKeyProvider,

  accountAbstractionProvider: aaProvider,

})

```

### Configure Signer​

The Web3Auth Smart Account feature is compatible with popular signer SDKs, including wagmi, ethers,

and viem. You can choose your preferred package to configure the signer.

You can retreive the provider to configure the signer from Web3Auth instance.

Wagmi does not require any special configuration to use the signer with smart accounts. Once you

have set up your Web3Auth provider and connected your wallet, Wagmi's hooks (such as useSigner or

useAccount) will automatically use the smart account as the signer. You can interact with smart

accounts using Wagmi just like you would with a regular EOA (Externally Owned Account) signer—no

additional setup is needed.

```

import { createWalletClient } from "viem";

// Use your Web3Auth instance to retreive the provider.

const provider = web3auth.provider;

const walletClient = createWalletClient({

  transport: custom(provider),

});

```

## Smart Account Address​

Once the signers or Wagmi configuration is set up, it can be used to retrieve the user's Smart

Account address.

```

import { useAccount } from "wagmi";

const { address } = useAccount();

const smartAccountAddress = address;

```

## Send Transaction​

Developers can use their preferred signer or Wagmi hooks to initiate on-chain transactions, while

Web3Auth manages the creation and submission of the UserOperation. Only the `to`, `data`, and

`value` fields need to be provided. Any additional parameters will be ignored and automatically

overridden.

To ensure reliable execution, the bundler client sets maxFeePerGas and maxPriorityFeePerGas values.

If custom values are required, developers can use the

[Viem's BundlerClient](https://viem.sh/account-abstraction/clients/bundler#bundler-client) to

manually construct and send the user operation.

Since Smart Accounts are deployed smart contracts, the user's first transaction also triggers the

on-chain deployment of their wallet.

```

import { useSendTransaction } from "wagmi";

const { data: hash, sendTransaction } = useSendTransaction();

// Convert 1 ether to WEI format

const value = web3.utils.toWei(1);

sendTransaction({ to: "DESTINATION_ADDRESS", value, data: "0x" });

const {

  data: receipt,

  isLoading: isConfirming,

  isSuccess: isConfirmed,

} = useWaitForTransactionReceipt({

  hash,

});

```

## Advanced Smart Account Operations​

To learn more about supported transaction methods, and how to perform batch transactions, [checkout our detailed documentation of AccountAbstractionProvider](https://docs.metamask.io/embedded-wallets/sdk/react/).

# Advanced Permissions (ERC-7715)

The Smart Accounts Kit supports Advanced Permissions ([ERC-7715](https://eips.ethereum.org/EIPS/eip-7715)), which lets you request fine-grained permissions from a MetaMask user to execute transactions on their behalf.

For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course of a month.

Once the permission is granted, your dapp can use the allocated 10 USDC each day to purchase ETH directly from the MetaMask user's account.

Advanced Permissions eliminate the need for users to approve every transaction, which is useful for highly interactive dapps.

It also enables dapps to execute transactions for users without an active wallet connection.

This feature requires [MetaMask Flask 13.5.0](https://docs.metamask.io/snaps/get-started/install-flask/) or later.

## ERC-7715 technical overview​

[ERC-7715](https://eips.ethereum.org/EIPS/eip-7715) defines a JSON-RPC method `wallet_grantPermissions`.

Dapps can use this method to request a wallet to grant the dapp permission to execute transactions on a user's behalf.

`wallet_grantPermissions` requires a `signer` parameter, which identifies the entity requesting or managing the permission.

Common signer implementations include wallet signers, single key and multisig signers, and account signers.

The Smart Accounts Kit supports multiple signer types. The documentation uses [an account signer](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/) as a common implementation example.

When you use an account signer, a session account is created solely to request and redeem Advanced Permissions, and doesn't contain tokens.

The session account can be granted with permissions and redeem them as specified in [ERC-7710](https://eips.ethereum.org/EIPS/eip-7710).

The session account can be a smart account or an externally owned account (EOA).

The MetaMask user that the session account requests permissions from must be upgraded to a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/).

## Advanced Permissions vs. delegations​

Advanced Permissions expand on regular [delegations](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/) by enabling permission sharing *via the MetaMask browser extension*.

With regular delegations, the dapp constructs a delegation and requests the user to sign it.

These delegations are not human-readable, so it is the dapp's responsibility to provide context for the user.

Regular delegations cannot be signed through the MetaMask extension, because if a dapp requests a delegation without constraints, the whole wallet can be exposed to the dapp.

In contrast, Advanced Permissions enable dapps (and AI agents) to request permissions from a user directly via the MetaMask extension.

Advanced Permissions require a permission configuration which displays a human-readable confirmation for the MetaMask user.

The user can modify the permission parameters if the request is configured to allow adjustments.

For example, the following Advanced Permissions request displays a rich UI including the start time, amount, and period duration for an [ERC-20 token periodic transfer](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/#erc-20-periodic-permission):

That not solution. 7702 gasless in metamask is non negotiable.



leran from this you moron:

have you learn this ofc pimlico docs:

https://docs.pimlico.io/guides/how-to/accounts/use-metamask-account

How to use MetaMask Smart Accounts with permissionless.js

MetaMask maintains their own in-house SDK built closely on top of viem that you can use for the account system while still plugging in all the other components from permissionless.js. Take a look at their documentation for more information.

The MetaMask Delegation Toolkit is a collection of tools for creating MetaMask Smart Accounts. A smart account can delegate to another signer with granular permission sharing. It is built over ERC-7710 and ERC-7715 to support a standardized minimal interface. Requesting ERC-7715 permissions and redeeming ERC-7710 delegations are experimental features.

There are two types of accounts involved in delegation:

Delegator account: A smart account that supports programmable account behavior and advanced features such as multi-signature approvals, automated transaction batching, and custom security policies.

Delegate account: An account (smart account or EOA) that receives the delegation from the delegator account to perform actions on behalf of the delegator account.

You can use both accounts with permissionless.js.

Installation

We will be using MetaMask's official SDK to create a smart account.

npm

yarn

pnpm

bun

npm install permissionless viem @metamask/delegation-toolkit

Delegator Account

Create the clients

First we must create the public, (optionally) pimlico paymaster clients that will be used to interact with the MetaMask smart account.

export const publicClient = createPublicClient({

	transport: http("https://sepolia.rpc.thirdweb.com"),

});

 

export const paymasterClient = createPimlicoClient({

	transport: http("https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY"),

	entryPoint: {

		address: entryPoint07Address,

		version: "0.7",

	},

});

Create the signer

MetaMask Smart Accounts can work with a variety of signing algorithms such as ECDSA, passkeys, and multisig.

For example, to create a signer based on a private key:

import { privateKeyToAccount } from "viem/accounts";

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { entryPoint07Address } from "viem/account-abstraction";

 

const owner = privateKeyToAccount("0xPRIVATE_KEY");

Create the delegator smart account

For a full list of options for creating a MetaMask smart account, take a look at the MetaMask's documentation page for toMetaMaskSmartAccount.

With a signer, you can create a MetaMask smart account as such:

import {

	Implementation,

	toMetaMaskSmartAccount,

} from "@metamask/delegation-toolkit";

 

const delegatorSmartAccount = await toMetaMaskSmartAccount({

	client: publicClient,

	implementation: Implementation.Hybrid,

	deployParams: [owner.address, [], [], []],

	deploySalt: "0x",

	signatory: { account: owner },

});

 

Create the smart account client

const smartAccountClient = createSmartAccountClient({

	account: delegatorSmartAccount,

	chain: sepolia,

	paymaster: paymasterClient,

	bundlerTransport: http(

		"https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY",

	),

	userOperation: {

		estimateFeesPerGas: async () =>

			(await paymasterClient.getUserOperationGasPrice()).fast,

	},

});

Send a transaction

Transactions using permissionless.js simply wrap around user operations. This means you can switch to permissionless.js from your existing viem EOA codebase with minimal-to-no changes.

const txHash = await smartAccountClient.sendTransaction({

	to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",

	value: parseEther("0.1"),

});

This also means you can also use viem Contract instances to transact without any modifications.

const nftContract = getContract({

	address: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",

	abi: tokenAbi,

	client: {

		public: publicClient,

		wallet: smartAccountClient,

	},

});

 

const txHash = await nftContract.write.mint([

	"0x_MY_ADDRESS_TO_MINT_TOKENS",

	parseEther("1"),

]);

You can also send an array of transactions in a single batch.

const userOpHash = await smartAccountClient.sendUserOperation({

	calls: [

		{

			to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",

			value: parseEther("0.1"),

			data: "0x",

		},

		{

			to: "0x1440ec793aE50fA046B95bFeCa5aF475b6003f9e",

			value: parseEther("0.1"),

			data: "0x1234",

		},

	],

});

Delegate Account

A delegate account is an account that receives the delegation from the delegator account to perform actions on behalf of the delegator account. To create a delegate account, we will follow the following steps:

Create a delegate signer

Create the delegate smart account

Create a delegation using delegator smart account

Sign the delegation

Send transactions using delegate smart account with signed delegation

Create the clients

First we must create the public, (optionally) pimlico paymaster clients that will be used to interact with the MetaMask smart account.

export const publicClient = createPublicClient({

	transport: http("https://sepolia.rpc.thirdweb.com"),

});

 

export const paymasterClient = createPimlicoClient({

	transport: http("https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY"),

	entryPoint: {

		address: entryPoint07Address,

		version: "0.7",

	},

});

Create the signer

MetaMask Smart Accounts can work with a variety of signing algorithms such as ECDSA, passkeys, and multisig.

For example, to create a signer based on a private key:

const delegateSigner = privateKeyToAccount("0xPRIVATE_KEY");

Create the delegate smart account

For a full list of options for creating a MetaMask smart account, take a look at the MetaMask's documentation page for toMetaMaskSmartAccount.

With a delegate signer, you can create a MetaMask delegate account as such:

const delegateSmartAccount = await toMetaMaskSmartAccount({

	client: publicClient,

	implementation: Implementation.Hybrid,

	deployParams: [delegateSigner.address, [], [], []],

	deploySalt: "0x",

	signatory: { account: delegateSigner },

});

Create a delegation

This example passes an empty caveats array, which means the delegate can perform any action on the delegator's behalf. We recommend restricting the delegation by adding caveat enforcers.

import { createDelegation } from "@metamask/delegation-toolkit";

 

const delegation = createDelegation({

	to: delegateSmartAccount.address,

	from: delegatorSmartAccount.address,

	caveats: [],

});

Sign the delegation

const signature = await delegatorSmartAccount.signDelegation({

	delegation,

});

 

const signedDelegation = {

	...delegation,

	signature,

};

Create the smart account client

const delegateSmartAccountClient = createSmartAccountClient({

	account: delegateSmartAccount,

	chain: sepolia,

	paymaster: paymasterClient,

	bundlerTransport: http(

		"https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY",

	),

	userOperation: {

		estimateFeesPerGas: async () =>

			(await paymasterClient.getUserOperationGasPrice()).fast,

	},

});

Send transactions using signed delegation

import { DelegationManager } from "@metamask/delegation-toolkit/contracts";

import { SINGLE_DEFAULT_MODE } from "@metamask/delegation-toolkit/utils";

import { createExecution } from "@metamask/delegation-toolkit";

 

const delegations = [signedDelegation];

 

// Actual execution to be performed by the delegate account

const executions = [

	createExecution({

		target: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",

		callData: encodeFunctionData({

			abi: tokenAbi,

			functionName: "mint",

			args: ["0x_MY_ADDRESS_TO_MINT_TOKENS", parseEther("1")],

		}),

	}),

];

 

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({

	delegations: [delegations],

	modes: [SINGLE_DEFAULT_MODE],

	executions: [executions],

});

 

const txHash = await delegateSmartAccountClient.sendTransaction({

	calls: [

		{

			to: delegateSmartAccount.address,

			data: redeemDelegationCalldata,

		},

	],

});

have you also learn from metamask ofc docs:

# Configure the Smart Accounts Kit

The Smart Accounts Kit is highly configurable, providing support for custom [bundlers and paymasters](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/#configure-the-bundler).

You can also configure the [toolkit environment](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/#optional-configure-the-toolkit-environment) to interact with the [Delegation Framework](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-framework).

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Configure the bundler​

The toolkit uses Viem's Account Abstraction API to configure custom bundlers and paymasters.

This provides a robust and flexible foundation for creating and managing [MetaMask Smart Accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/).

See Viem's [account abstraction documentation](https://viem.sh/account-abstraction) for more information on the API's features, methods, and best practices.

To use the bundler and paymaster clients with the toolkit, create instances of these clients and configure them as follows:

```

import {

  createPaymasterClient,

  createBundlerClient,

} from "viem/account-abstraction";

import { http } from "viem";

import { sepolia as chain } from "viem/chains"; 

// Replace these URLs with your actual bundler and paymaster endpoints.

const bundlerUrl = "https://your-bundler-url.com";

const paymasterUrl = "https://your-paymaster-url.com";

// The paymaster is optional.

const paymasterClient = createPaymasterClient({

  transport: http(paymasterUrl),

});

const bundlerClient = createBundlerClient({

  transport: http(bundlerUrl),

  paymaster: paymasterClient,

  chain,

});

```

Replace the bundler and paymaster URLs with your bundler and paymaster endpoints.

For example, you can use endpoints from [Pimlico](https://docs.pimlico.io/references/bundler), [Infura](https://docs.metamask.io/services/), or [ZeroDev](https://docs.zerodev.app/meta-infra/intro).

Providing a paymaster is optional when configuring your bundler client. However, if you choose not to use a paymaster, the smart contract account must have enough funds to pay gas fees.

## (Optional) Configure the toolkit environment​

The toolkit environment (`SmartAccountsEnvironment`) defines the contract addresses necessary for interacting with the [Delegation Framework](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-framework) on a specific network.

It serves several key purposes:

- It provides a centralized configuration for all the contract addresses required by the Delegation Framework.

- It enables easy switching between different networks (for example, Mainnet and testnet) or custom deployments.

- It ensures consistency across different parts of the application that interact with the Delegation Framework.

### Resolve the environment​

When you create a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/), the toolkit automatically

resolves the environment based on the version it requires and the chain configured.

If no environment is found for the specified chain, it throws an error.

```

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { delegatorSmartAccount } from "./config.ts";

const environment: SmartAccountsEnvironment = delegatorSmartAccount.environment; 

```

See the changelog of the toolkit version you are using (in the left sidebar) for supported chains.

Alternatively, you can use the [getSmartAccountsEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#getsmartaccountsenvironment) function to resolve the environment.

This function is especially useful if your delegator is not a smart account when

creating a [redelegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-types).

```

import { 

  getSmartAccountsEnvironment, 

  SmartAccountsEnvironment, 

} from "@metamask/smart-accounts-kit"; 

// Resolves the SmartAccountsEnvironment for Sepolia

const environment: SmartAccountsEnvironment = getSmartAccountsEnvironment(11155111);

```

### Deploy a custom environment​

You can deploy the contracts using any method, but the toolkit provides a convenient [deployDelegatorEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#deploydelegatorenvironment) function. This function simplifies deploying the Delegation Framework contracts to your desired EVM chain.

This function requires a Viem [Public Client](https://viem.sh/docs/clients/public), [Wallet Client](https://viem.sh/docs/clients/wallet), and [Chain](https://viem.sh/docs/glossary/types#chain)

to deploy the contracts and resolve the `SmartAccountsEnvironment`.

Your wallet must have a sufficient native token balance to deploy the contracts.

```

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { deployDeleGatorEnvironment } from "@metamask/smart-accounts-kit/utils";

const environment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain

);

```

You can also override specific contracts when calling `deployDelegatorEnvironment`.

For example, if you've already deployed the `EntryPoint` contract on the target chain, you can pass the contract address to the function.

```

// The config.ts is the same as in the previous example.

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { deployDeleGatorEnvironment } from "@metamask/smart-accounts-kit/utils";

const environment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain,

+ {

+   EntryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032"

+ }

);

```

Once the contracts are deployed, you can use them to override the environment.

### Override the environment​

To override the environment, the toolkit provides an [overrideDeployedEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#overridedeployedenvironment) function to resolve

`SmartAccountsEnvironment` with specified contracts for the given chain and contract version.

```

// The config.ts is the same as in the previous example.

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { 

  overrideDeployedEnvironment,

  deployDeleGatorEnvironment 

} from "@metamask/smart-accounts-kit";

const environment: SmartAccountsEnvironment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain

);

overrideDeployedEnvironment(

  chain.id,

  "1.3.0",

  environment,

);

```

If you've already deployed the contracts using a different method, you can create a `DelegatorEnvironment` instance with the required contract addresses, and pass it to the function.

```

- import { walletClient, publicClient } from "./config.ts";

- import { sepolia as chain } from "viem/chains";

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { 

  overrideDeployedEnvironment,

- deployDeleGatorEnvironment

} from "@metamask/smart-accounts-kit";

- const environment: SmartAccountsEnvironment = await deployDeleGatorEnvironment(

-  walletClient, 

-  publicClient, 

-  chain

- );

+ const environment: SmartAccountsEnvironment = {

+  SimpleFactory: "0x124..",

+  // ...

+  implementations: {

+    // ...

+  },

+ };

overrideDeployedEnvironment(

  chain.id,

  "1.3.0",

  environment

);

```

Make sure to specify the Delegation Framework version required by the toolkit.

See the changelog of the toolkit version you are using (in the left sidebar) for its required Framework version.

# Create a smart account

You can enable users to create a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) directly in your dapp.

This page provides examples of using [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) with Viem Core SDK to create different types of smart accounts with different signature schemes.

An account's supported *signatories* can sign data on behalf of the smart account.

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Create a Hybrid smart account​

A Hybrid smart account supports both an externally owned account (EOA) owner and any number of passkey (WebAuthn) signers.

You can create a Hybrid smart account with the following types of signers.

### Create a Hybrid smart account with an Account signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount), and Viem's [privateKeyToAccount and generatePrivateKey](https://viem.sh/docs/accounts/local/privateKeyToAccount), to create a Hybrid smart account with a signer from a randomly generated private key:

```

import { publicClient } from "./client.ts"

import { account } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [account.address, [], [], []],

  deploySalt: "0x",

  signer: { account },

});

```

### Create a Hybrid smart account with a Wallet Client signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) to create a Hybrid smart account with a Wallet Client signer:

```

import { publicClient } from "./client.ts"

import { walletClient } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const addresses = await walletClient.getAddresses();

const owner = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [owner, [], [], []],

  deploySalt: "0x",

  signer: { walletClient },

});

```

### Create a Hybrid smart account with a passkey signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [toWebAuthnAccount](https://viem.sh/account-abstraction/accounts/webauthn) to create a Hybrid smart account with a passkey (WebAuthn) signer:

To work with WebAuthn, install the [Ox SDK](https://oxlib.sh/).

```

import { publicClient } from "./client.ts"

import { webAuthnAccount, credential } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

import { Address, PublicKey } from "ox";

import { toHex } from "viem";

// Deserialize compressed public key

const publicKey = PublicKey.fromHex(credential.publicKey);

// Convert public key to address

const owner = Address.fromPublicKey(publicKey);

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [owner, [toHex(credential.id)], [publicKey.x], [publicKey.y]],

  deploySalt: "0x",

  signer: { webAuthnAccount, keyId: toHex(credential.id) },

});

```

## Create a Multisig smart account​

A [Multisig smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#multisig-smart-account) supports multiple EOA signers with a configurable threshold for execution.

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) to create a Multsig smart account with a combination of account signers and Wallet Client signers:

```

import { publicClient } from "./client.ts";

import { account, walletClient } from "./signers.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const owners = [ account.address, walletClient.address ];

const signer = [ { account }, { walletClient } ];

const threshold = 2n

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.MultiSig,

  deployParams: [owners, threshold],

  deploySalt: "0x",

  signer,

});

```

The number of signers in the signatories must be at least equal to the threshold for valid signature generation.

## Create a Stateless 7702 smart account​

A [Stateless 7702 smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#stateless-7702-smart-account) represents an EOA that has been upgraded to support MetaMask Smart Accounts

functionality as defined by [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702).

This implementation does not handle the upgrade process; see the [EIP-7702 quickstart](https://docs.metamask.io/smart-accounts-kit/get-started/smart-account-quickstart/eip7702/) to learn how to upgrade.

You can create a Stateless 7702 smart account with the following types of signatories.

### Create a Stateless 7702 smart account with an account signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [privateKeyToAccount](https://viem.sh/docs/accounts/local/privateKeyToAccount) to create a Stateless 7702 smart account with a signer from a private key:

```

import { publicClient } from "./client.ts";

import { account } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Stateless7702,

  address: account.address // Address of the upgraded EOA

  signer: { account },

});

```

### Create a Stateless 7702 smart account with a Wallet Client signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) to create a Stateless 7702 smart account with a Wallet Client signer:

```

import { publicClient } from "./client.ts";

import { walletClient } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const addresses = await walletClient.getAddresses();

const address = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Stateless7702,

  address, // Address of the upgraded EOA

  signer: { walletClient },

});

```

## Next steps​

With a MetaMask smart account, you can perform the following functions:

- In conjunction with [Viem Account Abstraction clients](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/), [deploy the smart account](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/deploy-smart-account/)

and [send user operations](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-user-operation/).

- [Create delegations](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/) that can be used to grant specific rights and permissions to other accounts.

Smart accounts that create delegations are called *delegator accounts*.

# Deploy a smart account

You can deploy MetaMask Smart Accounts in two different ways. You can either deploy a smart account automatically when sending

the first user operation, or manually deploy the account.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Deploy with the first user operation​

When you send the first user operation from a smart account, the Smart Accounts Kit checks whether the account is already deployed. If the account

is not deployed, the toolkit adds the `initCode` to the user operation to deploy the account within the

same operation. Internally, the `initCode` is encoded using the `factory` and `factoryData`.

```

import { bundlerClient, smartAccount } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001"),

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas

});

```

## Deploy manually​

To deploy a smart account manually, call the [getFactoryArgs](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#getfactoryargs)

method from the smart account to retrieve the `factory` and `factoryData`. This allows you to use a relay account to sponsor the deployment without needing a paymaster.

The `factory` represents the contract address responsible for deploying the smart account, while `factoryData` contains the

calldata that will be executed by the `factory` to deploy the smart account.

The relay account can be either an externally owned account (EOA) or another smart account. This example uses an EOA.

```

import { walletClient, smartAccount } from "./config.ts";

const { factory, factoryData } = await smartAccount.getFactoryArgs();

// Deploy smart account using relay account.

const hash = await walletClient.sendTransaction({

  to: factory,

  data: factoryData,

})

```

## Next steps​

- Learn more about [sending user operations](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-user-operation/).

- To sponsor gas for end users, see how to [send a gasless transaction](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-gasless-transaction/).

# Send a user operation

User operations are the [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) counterpart to traditional blockchain transactions.

They incorporate significant enhancements that improve user experience and provide greater

flexibility in account management and transaction execution.

Viem's Account Abstraction API allows a developer to specify an array of `Calls` that will be executed as a user operation via Viem's [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation) method.

The MetaMask Smart Accounts Kit encodes and executes the provided calls.

User operations are not directly sent to the network.

Instead, they are sent to a bundler, which validates, optimizes, and aggregates them before network submission.

See [Viem's Bundler Client](https://viem.sh/account-abstraction/clients/bundler) for details on how to interact with the bundler.

If a user operation is sent from a MetaMask smart account that has not been deployed, the toolkit configures the user operation to automatically deploy the account.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Send a user operation​

The following is a simplified example of sending a user operation using Viem Core SDK. Viem Core SDK offers more granular control for developers who require it.

In the example, a user operation is created with the necessary gas limits.

This user operation is passed to a bundler instance, and the `EntryPoint` address is retrieved from the client.

```

import { bundlerClient, smartAccount } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001")

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas

});

```

### Estimate fee per gas​

Different bundlers have different ways to estimate `maxFeePerGas` and `maxPriorityFeePerGas`, and can reject requests with insufficient values.

The following example updates the previous example to estimate the fees.

This example uses constant values, but the [Hello Gator example](https://github.com/MetaMask/hello-gator) uses Pimlico's Alto bundler,

which fetches user operation gas price using the RPC method [pimlico_getUserOperationPrice](https://docs.pimlico.io/infra/bundler/endpoints/pimlico_getUserOperationGasPrice).

To estimate the gas fee for Pimlico's bundler, install the [permissionless.js SDK](https://docs.pimlico.io/references/permissionless/).

```

+ import { createPimlicoClient } from "permissionless/clients/pimlico";

import { parseEther } from "viem";

import { bundlerClient, smartAccount } from "./config.ts" // The config.ts is the same as in the previous example.

- const maxFeePerGas = 1n;

- const maxPriorityFeePerGas = 1n;

+ const pimlicoClient = createPimlicoClient({

+   transport: http("https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>"), // You can get the API Key from the Pimlico dashboard.

+ });

+

+ const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("1")

    }

  ],

-  maxFeePerGas,

-  maxPriorityFeePerGas

+  ...fee

});

```

### Wait for the transaction receipt​

After submitting the user operation, it's crucial to wait for the receipt to ensure that it has been successfully included in the blockchain. Use the `waitForUserOperationReceipt` method provided by the bundler client.

```

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { bundlerClient, smartAccount } from "./config.ts" // The config.ts is the same as in the previous example.

const pimlicoClient = createPimlicoClient({

  transport: http("https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>"), // You can get the API Key from the Pimlico dashboard.

});

const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("1")

    }

  ],

  ...fee

});

+ const { receipt } = await bundlerClient.waitForUserOperationReceipt({

+   hash: userOperationHash

+ });

+

+ console.log(receipt.transactionHash);

```

## Next steps​

To sponsor gas for end users, see how to [send a gasless transaction](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-gasless-transaction/).

# Send a gasless transaction

MetaMask Smart Accounts support gas sponsorship, which simplifies onboarding by abstracting gas fees away from end users.

You can use any paymaster service provider, such as [Pimlico](https://docs.pimlico.io/references/paymaster) or [ZeroDev](https://docs.zerodev.app/meta-infra/rpcs), or plug in your own custom paymaster.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Send a gasless transaction​

The following example demonstrates how to use Viem's [Paymaster Client](https://viem.sh/account-abstraction/clients/paymaster) to send gasless transactions.

You can provide the paymaster client using the paymaster property in the [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation#paymaster-optional) method, or in the [Bundler Client](https://viem.sh/account-abstraction/clients/bundler#paymaster-optional).

In this example, the paymaster client is passed to the `sendUserOperation` method.

```

import { bundlerClient, smartAccount, paymasterClient } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001")

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas,

  paymaster: paymasterClient,

});

```

# Generate a multisig signature

The Smart Accounts Kit supports [Multisig smart accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#multisig-smart-account),

allowing you to add multiple externally owned accounts (EOA)

signers with a configurable execution threshold. When the threshold

is greater than 1, you can collect signatures from the required signers

and use the [aggregateSignature](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#aggregatesignature) function to combine them

into a single aggregated signature.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a Multisig smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/#create-a-multisig-smart-account)

## Generate a multisig signature​

The following example configures a Multisig smart account with two different signers: Alice

and Bob. The account has a threshold of 2, meaning that signatures from

both parties are required for any execution.

```

import { 

  bundlerClient, 

  aliceSmartAccount, 

  bobSmartAccount,

  aliceAccount,

  bobAccount,

} from "./config.ts";

import { aggregateSignature } from "@metamask/smart-accounts-kit";

const userOperation = await bundlerClient.prepareUserOperation({

  account: aliceSmartAccount,

  calls: [

    {

      target: zeroAddress,

      value: 0n,

      data: "0x",

    }

  ]

});

const aliceSignature = await aliceSmartAccount.signUserOperation(userOperation);

const bobSignature = await bobSmartAccount.signUserOperation(userOperation);

const aggregatedSignature = aggregateSignature({

  signatures: [{

    signer: aliceAccount.address,

    signature: aliceSignature,

    type: "ECDSA",

  }, {

    signer: bobAccount.address,

    signature: bobSignature,

    type: "ECDSA",

  }],

});

```

# Perform executions on a smart account's behalf

[Delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/) is the ability for a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) to grant permission to another account to perform executions on its behalf.

In this guide, you'll create a delegator account (Alice) and a delegate account (Bob), and grant Bob permission to perform executions on Alice's behalf.

You'll complete the delegation lifecycle (create, sign, and redeem a delegation).

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Steps​

### 1. Create a Public Client​

Create a [Viem Public Client](https://viem.sh/docs/clients/public) using Viem's `createPublicClient` function.

You will configure Alice's account (the delegator) and the Bundler Client with the Public Client, which you can use to query the signer's account state and interact with smart contracts.

```

import { createPublicClient, http } from "viem"

import { sepolia as chain } from "viem/chains"

const publicClient = createPublicClient({

  chain,

  transport: http(),

})

```

### 2. Create a Bundler Client​

Create a [Viem Bundler Client](https://viem.sh/account-abstraction/clients/bundler) using Viem's `createBundlerClient` function.

You can use the bundler service to estimate gas for user operations and submit transactions to the network.

```

import { createBundlerClient } from "viem/account-abstraction"

const bundlerClient = createBundlerClient({

  client: publicClient,

  transport: http("https://your-bundler-rpc.com"),

})

```

### 3. Create a delegator account​

Create an account to represent Alice, the delegator who will create a delegation.

The delegator must be a MetaMask smart account; use the toolkit's [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) method to create the delegator account.

A Hybrid smart account is a flexible smart account implementation that supports both an externally owned account (EOA) owner and any number of P256 (passkey) signers.

This examples configures a [Hybrid smart account with an Account signer](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/#create-a-hybrid-smart-account-with-an-account-signer):

```

import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

import { privateKeyToAccount } from "viem/accounts"

const delegatorAccount = privateKeyToAccount("0x...")

const delegatorSmartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [delegatorAccount.address, [], [], []],

  deploySalt: "0x",

  signer: { account: delegatorAccount },

})

```

See [how to configure other smart account types](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/).

### 4. Create a delegate account​

Create an account to represent Bob, the delegate who will receive the delegation. The delegate can be a smart account or an externally owned account (EOA):

```

import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

import { privateKeyToAccount } from "viem/accounts"

const delegateAccount = privateKeyToAccount("0x...")

const delegateSmartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid, // Hybrid smart account

  deployParams: [delegateAccount.address, [], [], []],

  deploySalt: "0x",

  signer: { account: delegateAccount },

})

```

### 5. Create a delegation​

Create a [root delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-types) from Alice to Bob.

With a root delegation, Alice is delegating her own authority away, as opposed to *redelegating* permissions she received from a previous delegation.

Use the toolkit's [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation) method to create a root delegation. When creating

delegation, you need to configure the scope of the delegation to define the initial authority.

This example uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-transfer-scope) scope, allowing Alice to delegate to Bob the ability to spend her USDC, with a

specified limit on the total amount.

Before creating a delegation, ensure that the delegator account (in this example, Alice's account) has been deployed. If the account is not deployed, redeeming the delegation will fail.

```

import { createDelegation } from "@metamask/smart-accounts-kit"

import { parseUnits } from "viem"

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const delegation = createDelegation({

  to: delegateSmartAccount.address, // This example uses a delegate smart account

  from: delegatorSmartAccount.address,

  environment: delegatorSmartAccount.environment

  scope: {

    type: "erc20TransferAmount",

    tokenAddress,

    // 10 USDC 

    maxAmount: parseUnits("10", 6),

  },

})

```

### 6. Sign the delegation​

Sign the delegation with Alice's account, using the [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#signdelegation) method from `MetaMaskSmartAccount`. Alternatively, you can use the toolkit's [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#signdelegation) utility method. Bob will later use the signed delegation to perform actions on Alice's behalf.

```

const signature = await delegatorSmartAccount.signDelegation({

  delegation,

})

const signedDelegation = {

  ...delegation,

  signature,

}

```

### 7. Redeem the delegation​

Bob can now redeem the delegation. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on Alice's behalf.

To prepare the calldata for the redeem transaction, use the [redeemDelegations](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#redeemdelegations) method from `DelegationManager`.

Since Bob is redeeming a single delegation chain, use the [SingleDefault](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#execution-modes) execution mode.

Bob can redeem the delegation by submitting a user operation if his account is a smart account, or a regular transaction if his account is an EOA. In this example, Bob transfers 1 USDC from Alice’s account to his own.

```

import { createExecution, ExecutionMode } from "@metamask/smart-accounts-kit"

import { DelegationManager } from "@metamask/smart-accounts-kit/contracts"

import { zeroAddress } from "viem"

import { callData } from "./config.ts"

const delegations = [signedDelegation]

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const executions = createExecution({ target: tokenAddress, callData })

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({

  delegations: [delegations],

  modes: [ExecutionMode.SingleDefault],

  executions: [executions],

})

const userOperationHash = await bundlerClient.sendUserOperation({

  account: delegateSmartAccount,

  calls: [

    {

      to: delegateSmartAccount.address,

      data: redeemDelegationCalldata,

    },

  ],

  maxFeePerGas: 1n,

  maxPriorityFeePerGas: 1n,

})

```

## Next steps​

- See [how to configure different scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/) to define the initial authority of a delegation.

- See [how to further refine the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

- See [how to disable a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/disable-delegation/) to revoke permissions.

# Use delegation scopes

When [creating a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/), you can configure a scope to define the delegation's initial authority and help prevent delegation misuse.

You can further constrain this initial authority by [adding caveats to a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/).

The Smart Accounts Kit currently supports three categories of scopes:

| Scope type | Description |

| --- | --- |

| Spending limit scopes | Restricts the spending of native, ERC-20, and ERC-721 tokens based on defined conditions. |

| Function call scope | Restricts the delegation to specific contract methods, contract addresses, or calldata. |

| Ownership transfer scope | Restricts the delegation to only allow ownership transfers, specifically the transferOwnership function for a specified contract. |

# Use spending limit scopes

Spending limit scopes define how much a delegate can spend in native, ERC-20, or ERC-721 tokens.

You can set transfer limits with or without time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## ERC-20 periodic scope​

This scope ensures a per-period limit for ERC-20 token transfers.

You set the amount, period, and start data.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day.

Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20PeriodTransfer",

    tokenAddress: "0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da",

    // USDC has 6 decimal places.

    periodAmount: parseUnits("10", 6),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 streaming scope​

This scopes ensures a linear streaming transfer limit for ERC-20 tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20Streaming",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    amountPerSecond: parseUnits("0.1", 6),

    initialAmount: parseUnits("10", 6),

    maxAmount: parseUnits("100", 6),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 transfer scope​

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions.

Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    maxAmount: parseUnits("10", 6),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-721 scope​

This scope limits the delegation to ERC-721 token transfers only.

For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer.

See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const delegation = createDelegation({

  scope: {

    type: "erc721Transfer",

    tokenAddress: "0x3fF528De37cd95b67845C1c55303e7685c72F319",

    tokenId: 1n,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token periodic scope​

This scope ensures a per-period limit for native token transfers.

You set the amount, period, and start date.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

Bob can transfer a total of 0.01 ETH per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenPeriodTransfer",

    periodAmount: parseEther("0.01"),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token streaming scope​

This scopes ensures a linear streaming transfer limit for native tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenStreaming",

    amountPerSecond: parseEther("0.001"),

    initialAmount: parseEther("0.01"),

    maxAmount: parseEther("0.1"),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token transfer scope​

This scope ensures that native token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

Bob may use the 0.1 ETH in a single transaction or make multiple transactions, as long as the total does not exceed 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

const delegation = createDelegation({

  scope: {

    type: "nativeTokenTransferAmount",

    maxAmount: parseEther("0.001"),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Use spending limit scopes

Spending limit scopes define how much a delegate can spend in native, ERC-20, or ERC-721 tokens.

You can set transfer limits with or without time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## ERC-20 periodic scope​

This scope ensures a per-period limit for ERC-20 token transfers.

You set the amount, period, and start data.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day.

Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20PeriodTransfer",

    tokenAddress: "0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da",

    // USDC has 6 decimal places.

    periodAmount: parseUnits("10", 6),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 streaming scope​

This scopes ensures a linear streaming transfer limit for ERC-20 tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20Streaming",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    amountPerSecond: parseUnits("0.1", 6),

    initialAmount: parseUnits("10", 6),

    maxAmount: parseUnits("100", 6),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 transfer scope​

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions.

Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    maxAmount: parseUnits("10", 6),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-721 scope​

This scope limits the delegation to ERC-721 token transfers only.

For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer.

See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const delegation = createDelegation({

  scope: {

    type: "erc721Transfer",

    tokenAddress: "0x3fF528De37cd95b67845C1c55303e7685c72F319",

    tokenId: 1n,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token periodic scope​

This scope ensures a per-period limit for native token transfers.

You set the amount, period, and start date.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

Bob can transfer a total of 0.01 ETH per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenPeriodTransfer",

    periodAmount: parseEther("0.01"),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token streaming scope​

This scopes ensures a linear streaming transfer limit for native tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenStreaming",

    amountPerSecond: parseEther("0.001"),

    initialAmount: parseEther("0.01"),

    maxAmount: parseEther("0.1"),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token transfer scope​

This scope ensures that native token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

Bob may use the 0.1 ETH in a single transaction or make multiple transactions, as long as the total does not exceed 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

const delegation = createDelegation({

  scope: {

    type: "nativeTokenTransferAmount",

    maxAmount: parseEther("0.001"),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Use the ownership transfer scope

The ownership transfer scope restricts a delegation to ownership transfer calls only.

For example, Alice has deployed a smart contract, and she delegates to Bob the ability to transfer ownership of that contract.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## Ownership transfer scope​

This scope requires a `contractAddress`, which represents the address of the deployed contract.

Internally, this scope uses the [ownershipTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#ownershiptransfer) caveat enforcer.

See the [ownership transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#ownership-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const contractAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const delegation = createDelegation({

  scope: {

    type: "ownershipTransfer",

    contractAddress,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Constrain a delegation scope

[Delegation scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/) define the delegation's initial authority and help prevent delegation misuse.

You can further constrain these scopes and limit the delegation's authority by applying [caveat enforcers](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/caveat-enforcers/).

## Prerequisites​

[Configure a delegation scope.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/)

## Apply a caveat enforcer​

For example, Alice creates a delegation with an [ERC-20 transfer scope](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-transfer-scope) that allows Bob to spend up to 10 USDC.

If Alice wants to further restrict the scope to limit Bob's delegation to be valid for only seven days,

she can apply the [timestamp](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#timestamp) caveat enforcer.

The following example creates a delegation using [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation), applies the ERC-20 transfer scope with a spending limit of 10 USDC, and applies the `timestamp` caveat enforcer to restrict the delegation's validity to a seven-day period:

```

import { createDelegation } from "@metamask/smart-accounts-kit";

// Convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// Seven days after current time.

const beforeThreshold = currentTime + 604800;

const caveats = [{

  type: "timestamp",

  afterThreshold: currentTime,

  beforeThreshold, 

}];

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    maxAmount: 10000n,

  },

  // Apply caveats to the delegation.

  caveats,

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

- See the [caveats reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/) for the full list of caveat types and their parameters.

- For more specific or custom control, you can also [create custom caveat enforcers](https://docs.metamask.io/tutorials/create-custom-caveat-enforcer/)

and apply them to delegations.

# Check the delegation state

When using [spending limit delegation scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/) or relevant [caveat enforcers](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/),

you might need to check the remaining transferrable amount in a delegation.

For example, if a delegation allows a user to spend 10 USDC per week and they have already spent 10 - n USDC in the current period,

you can determine how much of the allowance is still available for transfer.

Use the `CaveatEnforcerClient` to check the available balances for specific scopes or caveats.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

- [Create a delegation with an ERC-20 periodic scope.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-periodic-scope)

## Create a CaveatEnforcerClient​

To check the delegation state, create a [CaveatEnforcerClient](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/).

This client allows you to interact with the caveat enforcers of the delegation, and read the required state.

```

import { environment, publicClient as client } from './config.ts'

import { createCaveatEnforcerClient } from '@metamask/smart-accounts-kit'

const caveatEnforcerClient = createCaveatEnforcerClient({

  environment,

  client,

})

```

## Read the caveat enforcer state​

This example uses the [getErc20PeriodTransferEnforcerAvailableAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/#geterc20periodtransferenforceravailableamount) method to read the state and retrieve the remaining amount for the current transfer period.

```

import { delegation } './config.ts'

// Returns the available amount for current period. 

const { availableAmount } = await caveatEnforcerClient.getErc20PeriodTransferEnforcerAvailableAmount({

  delegation,

})

```

## Next steps​

See the [Caveat Enforcer Client reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/) for the full list of available methods.

# Perform executions on a MetaMask user's behalf

[Advanced Permissions (ERC-7115)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) are fine-grained permissions that your dapp can request from a MetaMask user to execute transactions on their

behalf. For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course

of a month. Once the permission is granted, your dapp can use the allocated 10 USDC each day to

purchase ETH directly from the MetaMask user's account.

In this guide, you'll request an ERC-20 periodic transfer permission from a MetaMask user to transfer 1 USDC every day on their behalf.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Install MetaMask Flask 13.5.0 or later.](https://docs.metamask.io/snaps/get-started/install-flask/)

### 1. Set up a Wallet Client​

Set up a [Viem Wallet Client](https://viem.sh/docs/clients/wallet) using Viem's `createWalletClient` function. This client will

help you interact with MetaMask Flask.

Then, extend the Wallet Client functionality using `erc7715ProviderActions`. These actions enable you to request Advanced Permissions from the user.

```

import { createWalletClient, custom } from "viem";

import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";

const walletClient = createWalletClient({

  transport: custom(window.ethereum),

}).extend(erc7715ProviderActions());

```

### 2. Set up a Public Client​

Set up a [Viem Public Client](https://viem.sh/docs/clients/public) using Viem's `createPublicClient` function.

This client will help you query the account state and interact with the blockchain network.

```

import { createPublicClient, http } from "viem";

import { sepolia as chain } from "viem/chains";

 

const publicClient = createPublicClient({

  chain,

  transport: http(),

});

```

### 3. Set up a session account​

Set up a session account which can either be a smart account or an externally owned account (EOA)

to request Advanced Permissions. The requested permissions are granted to the session account, which

is responsible for executing transactions on behalf of the user.

```

import { privateKeyToAccount } from "viem/accounts";

import { 

  toMetaMaskSmartAccount, 

  Implementation 

} from "@metamask/smart-accounts-kit";

const privateKey = "0x...";

const account = privateKeyToAccount(privateKey);

const sessionAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [account.address, [], [], []],

  deploySalt: "0x",

  signer: { account },

});

```

### 4. Check the EOA account code​

Advanced Permissions support the automatic upgrading of a MetaMask user's account to a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/),

when using MetaMask Flask version 13.9.0 or later. For earlier versions, you must ensure that the

user is upgraded to a smart account before requesting Advanced Permissions.

If the user has not yet been upgraded, you can handle the upgrade [programmatically](https://docs.metamask.io/wallet/how-to/send-transactions/send-batch-transactions/#about-atomic-batch-transactions) or ask the

user to [switch to a smart account manually](https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account/#how-to-switch-to-a-metamask-smart-account).

MetaMask's Advanced Permissions (ERC-7115) implementation requires the user to be upgraded to a MetaMask

Smart Account because, under the hood, you're requesting a signature for an [ERC-7710 delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/).

ERC-7710 delegation is one of the core features supported only by MetaMask Smart Accounts.

```

import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { sepolia as chain } from "viem/chains";

const addresses = await walletClient.requestAddresses();

const address = addresses[0];

// Get the EOA account code

const code = await publicClient.getCode({

  address,

});

if (code) {

  // The address to which EOA has delegated. According to EIP-7702, 0xef0100 || address

  // represents the delegation. 

  // 

  // You need to remove the first 8 characters (0xef0100) to get the delegator address.

  const delegatorAddress = `0x${code.substring(8)}`;

  const statelessDelegatorAddress = getSmartAccountsEnvironment(chain.id)

  .implementations

  .EIP7702StatelessDeleGatorImpl;

  // If account is not upgraded to MetaMask smart account, you can

  // either upgrade programmatically or ask the user to switch to a smart account manually.

  const isAccountUpgraded = delegatorAddress.toLowerCase() === statelessDelegatorAddress.toLowerCase();

}

```

### 5. Request Advanced Permissions​

Request Advanced Permissions from the user using the Wallet Client's `requestExecutionPermissions` action.

In this example, you'll request an

[ERC-20 periodic permission](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/#erc-20-periodic-permission).

See the [requestExecutionPermissions](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#requestexecutionpermissions) API reference for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

// Since current time is in seconds, we need to convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // The requested permissions will granted to the

      // session account.

      address: sessionAccount.address,

    },

  },

  permission: {

    type: "erc20-token-periodic",

    data: {

      tokenAddress,

      // 1 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6

      periodAmount: parseUnits("10", 6),

      // 1 day in seconds

      periodDuration: 86400,

      justification?: "Permission to transfer 1 USDC every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

### 6. Set up a Viem client​

Set up a Viem client depending on your session account type.

For a smart account, set up a [Viem Bundler Client](https://viem.sh/account-abstraction/clients/bundler)

using Viem's `createBundlerClient` function. This lets you use the bundler service

to estimate gas for user operations and submit transactions to the network.

For an EOA, set up a [Viem Wallet Client](https://viem.sh/docs/clients/wallet)

using Viem's `createWalletClient` function. This lets you send transactions directly to the network.

The toolkit provides public actions for both of the clients which can be used to redeem Advanced Permissions, and execute transactions on a user's behalf.

```

import { createBundlerClient } from "viem/account-abstraction";

import { erc7710BundlerActions } from "@metamask/smart-accounts-kit/actions";

const bundlerClient = createBundlerClient({

  client: publicClient,

  transport: http("https://your-bundler-rpc.com"),

  // Allows you to use the same Bundler Client as paymaster.

  paymaster: true

}).extend(erc7710BundlerActions());

```

### 7. Redeem Advanced Permissions​

The session account can now redeem the permissions. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on the user's behalf.

To redeem the permissions, use the client action based on your session account type.

A smart account uses the Bundler Client's `sendUserOperationWithDelegation` action,

and an EOA uses the Wallet Client's `sendTransactionWithDelegation` action.

See the [sendUserOperationWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/bundler-client/#senduseroperationwithdelegation) and [sendTransactionWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#sendtransactionwithdelegation) API reference for more information.

```

import { calldata } from "./config.ts";

// These properties must be extracted from the permission response.

const permissionsContext = grantedPermissions[0].context;

const delegationManager = grantedPermissions[0].signerMeta.delegationManager;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// Calls without permissionsContext and delegationManager will be executed 

// as a normal user operation.

const userOperationHash = await bundlerClient.sendUserOperationWithDelegation({

  publicClient,

  account: sessionAccount,

  calls: [

    {

      to: tokenAddress,

      data: calldata,

      permissionsContext,

      delegationManager,

    },

  ],

  // Appropriate values must be used for fee-per-gas. 

  maxFeePerGas: 1n,

  maxPriorityFeePerGas: 1n,

});

```

## Next steps​

See how to configure different [ERC-20 token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/) and

[native token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/native-token/).

# Use ERC-20 token permissions

[Advanced Permissions (ERC-7715)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) supports ERC-20 token permission types that allow you to request fine-grained

permissions for ERC-20 token transfers with time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a session account.](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/#3-set-up-a-session-account)

## ERC-20 periodic permission​

This permission type ensures a per-period limit for ERC-20 token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 10 USDC on their behalf each day. The dapp can transfer a total of

10 USDC per day; the limit resets at the beginning of the next day.

See the [ERC-20 periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-periodic-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "erc20-token-periodic",

    data: {

      tokenAddress,

      // 10 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6.

      periodAmount: parseUnits("10", 6),

      // 1 day in seconds.

      periodDuration: 86400,

      justification?: "Permission to transfer 1 USDC every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

## ERC-20 stream permission​

This permission type ensures a linear streaming transfer limit for ERC-20 tokens. Token transfers are blocked until the

defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the

configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.1 USDC per second, starting with an initial amount

of 1 USDC, up to a maximum of 2 USDC.

See the [ERC-20 stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-stream-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "erc20-token-stream",

    data: {

      tokenAddress,

      // 0.1 USDC in WEI format. Since USDC has 6 decimals, 0.1 * 10^6.

      amountPerSecond: parseUnits("0.1", 6),

      // 1 USDC in WEI format. Since USDC has 6 decimals, 1 * 10^6.

      initialAmount: parseUnits("1", 6),

      // 2 USDC in WEI format. Since USDC has 6 decimals, 2 * 10^6.

      maxAmount: parseUnits("2", 6),

      startTime: currentTime,

      justification: "Permission to use 0.1 USDC per second",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

# Use native token permissions

[Advanced Permissions (ERC-7115)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) supports native token permission types that allow you to request fine-grained

permissions for native token transfers with time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a session account.](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/#3-set-up-a-session-account)

## Native token periodic permission​

This permission type ensures a per-period limit for native token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 0.001 ETH on their behalf each day. The dapp can transfer a total of

0.001 USDC per day; the limit resets at the beginning of the next day.

See the [native token periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-periodic-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseEther } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "native-token-periodic",

    data: {

      // 0.001 ETH in wei format.

      periodAmount: parseEther("0.001"),

      // 1 hour in seconds.

      periodDuration: 86400,

      startTime: currentTime,

      justification: "Permission to use 0.001 ETH every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

## Native token stream permission​

This permission type ensures a linear streaming transfer limit for native tokens. Token transfers are blocked until the

defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the

configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.0001 ETH per second, starting with an initial amount

of 0.1 ETH, up to a maximum of 1 ETH.

See the [native token stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-stream-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseEther } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "native-token-stream",

    data: {

      // 0.0001 ETH in wei format.

      amountPerSecond: parseEther("0.0001"),

      // 0.1 ETH in wei format.

      initialAmount: parseEther("0.1"),

      // 1 ETH in wei format.

      maxAmount: parseEther("1"),

      startTime: currentTime,

      justification: "Permission to use 0.0001 ETH per second",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

# Send your first gasless transaction

A paymaster is a vital component in the ERC-4337 standard, responsible for covering transaction costs on behalf of the user. There are various types of paymasters, such as gasless paymasters, ERC-20 paymasters, and more.

In this guide, we'll talk about how you can use the Pimlico gasless Paymaster with Web3Auth Account Abstraction Provider to sponsor the transaction for your users without requiring the user to pay gas fees.

For those who want to skip straight to the code, you can find it on [GitHub](https://github.com/Web3Auth/web3auth-examples/tree/main/other/smart-account-example).

## Prerequisites​

- Pimlico Account: Since we'll be using the Pimlico paymaster, you'll need to have an API key from Pimlico. You can get a free API key from [Pimlico Dashboard](https://dashboard.pimlico.io/).

- Web3Auth Dashboard: If you haven't already, sign up on the Web3Auth platform. It is free and gives you access to the Web3Auth's base plan. Head to Web3Auth's documentation page for detailed [instructions on setting up the Web3Auth Dashboard](https://docs.metamask.io/embedded-wallets/dashboard/).

- Web3Auth PnP Web SDK: This guide assumes that you already know how to integrate the PnP Web SDK in your project. If not, you can learn how to [integrate Web3Auth in your Web app](https://docs.metamask.io/embedded-wallets/sdk/react/).

## Integrate AccountAbstractionProvider​

Once, you have set up the Web3Auth Dashboard, and created a new project, it's time to integrate Web3Auth Account Abstraction Provider in your Web application. For the implementation, we'll use the [@web3auth/account-abstraction-provider](https://www.npmjs.com/package/@web3auth/account-abstraction-provider). The provider simplifies the entire process by managing the complex logic behind configuring the account abstraction provider, bundler, and preparing user operations.

If you are already using the Web3Auth Pnp SDK in your project, you just need to configure the AccountAbstractionProvider with the paymaster details, and pass it to the Web3Auth instance. No other changes are required.

### Installation​

```

npm install --save @web3auth/account-abstraction-provider

```

### Configure Paymaster​

The AccountAbstractionProvider requires specific configurations to function correctly. One key configuration is the paymaster. Web3Auth supports custom paymaster configurations, allowing you to deploy your own paymaster and integrate it with the provider.

You can choose from a variety of paymaster services available in the ecosystem. In this guide, we'll be configuring the Pimlico's paymaster. However, it's important to note that paymaster support is not limited to the Pimlico, giving you the flexibility to integrate any compatible paymaster service that suits your requirements.

For the simplicity, we have only use `SafeSmartAccount`, but you choose your favorite smart account provider from the available ones. [Learn how to configure the smart account](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/smart-accounts/).

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from '@web3auth/account-abstraction-provider'

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: '0xaa36a7',

  rpcTarget: 'https://rpc.sepolia.org',

  displayName: 'Ethereum Sepolia Testnet',

  blockExplorerUrl: 'https://sepolia.etherscan.io',

  ticker: 'ETH',

  tickerName: 'Ethereum',

  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',

}

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

    smartAccountInit: new SafeSmartAccount(),

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

})

```

## Configure Web3Auth​

Once you have configured your `AccountAbstractionProvider`, you can now plug it in your Web3Auth Modal/No Modal instance. If you are using the external wallets like MetaMask, Coinbase, etc, you can define whether you want to use the AccountAbstractionProvider, or EthereumPrivateKeyProvider by setting the `useAAWithExternalWallet` in `IWeb3AuthCoreOptions`.

If you are setting `useAAWithExternalWallet` to `true`, it'll create a new Smart Account for your user, where the signer/creator of the Smart Account would be the external wallet.

If you are setting `useAAWithExternalWallet` to `false`, it'll skip creating a new Smart Account, and directly use the external wallet to sign the transactions.

```

import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

import { Web3Auth } from "@web3auth/modal";

const privateKeyProvider = new EthereumPrivateKeyProvider({

  // Use the chain config we declared earlier

  config: { chainConfig },

});

const web3auth = new Web3Auth({

  clientId: "YOUR_WEB3AUTH_CLIENT_ID", // Pass your Web3Auth Client ID, ideally using an environment variable

  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,

  privateKeyProvider,

  // Use the account abstraction provider we configured earlier

  accountAbstractionProvider

  // This will allow you to use EthereumPrivateKeyProvider for

  // external wallets, while use the AccountAbstractionProvider

  // for Web3Auth embedded wallets.

  useAAWithExternalWallet: false,

});

```

## Configure Signer​

The Web3Auth Smart Account feature is compatible with popular signer SDKs, including wagmi, ethers, and viem. You can choose your preferred package to configure the signer.

You can retreive the provider to configure the signer from Web3Auth instance.

Wagmi does not require any special configuration to use the signer with smart accounts. Once you have set up your Web3Auth provider and connected your wallet, Wagmi's hooks (such as useSigner or useAccount) will automatically use the smart account as the signer. You can interact with smart accounts using Wagmi just like you would with a regular EOA (Externally Owned Account) signer—no additional setup is needed.

```

import { createWalletClient } from 'viem'

// Use your Web3Auth instance to retreive the provider.

const provider = web3auth.provider

const walletClient = createWalletClient({

  transport: custom(provider),

})

```

## Send a transaction​

Developers can use their preferred signer or Wagmi hooks to initiate on-chain transactions, while Web3Auth manages the creation and submission of the UserOperation. Only the `to`, `data`, and `value` fields need to be provided. Any additional parameters will be ignored and automatically overridden.

To ensure reliable execution, the bundler client sets maxFeePerGas and maxPriorityFeePerGas values. If custom values are required, developers can use the [Viem's BundlerClient](https://viem.sh/account-abstraction/clients/bundler#bundler-client) to manually construct and send the user operation.

Since Smart Accounts are deployed smart contracts, the user's first transaction also triggers the on-chain deployment of their wallet.

```

import { useSendTransaction } from 'wagmi'

const { data: hash, sendTransaction } = useSendTransaction()

// Convert 1 ether to WEI format

const value = web3.utils.toWei(1)

sendTransaction({ to: 'DESTINATION_ADDRESS', value, data: '0x' })

const {

  data: receipt,

  isLoading: isConfirming,

  isSuccess: isConfirmed,

} = useWaitForTransactionReceipt({

  hash,

})

```

## Conclusion​

Voila, you have successfully sent your first gasless transaction using the Pimlico paymaster with Web3Auth Account Abstraction Provider. To learn more about advance features of the Account Abstraction Provider like performing batch transactions, using ERC-20 paymaster you can refer to the [Account Abstraction Provider](https://docs.metamask.io/embedded-wallets/sdk/react/) documentation.

# Smart Accounts

Effortlessly create and manage smart accounts for your users with just a few lines of code, using our Smart Account feature. Smart accounts offer enhanced control and programmability, enabling powerful features that traditional wallets can't provide.

**Key features of Smart Accounts include:**

- **Gas Abstraction:** Cover transaction fees for users, or allow users to pay for their own transactions using ERC-20 tokens.

- **Batch Transactions:** Perform multiple transactions in a single call.

- **Automated Transactions:** Allow users to automate actions, like swapping ETH to USDT when ETH hits a specific price.

- **Custom Spending Limits:** Allow users to set tailored spending limits.

> For more information about ERC-4337 and its components, check out our detailed blog post.

For more information about ERC-4337 and its components, [check out our detailed blog post](https://blog.web3auth.io/an-ultimate-guide-to-web3-wallets-externally-owned-account-and-smart-contract-wallet/#introduction-to-eip-4337).

Our smart account integration streamlines your setup, allowing you to create and manage smart accounts using your favorite libraries like Viem, Ethers, and Wagmi. You don't need to rely on third-party packages to effortlessly create ERC-4337 compatible Smart Contract Wallets (SCWs), giving users the ability to perform batch transactions and efficiently manage gas sponsorship.

This is a paid feature and the minimum [pricing plan](https://web3auth.io/pricing.html) to use this

SDK in a production environment is the **Growth Plan**. You can use this feature in Web3Auth

Sapphire Devnet network for free.

## Enabling Smart Accounts​

To enable this feature, you need to configure Smart Accounts from your project in the [Web3Auth Developer Dashboard](https://dashboard.web3auth.io/).

### Dashboard Configuration​

To enable Smart Accounts, navigate to the Smart Accounts section in the Web3Auth dashboard, and enable the "Set up Smart Accounts" toggle. Web3Auth currently supports [MetaMaskSmartAccount](https://docs.gator.metamask.io/how-to/create-delegator-account#create-a-metamasksmartaccount) as a Smart Account provider.

## Installation​

To use native account abstraction, you'll need to install the

[@web3auth/account-abstraction-provider](https://www.npmjs.com/package/@web3auth/account-abstraction-provider),

which allows you to create and interact with Smart Contract Wallets (SCWs). This provider simplifies

the entire process by managing the complex logic behind configuring the account abstraction

provider, bundler, and preparing user operations.

```

npm install --save @web3auth/account-abstraction-provider

```

## Configure​

When instantiating the Account Abstraction Provider, you can pass configuration objects to the

constructor. These configuration options allow you to select the desired Account Abstraction (AA)

provider, as well as configure the bundler and paymaster, giving you flexibility and control over

the provider.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

Please note this is the important step for setting the Web3Auth account abstraction provider.

- [Configure Smart Account provider](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#configure-smart-account-provider)

- [Configure Bundler](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#configure-bundler)

- [Configure Sponsored Paymaster](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#sponsored-paymaster)

- [Configure ERC-20 Paymaster](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#erc-20-paymaster)

## Configure Smart Account Provider​

Web3Auth offers the flexibility to choose your preferred Account Abstraction (AA) provider.

Currently, we support Safe, Kernel, Biconomy, and Trust.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Configure Bundler​

Web3Auth enables you to configure your bundler and define the paymaster context. The bundler

aggregates the UserOperations and submits them on-chain via a global entry point contract.

Bundler support is not limited to the examples below—you can use any bundler of your choice.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Configure Paymaster​

You can configure the paymaster of your choice to sponsor gas fees for your users, along with the paymaster context. The paymaster context lets you set additional parameters, such as choosing the token for ERC-20 paymasters, defining gas policies, and more.

### Sponsored Paymaster​

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

### ERC-20 Paymaster​

When using an ERC-20 paymaster, ensure you include the approval transaction, as Web3Auth does not

handle the approval internally.

For Pimlico, you can specify the token you want to use in the paymasterContext. If you want to set

up sponsorship policies, you can define those in the paymasterContext as well.

[Checkout the supported tokens for ERC-20 Paymaster on Pimlico](https://docs.pimlico.io/infra/paymaster/erc20-paymaster/supported-tokens).

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

      paymasterContext: {

        token: "SUPPORTED_TOKEN_CONTRACT_ADDRESS",

      },

    },

    smartAccountInit: new SafeSmartAccount(),

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Set up​

### Configure Web3Auth Instance​

```

import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider'

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from '@web3auth/account-abstraction-provider'

import Web3Auth, { WEB3AUTH_NETWORK } from '@web3auth/react-native-sdk'

import * as WebBrowser from '@toruslabs/react-native-web-browser'

import EncryptedStorage from 'react-native-encrypted-storage'

import { CHAIN_NAMESPACES } from '@web3auth/base'

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: '0xaa36a7',

  rpcTarget: 'https://rpc.sepolia.org',

  displayName: 'Ethereum Sepolia Testnet',

  blockExplorerUrl: 'https://sepolia.etherscan.io',

  ticker: 'ETH',

  tickerName: 'Ethereum',

  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',

}

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

    smartAccountInit: new SafeSmartAccount(),

  },

})

const privateKeyProvider = new EthereumPrivateKeyProvider({

  config: { chainConfig },

})

const web3auth = new Web3Auth(WebBrowser, EncryptedStorage, {

  clientId,

  redirectUrl,

  network: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET, // or other networks

  privateKeyProvider,

  accountAbstractionProvider: aaProvider,

})

```

### Configure Signer​

The Web3Auth Smart Account feature is compatible with popular signer SDKs, including wagmi, ethers,

and viem. You can choose your preferred package to configure the signer.

You can retreive the provider to configure the signer from Web3Auth instance.

Wagmi does not require any special configuration to use the signer with smart accounts. Once you

have set up your Web3Auth provider and connected your wallet, Wagmi's hooks (such as useSigner or

useAccount) will automatically use the smart account as the signer. You can interact with smart

accounts using Wagmi just like you would with a regular EOA (Externally Owned Account) signer—no

additional setup is needed.

```

import { createWalletClient } from "viem";

// Use your Web3Auth instance to retreive the provider.

const provider = web3auth.provider;

const walletClient = createWalletClient({

  transport: custom(provider),

});

```

## Smart Account Address​

Once the signers or Wagmi configuration is set up, it can be used to retrieve the user's Smart

Account address.

```

import { useAccount } from "wagmi";

const { address } = useAccount();

const smartAccountAddress = address;

```

## Send Transaction​

Developers can use their preferred signer or Wagmi hooks to initiate on-chain transactions, while

Web3Auth manages the creation and submission of the UserOperation. Only the `to`, `data`, and

`value` fields need to be provided. Any additional parameters will be ignored and automatically

overridden.

To ensure reliable execution, the bundler client sets maxFeePerGas and maxPriorityFeePerGas values.

If custom values are required, developers can use the

[Viem's BundlerClient](https://viem.sh/account-abstraction/clients/bundler#bundler-client) to

manually construct and send the user operation.

Since Smart Accounts are deployed smart contracts, the user's first transaction also triggers the

on-chain deployment of their wallet.

```

import { useSendTransaction } from "wagmi";

const { data: hash, sendTransaction } = useSendTransaction();

// Convert 1 ether to WEI format

const value = web3.utils.toWei(1);

sendTransaction({ to: "DESTINATION_ADDRESS", value, data: "0x" });

const {

  data: receipt,

  isLoading: isConfirming,

  isSuccess: isConfirmed,

} = useWaitForTransactionReceipt({

  hash,

});

```

## Advanced Smart Account Operations​

To learn more about supported transaction methods, and how to perform batch transactions, [checkout our detailed documentation of AccountAbstractionProvider](https://docs.metamask.io/embedded-wallets/sdk/react/).

# Advanced Permissions (ERC-7715)

The Smart Accounts Kit supports Advanced Permissions ([ERC-7715](https://eips.ethereum.org/EIPS/eip-7715)), which lets you request fine-grained permissions from a MetaMask user to execute transactions on their behalf.

For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course of a month.

Once the permission is granted, your dapp can use the allocated 10 USDC each day to purchase ETH directly from the MetaMask user's account.

Advanced Permissions eliminate the need for users to approve every transaction, which is useful for highly interactive dapps.

It also enables dapps to execute transactions for users without an active wallet connection.

This feature requires [MetaMask Flask 13.5.0](https://docs.metamask.io/snaps/get-started/install-flask/) or later.

## ERC-7715 technical overview​

[ERC-7715](https://eips.ethereum.org/EIPS/eip-7715) defines a JSON-RPC method `wallet_grantPermissions`.

Dapps can use this method to request a wallet to grant the dapp permission to execute transactions on a user's behalf.

`wallet_grantPermissions` requires a `signer` parameter, which identifies the entity requesting or managing the permission.

Common signer implementations include wallet signers, single key and multisig signers, and account signers.

The Smart Accounts Kit supports multiple signer types. The documentation uses [an account signer](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/) as a common implementation example.

When you use an account signer, a session account is created solely to request and redeem Advanced Permissions, and doesn't contain tokens.

The session account can be granted with permissions and redeem them as specified in [ERC-7710](https://eips.ethereum.org/EIPS/eip-7710).

The session account can be a smart account or an externally owned account (EOA).

The MetaMask user that the session account requests permissions from must be upgraded to a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/).

## Advanced Permissions vs. delegations​

Advanced Permissions expand on regular [delegations](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/) by enabling permission sharing *via the MetaMask browser extension*.

With regular delegations, the dapp constructs a delegation and requests the user to sign it.

These delegations are not human-readable, so it is the dapp's responsibility to provide context for the user.

Regular delegations cannot be signed through the MetaMask extension, because if a dapp requests a delegation without constraints, the whole wallet can be exposed to the dapp.

In contrast, Advanced Permissions enable dapps (and AI agents) to request permissions from a user directly via the MetaMask extension.

Advanced Permissions require a permission configuration which displays a human-readable confirmation for the MetaMask user.

The user can modify the permission parameters if the request is configured to allow adjustments.

For example, the following Advanced Permissions request displays a rich UI including the start time, amount, and period duration for an [ERC-20 token periodic transfer](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/#erc-20-periodic-permission):

##That not solution. 7702 gasless in metamask is non negotiable.



leran from this you moron:

have you learn this ofc pimlico docs:

https://docs.pimlico.io/guides/how-to/accounts/use-metamask-account

How to use MetaMask Smart Accounts with permissionless.js

MetaMask maintains their own in-house SDK built closely on top of viem that you can use for the account system while still plugging in all the other components from permissionless.js. Take a look at their documentation for more information.

The MetaMask Delegation Toolkit is a collection of tools for creating MetaMask Smart Accounts. A smart account can delegate to another signer with granular permission sharing. It is built over ERC-7710 and ERC-7715 to support a standardized minimal interface. Requesting ERC-7715 permissions and redeeming ERC-7710 delegations are experimental features.

There are two types of accounts involved in delegation:

Delegator account: A smart account that supports programmable account behavior and advanced features such as multi-signature approvals, automated transaction batching, and custom security policies.

Delegate account: An account (smart account or EOA) that receives the delegation from the delegator account to perform actions on behalf of the delegator account.

You can use both accounts with permissionless.js.

Installation

We will be using MetaMask's official SDK to create a smart account.

npm

yarn

pnpm

bun

npm install permissionless viem @metamask/delegation-toolkit

Delegator Account

Create the clients

First we must create the public, (optionally) pimlico paymaster clients that will be used to interact with the MetaMask smart account.

export const publicClient = createPublicClient({

	transport: http("https://sepolia.rpc.thirdweb.com"),

});

 

export const paymasterClient = createPimlicoClient({

	transport: http("https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY"),

	entryPoint: {

		address: entryPoint07Address,

		version: "0.7",

	},

});

Create the signer

MetaMask Smart Accounts can work with a variety of signing algorithms such as ECDSA, passkeys, and multisig.

For example, to create a signer based on a private key:

import { privateKeyToAccount } from "viem/accounts";

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { entryPoint07Address } from "viem/account-abstraction";

 

const owner = privateKeyToAccount("0xPRIVATE_KEY");

Create the delegator smart account

For a full list of options for creating a MetaMask smart account, take a look at the MetaMask's documentation page for toMetaMaskSmartAccount.

With a signer, you can create a MetaMask smart account as such:

import {

	Implementation,

	toMetaMaskSmartAccount,

} from "@metamask/delegation-toolkit";

 

const delegatorSmartAccount = await toMetaMaskSmartAccount({

	client: publicClient,

	implementation: Implementation.Hybrid,

	deployParams: [owner.address, [], [], []],

	deploySalt: "0x",

	signatory: { account: owner },

});

 

Create the smart account client

const smartAccountClient = createSmartAccountClient({

	account: delegatorSmartAccount,

	chain: sepolia,

	paymaster: paymasterClient,

	bundlerTransport: http(

		"https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY",

	),

	userOperation: {

		estimateFeesPerGas: async () =>

			(await paymasterClient.getUserOperationGasPrice()).fast,

	},

});

Send a transaction

Transactions using permissionless.js simply wrap around user operations. This means you can switch to permissionless.js from your existing viem EOA codebase with minimal-to-no changes.

const txHash = await smartAccountClient.sendTransaction({

	to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",

	value: parseEther("0.1"),

});

This also means you can also use viem Contract instances to transact without any modifications.

const nftContract = getContract({

	address: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",

	abi: tokenAbi,

	client: {

		public: publicClient,

		wallet: smartAccountClient,

	},

});

 

const txHash = await nftContract.write.mint([

	"0x_MY_ADDRESS_TO_MINT_TOKENS",

	parseEther("1"),

]);

You can also send an array of transactions in a single batch.

const userOpHash = await smartAccountClient.sendUserOperation({

	calls: [

		{

			to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",

			value: parseEther("0.1"),

			data: "0x",

		},

		{

			to: "0x1440ec793aE50fA046B95bFeCa5aF475b6003f9e",

			value: parseEther("0.1"),

			data: "0x1234",

		},

	],

});

Delegate Account

A delegate account is an account that receives the delegation from the delegator account to perform actions on behalf of the delegator account. To create a delegate account, we will follow the following steps:

Create a delegate signer

Create the delegate smart account

Create a delegation using delegator smart account

Sign the delegation

Send transactions using delegate smart account with signed delegation

Create the clients

First we must create the public, (optionally) pimlico paymaster clients that will be used to interact with the MetaMask smart account.

export const publicClient = createPublicClient({

	transport: http("https://sepolia.rpc.thirdweb.com"),

});

 

export const paymasterClient = createPimlicoClient({

	transport: http("https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY"),

	entryPoint: {

		address: entryPoint07Address,

		version: "0.7",

	},

});

Create the signer

MetaMask Smart Accounts can work with a variety of signing algorithms such as ECDSA, passkeys, and multisig.

For example, to create a signer based on a private key:

const delegateSigner = privateKeyToAccount("0xPRIVATE_KEY");

Create the delegate smart account

For a full list of options for creating a MetaMask smart account, take a look at the MetaMask's documentation page for toMetaMaskSmartAccount.

With a delegate signer, you can create a MetaMask delegate account as such:

const delegateSmartAccount = await toMetaMaskSmartAccount({

	client: publicClient,

	implementation: Implementation.Hybrid,

	deployParams: [delegateSigner.address, [], [], []],

	deploySalt: "0x",

	signatory: { account: delegateSigner },

});

Create a delegation

This example passes an empty caveats array, which means the delegate can perform any action on the delegator's behalf. We recommend restricting the delegation by adding caveat enforcers.

import { createDelegation } from "@metamask/delegation-toolkit";

 

const delegation = createDelegation({

	to: delegateSmartAccount.address,

	from: delegatorSmartAccount.address,

	caveats: [],

});

Sign the delegation

const signature = await delegatorSmartAccount.signDelegation({

	delegation,

});

 

const signedDelegation = {

	...delegation,

	signature,

};

Create the smart account client

const delegateSmartAccountClient = createSmartAccountClient({

	account: delegateSmartAccount,

	chain: sepolia,

	paymaster: paymasterClient,

	bundlerTransport: http(

		"https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY",

	),

	userOperation: {

		estimateFeesPerGas: async () =>

			(await paymasterClient.getUserOperationGasPrice()).fast,

	},

});

Send transactions using signed delegation

import { DelegationManager } from "@metamask/delegation-toolkit/contracts";

import { SINGLE_DEFAULT_MODE } from "@metamask/delegation-toolkit/utils";

import { createExecution } from "@metamask/delegation-toolkit";

 

const delegations = [signedDelegation];

 

// Actual execution to be performed by the delegate account

const executions = [

	createExecution({

		target: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",

		callData: encodeFunctionData({

			abi: tokenAbi,

			functionName: "mint",

			args: ["0x_MY_ADDRESS_TO_MINT_TOKENS", parseEther("1")],

		}),

	}),

];

 

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({

	delegations: [delegations],

	modes: [SINGLE_DEFAULT_MODE],

	executions: [executions],

});

 

const txHash = await delegateSmartAccountClient.sendTransaction({

	calls: [

		{

			to: delegateSmartAccount.address,

			data: redeemDelegationCalldata,

		},

	],

});

have you also learn from metamask ofc docs:

# Configure the Smart Accounts Kit

The Smart Accounts Kit is highly configurable, providing support for custom [bundlers and paymasters](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/#configure-the-bundler).

You can also configure the [toolkit environment](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/#optional-configure-the-toolkit-environment) to interact with the [Delegation Framework](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-framework).

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Configure the bundler​

The toolkit uses Viem's Account Abstraction API to configure custom bundlers and paymasters.

This provides a robust and flexible foundation for creating and managing [MetaMask Smart Accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/).

See Viem's [account abstraction documentation](https://viem.sh/account-abstraction) for more information on the API's features, methods, and best practices.

To use the bundler and paymaster clients with the toolkit, create instances of these clients and configure them as follows:

```

import {

  createPaymasterClient,

  createBundlerClient,

} from "viem/account-abstraction";

import { http } from "viem";

import { sepolia as chain } from "viem/chains"; 

// Replace these URLs with your actual bundler and paymaster endpoints.

const bundlerUrl = "https://your-bundler-url.com";

const paymasterUrl = "https://your-paymaster-url.com";

// The paymaster is optional.

const paymasterClient = createPaymasterClient({

  transport: http(paymasterUrl),

});

const bundlerClient = createBundlerClient({

  transport: http(bundlerUrl),

  paymaster: paymasterClient,

  chain,

});

```

Replace the bundler and paymaster URLs with your bundler and paymaster endpoints.

For example, you can use endpoints from [Pimlico](https://docs.pimlico.io/references/bundler), [Infura](https://docs.metamask.io/services/), or [ZeroDev](https://docs.zerodev.app/meta-infra/intro).

Providing a paymaster is optional when configuring your bundler client. However, if you choose not to use a paymaster, the smart contract account must have enough funds to pay gas fees.

## (Optional) Configure the toolkit environment​

The toolkit environment (`SmartAccountsEnvironment`) defines the contract addresses necessary for interacting with the [Delegation Framework](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-framework) on a specific network.

It serves several key purposes:

- It provides a centralized configuration for all the contract addresses required by the Delegation Framework.

- It enables easy switching between different networks (for example, Mainnet and testnet) or custom deployments.

- It ensures consistency across different parts of the application that interact with the Delegation Framework.

### Resolve the environment​

When you create a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/), the toolkit automatically

resolves the environment based on the version it requires and the chain configured.

If no environment is found for the specified chain, it throws an error.

```

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { delegatorSmartAccount } from "./config.ts";

const environment: SmartAccountsEnvironment = delegatorSmartAccount.environment; 

```

See the changelog of the toolkit version you are using (in the left sidebar) for supported chains.

Alternatively, you can use the [getSmartAccountsEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#getsmartaccountsenvironment) function to resolve the environment.

This function is especially useful if your delegator is not a smart account when

creating a [redelegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-types).

```

import { 

  getSmartAccountsEnvironment, 

  SmartAccountsEnvironment, 

} from "@metamask/smart-accounts-kit"; 

// Resolves the SmartAccountsEnvironment for Sepolia

const environment: SmartAccountsEnvironment = getSmartAccountsEnvironment(11155111);

```

### Deploy a custom environment​

You can deploy the contracts using any method, but the toolkit provides a convenient [deployDelegatorEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#deploydelegatorenvironment) function. This function simplifies deploying the Delegation Framework contracts to your desired EVM chain.

This function requires a Viem [Public Client](https://viem.sh/docs/clients/public), [Wallet Client](https://viem.sh/docs/clients/wallet), and [Chain](https://viem.sh/docs/glossary/types#chain)

to deploy the contracts and resolve the `SmartAccountsEnvironment`.

Your wallet must have a sufficient native token balance to deploy the contracts.

```

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { deployDeleGatorEnvironment } from "@metamask/smart-accounts-kit/utils";

const environment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain

);

```

You can also override specific contracts when calling `deployDelegatorEnvironment`.

For example, if you've already deployed the `EntryPoint` contract on the target chain, you can pass the contract address to the function.

```

// The config.ts is the same as in the previous example.

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { deployDeleGatorEnvironment } from "@metamask/smart-accounts-kit/utils";

const environment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain,

+ {

+   EntryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032"

+ }

);

```

Once the contracts are deployed, you can use them to override the environment.

### Override the environment​

To override the environment, the toolkit provides an [overrideDeployedEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#overridedeployedenvironment) function to resolve

`SmartAccountsEnvironment` with specified contracts for the given chain and contract version.

```

// The config.ts is the same as in the previous example.

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { 

  overrideDeployedEnvironment,

  deployDeleGatorEnvironment 

} from "@metamask/smart-accounts-kit";

const environment: SmartAccountsEnvironment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain

);

overrideDeployedEnvironment(

  chain.id,

  "1.3.0",

  environment,

);

```

If you've already deployed the contracts using a different method, you can create a `DelegatorEnvironment` instance with the required contract addresses, and pass it to the function.

```

- import { walletClient, publicClient } from "./config.ts";

- import { sepolia as chain } from "viem/chains";

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { 

  overrideDeployedEnvironment,

- deployDeleGatorEnvironment

} from "@metamask/smart-accounts-kit";

- const environment: SmartAccountsEnvironment = await deployDeleGatorEnvironment(

-  walletClient, 

-  publicClient, 

-  chain

- );

+ const environment: SmartAccountsEnvironment = {

+  SimpleFactory: "0x124..",

+  // ...

+  implementations: {

+    // ...

+  },

+ };

overrideDeployedEnvironment(

  chain.id,

  "1.3.0",

  environment

);

```

Make sure to specify the Delegation Framework version required by the toolkit.

See the changelog of the toolkit version you are using (in the left sidebar) for its required Framework version.

# Create a smart account

You can enable users to create a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) directly in your dapp.

This page provides examples of using [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) with Viem Core SDK to create different types of smart accounts with different signature schemes.

An account's supported *signatories* can sign data on behalf of the smart account.

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Create a Hybrid smart account​

A Hybrid smart account supports both an externally owned account (EOA) owner and any number of passkey (WebAuthn) signers.

You can create a Hybrid smart account with the following types of signers.

### Create a Hybrid smart account with an Account signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount), and Viem's [privateKeyToAccount and generatePrivateKey](https://viem.sh/docs/accounts/local/privateKeyToAccount), to create a Hybrid smart account with a signer from a randomly generated private key:

```

import { publicClient } from "./client.ts"

import { account } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [account.address, [], [], []],

  deploySalt: "0x",

  signer: { account },

});

```

### Create a Hybrid smart account with a Wallet Client signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) to create a Hybrid smart account with a Wallet Client signer:

```

import { publicClient } from "./client.ts"

import { walletClient } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const addresses = await walletClient.getAddresses();

const owner = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [owner, [], [], []],

  deploySalt: "0x",

  signer: { walletClient },

});

```

### Create a Hybrid smart account with a passkey signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [toWebAuthnAccount](https://viem.sh/account-abstraction/accounts/webauthn) to create a Hybrid smart account with a passkey (WebAuthn) signer:

To work with WebAuthn, install the [Ox SDK](https://oxlib.sh/).

```

import { publicClient } from "./client.ts"

import { webAuthnAccount, credential } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

import { Address, PublicKey } from "ox";

import { toHex } from "viem";

// Deserialize compressed public key

const publicKey = PublicKey.fromHex(credential.publicKey);

// Convert public key to address

const owner = Address.fromPublicKey(publicKey);

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [owner, [toHex(credential.id)], [publicKey.x], [publicKey.y]],

  deploySalt: "0x",

  signer: { webAuthnAccount, keyId: toHex(credential.id) },

});

```

## Create a Multisig smart account​

A [Multisig smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#multisig-smart-account) supports multiple EOA signers with a configurable threshold for execution.

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) to create a Multsig smart account with a combination of account signers and Wallet Client signers:

```

import { publicClient } from "./client.ts";

import { account, walletClient } from "./signers.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const owners = [ account.address, walletClient.address ];

const signer = [ { account }, { walletClient } ];

const threshold = 2n

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.MultiSig,

  deployParams: [owners, threshold],

  deploySalt: "0x",

  signer,

});

```

The number of signers in the signatories must be at least equal to the threshold for valid signature generation.

## Create a Stateless 7702 smart account​

A [Stateless 7702 smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#stateless-7702-smart-account) represents an EOA that has been upgraded to support MetaMask Smart Accounts

functionality as defined by [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702).

This implementation does not handle the upgrade process; see the [EIP-7702 quickstart](https://docs.metamask.io/smart-accounts-kit/get-started/smart-account-quickstart/eip7702/) to learn how to upgrade.

You can create a Stateless 7702 smart account with the following types of signatories.

### Create a Stateless 7702 smart account with an account signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [privateKeyToAccount](https://viem.sh/docs/accounts/local/privateKeyToAccount) to create a Stateless 7702 smart account with a signer from a private key:

```

import { publicClient } from "./client.ts";

import { account } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Stateless7702,

  address: account.address // Address of the upgraded EOA

  signer: { account },

});

```

### Create a Stateless 7702 smart account with a Wallet Client signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) to create a Stateless 7702 smart account with a Wallet Client signer:

```

import { publicClient } from "./client.ts";

import { walletClient } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const addresses = await walletClient.getAddresses();

const address = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Stateless7702,

  address, // Address of the upgraded EOA

  signer: { walletClient },

});

```

## Next steps​

With a MetaMask smart account, you can perform the following functions:

- In conjunction with [Viem Account Abstraction clients](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/), [deploy the smart account](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/deploy-smart-account/)

and [send user operations](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-user-operation/).

- [Create delegations](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/) that can be used to grant specific rights and permissions to other accounts.

Smart accounts that create delegations are called *delegator accounts*.

# Deploy a smart account

You can deploy MetaMask Smart Accounts in two different ways. You can either deploy a smart account automatically when sending

the first user operation, or manually deploy the account.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Deploy with the first user operation​

When you send the first user operation from a smart account, the Smart Accounts Kit checks whether the account is already deployed. If the account

is not deployed, the toolkit adds the `initCode` to the user operation to deploy the account within the

same operation. Internally, the `initCode` is encoded using the `factory` and `factoryData`.

```

import { bundlerClient, smartAccount } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001"),

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas

});

```

## Deploy manually​

To deploy a smart account manually, call the [getFactoryArgs](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#getfactoryargs)

method from the smart account to retrieve the `factory` and `factoryData`. This allows you to use a relay account to sponsor the deployment without needing a paymaster.

The `factory` represents the contract address responsible for deploying the smart account, while `factoryData` contains the

calldata that will be executed by the `factory` to deploy the smart account.

The relay account can be either an externally owned account (EOA) or another smart account. This example uses an EOA.

```

import { walletClient, smartAccount } from "./config.ts";

const { factory, factoryData } = await smartAccount.getFactoryArgs();

// Deploy smart account using relay account.

const hash = await walletClient.sendTransaction({

  to: factory,

  data: factoryData,

})

```

## Next steps​

- Learn more about [sending user operations](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-user-operation/).

- To sponsor gas for end users, see how to [send a gasless transaction](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-gasless-transaction/).

# Send a user operation

User operations are the [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) counterpart to traditional blockchain transactions.

They incorporate significant enhancements that improve user experience and provide greater

flexibility in account management and transaction execution.

Viem's Account Abstraction API allows a developer to specify an array of `Calls` that will be executed as a user operation via Viem's [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation) method.

The MetaMask Smart Accounts Kit encodes and executes the provided calls.

User operations are not directly sent to the network.

Instead, they are sent to a bundler, which validates, optimizes, and aggregates them before network submission.

See [Viem's Bundler Client](https://viem.sh/account-abstraction/clients/bundler) for details on how to interact with the bundler.

If a user operation is sent from a MetaMask smart account that has not been deployed, the toolkit configures the user operation to automatically deploy the account.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Send a user operation​

The following is a simplified example of sending a user operation using Viem Core SDK. Viem Core SDK offers more granular control for developers who require it.

In the example, a user operation is created with the necessary gas limits.

This user operation is passed to a bundler instance, and the `EntryPoint` address is retrieved from the client.

```

import { bundlerClient, smartAccount } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001")

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas

});

```

### Estimate fee per gas​

Different bundlers have different ways to estimate `maxFeePerGas` and `maxPriorityFeePerGas`, and can reject requests with insufficient values.

The following example updates the previous example to estimate the fees.

This example uses constant values, but the [Hello Gator example](https://github.com/MetaMask/hello-gator) uses Pimlico's Alto bundler,

which fetches user operation gas price using the RPC method [pimlico_getUserOperationPrice](https://docs.pimlico.io/infra/bundler/endpoints/pimlico_getUserOperationGasPrice).

To estimate the gas fee for Pimlico's bundler, install the [permissionless.js SDK](https://docs.pimlico.io/references/permissionless/).

```

+ import { createPimlicoClient } from "permissionless/clients/pimlico";

import { parseEther } from "viem";

import { bundlerClient, smartAccount } from "./config.ts" // The config.ts is the same as in the previous example.

- const maxFeePerGas = 1n;

- const maxPriorityFeePerGas = 1n;

+ const pimlicoClient = createPimlicoClient({

+   transport: http("https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>"), // You can get the API Key from the Pimlico dashboard.

+ });

+

+ const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("1")

    }

  ],

-  maxFeePerGas,

-  maxPriorityFeePerGas

+  ...fee

});

```

### Wait for the transaction receipt​

After submitting the user operation, it's crucial to wait for the receipt to ensure that it has been successfully included in the blockchain. Use the `waitForUserOperationReceipt` method provided by the bundler client.

```

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { bundlerClient, smartAccount } from "./config.ts" // The config.ts is the same as in the previous example.

const pimlicoClient = createPimlicoClient({

  transport: http("https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>"), // You can get the API Key from the Pimlico dashboard.

});

const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("1")

    }

  ],

  ...fee

});

+ const { receipt } = await bundlerClient.waitForUserOperationReceipt({

+   hash: userOperationHash

+ });

+

+ console.log(receipt.transactionHash);

```

## Next steps​

To sponsor gas for end users, see how to [send a gasless transaction](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-gasless-transaction/).

# Send a gasless transaction

MetaMask Smart Accounts support gas sponsorship, which simplifies onboarding by abstracting gas fees away from end users.

You can use any paymaster service provider, such as [Pimlico](https://docs.pimlico.io/references/paymaster) or [ZeroDev](https://docs.zerodev.app/meta-infra/rpcs), or plug in your own custom paymaster.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Send a gasless transaction​

The following example demonstrates how to use Viem's [Paymaster Client](https://viem.sh/account-abstraction/clients/paymaster) to send gasless transactions.

You can provide the paymaster client using the paymaster property in the [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation#paymaster-optional) method, or in the [Bundler Client](https://viem.sh/account-abstraction/clients/bundler#paymaster-optional).

In this example, the paymaster client is passed to the `sendUserOperation` method.

```

import { bundlerClient, smartAccount, paymasterClient } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001")

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas,

  paymaster: paymasterClient,

});

```

# Generate a multisig signature

The Smart Accounts Kit supports [Multisig smart accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#multisig-smart-account),

allowing you to add multiple externally owned accounts (EOA)

signers with a configurable execution threshold. When the threshold

is greater than 1, you can collect signatures from the required signers

and use the [aggregateSignature](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#aggregatesignature) function to combine them

into a single aggregated signature.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a Multisig smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/#create-a-multisig-smart-account)

## Generate a multisig signature​

The following example configures a Multisig smart account with two different signers: Alice

and Bob. The account has a threshold of 2, meaning that signatures from

both parties are required for any execution.

```

import { 

  bundlerClient, 

  aliceSmartAccount, 

  bobSmartAccount,

  aliceAccount,

  bobAccount,

} from "./config.ts";

import { aggregateSignature } from "@metamask/smart-accounts-kit";

const userOperation = await bundlerClient.prepareUserOperation({

  account: aliceSmartAccount,

  calls: [

    {

      target: zeroAddress,

      value: 0n,

      data: "0x",

    }

  ]

});

const aliceSignature = await aliceSmartAccount.signUserOperation(userOperation);

const bobSignature = await bobSmartAccount.signUserOperation(userOperation);

const aggregatedSignature = aggregateSignature({

  signatures: [{

    signer: aliceAccount.address,

    signature: aliceSignature,

    type: "ECDSA",

  }, {

    signer: bobAccount.address,

    signature: bobSignature,

    type: "ECDSA",

  }],

});

```

# Perform executions on a smart account's behalf

[Delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/) is the ability for a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) to grant permission to another account to perform executions on its behalf.

In this guide, you'll create a delegator account (Alice) and a delegate account (Bob), and grant Bob permission to perform executions on Alice's behalf.

You'll complete the delegation lifecycle (create, sign, and redeem a delegation).

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Steps​

### 1. Create a Public Client​

Create a [Viem Public Client](https://viem.sh/docs/clients/public) using Viem's `createPublicClient` function.

You will configure Alice's account (the delegator) and the Bundler Client with the Public Client, which you can use to query the signer's account state and interact with smart contracts.

```

import { createPublicClient, http } from "viem"

import { sepolia as chain } from "viem/chains"

const publicClient = createPublicClient({

  chain,

  transport: http(),

})

```

### 2. Create a Bundler Client​

Create a [Viem Bundler Client](https://viem.sh/account-abstraction/clients/bundler) using Viem's `createBundlerClient` function.

You can use the bundler service to estimate gas for user operations and submit transactions to the network.

```

import { createBundlerClient } from "viem/account-abstraction"

const bundlerClient = createBundlerClient({

  client: publicClient,

  transport: http("https://your-bundler-rpc.com"),

})

```

### 3. Create a delegator account​

Create an account to represent Alice, the delegator who will create a delegation.

The delegator must be a MetaMask smart account; use the toolkit's [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) method to create the delegator account.

A Hybrid smart account is a flexible smart account implementation that supports both an externally owned account (EOA) owner and any number of P256 (passkey) signers.

This examples configures a [Hybrid smart account with an Account signer](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/#create-a-hybrid-smart-account-with-an-account-signer):

```

import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

import { privateKeyToAccount } from "viem/accounts"

const delegatorAccount = privateKeyToAccount("0x...")

const delegatorSmartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [delegatorAccount.address, [], [], []],

  deploySalt: "0x",

  signer: { account: delegatorAccount },

})

```

See [how to configure other smart account types](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/).

### 4. Create a delegate account​

Create an account to represent Bob, the delegate who will receive the delegation. The delegate can be a smart account or an externally owned account (EOA):

```

import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

import { privateKeyToAccount } from "viem/accounts"

const delegateAccount = privateKeyToAccount("0x...")

const delegateSmartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid, // Hybrid smart account

  deployParams: [delegateAccount.address, [], [], []],

  deploySalt: "0x",

  signer: { account: delegateAccount },

})

```

### 5. Create a delegation​

Create a [root delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-types) from Alice to Bob.

With a root delegation, Alice is delegating her own authority away, as opposed to *redelegating* permissions she received from a previous delegation.

Use the toolkit's [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation) method to create a root delegation. When creating

delegation, you need to configure the scope of the delegation to define the initial authority.

This example uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-transfer-scope) scope, allowing Alice to delegate to Bob the ability to spend her USDC, with a

specified limit on the total amount.

Before creating a delegation, ensure that the delegator account (in this example, Alice's account) has been deployed. If the account is not deployed, redeeming the delegation will fail.

```

import { createDelegation } from "@metamask/smart-accounts-kit"

import { parseUnits } from "viem"

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const delegation = createDelegation({

  to: delegateSmartAccount.address, // This example uses a delegate smart account

  from: delegatorSmartAccount.address,

  environment: delegatorSmartAccount.environment

  scope: {

    type: "erc20TransferAmount",

    tokenAddress,

    // 10 USDC 

    maxAmount: parseUnits("10", 6),

  },

})

```

### 6. Sign the delegation​

Sign the delegation with Alice's account, using the [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#signdelegation) method from `MetaMaskSmartAccount`. Alternatively, you can use the toolkit's [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#signdelegation) utility method. Bob will later use the signed delegation to perform actions on Alice's behalf.

```

const signature = await delegatorSmartAccount.signDelegation({

  delegation,

})

const signedDelegation = {

  ...delegation,

  signature,

}

```

### 7. Redeem the delegation​

Bob can now redeem the delegation. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on Alice's behalf.

To prepare the calldata for the redeem transaction, use the [redeemDelegations](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#redeemdelegations) method from `DelegationManager`.

Since Bob is redeeming a single delegation chain, use the [SingleDefault](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#execution-modes) execution mode.

Bob can redeem the delegation by submitting a user operation if his account is a smart account, or a regular transaction if his account is an EOA. In this example, Bob transfers 1 USDC from Alice’s account to his own.

```

import { createExecution, ExecutionMode } from "@metamask/smart-accounts-kit"

import { DelegationManager } from "@metamask/smart-accounts-kit/contracts"

import { zeroAddress } from "viem"

import { callData } from "./config.ts"

const delegations = [signedDelegation]

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const executions = createExecution({ target: tokenAddress, callData })

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({

  delegations: [delegations],

  modes: [ExecutionMode.SingleDefault],

  executions: [executions],

})

const userOperationHash = await bundlerClient.sendUserOperation({

  account: delegateSmartAccount,

  calls: [

    {

      to: delegateSmartAccount.address,

      data: redeemDelegationCalldata,

    },

  ],

  maxFeePerGas: 1n,

  maxPriorityFeePerGas: 1n,

})

```

## Next steps​

- See [how to configure different scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/) to define the initial authority of a delegation.

- See [how to further refine the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

- See [how to disable a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/disable-delegation/) to revoke permissions.

# Use delegation scopes

When [creating a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/), you can configure a scope to define the delegation's initial authority and help prevent delegation misuse.

You can further constrain this initial authority by [adding caveats to a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/).

The Smart Accounts Kit currently supports three categories of scopes:

| Scope type | Description |

| --- | --- |

| Spending limit scopes | Restricts the spending of native, ERC-20, and ERC-721 tokens based on defined conditions. |

| Function call scope | Restricts the delegation to specific contract methods, contract addresses, or calldata. |

| Ownership transfer scope | Restricts the delegation to only allow ownership transfers, specifically the transferOwnership function for a specified contract. |

# Use spending limit scopes

Spending limit scopes define how much a delegate can spend in native, ERC-20, or ERC-721 tokens.

You can set transfer limits with or without time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## ERC-20 periodic scope​

This scope ensures a per-period limit for ERC-20 token transfers.

You set the amount, period, and start data.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day.

Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20PeriodTransfer",

    tokenAddress: "0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da",

    // USDC has 6 decimal places.

    periodAmount: parseUnits("10", 6),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 streaming scope​

This scopes ensures a linear streaming transfer limit for ERC-20 tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20Streaming",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    amountPerSecond: parseUnits("0.1", 6),

    initialAmount: parseUnits("10", 6),

    maxAmount: parseUnits("100", 6),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 transfer scope​

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions.

Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    maxAmount: parseUnits("10", 6),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-721 scope​

This scope limits the delegation to ERC-721 token transfers only.

For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer.

See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const delegation = createDelegation({

  scope: {

    type: "erc721Transfer",

    tokenAddress: "0x3fF528De37cd95b67845C1c55303e7685c72F319",

    tokenId: 1n,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token periodic scope​

This scope ensures a per-period limit for native token transfers.

You set the amount, period, and start date.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

Bob can transfer a total of 0.01 ETH per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenPeriodTransfer",

    periodAmount: parseEther("0.01"),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token streaming scope​

This scopes ensures a linear streaming transfer limit for native tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenStreaming",

    amountPerSecond: parseEther("0.001"),

    initialAmount: parseEther("0.01"),

    maxAmount: parseEther("0.1"),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token transfer scope​

This scope ensures that native token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

Bob may use the 0.1 ETH in a single transaction or make multiple transactions, as long as the total does not exceed 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

const delegation = createDelegation({

  scope: {

    type: "nativeTokenTransferAmount",

    maxAmount: parseEther("0.001"),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Use spending limit scopes

Spending limit scopes define how much a delegate can spend in native, ERC-20, or ERC-721 tokens.

You can set transfer limits with or without time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## ERC-20 periodic scope​

This scope ensures a per-period limit for ERC-20 token transfers.

You set the amount, period, and start data.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day.

Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20PeriodTransfer",

    tokenAddress: "0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da",

    // USDC has 6 decimal places.

    periodAmount: parseUnits("10", 6),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 streaming scope​

This scopes ensures a linear streaming transfer limit for ERC-20 tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20Streaming",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    amountPerSecond: parseUnits("0.1", 6),

    initialAmount: parseUnits("10", 6),

    maxAmount: parseUnits("100", 6),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 transfer scope​

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions.

Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    maxAmount: parseUnits("10", 6),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-721 scope​

This scope limits the delegation to ERC-721 token transfers only.

For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer.

See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const delegation = createDelegation({

  scope: {

    type: "erc721Transfer",

    tokenAddress: "0x3fF528De37cd95b67845C1c55303e7685c72F319",

    tokenId: 1n,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token periodic scope​

This scope ensures a per-period limit for native token transfers.

You set the amount, period, and start date.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

Bob can transfer a total of 0.01 ETH per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenPeriodTransfer",

    periodAmount: parseEther("0.01"),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token streaming scope​

This scopes ensures a linear streaming transfer limit for native tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenStreaming",

    amountPerSecond: parseEther("0.001"),

    initialAmount: parseEther("0.01"),

    maxAmount: parseEther("0.1"),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token transfer scope​

This scope ensures that native token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

Bob may use the 0.1 ETH in a single transaction or make multiple transactions, as long as the total does not exceed 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

const delegation = createDelegation({

  scope: {

    type: "nativeTokenTransferAmount",

    maxAmount: parseEther("0.001"),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Use the ownership transfer scope

The ownership transfer scope restricts a delegation to ownership transfer calls only.

For example, Alice has deployed a smart contract, and she delegates to Bob the ability to transfer ownership of that contract.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## Ownership transfer scope​

This scope requires a `contractAddress`, which represents the address of the deployed contract.

Internally, this scope uses the [ownershipTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#ownershiptransfer) caveat enforcer.

See the [ownership transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#ownership-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const contractAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const delegation = createDelegation({

  scope: {

    type: "ownershipTransfer",

    contractAddress,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Constrain a delegation scope

[Delegation scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/) define the delegation's initial authority and help prevent delegation misuse.

You can further constrain these scopes and limit the delegation's authority by applying [caveat enforcers](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/caveat-enforcers/).

## Prerequisites​

[Configure a delegation scope.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/)

## Apply a caveat enforcer​

For example, Alice creates a delegation with an [ERC-20 transfer scope](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-transfer-scope) that allows Bob to spend up to 10 USDC.

If Alice wants to further restrict the scope to limit Bob's delegation to be valid for only seven days,

she can apply the [timestamp](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#timestamp) caveat enforcer.

The following example creates a delegation using [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation), applies the ERC-20 transfer scope with a spending limit of 10 USDC, and applies the `timestamp` caveat enforcer to restrict the delegation's validity to a seven-day period:

```

import { createDelegation } from "@metamask/smart-accounts-kit";

// Convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// Seven days after current time.

const beforeThreshold = currentTime + 604800;

const caveats = [{

  type: "timestamp",

  afterThreshold: currentTime,

  beforeThreshold, 

}];

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    maxAmount: 10000n,

  },

  // Apply caveats to the delegation.

  caveats,

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

- See the [caveats reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/) for the full list of caveat types and their parameters.

- For more specific or custom control, you can also [create custom caveat enforcers](https://docs.metamask.io/tutorials/create-custom-caveat-enforcer/)

and apply them to delegations.

# Check the delegation state

When using [spending limit delegation scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/) or relevant [caveat enforcers](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/),

you might need to check the remaining transferrable amount in a delegation.

For example, if a delegation allows a user to spend 10 USDC per week and they have already spent 10 - n USDC in the current period,

you can determine how much of the allowance is still available for transfer.

Use the `CaveatEnforcerClient` to check the available balances for specific scopes or caveats.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

- [Create a delegation with an ERC-20 periodic scope.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-periodic-scope)

## Create a CaveatEnforcerClient​

To check the delegation state, create a [CaveatEnforcerClient](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/).

This client allows you to interact with the caveat enforcers of the delegation, and read the required state.

```

import { environment, publicClient as client } from './config.ts'

import { createCaveatEnforcerClient } from '@metamask/smart-accounts-kit'

const caveatEnforcerClient = createCaveatEnforcerClient({

  environment,

  client,

})

```

## Read the caveat enforcer state​

This example uses the [getErc20PeriodTransferEnforcerAvailableAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/#geterc20periodtransferenforceravailableamount) method to read the state and retrieve the remaining amount for the current transfer period.

```

import { delegation } './config.ts'

// Returns the available amount for current period. 

const { availableAmount } = await caveatEnforcerClient.getErc20PeriodTransferEnforcerAvailableAmount({

  delegation,

})

```

## Next steps​

See the [Caveat Enforcer Client reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/) for the full list of available methods.

# Perform executions on a MetaMask user's behalf

[Advanced Permissions (ERC-7115)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) are fine-grained permissions that your dapp can request from a MetaMask user to execute transactions on their

behalf. For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course

of a month. Once the permission is granted, your dapp can use the allocated 10 USDC each day to

purchase ETH directly from the MetaMask user's account.

In this guide, you'll request an ERC-20 periodic transfer permission from a MetaMask user to transfer 1 USDC every day on their behalf.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Install MetaMask Flask 13.5.0 or later.](https://docs.metamask.io/snaps/get-started/install-flask/)

### 1. Set up a Wallet Client​

Set up a [Viem Wallet Client](https://viem.sh/docs/clients/wallet) using Viem's `createWalletClient` function. This client will

help you interact with MetaMask Flask.

Then, extend the Wallet Client functionality using `erc7715ProviderActions`. These actions enable you to request Advanced Permissions from the user.

```

import { createWalletClient, custom } from "viem";

import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";

const walletClient = createWalletClient({

  transport: custom(window.ethereum),

}).extend(erc7715ProviderActions());

```

### 2. Set up a Public Client​

Set up a [Viem Public Client](https://viem.sh/docs/clients/public) using Viem's `createPublicClient` function.

This client will help you query the account state and interact with the blockchain network.

```

import { createPublicClient, http } from "viem";

import { sepolia as chain } from "viem/chains";

 

const publicClient = createPublicClient({

  chain,

  transport: http(),

});

```

### 3. Set up a session account​

Set up a session account which can either be a smart account or an externally owned account (EOA)

to request Advanced Permissions. The requested permissions are granted to the session account, which

is responsible for executing transactions on behalf of the user.

```

import { privateKeyToAccount } from "viem/accounts";

import { 

  toMetaMaskSmartAccount, 

  Implementation 

} from "@metamask/smart-accounts-kit";

const privateKey = "0x...";

const account = privateKeyToAccount(privateKey);

const sessionAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [account.address, [], [], []],

  deploySalt: "0x",

  signer: { account },

});

```

### 4. Check the EOA account code​

Advanced Permissions support the automatic upgrading of a MetaMask user's account to a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/),

when using MetaMask Flask version 13.9.0 or later. For earlier versions, you must ensure that the

user is upgraded to a smart account before requesting Advanced Permissions.

If the user has not yet been upgraded, you can handle the upgrade [programmatically](https://docs.metamask.io/wallet/how-to/send-transactions/send-batch-transactions/#about-atomic-batch-transactions) or ask the

user to [switch to a smart account manually](https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account/#how-to-switch-to-a-metamask-smart-account).

MetaMask's Advanced Permissions (ERC-7115) implementation requires the user to be upgraded to a MetaMask

Smart Account because, under the hood, you're requesting a signature for an [ERC-7710 delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/).

ERC-7710 delegation is one of the core features supported only by MetaMask Smart Accounts.

```

import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { sepolia as chain } from "viem/chains";

const addresses = await walletClient.requestAddresses();

const address = addresses[0];

// Get the EOA account code

const code = await publicClient.getCode({

  address,

});

if (code) {

  // The address to which EOA has delegated. According to EIP-7702, 0xef0100 || address

  // represents the delegation. 

  // 

  // You need to remove the first 8 characters (0xef0100) to get the delegator address.

  const delegatorAddress = `0x${code.substring(8)}`;

  const statelessDelegatorAddress = getSmartAccountsEnvironment(chain.id)

  .implementations

  .EIP7702StatelessDeleGatorImpl;

  // If account is not upgraded to MetaMask smart account, you can

  // either upgrade programmatically or ask the user to switch to a smart account manually.

  const isAccountUpgraded = delegatorAddress.toLowerCase() === statelessDelegatorAddress.toLowerCase();

}

```

### 5. Request Advanced Permissions​

Request Advanced Permissions from the user using the Wallet Client's `requestExecutionPermissions` action.

In this example, you'll request an

[ERC-20 periodic permission](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/#erc-20-periodic-permission).

See the [requestExecutionPermissions](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#requestexecutionpermissions) API reference for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

// Since current time is in seconds, we need to convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // The requested permissions will granted to the

      // session account.

      address: sessionAccount.address,

    },

  },

  permission: {

    type: "erc20-token-periodic",

    data: {

      tokenAddress,

      // 1 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6

      periodAmount: parseUnits("10", 6),

      // 1 day in seconds

      periodDuration: 86400,

      justification?: "Permission to transfer 1 USDC every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

### 6. Set up a Viem client​

Set up a Viem client depending on your session account type.

For a smart account, set up a [Viem Bundler Client](https://viem.sh/account-abstraction/clients/bundler)

using Viem's `createBundlerClient` function. This lets you use the bundler service

to estimate gas for user operations and submit transactions to the network.

For an EOA, set up a [Viem Wallet Client](https://viem.sh/docs/clients/wallet)

using Viem's `createWalletClient` function. This lets you send transactions directly to the network.

The toolkit provides public actions for both of the clients which can be used to redeem Advanced Permissions, and execute transactions on a user's behalf.

```

import { createBundlerClient } from "viem/account-abstraction";

import { erc7710BundlerActions } from "@metamask/smart-accounts-kit/actions";

const bundlerClient = createBundlerClient({

  client: publicClient,

  transport: http("https://your-bundler-rpc.com"),

  // Allows you to use the same Bundler Client as paymaster.

  paymaster: true

}).extend(erc7710BundlerActions());

```

### 7. Redeem Advanced Permissions​

The session account can now redeem the permissions. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on the user's behalf.

To redeem the permissions, use the client action based on your session account type.

A smart account uses the Bundler Client's `sendUserOperationWithDelegation` action,

and an EOA uses the Wallet Client's `sendTransactionWithDelegation` action.

See the [sendUserOperationWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/bundler-client/#senduseroperationwithdelegation) and [sendTransactionWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#sendtransactionwithdelegation) API reference for more information.

```

import { calldata } from "./config.ts";

// These properties must be extracted from the permission response.

const permissionsContext = grantedPermissions[0].context;

const delegationManager = grantedPermissions[0].signerMeta.delegationManager;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// Calls without permissionsContext and delegationManager will be executed 

// as a normal user operation.

const userOperationHash = await bundlerClient.sendUserOperationWithDelegation({

  publicClient,

  account: sessionAccount,

  calls: [

    {

      to: tokenAddress,

      data: calldata,

      permissionsContext,

      delegationManager,

    },

  ],

  // Appropriate values must be used for fee-per-gas. 

  maxFeePerGas: 1n,

  maxPriorityFeePerGas: 1n,

});

```

## Next steps​

See how to configure different [ERC-20 token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/) and

[native token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/native-token/).

# Use ERC-20 token permissions

[Advanced Permissions (ERC-7715)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) supports ERC-20 token permission types that allow you to request fine-grained

permissions for ERC-20 token transfers with time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a session account.](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/#3-set-up-a-session-account)

## ERC-20 periodic permission​

This permission type ensures a per-period limit for ERC-20 token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 10 USDC on their behalf each day. The dapp can transfer a total of

10 USDC per day; the limit resets at the beginning of the next day.

See the [ERC-20 periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-periodic-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "erc20-token-periodic",

    data: {

      tokenAddress,

      // 10 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6.

      periodAmount: parseUnits("10", 6),

      // 1 day in seconds.

      periodDuration: 86400,

      justification?: "Permission to transfer 1 USDC every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

## ERC-20 stream permission​

This permission type ensures a linear streaming transfer limit for ERC-20 tokens. Token transfers are blocked until the

defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the

configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.1 USDC per second, starting with an initial amount

of 1 USDC, up to a maximum of 2 USDC.

See the [ERC-20 stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-stream-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "erc20-token-stream",

    data: {

      tokenAddress,

      // 0.1 USDC in WEI format. Since USDC has 6 decimals, 0.1 * 10^6.

      amountPerSecond: parseUnits("0.1", 6),

      // 1 USDC in WEI format. Since USDC has 6 decimals, 1 * 10^6.

      initialAmount: parseUnits("1", 6),

      // 2 USDC in WEI format. Since USDC has 6 decimals, 2 * 10^6.

      maxAmount: parseUnits("2", 6),

      startTime: currentTime,

      justification: "Permission to use 0.1 USDC per second",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

# Use native token permissions

[Advanced Permissions (ERC-7115)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) supports native token permission types that allow you to request fine-grained

permissions for native token transfers with time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a session account.](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/#3-set-up-a-session-account)

## Native token periodic permission​

This permission type ensures a per-period limit for native token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 0.001 ETH on their behalf each day. The dapp can transfer a total of

0.001 USDC per day; the limit resets at the beginning of the next day.

See the [native token periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-periodic-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseEther } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "native-token-periodic",

    data: {

      // 0.001 ETH in wei format.

      periodAmount: parseEther("0.001"),

      // 1 hour in seconds.

      periodDuration: 86400,

      startTime: currentTime,

      justification: "Permission to use 0.001 ETH every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

## Native token stream permission​

This permission type ensures a linear streaming transfer limit for native tokens. Token transfers are blocked until the

defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the

configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.0001 ETH per second, starting with an initial amount

of 0.1 ETH, up to a maximum of 1 ETH.

See the [native token stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-stream-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseEther } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "native-token-stream",

    data: {

      // 0.0001 ETH in wei format.

      amountPerSecond: parseEther("0.0001"),

      // 0.1 ETH in wei format.

      initialAmount: parseEther("0.1"),

      // 1 ETH in wei format.

      maxAmount: parseEther("1"),

      startTime: currentTime,

      justification: "Permission to use 0.0001 ETH per second",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

# Send your first gasless transaction

A paymaster is a vital component in the ERC-4337 standard, responsible for covering transaction costs on behalf of the user. There are various types of paymasters, such as gasless paymasters, ERC-20 paymasters, and more.

In this guide, we'll talk about how you can use the Pimlico gasless Paymaster with Web3Auth Account Abstraction Provider to sponsor the transaction for your users without requiring the user to pay gas fees.

For those who want to skip straight to the code, you can find it on [GitHub](https://github.com/Web3Auth/web3auth-examples/tree/main/other/smart-account-example).

## Prerequisites​

- Pimlico Account: Since we'll be using the Pimlico paymaster, you'll need to have an API key from Pimlico. You can get a free API key from [Pimlico Dashboard](https://dashboard.pimlico.io/).

- Web3Auth Dashboard: If you haven't already, sign up on the Web3Auth platform. It is free and gives you access to the Web3Auth's base plan. Head to Web3Auth's documentation page for detailed [instructions on setting up the Web3Auth Dashboard](https://docs.metamask.io/embedded-wallets/dashboard/).

- Web3Auth PnP Web SDK: This guide assumes that you already know how to integrate the PnP Web SDK in your project. If not, you can learn how to [integrate Web3Auth in your Web app](https://docs.metamask.io/embedded-wallets/sdk/react/).

## Integrate AccountAbstractionProvider​

Once, you have set up the Web3Auth Dashboard, and created a new project, it's time to integrate Web3Auth Account Abstraction Provider in your Web application. For the implementation, we'll use the [@web3auth/account-abstraction-provider](https://www.npmjs.com/package/@web3auth/account-abstraction-provider). The provider simplifies the entire process by managing the complex logic behind configuring the account abstraction provider, bundler, and preparing user operations.

If you are already using the Web3Auth Pnp SDK in your project, you just need to configure the AccountAbstractionProvider with the paymaster details, and pass it to the Web3Auth instance. No other changes are required.

### Installation​

```

npm install --save @web3auth/account-abstraction-provider

```

### Configure Paymaster​

The AccountAbstractionProvider requires specific configurations to function correctly. One key configuration is the paymaster. Web3Auth supports custom paymaster configurations, allowing you to deploy your own paymaster and integrate it with the provider.

You can choose from a variety of paymaster services available in the ecosystem. In this guide, we'll be configuring the Pimlico's paymaster. However, it's important to note that paymaster support is not limited to the Pimlico, giving you the flexibility to integrate any compatible paymaster service that suits your requirements.

For the simplicity, we have only use `SafeSmartAccount`, but you choose your favorite smart account provider from the available ones. [Learn how to configure the smart account](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/smart-accounts/).

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from '@web3auth/account-abstraction-provider'

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: '0xaa36a7',

  rpcTarget: 'https://rpc.sepolia.org',

  displayName: 'Ethereum Sepolia Testnet',

  blockExplorerUrl: 'https://sepolia.etherscan.io',

  ticker: 'ETH',

  tickerName: 'Ethereum',

  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',

}

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

    smartAccountInit: new SafeSmartAccount(),

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

})

```

## Configure Web3Auth​

Once you have configured your `AccountAbstractionProvider`, you can now plug it in your Web3Auth Modal/No Modal instance. If you are using the external wallets like MetaMask, Coinbase, etc, you can define whether you want to use the AccountAbstractionProvider, or EthereumPrivateKeyProvider by setting the `useAAWithExternalWallet` in `IWeb3AuthCoreOptions`.

If you are setting `useAAWithExternalWallet` to `true`, it'll create a new Smart Account for your user, where the signer/creator of the Smart Account would be the external wallet.

If you are setting `useAAWithExternalWallet` to `false`, it'll skip creating a new Smart Account, and directly use the external wallet to sign the transactions.

```

import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

import { Web3Auth } from "@web3auth/modal";

const privateKeyProvider = new EthereumPrivateKeyProvider({

  // Use the chain config we declared earlier

  config: { chainConfig },

});

const web3auth = new Web3Auth({

  clientId: "YOUR_WEB3AUTH_CLIENT_ID", // Pass your Web3Auth Client ID, ideally using an environment variable

  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,

  privateKeyProvider,

  // Use the account abstraction provider we configured earlier

  accountAbstractionProvider

  // This will allow you to use EthereumPrivateKeyProvider for

  // external wallets, while use the AccountAbstractionProvider

  // for Web3Auth embedded wallets.

  useAAWithExternalWallet: false,

});

```

## Configure Signer​

The Web3Auth Smart Account feature is compatible with popular signer SDKs, including wagmi, ethers, and viem. You can choose your preferred package to configure the signer.

You can retreive the provider to configure the signer from Web3Auth instance.

Wagmi does not require any special configuration to use the signer with smart accounts. Once you have set up your Web3Auth provider and connected your wallet, Wagmi's hooks (such as useSigner or useAccount) will automatically use the smart account as the signer. You can interact with smart accounts using Wagmi just like you would with a regular EOA (Externally Owned Account) signer—no additional setup is needed.

```

import { createWalletClient } from 'viem'

// Use your Web3Auth instance to retreive the provider.

const provider = web3auth.provider

const walletClient = createWalletClient({

  transport: custom(provider),

})

```

## Send a transaction​

Developers can use their preferred signer or Wagmi hooks to initiate on-chain transactions, while Web3Auth manages the creation and submission of the UserOperation. Only the `to`, `data`, and `value` fields need to be provided. Any additional parameters will be ignored and automatically overridden.

To ensure reliable execution, the bundler client sets maxFeePerGas and maxPriorityFeePerGas values. If custom values are required, developers can use the [Viem's BundlerClient](https://viem.sh/account-abstraction/clients/bundler#bundler-client) to manually construct and send the user operation.

Since Smart Accounts are deployed smart contracts, the user's first transaction also triggers the on-chain deployment of their wallet.

```

import { useSendTransaction } from 'wagmi'

const { data: hash, sendTransaction } = useSendTransaction()

// Convert 1 ether to WEI format

const value = web3.utils.toWei(1)

sendTransaction({ to: 'DESTINATION_ADDRESS', value, data: '0x' })

const {

  data: receipt,

  isLoading: isConfirming,

  isSuccess: isConfirmed,

} = useWaitForTransactionReceipt({

  hash,

})

```

## Conclusion​

Voila, you have successfully sent your first gasless transaction using the Pimlico paymaster with Web3Auth Account Abstraction Provider. To learn more about advance features of the Account Abstraction Provider like performing batch transactions, using ERC-20 paymaster you can refer to the [Account Abstraction Provider](https://docs.metamask.io/embedded-wallets/sdk/react/) documentation.

# Smart Accounts

Effortlessly create and manage smart accounts for your users with just a few lines of code, using our Smart Account feature. Smart accounts offer enhanced control and programmability, enabling powerful features that traditional wallets can't provide.

**Key features of Smart Accounts include:**

- **Gas Abstraction:** Cover transaction fees for users, or allow users to pay for their own transactions using ERC-20 tokens.

- **Batch Transactions:** Perform multiple transactions in a single call.

- **Automated Transactions:** Allow users to automate actions, like swapping ETH to USDT when ETH hits a specific price.

- **Custom Spending Limits:** Allow users to set tailored spending limits.

> For more information about ERC-4337 and its components, check out our detailed blog post.

For more information about ERC-4337 and its components, [check out our detailed blog post](https://blog.web3auth.io/an-ultimate-guide-to-web3-wallets-externally-owned-account-and-smart-contract-wallet/#introduction-to-eip-4337).

Our smart account integration streamlines your setup, allowing you to create and manage smart accounts using your favorite libraries like Viem, Ethers, and Wagmi. You don't need to rely on third-party packages to effortlessly create ERC-4337 compatible Smart Contract Wallets (SCWs), giving users the ability to perform batch transactions and efficiently manage gas sponsorship.

This is a paid feature and the minimum [pricing plan](https://web3auth.io/pricing.html) to use this

SDK in a production environment is the **Growth Plan**. You can use this feature in Web3Auth

Sapphire Devnet network for free.

## Enabling Smart Accounts​

To enable this feature, you need to configure Smart Accounts from your project in the [Web3Auth Developer Dashboard](https://dashboard.web3auth.io/).

### Dashboard Configuration​

To enable Smart Accounts, navigate to the Smart Accounts section in the Web3Auth dashboard, and enable the "Set up Smart Accounts" toggle. Web3Auth currently supports [MetaMaskSmartAccount](https://docs.gator.metamask.io/how-to/create-delegator-account#create-a-metamasksmartaccount) as a Smart Account provider.

## Installation​

To use native account abstraction, you'll need to install the

[@web3auth/account-abstraction-provider](https://www.npmjs.com/package/@web3auth/account-abstraction-provider),

which allows you to create and interact with Smart Contract Wallets (SCWs). This provider simplifies

the entire process by managing the complex logic behind configuring the account abstraction

provider, bundler, and preparing user operations.

```

npm install --save @web3auth/account-abstraction-provider

```

## Configure​

When instantiating the Account Abstraction Provider, you can pass configuration objects to the

constructor. These configuration options allow you to select the desired Account Abstraction (AA)

provider, as well as configure the bundler and paymaster, giving you flexibility and control over

the provider.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

Please note this is the important step for setting the Web3Auth account abstraction provider.

- [Configure Smart Account provider](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#configure-smart-account-provider)

- [Configure Bundler](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#configure-bundler)

- [Configure Sponsored Paymaster](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#sponsored-paymaster)

- [Configure ERC-20 Paymaster](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#erc-20-paymaster)

## Configure Smart Account Provider​

Web3Auth offers the flexibility to choose your preferred Account Abstraction (AA) provider.

Currently, we support Safe, Kernel, Biconomy, and Trust.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Configure Bundler​

Web3Auth enables you to configure your bundler and define the paymaster context. The bundler

aggregates the UserOperations and submits them on-chain via a global entry point contract.

Bundler support is not limited to the examples below—you can use any bundler of your choice.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Configure Paymaster​

You can configure the paymaster of your choice to sponsor gas fees for your users, along with the paymaster context. The paymaster context lets you set additional parameters, such as choosing the token for ERC-20 paymasters, defining gas policies, and more.

### Sponsored Paymaster​

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

### ERC-20 Paymaster​

When using an ERC-20 paymaster, ensure you include the approval transaction, as Web3Auth does not

handle the approval internally.

For Pimlico, you can specify the token you want to use in the paymasterContext. If you want to set

up sponsorship policies, you can define those in the paymasterContext as well.

[Checkout the supported tokens for ERC-20 Paymaster on Pimlico](https://docs.pimlico.io/infra/paymaster/erc20-paymaster/supported-tokens).

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

      paymasterContext: {

        token: "SUPPORTED_TOKEN_CONTRACT_ADDRESS",

      },

    },

    smartAccountInit: new SafeSmartAccount(),

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Set up​

### Configure Web3Auth Instance​

```

import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider'

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from '@web3auth/account-abstraction-provider'

import Web3Auth, { WEB3AUTH_NETWORK } from '@web3auth/react-native-sdk'

import * as WebBrowser from '@toruslabs/react-native-web-browser'

import EncryptedStorage from 'react-native-encrypted-storage'

import { CHAIN_NAMESPACES } from '@web3auth/base'

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: '0xaa36a7',

  rpcTarget: 'https://rpc.sepolia.org',

  displayName: 'Ethereum Sepolia Testnet',

  blockExplorerUrl: 'https://sepolia.etherscan.io',

  ticker: 'ETH',

  tickerName: 'Ethereum',

  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',

}

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

    smartAccountInit: new SafeSmartAccount(),

  },

})

const privateKeyProvider = new EthereumPrivateKeyProvider({

  config: { chainConfig },

})

const web3auth = new Web3Auth(WebBrowser, EncryptedStorage, {

  clientId,

  redirectUrl,

  network: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET, // or other networks

  privateKeyProvider,

  accountAbstractionProvider: aaProvider,

})

```

### Configure Signer​

The Web3Auth Smart Account feature is compatible with popular signer SDKs, including wagmi, ethers,

and viem. You can choose your preferred package to configure the signer.

You can retreive the provider to configure the signer from Web3Auth instance.

Wagmi does not require any special configuration to use the signer with smart accounts. Once you

have set up your Web3Auth provider and connected your wallet, Wagmi's hooks (such as useSigner or

useAccount) will automatically use the smart account as the signer. You can interact with smart

accounts using Wagmi just like you would with a regular EOA (Externally Owned Account) signer—no

additional setup is needed.

```

import { createWalletClient } from "viem";

// Use your Web3Auth instance to retreive the provider.

const provider = web3auth.provider;

const walletClient = createWalletClient({

  transport: custom(provider),

});

```

## Smart Account Address​

Once the signers or Wagmi configuration is set up, it can be used to retrieve the user's Smart

Account address.

```

import { useAccount } from "wagmi";

const { address } = useAccount();

const smartAccountAddress = address;

```

## Send Transaction​

Developers can use their preferred signer or Wagmi hooks to initiate on-chain transactions, while

Web3Auth manages the creation and submission of the UserOperation. Only the `to`, `data`, and

`value` fields need to be provided. Any additional parameters will be ignored and automatically

overridden.

To ensure reliable execution, the bundler client sets maxFeePerGas and maxPriorityFeePerGas values.

If custom values are required, developers can use the

[Viem's BundlerClient](https://viem.sh/account-abstraction/clients/bundler#bundler-client) to

manually construct and send the user operation.

Since Smart Accounts are deployed smart contracts, the user's first transaction also triggers the

on-chain deployment of their wallet.

```

import { useSendTransaction } from "wagmi";

const { data: hash, sendTransaction } = useSendTransaction();

// Convert 1 ether to WEI format

const value = web3.utils.toWei(1);

sendTransaction({ to: "DESTINATION_ADDRESS", value, data: "0x" });

const {

  data: receipt,

  isLoading: isConfirming,

  isSuccess: isConfirmed,

} = useWaitForTransactionReceipt({

  hash,

});

```

## Advanced Smart Account Operations​

To learn more about supported transaction methods, and how to perform batch transactions, [checkout our detailed documentation of AccountAbstractionProvider](https://docs.metamask.io/embedded-wallets/sdk/react/).

# Advanced Permissions (ERC-7715)

The Smart Accounts Kit supports Advanced Permissions ([ERC-7715](https://eips.ethereum.org/EIPS/eip-7715)), which lets you request fine-grained permissions from a MetaMask user to execute transactions on their behalf.

For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course of a month.

Once the permission is granted, your dapp can use the allocated 10 USDC each day to purchase ETH directly from the MetaMask user's account.

Advanced Permissions eliminate the need for users to approve every transaction, which is useful for highly interactive dapps.

It also enables dapps to execute transactions for users without an active wallet connection.

This feature requires [MetaMask Flask 13.5.0](https://docs.metamask.io/snaps/get-started/install-flask/) or later.

## ERC-7715 technical overview​

[ERC-7715](https://eips.ethereum.org/EIPS/eip-7715) defines a JSON-RPC method `wallet_grantPermissions`.

Dapps can use this method to request a wallet to grant the dapp permission to execute transactions on a user's behalf.

`wallet_grantPermissions` requires a `signer` parameter, which identifies the entity requesting or managing the permission.

Common signer implementations include wallet signers, single key and multisig signers, and account signers.

The Smart Accounts Kit supports multiple signer types. The documentation uses [an account signer](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/) as a common implementation example.

When you use an account signer, a session account is created solely to request and redeem Advanced Permissions, and doesn't contain tokens.

The session account can be granted with permissions and redeem them as specified in [ERC-7710](https://eips.ethereum.org/EIPS/eip-7710).

The session account can be a smart account or an externally owned account (EOA).

The MetaMask user that the session account requests permissions from must be upgraded to a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/).

## Advanced Permissions vs. delegations​

Advanced Permissions expand on regular [delegations](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/) by enabling permission sharing *via the MetaMask browser extension*.

With regular delegations, the dapp constructs a delegation and requests the user to sign it.

These delegations are not human-readable, so it is the dapp's responsibility to provide context for the user.

Regular delegations cannot be signed through the MetaMask extension, because if a dapp requests a delegation without constraints, the whole wallet can be exposed to the dapp.

In contrast, Advanced Permissions enable dapps (and AI agents) to request permissions from a user directly via the MetaMask extension.

Advanced Permissions require a permission configuration which displays a human-readable confirmation for the MetaMask user.

The user can modify the permission parameters if the request is configured to allow adjustments.

For example, the following Advanced Permissions request displays a rich UI including the start time, amount, and period duration for an [ERC-20 token periodic transfer](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/#erc-20-periodic-permission):

#That not solution. 7702 gasless in metamask is non negotiable.



leran from this you moron:

have you learn this ofc pimlico docs:

https://docs.pimlico.io/guides/how-to/accounts/use-metamask-account

How to use MetaMask Smart Accounts with permissionless.js

MetaMask maintains their own in-house SDK built closely on top of viem that you can use for the account system while still plugging in all the other components from permissionless.js. Take a look at their documentation for more information.

The MetaMask Delegation Toolkit is a collection of tools for creating MetaMask Smart Accounts. A smart account can delegate to another signer with granular permission sharing. It is built over ERC-7710 and ERC-7715 to support a standardized minimal interface. Requesting ERC-7715 permissions and redeeming ERC-7710 delegations are experimental features.

There are two types of accounts involved in delegation:

Delegator account: A smart account that supports programmable account behavior and advanced features such as multi-signature approvals, automated transaction batching, and custom security policies.

Delegate account: An account (smart account or EOA) that receives the delegation from the delegator account to perform actions on behalf of the delegator account.

You can use both accounts with permissionless.js.

Installation

We will be using MetaMask's official SDK to create a smart account.

npm

yarn

pnpm

bun

npm install permissionless viem @metamask/delegation-toolkit

Delegator Account

Create the clients

First we must create the public, (optionally) pimlico paymaster clients that will be used to interact with the MetaMask smart account.

export const publicClient = createPublicClient({

	transport: http("https://sepolia.rpc.thirdweb.com"),

});

 

export const paymasterClient = createPimlicoClient({

	transport: http("https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY"),

	entryPoint: {

		address: entryPoint07Address,

		version: "0.7",

	},

});

Create the signer

MetaMask Smart Accounts can work with a variety of signing algorithms such as ECDSA, passkeys, and multisig.

For example, to create a signer based on a private key:

import { privateKeyToAccount } from "viem/accounts";

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { entryPoint07Address } from "viem/account-abstraction";

 

const owner = privateKeyToAccount("0xPRIVATE_KEY");

Create the delegator smart account

For a full list of options for creating a MetaMask smart account, take a look at the MetaMask's documentation page for toMetaMaskSmartAccount.

With a signer, you can create a MetaMask smart account as such:

import {

	Implementation,

	toMetaMaskSmartAccount,

} from "@metamask/delegation-toolkit";

 

const delegatorSmartAccount = await toMetaMaskSmartAccount({

	client: publicClient,

	implementation: Implementation.Hybrid,

	deployParams: [owner.address, [], [], []],

	deploySalt: "0x",

	signatory: { account: owner },

});

 

Create the smart account client

const smartAccountClient = createSmartAccountClient({

	account: delegatorSmartAccount,

	chain: sepolia,

	paymaster: paymasterClient,

	bundlerTransport: http(

		"https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY",

	),

	userOperation: {

		estimateFeesPerGas: async () =>

			(await paymasterClient.getUserOperationGasPrice()).fast,

	},

});

Send a transaction

Transactions using permissionless.js simply wrap around user operations. This means you can switch to permissionless.js from your existing viem EOA codebase with minimal-to-no changes.

const txHash = await smartAccountClient.sendTransaction({

	to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",

	value: parseEther("0.1"),

});

This also means you can also use viem Contract instances to transact without any modifications.

const nftContract = getContract({

	address: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",

	abi: tokenAbi,

	client: {

		public: publicClient,

		wallet: smartAccountClient,

	},

});

 

const txHash = await nftContract.write.mint([

	"0x_MY_ADDRESS_TO_MINT_TOKENS",

	parseEther("1"),

]);

You can also send an array of transactions in a single batch.

const userOpHash = await smartAccountClient.sendUserOperation({

	calls: [

		{

			to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",

			value: parseEther("0.1"),

			data: "0x",

		},

		{

			to: "0x1440ec793aE50fA046B95bFeCa5aF475b6003f9e",

			value: parseEther("0.1"),

			data: "0x1234",

		},

	],

});

Delegate Account

A delegate account is an account that receives the delegation from the delegator account to perform actions on behalf of the delegator account. To create a delegate account, we will follow the following steps:

Create a delegate signer

Create the delegate smart account

Create a delegation using delegator smart account

Sign the delegation

Send transactions using delegate smart account with signed delegation

Create the clients

First we must create the public, (optionally) pimlico paymaster clients that will be used to interact with the MetaMask smart account.

export const publicClient = createPublicClient({

	transport: http("https://sepolia.rpc.thirdweb.com"),

});

 

export const paymasterClient = createPimlicoClient({

	transport: http("https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY"),

	entryPoint: {

		address: entryPoint07Address,

		version: "0.7",

	},

});

Create the signer

MetaMask Smart Accounts can work with a variety of signing algorithms such as ECDSA, passkeys, and multisig.

For example, to create a signer based on a private key:

const delegateSigner = privateKeyToAccount("0xPRIVATE_KEY");

Create the delegate smart account

For a full list of options for creating a MetaMask smart account, take a look at the MetaMask's documentation page for toMetaMaskSmartAccount.

With a delegate signer, you can create a MetaMask delegate account as such:

const delegateSmartAccount = await toMetaMaskSmartAccount({

	client: publicClient,

	implementation: Implementation.Hybrid,

	deployParams: [delegateSigner.address, [], [], []],

	deploySalt: "0x",

	signatory: { account: delegateSigner },

});

Create a delegation

This example passes an empty caveats array, which means the delegate can perform any action on the delegator's behalf. We recommend restricting the delegation by adding caveat enforcers.

import { createDelegation } from "@metamask/delegation-toolkit";

 

const delegation = createDelegation({

	to: delegateSmartAccount.address,

	from: delegatorSmartAccount.address,

	caveats: [],

});

Sign the delegation

const signature = await delegatorSmartAccount.signDelegation({

	delegation,

});

 

const signedDelegation = {

	...delegation,

	signature,

};

Create the smart account client

const delegateSmartAccountClient = createSmartAccountClient({

	account: delegateSmartAccount,

	chain: sepolia,

	paymaster: paymasterClient,

	bundlerTransport: http(

		"https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY",

	),

	userOperation: {

		estimateFeesPerGas: async () =>

			(await paymasterClient.getUserOperationGasPrice()).fast,

	},

});

Send transactions using signed delegation

import { DelegationManager } from "@metamask/delegation-toolkit/contracts";

import { SINGLE_DEFAULT_MODE } from "@metamask/delegation-toolkit/utils";

import { createExecution } from "@metamask/delegation-toolkit";

 

const delegations = [signedDelegation];

 

// Actual execution to be performed by the delegate account

const executions = [

	createExecution({

		target: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",

		callData: encodeFunctionData({

			abi: tokenAbi,

			functionName: "mint",

			args: ["0x_MY_ADDRESS_TO_MINT_TOKENS", parseEther("1")],

		}),

	}),

];

 

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({

	delegations: [delegations],

	modes: [SINGLE_DEFAULT_MODE],

	executions: [executions],

});

 

const txHash = await delegateSmartAccountClient.sendTransaction({

	calls: [

		{

			to: delegateSmartAccount.address,

			data: redeemDelegationCalldata,

		},

	],

});

have you also learn from metamask ofc docs:

# Configure the Smart Accounts Kit

The Smart Accounts Kit is highly configurable, providing support for custom [bundlers and paymasters](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/#configure-the-bundler).

You can also configure the [toolkit environment](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/#optional-configure-the-toolkit-environment) to interact with the [Delegation Framework](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-framework).

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Configure the bundler​

The toolkit uses Viem's Account Abstraction API to configure custom bundlers and paymasters.

This provides a robust and flexible foundation for creating and managing [MetaMask Smart Accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/).

See Viem's [account abstraction documentation](https://viem.sh/account-abstraction) for more information on the API's features, methods, and best practices.

To use the bundler and paymaster clients with the toolkit, create instances of these clients and configure them as follows:

```

import {

  createPaymasterClient,

  createBundlerClient,

} from "viem/account-abstraction";

import { http } from "viem";

import { sepolia as chain } from "viem/chains"; 

// Replace these URLs with your actual bundler and paymaster endpoints.

const bundlerUrl = "https://your-bundler-url.com";

const paymasterUrl = "https://your-paymaster-url.com";

// The paymaster is optional.

const paymasterClient = createPaymasterClient({

  transport: http(paymasterUrl),

});

const bundlerClient = createBundlerClient({

  transport: http(bundlerUrl),

  paymaster: paymasterClient,

  chain,

});

```

Replace the bundler and paymaster URLs with your bundler and paymaster endpoints.

For example, you can use endpoints from [Pimlico](https://docs.pimlico.io/references/bundler), [Infura](https://docs.metamask.io/services/), or [ZeroDev](https://docs.zerodev.app/meta-infra/intro).

Providing a paymaster is optional when configuring your bundler client. However, if you choose not to use a paymaster, the smart contract account must have enough funds to pay gas fees.

## (Optional) Configure the toolkit environment​

The toolkit environment (`SmartAccountsEnvironment`) defines the contract addresses necessary for interacting with the [Delegation Framework](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-framework) on a specific network.

It serves several key purposes:

- It provides a centralized configuration for all the contract addresses required by the Delegation Framework.

- It enables easy switching between different networks (for example, Mainnet and testnet) or custom deployments.

- It ensures consistency across different parts of the application that interact with the Delegation Framework.

### Resolve the environment​

When you create a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/), the toolkit automatically

resolves the environment based on the version it requires and the chain configured.

If no environment is found for the specified chain, it throws an error.

```

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { delegatorSmartAccount } from "./config.ts";

const environment: SmartAccountsEnvironment = delegatorSmartAccount.environment; 

```

See the changelog of the toolkit version you are using (in the left sidebar) for supported chains.

Alternatively, you can use the [getSmartAccountsEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#getsmartaccountsenvironment) function to resolve the environment.

This function is especially useful if your delegator is not a smart account when

creating a [redelegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-types).

```

import { 

  getSmartAccountsEnvironment, 

  SmartAccountsEnvironment, 

} from "@metamask/smart-accounts-kit"; 

// Resolves the SmartAccountsEnvironment for Sepolia

const environment: SmartAccountsEnvironment = getSmartAccountsEnvironment(11155111);

```

### Deploy a custom environment​

You can deploy the contracts using any method, but the toolkit provides a convenient [deployDelegatorEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#deploydelegatorenvironment) function. This function simplifies deploying the Delegation Framework contracts to your desired EVM chain.

This function requires a Viem [Public Client](https://viem.sh/docs/clients/public), [Wallet Client](https://viem.sh/docs/clients/wallet), and [Chain](https://viem.sh/docs/glossary/types#chain)

to deploy the contracts and resolve the `SmartAccountsEnvironment`.

Your wallet must have a sufficient native token balance to deploy the contracts.

```

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { deployDeleGatorEnvironment } from "@metamask/smart-accounts-kit/utils";

const environment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain

);

```

You can also override specific contracts when calling `deployDelegatorEnvironment`.

For example, if you've already deployed the `EntryPoint` contract on the target chain, you can pass the contract address to the function.

```

// The config.ts is the same as in the previous example.

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { deployDeleGatorEnvironment } from "@metamask/smart-accounts-kit/utils";

const environment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain,

+ {

+   EntryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032"

+ }

);

```

Once the contracts are deployed, you can use them to override the environment.

### Override the environment​

To override the environment, the toolkit provides an [overrideDeployedEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#overridedeployedenvironment) function to resolve

`SmartAccountsEnvironment` with specified contracts for the given chain and contract version.

```

// The config.ts is the same as in the previous example.

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { 

  overrideDeployedEnvironment,

  deployDeleGatorEnvironment 

} from "@metamask/smart-accounts-kit";

const environment: SmartAccountsEnvironment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain

);

overrideDeployedEnvironment(

  chain.id,

  "1.3.0",

  environment,

);

```

If you've already deployed the contracts using a different method, you can create a `DelegatorEnvironment` instance with the required contract addresses, and pass it to the function.

```

- import { walletClient, publicClient } from "./config.ts";

- import { sepolia as chain } from "viem/chains";

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { 

  overrideDeployedEnvironment,

- deployDeleGatorEnvironment

} from "@metamask/smart-accounts-kit";

- const environment: SmartAccountsEnvironment = await deployDeleGatorEnvironment(

-  walletClient, 

-  publicClient, 

-  chain

- );

+ const environment: SmartAccountsEnvironment = {

+  SimpleFactory: "0x124..",

+  // ...

+  implementations: {

+    // ...

+  },

+ };

overrideDeployedEnvironment(

  chain.id,

  "1.3.0",

  environment

);

```

Make sure to specify the Delegation Framework version required by the toolkit.

See the changelog of the toolkit version you are using (in the left sidebar) for its required Framework version.

# Create a smart account

You can enable users to create a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) directly in your dapp.

This page provides examples of using [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) with Viem Core SDK to create different types of smart accounts with different signature schemes.

An account's supported *signatories* can sign data on behalf of the smart account.

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Create a Hybrid smart account​

A Hybrid smart account supports both an externally owned account (EOA) owner and any number of passkey (WebAuthn) signers.

You can create a Hybrid smart account with the following types of signers.

### Create a Hybrid smart account with an Account signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount), and Viem's [privateKeyToAccount and generatePrivateKey](https://viem.sh/docs/accounts/local/privateKeyToAccount), to create a Hybrid smart account with a signer from a randomly generated private key:

```

import { publicClient } from "./client.ts"

import { account } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [account.address, [], [], []],

  deploySalt: "0x",

  signer: { account },

});

```

### Create a Hybrid smart account with a Wallet Client signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) to create a Hybrid smart account with a Wallet Client signer:

```

import { publicClient } from "./client.ts"

import { walletClient } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const addresses = await walletClient.getAddresses();

const owner = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [owner, [], [], []],

  deploySalt: "0x",

  signer: { walletClient },

});

```

### Create a Hybrid smart account with a passkey signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [toWebAuthnAccount](https://viem.sh/account-abstraction/accounts/webauthn) to create a Hybrid smart account with a passkey (WebAuthn) signer:

To work with WebAuthn, install the [Ox SDK](https://oxlib.sh/).

```

import { publicClient } from "./client.ts"

import { webAuthnAccount, credential } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

import { Address, PublicKey } from "ox";

import { toHex } from "viem";

// Deserialize compressed public key

const publicKey = PublicKey.fromHex(credential.publicKey);

// Convert public key to address

const owner = Address.fromPublicKey(publicKey);

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [owner, [toHex(credential.id)], [publicKey.x], [publicKey.y]],

  deploySalt: "0x",

  signer: { webAuthnAccount, keyId: toHex(credential.id) },

});

```

## Create a Multisig smart account​

A [Multisig smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#multisig-smart-account) supports multiple EOA signers with a configurable threshold for execution.

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) to create a Multsig smart account with a combination of account signers and Wallet Client signers:

```

import { publicClient } from "./client.ts";

import { account, walletClient } from "./signers.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const owners = [ account.address, walletClient.address ];

const signer = [ { account }, { walletClient } ];

const threshold = 2n

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.MultiSig,

  deployParams: [owners, threshold],

  deploySalt: "0x",

  signer,

});

```

The number of signers in the signatories must be at least equal to the threshold for valid signature generation.

## Create a Stateless 7702 smart account​

A [Stateless 7702 smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#stateless-7702-smart-account) represents an EOA that has been upgraded to support MetaMask Smart Accounts

functionality as defined by [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702).

This implementation does not handle the upgrade process; see the [EIP-7702 quickstart](https://docs.metamask.io/smart-accounts-kit/get-started/smart-account-quickstart/eip7702/) to learn how to upgrade.

You can create a Stateless 7702 smart account with the following types of signatories.

### Create a Stateless 7702 smart account with an account signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [privateKeyToAccount](https://viem.sh/docs/accounts/local/privateKeyToAccount) to create a Stateless 7702 smart account with a signer from a private key:

```

import { publicClient } from "./client.ts";

import { account } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Stateless7702,

  address: account.address // Address of the upgraded EOA

  signer: { account },

});

```

### Create a Stateless 7702 smart account with a Wallet Client signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) to create a Stateless 7702 smart account with a Wallet Client signer:

```

import { publicClient } from "./client.ts";

import { walletClient } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const addresses = await walletClient.getAddresses();

const address = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Stateless7702,

  address, // Address of the upgraded EOA

  signer: { walletClient },

});

```

## Next steps​

With a MetaMask smart account, you can perform the following functions:

- In conjunction with [Viem Account Abstraction clients](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/), [deploy the smart account](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/deploy-smart-account/)

and [send user operations](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-user-operation/).

- [Create delegations](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/) that can be used to grant specific rights and permissions to other accounts.

Smart accounts that create delegations are called *delegator accounts*.

# Deploy a smart account

You can deploy MetaMask Smart Accounts in two different ways. You can either deploy a smart account automatically when sending

the first user operation, or manually deploy the account.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Deploy with the first user operation​

When you send the first user operation from a smart account, the Smart Accounts Kit checks whether the account is already deployed. If the account

is not deployed, the toolkit adds the `initCode` to the user operation to deploy the account within the

same operation. Internally, the `initCode` is encoded using the `factory` and `factoryData`.

```

import { bundlerClient, smartAccount } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001"),

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas

});

```

## Deploy manually​

To deploy a smart account manually, call the [getFactoryArgs](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#getfactoryargs)

method from the smart account to retrieve the `factory` and `factoryData`. This allows you to use a relay account to sponsor the deployment without needing a paymaster.

The `factory` represents the contract address responsible for deploying the smart account, while `factoryData` contains the

calldata that will be executed by the `factory` to deploy the smart account.

The relay account can be either an externally owned account (EOA) or another smart account. This example uses an EOA.

```

import { walletClient, smartAccount } from "./config.ts";

const { factory, factoryData } = await smartAccount.getFactoryArgs();

// Deploy smart account using relay account.

const hash = await walletClient.sendTransaction({

  to: factory,

  data: factoryData,

})

```

## Next steps​

- Learn more about [sending user operations](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-user-operation/).

- To sponsor gas for end users, see how to [send a gasless transaction](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-gasless-transaction/).

# Send a user operation

User operations are the [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) counterpart to traditional blockchain transactions.

They incorporate significant enhancements that improve user experience and provide greater

flexibility in account management and transaction execution.

Viem's Account Abstraction API allows a developer to specify an array of `Calls` that will be executed as a user operation via Viem's [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation) method.

The MetaMask Smart Accounts Kit encodes and executes the provided calls.

User operations are not directly sent to the network.

Instead, they are sent to a bundler, which validates, optimizes, and aggregates them before network submission.

See [Viem's Bundler Client](https://viem.sh/account-abstraction/clients/bundler) for details on how to interact with the bundler.

If a user operation is sent from a MetaMask smart account that has not been deployed, the toolkit configures the user operation to automatically deploy the account.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Send a user operation​

The following is a simplified example of sending a user operation using Viem Core SDK. Viem Core SDK offers more granular control for developers who require it.

In the example, a user operation is created with the necessary gas limits.

This user operation is passed to a bundler instance, and the `EntryPoint` address is retrieved from the client.

```

import { bundlerClient, smartAccount } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001")

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas

});

```

### Estimate fee per gas​

Different bundlers have different ways to estimate `maxFeePerGas` and `maxPriorityFeePerGas`, and can reject requests with insufficient values.

The following example updates the previous example to estimate the fees.

This example uses constant values, but the [Hello Gator example](https://github.com/MetaMask/hello-gator) uses Pimlico's Alto bundler,

which fetches user operation gas price using the RPC method [pimlico_getUserOperationPrice](https://docs.pimlico.io/infra/bundler/endpoints/pimlico_getUserOperationGasPrice).

To estimate the gas fee for Pimlico's bundler, install the [permissionless.js SDK](https://docs.pimlico.io/references/permissionless/).

```

+ import { createPimlicoClient } from "permissionless/clients/pimlico";

import { parseEther } from "viem";

import { bundlerClient, smartAccount } from "./config.ts" // The config.ts is the same as in the previous example.

- const maxFeePerGas = 1n;

- const maxPriorityFeePerGas = 1n;

+ const pimlicoClient = createPimlicoClient({

+   transport: http("https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>"), // You can get the API Key from the Pimlico dashboard.

+ });

+

+ const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("1")

    }

  ],

-  maxFeePerGas,

-  maxPriorityFeePerGas

+  ...fee

});

```

### Wait for the transaction receipt​

After submitting the user operation, it's crucial to wait for the receipt to ensure that it has been successfully included in the blockchain. Use the `waitForUserOperationReceipt` method provided by the bundler client.

```

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { bundlerClient, smartAccount } from "./config.ts" // The config.ts is the same as in the previous example.

const pimlicoClient = createPimlicoClient({

  transport: http("https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>"), // You can get the API Key from the Pimlico dashboard.

});

const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("1")

    }

  ],

  ...fee

});

+ const { receipt } = await bundlerClient.waitForUserOperationReceipt({

+   hash: userOperationHash

+ });

+

+ console.log(receipt.transactionHash);

```

## Next steps​

To sponsor gas for end users, see how to [send a gasless transaction](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-gasless-transaction/).

# Send a gasless transaction

MetaMask Smart Accounts support gas sponsorship, which simplifies onboarding by abstracting gas fees away from end users.

You can use any paymaster service provider, such as [Pimlico](https://docs.pimlico.io/references/paymaster) or [ZeroDev](https://docs.zerodev.app/meta-infra/rpcs), or plug in your own custom paymaster.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Send a gasless transaction​

The following example demonstrates how to use Viem's [Paymaster Client](https://viem.sh/account-abstraction/clients/paymaster) to send gasless transactions.

You can provide the paymaster client using the paymaster property in the [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation#paymaster-optional) method, or in the [Bundler Client](https://viem.sh/account-abstraction/clients/bundler#paymaster-optional).

In this example, the paymaster client is passed to the `sendUserOperation` method.

```

import { bundlerClient, smartAccount, paymasterClient } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001")

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas,

  paymaster: paymasterClient,

});

```

# Generate a multisig signature

The Smart Accounts Kit supports [Multisig smart accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#multisig-smart-account),

allowing you to add multiple externally owned accounts (EOA)

signers with a configurable execution threshold. When the threshold

is greater than 1, you can collect signatures from the required signers

and use the [aggregateSignature](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#aggregatesignature) function to combine them

into a single aggregated signature.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a Multisig smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/#create-a-multisig-smart-account)

## Generate a multisig signature​

The following example configures a Multisig smart account with two different signers: Alice

and Bob. The account has a threshold of 2, meaning that signatures from

both parties are required for any execution.

```

import { 

  bundlerClient, 

  aliceSmartAccount, 

  bobSmartAccount,

  aliceAccount,

  bobAccount,

} from "./config.ts";

import { aggregateSignature } from "@metamask/smart-accounts-kit";

const userOperation = await bundlerClient.prepareUserOperation({

  account: aliceSmartAccount,

  calls: [

    {

      target: zeroAddress,

      value: 0n,

      data: "0x",

    }

  ]

});

const aliceSignature = await aliceSmartAccount.signUserOperation(userOperation);

const bobSignature = await bobSmartAccount.signUserOperation(userOperation);

const aggregatedSignature = aggregateSignature({

  signatures: [{

    signer: aliceAccount.address,

    signature: aliceSignature,

    type: "ECDSA",

  }, {

    signer: bobAccount.address,

    signature: bobSignature,

    type: "ECDSA",

  }],

});

```

# Perform executions on a smart account's behalf

[Delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/) is the ability for a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) to grant permission to another account to perform executions on its behalf.

In this guide, you'll create a delegator account (Alice) and a delegate account (Bob), and grant Bob permission to perform executions on Alice's behalf.

You'll complete the delegation lifecycle (create, sign, and redeem a delegation).

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Steps​

### 1. Create a Public Client​

Create a [Viem Public Client](https://viem.sh/docs/clients/public) using Viem's `createPublicClient` function.

You will configure Alice's account (the delegator) and the Bundler Client with the Public Client, which you can use to query the signer's account state and interact with smart contracts.

```

import { createPublicClient, http } from "viem"

import { sepolia as chain } from "viem/chains"

const publicClient = createPublicClient({

  chain,

  transport: http(),

})

```

### 2. Create a Bundler Client​

Create a [Viem Bundler Client](https://viem.sh/account-abstraction/clients/bundler) using Viem's `createBundlerClient` function.

You can use the bundler service to estimate gas for user operations and submit transactions to the network.

```

import { createBundlerClient } from "viem/account-abstraction"

const bundlerClient = createBundlerClient({

  client: publicClient,

  transport: http("https://your-bundler-rpc.com"),

})

```

### 3. Create a delegator account​

Create an account to represent Alice, the delegator who will create a delegation.

The delegator must be a MetaMask smart account; use the toolkit's [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) method to create the delegator account.

A Hybrid smart account is a flexible smart account implementation that supports both an externally owned account (EOA) owner and any number of P256 (passkey) signers.

This examples configures a [Hybrid smart account with an Account signer](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/#create-a-hybrid-smart-account-with-an-account-signer):

```

import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

import { privateKeyToAccount } from "viem/accounts"

const delegatorAccount = privateKeyToAccount("0x...")

const delegatorSmartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [delegatorAccount.address, [], [], []],

  deploySalt: "0x",

  signer: { account: delegatorAccount },

})

```

See [how to configure other smart account types](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/).

### 4. Create a delegate account​

Create an account to represent Bob, the delegate who will receive the delegation. The delegate can be a smart account or an externally owned account (EOA):

```

import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

import { privateKeyToAccount } from "viem/accounts"

const delegateAccount = privateKeyToAccount("0x...")

const delegateSmartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid, // Hybrid smart account

  deployParams: [delegateAccount.address, [], [], []],

  deploySalt: "0x",

  signer: { account: delegateAccount },

})

```

### 5. Create a delegation​

Create a [root delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-types) from Alice to Bob.

With a root delegation, Alice is delegating her own authority away, as opposed to *redelegating* permissions she received from a previous delegation.

Use the toolkit's [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation) method to create a root delegation. When creating

delegation, you need to configure the scope of the delegation to define the initial authority.

This example uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-transfer-scope) scope, allowing Alice to delegate to Bob the ability to spend her USDC, with a

specified limit on the total amount.

Before creating a delegation, ensure that the delegator account (in this example, Alice's account) has been deployed. If the account is not deployed, redeeming the delegation will fail.

```

import { createDelegation } from "@metamask/smart-accounts-kit"

import { parseUnits } from "viem"

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const delegation = createDelegation({

  to: delegateSmartAccount.address, // This example uses a delegate smart account

  from: delegatorSmartAccount.address,

  environment: delegatorSmartAccount.environment

  scope: {

    type: "erc20TransferAmount",

    tokenAddress,

    // 10 USDC 

    maxAmount: parseUnits("10", 6),

  },

})

```

### 6. Sign the delegation​

Sign the delegation with Alice's account, using the [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#signdelegation) method from `MetaMaskSmartAccount`. Alternatively, you can use the toolkit's [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#signdelegation) utility method. Bob will later use the signed delegation to perform actions on Alice's behalf.

```

const signature = await delegatorSmartAccount.signDelegation({

  delegation,

})

const signedDelegation = {

  ...delegation,

  signature,

}

```

### 7. Redeem the delegation​

Bob can now redeem the delegation. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on Alice's behalf.

To prepare the calldata for the redeem transaction, use the [redeemDelegations](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#redeemdelegations) method from `DelegationManager`.

Since Bob is redeeming a single delegation chain, use the [SingleDefault](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#execution-modes) execution mode.

Bob can redeem the delegation by submitting a user operation if his account is a smart account, or a regular transaction if his account is an EOA. In this example, Bob transfers 1 USDC from Alice’s account to his own.

```

import { createExecution, ExecutionMode } from "@metamask/smart-accounts-kit"

import { DelegationManager } from "@metamask/smart-accounts-kit/contracts"

import { zeroAddress } from "viem"

import { callData } from "./config.ts"

const delegations = [signedDelegation]

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const executions = createExecution({ target: tokenAddress, callData })

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({

  delegations: [delegations],

  modes: [ExecutionMode.SingleDefault],

  executions: [executions],

})

const userOperationHash = await bundlerClient.sendUserOperation({

  account: delegateSmartAccount,

  calls: [

    {

      to: delegateSmartAccount.address,

      data: redeemDelegationCalldata,

    },

  ],

  maxFeePerGas: 1n,

  maxPriorityFeePerGas: 1n,

})

```

## Next steps​

- See [how to configure different scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/) to define the initial authority of a delegation.

- See [how to further refine the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

- See [how to disable a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/disable-delegation/) to revoke permissions.

# Use delegation scopes

When [creating a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/), you can configure a scope to define the delegation's initial authority and help prevent delegation misuse.

You can further constrain this initial authority by [adding caveats to a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/).

The Smart Accounts Kit currently supports three categories of scopes:

| Scope type | Description |

| --- | --- |

| Spending limit scopes | Restricts the spending of native, ERC-20, and ERC-721 tokens based on defined conditions. |

| Function call scope | Restricts the delegation to specific contract methods, contract addresses, or calldata. |

| Ownership transfer scope | Restricts the delegation to only allow ownership transfers, specifically the transferOwnership function for a specified contract. |

# Use spending limit scopes

Spending limit scopes define how much a delegate can spend in native, ERC-20, or ERC-721 tokens.

You can set transfer limits with or without time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## ERC-20 periodic scope​

This scope ensures a per-period limit for ERC-20 token transfers.

You set the amount, period, and start data.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day.

Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20PeriodTransfer",

    tokenAddress: "0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da",

    // USDC has 6 decimal places.

    periodAmount: parseUnits("10", 6),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 streaming scope​

This scopes ensures a linear streaming transfer limit for ERC-20 tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20Streaming",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    amountPerSecond: parseUnits("0.1", 6),

    initialAmount: parseUnits("10", 6),

    maxAmount: parseUnits("100", 6),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 transfer scope​

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions.

Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    maxAmount: parseUnits("10", 6),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-721 scope​

This scope limits the delegation to ERC-721 token transfers only.

For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer.

See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const delegation = createDelegation({

  scope: {

    type: "erc721Transfer",

    tokenAddress: "0x3fF528De37cd95b67845C1c55303e7685c72F319",

    tokenId: 1n,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token periodic scope​

This scope ensures a per-period limit for native token transfers.

You set the amount, period, and start date.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

Bob can transfer a total of 0.01 ETH per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenPeriodTransfer",

    periodAmount: parseEther("0.01"),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token streaming scope​

This scopes ensures a linear streaming transfer limit for native tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenStreaming",

    amountPerSecond: parseEther("0.001"),

    initialAmount: parseEther("0.01"),

    maxAmount: parseEther("0.1"),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token transfer scope​

This scope ensures that native token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

Bob may use the 0.1 ETH in a single transaction or make multiple transactions, as long as the total does not exceed 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

const delegation = createDelegation({

  scope: {

    type: "nativeTokenTransferAmount",

    maxAmount: parseEther("0.001"),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Use spending limit scopes

Spending limit scopes define how much a delegate can spend in native, ERC-20, or ERC-721 tokens.

You can set transfer limits with or without time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## ERC-20 periodic scope​

This scope ensures a per-period limit for ERC-20 token transfers.

You set the amount, period, and start data.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day.

Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20PeriodTransfer",

    tokenAddress: "0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da",

    // USDC has 6 decimal places.

    periodAmount: parseUnits("10", 6),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 streaming scope​

This scopes ensures a linear streaming transfer limit for ERC-20 tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20Streaming",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    amountPerSecond: parseUnits("0.1", 6),

    initialAmount: parseUnits("10", 6),

    maxAmount: parseUnits("100", 6),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 transfer scope​

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions.

Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    maxAmount: parseUnits("10", 6),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-721 scope​

This scope limits the delegation to ERC-721 token transfers only.

For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer.

See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const delegation = createDelegation({

  scope: {

    type: "erc721Transfer",

    tokenAddress: "0x3fF528De37cd95b67845C1c55303e7685c72F319",

    tokenId: 1n,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token periodic scope​

This scope ensures a per-period limit for native token transfers.

You set the amount, period, and start date.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

Bob can transfer a total of 0.01 ETH per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenPeriodTransfer",

    periodAmount: parseEther("0.01"),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token streaming scope​

This scopes ensures a linear streaming transfer limit for native tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenStreaming",

    amountPerSecond: parseEther("0.001"),

    initialAmount: parseEther("0.01"),

    maxAmount: parseEther("0.1"),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token transfer scope​

This scope ensures that native token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

Bob may use the 0.1 ETH in a single transaction or make multiple transactions, as long as the total does not exceed 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

const delegation = createDelegation({

  scope: {

    type: "nativeTokenTransferAmount",

    maxAmount: parseEther("0.001"),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Use the ownership transfer scope

The ownership transfer scope restricts a delegation to ownership transfer calls only.

For example, Alice has deployed a smart contract, and she delegates to Bob the ability to transfer ownership of that contract.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## Ownership transfer scope​

This scope requires a `contractAddress`, which represents the address of the deployed contract.

Internally, this scope uses the [ownershipTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#ownershiptransfer) caveat enforcer.

See the [ownership transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#ownership-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const contractAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const delegation = createDelegation({

  scope: {

    type: "ownershipTransfer",

    contractAddress,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Constrain a delegation scope

[Delegation scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/) define the delegation's initial authority and help prevent delegation misuse.

You can further constrain these scopes and limit the delegation's authority by applying [caveat enforcers](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/caveat-enforcers/).

## Prerequisites​

[Configure a delegation scope.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/)

## Apply a caveat enforcer​

For example, Alice creates a delegation with an [ERC-20 transfer scope](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-transfer-scope) that allows Bob to spend up to 10 USDC.

If Alice wants to further restrict the scope to limit Bob's delegation to be valid for only seven days,

she can apply the [timestamp](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#timestamp) caveat enforcer.

The following example creates a delegation using [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation), applies the ERC-20 transfer scope with a spending limit of 10 USDC, and applies the `timestamp` caveat enforcer to restrict the delegation's validity to a seven-day period:

```

import { createDelegation } from "@metamask/smart-accounts-kit";

// Convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// Seven days after current time.

const beforeThreshold = currentTime + 604800;

const caveats = [{

  type: "timestamp",

  afterThreshold: currentTime,

  beforeThreshold, 

}];

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    maxAmount: 10000n,

  },

  // Apply caveats to the delegation.

  caveats,

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

- See the [caveats reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/) for the full list of caveat types and their parameters.

- For more specific or custom control, you can also [create custom caveat enforcers](https://docs.metamask.io/tutorials/create-custom-caveat-enforcer/)

and apply them to delegations.

# Check the delegation state

When using [spending limit delegation scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/) or relevant [caveat enforcers](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/),

you might need to check the remaining transferrable amount in a delegation.

For example, if a delegation allows a user to spend 10 USDC per week and they have already spent 10 - n USDC in the current period,

you can determine how much of the allowance is still available for transfer.

Use the `CaveatEnforcerClient` to check the available balances for specific scopes or caveats.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

- [Create a delegation with an ERC-20 periodic scope.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-periodic-scope)

## Create a CaveatEnforcerClient​

To check the delegation state, create a [CaveatEnforcerClient](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/).

This client allows you to interact with the caveat enforcers of the delegation, and read the required state.

```

import { environment, publicClient as client } from './config.ts'

import { createCaveatEnforcerClient } from '@metamask/smart-accounts-kit'

const caveatEnforcerClient = createCaveatEnforcerClient({

  environment,

  client,

})

```

## Read the caveat enforcer state​

This example uses the [getErc20PeriodTransferEnforcerAvailableAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/#geterc20periodtransferenforceravailableamount) method to read the state and retrieve the remaining amount for the current transfer period.

```

import { delegation } './config.ts'

// Returns the available amount for current period. 

const { availableAmount } = await caveatEnforcerClient.getErc20PeriodTransferEnforcerAvailableAmount({

  delegation,

})

```

## Next steps​

See the [Caveat Enforcer Client reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/) for the full list of available methods.

# Perform executions on a MetaMask user's behalf

[Advanced Permissions (ERC-7115)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) are fine-grained permissions that your dapp can request from a MetaMask user to execute transactions on their

behalf. For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course

of a month. Once the permission is granted, your dapp can use the allocated 10 USDC each day to

purchase ETH directly from the MetaMask user's account.

In this guide, you'll request an ERC-20 periodic transfer permission from a MetaMask user to transfer 1 USDC every day on their behalf.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Install MetaMask Flask 13.5.0 or later.](https://docs.metamask.io/snaps/get-started/install-flask/)

### 1. Set up a Wallet Client​

Set up a [Viem Wallet Client](https://viem.sh/docs/clients/wallet) using Viem's `createWalletClient` function. This client will

help you interact with MetaMask Flask.

Then, extend the Wallet Client functionality using `erc7715ProviderActions`. These actions enable you to request Advanced Permissions from the user.

```

import { createWalletClient, custom } from "viem";

import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";

const walletClient = createWalletClient({

  transport: custom(window.ethereum),

}).extend(erc7715ProviderActions());

```

### 2. Set up a Public Client​

Set up a [Viem Public Client](https://viem.sh/docs/clients/public) using Viem's `createPublicClient` function.

This client will help you query the account state and interact with the blockchain network.

```

import { createPublicClient, http } from "viem";

import { sepolia as chain } from "viem/chains";

 

const publicClient = createPublicClient({

  chain,

  transport: http(),

});

```

### 3. Set up a session account​

Set up a session account which can either be a smart account or an externally owned account (EOA)

to request Advanced Permissions. The requested permissions are granted to the session account, which

is responsible for executing transactions on behalf of the user.

```

import { privateKeyToAccount } from "viem/accounts";

import { 

  toMetaMaskSmartAccount, 

  Implementation 

} from "@metamask/smart-accounts-kit";

const privateKey = "0x...";

const account = privateKeyToAccount(privateKey);

const sessionAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [account.address, [], [], []],

  deploySalt: "0x",

  signer: { account },

});

```

### 4. Check the EOA account code​

Advanced Permissions support the automatic upgrading of a MetaMask user's account to a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/),

when using MetaMask Flask version 13.9.0 or later. For earlier versions, you must ensure that the

user is upgraded to a smart account before requesting Advanced Permissions.

If the user has not yet been upgraded, you can handle the upgrade [programmatically](https://docs.metamask.io/wallet/how-to/send-transactions/send-batch-transactions/#about-atomic-batch-transactions) or ask the

user to [switch to a smart account manually](https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account/#how-to-switch-to-a-metamask-smart-account).

MetaMask's Advanced Permissions (ERC-7115) implementation requires the user to be upgraded to a MetaMask

Smart Account because, under the hood, you're requesting a signature for an [ERC-7710 delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/).

ERC-7710 delegation is one of the core features supported only by MetaMask Smart Accounts.

```

import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { sepolia as chain } from "viem/chains";

const addresses = await walletClient.requestAddresses();

const address = addresses[0];

// Get the EOA account code

const code = await publicClient.getCode({

  address,

});

if (code) {

  // The address to which EOA has delegated. According to EIP-7702, 0xef0100 || address

  // represents the delegation. 

  // 

  // You need to remove the first 8 characters (0xef0100) to get the delegator address.

  const delegatorAddress = `0x${code.substring(8)}`;

  const statelessDelegatorAddress = getSmartAccountsEnvironment(chain.id)

  .implementations

  .EIP7702StatelessDeleGatorImpl;

  // If account is not upgraded to MetaMask smart account, you can

  // either upgrade programmatically or ask the user to switch to a smart account manually.

  const isAccountUpgraded = delegatorAddress.toLowerCase() === statelessDelegatorAddress.toLowerCase();

}

```

### 5. Request Advanced Permissions​

Request Advanced Permissions from the user using the Wallet Client's `requestExecutionPermissions` action.

In this example, you'll request an

[ERC-20 periodic permission](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/#erc-20-periodic-permission).

See the [requestExecutionPermissions](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#requestexecutionpermissions) API reference for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

// Since current time is in seconds, we need to convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // The requested permissions will granted to the

      // session account.

      address: sessionAccount.address,

    },

  },

  permission: {

    type: "erc20-token-periodic",

    data: {

      tokenAddress,

      // 1 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6

      periodAmount: parseUnits("10", 6),

      // 1 day in seconds

      periodDuration: 86400,

      justification?: "Permission to transfer 1 USDC every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

### 6. Set up a Viem client​

Set up a Viem client depending on your session account type.

For a smart account, set up a [Viem Bundler Client](https://viem.sh/account-abstraction/clients/bundler)

using Viem's `createBundlerClient` function. This lets you use the bundler service

to estimate gas for user operations and submit transactions to the network.

For an EOA, set up a [Viem Wallet Client](https://viem.sh/docs/clients/wallet)

using Viem's `createWalletClient` function. This lets you send transactions directly to the network.

The toolkit provides public actions for both of the clients which can be used to redeem Advanced Permissions, and execute transactions on a user's behalf.

```

import { createBundlerClient } from "viem/account-abstraction";

import { erc7710BundlerActions } from "@metamask/smart-accounts-kit/actions";

const bundlerClient = createBundlerClient({

  client: publicClient,

  transport: http("https://your-bundler-rpc.com"),

  // Allows you to use the same Bundler Client as paymaster.

  paymaster: true

}).extend(erc7710BundlerActions());

```

### 7. Redeem Advanced Permissions​

The session account can now redeem the permissions. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on the user's behalf.

To redeem the permissions, use the client action based on your session account type.

A smart account uses the Bundler Client's `sendUserOperationWithDelegation` action,

and an EOA uses the Wallet Client's `sendTransactionWithDelegation` action.

See the [sendUserOperationWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/bundler-client/#senduseroperationwithdelegation) and [sendTransactionWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#sendtransactionwithdelegation) API reference for more information.

```

import { calldata } from "./config.ts";

// These properties must be extracted from the permission response.

const permissionsContext = grantedPermissions[0].context;

const delegationManager = grantedPermissions[0].signerMeta.delegationManager;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// Calls without permissionsContext and delegationManager will be executed 

// as a normal user operation.

const userOperationHash = await bundlerClient.sendUserOperationWithDelegation({

  publicClient,

  account: sessionAccount,

  calls: [

    {

      to: tokenAddress,

      data: calldata,

      permissionsContext,

      delegationManager,

    },

  ],

  // Appropriate values must be used for fee-per-gas. 

  maxFeePerGas: 1n,

  maxPriorityFeePerGas: 1n,

});

```

## Next steps​

See how to configure different [ERC-20 token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/) and

[native token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/native-token/).

# Use ERC-20 token permissions

[Advanced Permissions (ERC-7715)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) supports ERC-20 token permission types that allow you to request fine-grained

permissions for ERC-20 token transfers with time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a session account.](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/#3-set-up-a-session-account)

## ERC-20 periodic permission​

This permission type ensures a per-period limit for ERC-20 token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 10 USDC on their behalf each day. The dapp can transfer a total of

10 USDC per day; the limit resets at the beginning of the next day.

See the [ERC-20 periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-periodic-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "erc20-token-periodic",

    data: {

      tokenAddress,

      // 10 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6.

      periodAmount: parseUnits("10", 6),

      // 1 day in seconds.

      periodDuration: 86400,

      justification?: "Permission to transfer 1 USDC every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

## ERC-20 stream permission​

This permission type ensures a linear streaming transfer limit for ERC-20 tokens. Token transfers are blocked until the

defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the

configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.1 USDC per second, starting with an initial amount

of 1 USDC, up to a maximum of 2 USDC.

See the [ERC-20 stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-stream-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "erc20-token-stream",

    data: {

      tokenAddress,

      // 0.1 USDC in WEI format. Since USDC has 6 decimals, 0.1 * 10^6.

      amountPerSecond: parseUnits("0.1", 6),

      // 1 USDC in WEI format. Since USDC has 6 decimals, 1 * 10^6.

      initialAmount: parseUnits("1", 6),

      // 2 USDC in WEI format. Since USDC has 6 decimals, 2 * 10^6.

      maxAmount: parseUnits("2", 6),

      startTime: currentTime,

      justification: "Permission to use 0.1 USDC per second",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

# Use native token permissions

[Advanced Permissions (ERC-7115)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) supports native token permission types that allow you to request fine-grained

permissions for native token transfers with time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a session account.](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/#3-set-up-a-session-account)

## Native token periodic permission​

This permission type ensures a per-period limit for native token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 0.001 ETH on their behalf each day. The dapp can transfer a total of

0.001 USDC per day; the limit resets at the beginning of the next day.

See the [native token periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-periodic-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseEther } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "native-token-periodic",

    data: {

      // 0.001 ETH in wei format.

      periodAmount: parseEther("0.001"),

      // 1 hour in seconds.

      periodDuration: 86400,

      startTime: currentTime,

      justification: "Permission to use 0.001 ETH every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

## Native token stream permission​

This permission type ensures a linear streaming transfer limit for native tokens. Token transfers are blocked until the

defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the

configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.0001 ETH per second, starting with an initial amount

of 0.1 ETH, up to a maximum of 1 ETH.

See the [native token stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-stream-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseEther } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "native-token-stream",

    data: {

      // 0.0001 ETH in wei format.

      amountPerSecond: parseEther("0.0001"),

      // 0.1 ETH in wei format.

      initialAmount: parseEther("0.1"),

      // 1 ETH in wei format.

      maxAmount: parseEther("1"),

      startTime: currentTime,

      justification: "Permission to use 0.0001 ETH per second",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

# Send your first gasless transaction

A paymaster is a vital component in the ERC-4337 standard, responsible for covering transaction costs on behalf of the user. There are various types of paymasters, such as gasless paymasters, ERC-20 paymasters, and more.

In this guide, we'll talk about how you can use the Pimlico gasless Paymaster with Web3Auth Account Abstraction Provider to sponsor the transaction for your users without requiring the user to pay gas fees.

For those who want to skip straight to the code, you can find it on [GitHub](https://github.com/Web3Auth/web3auth-examples/tree/main/other/smart-account-example).

## Prerequisites​

- Pimlico Account: Since we'll be using the Pimlico paymaster, you'll need to have an API key from Pimlico. You can get a free API key from [Pimlico Dashboard](https://dashboard.pimlico.io/).

- Web3Auth Dashboard: If you haven't already, sign up on the Web3Auth platform. It is free and gives you access to the Web3Auth's base plan. Head to Web3Auth's documentation page for detailed [instructions on setting up the Web3Auth Dashboard](https://docs.metamask.io/embedded-wallets/dashboard/).

- Web3Auth PnP Web SDK: This guide assumes that you already know how to integrate the PnP Web SDK in your project. If not, you can learn how to [integrate Web3Auth in your Web app](https://docs.metamask.io/embedded-wallets/sdk/react/).

## Integrate AccountAbstractionProvider​

Once, you have set up the Web3Auth Dashboard, and created a new project, it's time to integrate Web3Auth Account Abstraction Provider in your Web application. For the implementation, we'll use the [@web3auth/account-abstraction-provider](https://www.npmjs.com/package/@web3auth/account-abstraction-provider). The provider simplifies the entire process by managing the complex logic behind configuring the account abstraction provider, bundler, and preparing user operations.

If you are already using the Web3Auth Pnp SDK in your project, you just need to configure the AccountAbstractionProvider with the paymaster details, and pass it to the Web3Auth instance. No other changes are required.

### Installation​

```

npm install --save @web3auth/account-abstraction-provider

```

### Configure Paymaster​

The AccountAbstractionProvider requires specific configurations to function correctly. One key configuration is the paymaster. Web3Auth supports custom paymaster configurations, allowing you to deploy your own paymaster and integrate it with the provider.

You can choose from a variety of paymaster services available in the ecosystem. In this guide, we'll be configuring the Pimlico's paymaster. However, it's important to note that paymaster support is not limited to the Pimlico, giving you the flexibility to integrate any compatible paymaster service that suits your requirements.

For the simplicity, we have only use `SafeSmartAccount`, but you choose your favorite smart account provider from the available ones. [Learn how to configure the smart account](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/smart-accounts/).

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from '@web3auth/account-abstraction-provider'

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: '0xaa36a7',

  rpcTarget: 'https://rpc.sepolia.org',

  displayName: 'Ethereum Sepolia Testnet',

  blockExplorerUrl: 'https://sepolia.etherscan.io',

  ticker: 'ETH',

  tickerName: 'Ethereum',

  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',

}

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

    smartAccountInit: new SafeSmartAccount(),

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

})

```

## Configure Web3Auth​

Once you have configured your `AccountAbstractionProvider`, you can now plug it in your Web3Auth Modal/No Modal instance. If you are using the external wallets like MetaMask, Coinbase, etc, you can define whether you want to use the AccountAbstractionProvider, or EthereumPrivateKeyProvider by setting the `useAAWithExternalWallet` in `IWeb3AuthCoreOptions`.

If you are setting `useAAWithExternalWallet` to `true`, it'll create a new Smart Account for your user, where the signer/creator of the Smart Account would be the external wallet.

If you are setting `useAAWithExternalWallet` to `false`, it'll skip creating a new Smart Account, and directly use the external wallet to sign the transactions.

```

import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

import { Web3Auth } from "@web3auth/modal";

const privateKeyProvider = new EthereumPrivateKeyProvider({

  // Use the chain config we declared earlier

  config: { chainConfig },

});

const web3auth = new Web3Auth({

  clientId: "YOUR_WEB3AUTH_CLIENT_ID", // Pass your Web3Auth Client ID, ideally using an environment variable

  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,

  privateKeyProvider,

  // Use the account abstraction provider we configured earlier

  accountAbstractionProvider

  // This will allow you to use EthereumPrivateKeyProvider for

  // external wallets, while use the AccountAbstractionProvider

  // for Web3Auth embedded wallets.

  useAAWithExternalWallet: false,

});

```

## Configure Signer​

The Web3Auth Smart Account feature is compatible with popular signer SDKs, including wagmi, ethers, and viem. You can choose your preferred package to configure the signer.

You can retreive the provider to configure the signer from Web3Auth instance.

Wagmi does not require any special configuration to use the signer with smart accounts. Once you have set up your Web3Auth provider and connected your wallet, Wagmi's hooks (such as useSigner or useAccount) will automatically use the smart account as the signer. You can interact with smart accounts using Wagmi just like you would with a regular EOA (Externally Owned Account) signer—no additional setup is needed.

```

import { createWalletClient } from 'viem'

// Use your Web3Auth instance to retreive the provider.

const provider = web3auth.provider

const walletClient = createWalletClient({

  transport: custom(provider),

})

```

## Send a transaction​

Developers can use their preferred signer or Wagmi hooks to initiate on-chain transactions, while Web3Auth manages the creation and submission of the UserOperation. Only the `to`, `data`, and `value` fields need to be provided. Any additional parameters will be ignored and automatically overridden.

To ensure reliable execution, the bundler client sets maxFeePerGas and maxPriorityFeePerGas values. If custom values are required, developers can use the [Viem's BundlerClient](https://viem.sh/account-abstraction/clients/bundler#bundler-client) to manually construct and send the user operation.

Since Smart Accounts are deployed smart contracts, the user's first transaction also triggers the on-chain deployment of their wallet.

```

import { useSendTransaction } from 'wagmi'

const { data: hash, sendTransaction } = useSendTransaction()

// Convert 1 ether to WEI format

const value = web3.utils.toWei(1)

sendTransaction({ to: 'DESTINATION_ADDRESS', value, data: '0x' })

const {

  data: receipt,

  isLoading: isConfirming,

  isSuccess: isConfirmed,

} = useWaitForTransactionReceipt({

  hash,

})

```

## Conclusion​

Voila, you have successfully sent your first gasless transaction using the Pimlico paymaster with Web3Auth Account Abstraction Provider. To learn more about advance features of the Account Abstraction Provider like performing batch transactions, using ERC-20 paymaster you can refer to the [Account Abstraction Provider](https://docs.metamask.io/embedded-wallets/sdk/react/) documentation.

# Smart Accounts

Effortlessly create and manage smart accounts for your users with just a few lines of code, using our Smart Account feature. Smart accounts offer enhanced control and programmability, enabling powerful features that traditional wallets can't provide.

**Key features of Smart Accounts include:**

- **Gas Abstraction:** Cover transaction fees for users, or allow users to pay for their own transactions using ERC-20 tokens.

- **Batch Transactions:** Perform multiple transactions in a single call.

- **Automated Transactions:** Allow users to automate actions, like swapping ETH to USDT when ETH hits a specific price.

- **Custom Spending Limits:** Allow users to set tailored spending limits.

> For more information about ERC-4337 and its components, check out our detailed blog post.

For more information about ERC-4337 and its components, [check out our detailed blog post](https://blog.web3auth.io/an-ultimate-guide-to-web3-wallets-externally-owned-account-and-smart-contract-wallet/#introduction-to-eip-4337).

Our smart account integration streamlines your setup, allowing you to create and manage smart accounts using your favorite libraries like Viem, Ethers, and Wagmi. You don't need to rely on third-party packages to effortlessly create ERC-4337 compatible Smart Contract Wallets (SCWs), giving users the ability to perform batch transactions and efficiently manage gas sponsorship.

This is a paid feature and the minimum [pricing plan](https://web3auth.io/pricing.html) to use this

SDK in a production environment is the **Growth Plan**. You can use this feature in Web3Auth

Sapphire Devnet network for free.

## Enabling Smart Accounts​

To enable this feature, you need to configure Smart Accounts from your project in the [Web3Auth Developer Dashboard](https://dashboard.web3auth.io/).

### Dashboard Configuration​

To enable Smart Accounts, navigate to the Smart Accounts section in the Web3Auth dashboard, and enable the "Set up Smart Accounts" toggle. Web3Auth currently supports [MetaMaskSmartAccount](https://docs.gator.metamask.io/how-to/create-delegator-account#create-a-metamasksmartaccount) as a Smart Account provider.

## Installation​

To use native account abstraction, you'll need to install the

[@web3auth/account-abstraction-provider](https://www.npmjs.com/package/@web3auth/account-abstraction-provider),

which allows you to create and interact with Smart Contract Wallets (SCWs). This provider simplifies

the entire process by managing the complex logic behind configuring the account abstraction

provider, bundler, and preparing user operations.

```

npm install --save @web3auth/account-abstraction-provider

```

## Configure​

When instantiating the Account Abstraction Provider, you can pass configuration objects to the

constructor. These configuration options allow you to select the desired Account Abstraction (AA)

provider, as well as configure the bundler and paymaster, giving you flexibility and control over

the provider.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

Please note this is the important step for setting the Web3Auth account abstraction provider.

- [Configure Smart Account provider](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#configure-smart-account-provider)

- [Configure Bundler](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#configure-bundler)

- [Configure Sponsored Paymaster](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#sponsored-paymaster)

- [Configure ERC-20 Paymaster](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#erc-20-paymaster)

## Configure Smart Account Provider​

Web3Auth offers the flexibility to choose your preferred Account Abstraction (AA) provider.

Currently, we support Safe, Kernel, Biconomy, and Trust.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Configure Bundler​

Web3Auth enables you to configure your bundler and define the paymaster context. The bundler

aggregates the UserOperations and submits them on-chain via a global entry point contract.

Bundler support is not limited to the examples below—you can use any bundler of your choice.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Configure Paymaster​

You can configure the paymaster of your choice to sponsor gas fees for your users, along with the paymaster context. The paymaster context lets you set additional parameters, such as choosing the token for ERC-20 paymasters, defining gas policies, and more.

### Sponsored Paymaster​

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

### ERC-20 Paymaster​

When using an ERC-20 paymaster, ensure you include the approval transaction, as Web3Auth does not

handle the approval internally.

For Pimlico, you can specify the token you want to use in the paymasterContext. If you want to set

up sponsorship policies, you can define those in the paymasterContext as well.

[Checkout the supported tokens for ERC-20 Paymaster on Pimlico](https://docs.pimlico.io/infra/paymaster/erc20-paymaster/supported-tokens).

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

      paymasterContext: {

        token: "SUPPORTED_TOKEN_CONTRACT_ADDRESS",

      },

    },

    smartAccountInit: new SafeSmartAccount(),

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Set up​

### Configure Web3Auth Instance​

```

import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider'

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from '@web3auth/account-abstraction-provider'

import Web3Auth, { WEB3AUTH_NETWORK } from '@web3auth/react-native-sdk'

import * as WebBrowser from '@toruslabs/react-native-web-browser'

import EncryptedStorage from 'react-native-encrypted-storage'

import { CHAIN_NAMESPACES } from '@web3auth/base'

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: '0xaa36a7',

  rpcTarget: 'https://rpc.sepolia.org',

  displayName: 'Ethereum Sepolia Testnet',

  blockExplorerUrl: 'https://sepolia.etherscan.io',

  ticker: 'ETH',

  tickerName: 'Ethereum',

  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',

}

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

    smartAccountInit: new SafeSmartAccount(),

  },

})

const privateKeyProvider = new EthereumPrivateKeyProvider({

  config: { chainConfig },

})

const web3auth = new Web3Auth(WebBrowser, EncryptedStorage, {

  clientId,

  redirectUrl,

  network: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET, // or other networks

  privateKeyProvider,

  accountAbstractionProvider: aaProvider,

})

```

### Configure Signer​

The Web3Auth Smart Account feature is compatible with popular signer SDKs, including wagmi, ethers,

and viem. You can choose your preferred package to configure the signer.

You can retreive the provider to configure the signer from Web3Auth instance.

Wagmi does not require any special configuration to use the signer with smart accounts. Once you

have set up your Web3Auth provider and connected your wallet, Wagmi's hooks (such as useSigner or

useAccount) will automatically use the smart account as the signer. You can interact with smart

accounts using Wagmi just like you would with a regular EOA (Externally Owned Account) signer—no

additional setup is needed.

```

import { createWalletClient } from "viem";

// Use your Web3Auth instance to retreive the provider.

const provider = web3auth.provider;

const walletClient = createWalletClient({

  transport: custom(provider),

});

```

## Smart Account Address​

Once the signers or Wagmi configuration is set up, it can be used to retrieve the user's Smart

Account address.

```

import { useAccount } from "wagmi";

const { address } = useAccount();

const smartAccountAddress = address;

```

## Send Transaction​

Developers can use their preferred signer or Wagmi hooks to initiate on-chain transactions, while

Web3Auth manages the creation and submission of the UserOperation. Only the `to`, `data`, and

`value` fields need to be provided. Any additional parameters will be ignored and automatically

overridden.

To ensure reliable execution, the bundler client sets maxFeePerGas and maxPriorityFeePerGas values.

If custom values are required, developers can use the

[Viem's BundlerClient](https://viem.sh/account-abstraction/clients/bundler#bundler-client) to

manually construct and send the user operation.

Since Smart Accounts are deployed smart contracts, the user's first transaction also triggers the

on-chain deployment of their wallet.

```

import { useSendTransaction } from "wagmi";

const { data: hash, sendTransaction } = useSendTransaction();

// Convert 1 ether to WEI format

const value = web3.utils.toWei(1);

sendTransaction({ to: "DESTINATION_ADDRESS", value, data: "0x" });

const {

  data: receipt,

  isLoading: isConfirming,

  isSuccess: isConfirmed,

} = useWaitForTransactionReceipt({

  hash,

});

```

## Advanced Smart Account Operations​

To learn more about supported transaction methods, and how to perform batch transactions, [checkout our detailed documentation of AccountAbstractionProvider](https://docs.metamask.io/embedded-wallets/sdk/react/).

# Advanced Permissions (ERC-7715)

The Smart Accounts Kit supports Advanced Permissions ([ERC-7715](https://eips.ethereum.org/EIPS/eip-7715)), which lets you request fine-grained permissions from a MetaMask user to execute transactions on their behalf.

For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course of a month.

Once the permission is granted, your dapp can use the allocated 10 USDC each day to purchase ETH directly from the MetaMask user's account.

Advanced Permissions eliminate the need for users to approve every transaction, which is useful for highly interactive dapps.

It also enables dapps to execute transactions for users without an active wallet connection.

This feature requires [MetaMask Flask 13.5.0](https://docs.metamask.io/snaps/get-started/install-flask/) or later.

## ERC-7715 technical overview​

[ERC-7715](https://eips.ethereum.org/EIPS/eip-7715) defines a JSON-RPC method `wallet_grantPermissions`.

Dapps can use this method to request a wallet to grant the dapp permission to execute transactions on a user's behalf.

`wallet_grantPermissions` requires a `signer` parameter, which identifies the entity requesting or managing the permission.

Common signer implementations include wallet signers, single key and multisig signers, and account signers.

The Smart Accounts Kit supports multiple signer types. The documentation uses [an account signer](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/) as a common implementation example.

When you use an account signer, a session account is created solely to request and redeem Advanced Permissions, and doesn't contain tokens.

The session account can be granted with permissions and redeem them as specified in [ERC-7710](https://eips.ethereum.org/EIPS/eip-7710).

The session account can be a smart account or an externally owned account (EOA).

The MetaMask user that the session account requests permissions from must be upgraded to a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/).

## Advanced Permissions vs. delegations​

Advanced Permissions expand on regular [delegations](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/) by enabling permission sharing *via the MetaMask browser extension*.

With regular delegations, the dapp constructs a delegation and requests the user to sign it.

These delegations are not human-readable, so it is the dapp's responsibility to provide context for the user.

Regular delegations cannot be signed through the MetaMask extension, because if a dapp requests a delegation without constraints, the whole wallet can be exposed to the dapp.

In contrast, Advanced Permissions enable dapps (and AI agents) to request permissions from a user directly via the MetaMask extension.

Advanced Permissions require a permission configuration which displays a human-readable confirmation for the MetaMask user.

The user can modify the permission parameters if the request is configured to allow adjustments.

For example, the following Advanced Permissions request displays a rich UI including the start time, amount, and period duration for an [ERC-20 token periodic transfer](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/#erc-20-periodic-permission):

##That not solution. 7702 gasless in metamask is non negotiable.



leran from this you moron:

have you learn this ofc pimlico docs:

https://docs.pimlico.io/guides/how-to/accounts/use-metamask-account

How to use MetaMask Smart Accounts with permissionless.js

MetaMask maintains their own in-house SDK built closely on top of viem that you can use for the account system while still plugging in all the other components from permissionless.js. Take a look at their documentation for more information.

The MetaMask Delegation Toolkit is a collection of tools for creating MetaMask Smart Accounts. A smart account can delegate to another signer with granular permission sharing. It is built over ERC-7710 and ERC-7715 to support a standardized minimal interface. Requesting ERC-7715 permissions and redeeming ERC-7710 delegations are experimental features.

There are two types of accounts involved in delegation:

Delegator account: A smart account that supports programmable account behavior and advanced features such as multi-signature approvals, automated transaction batching, and custom security policies.

Delegate account: An account (smart account or EOA) that receives the delegation from the delegator account to perform actions on behalf of the delegator account.

You can use both accounts with permissionless.js.

Installation

We will be using MetaMask's official SDK to create a smart account.

npm

yarn

pnpm

bun

npm install permissionless viem @metamask/delegation-toolkit

Delegator Account

Create the clients

First we must create the public, (optionally) pimlico paymaster clients that will be used to interact with the MetaMask smart account.

export const publicClient = createPublicClient({

	transport: http("https://sepolia.rpc.thirdweb.com"),

});

 

export const paymasterClient = createPimlicoClient({

	transport: http("https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY"),

	entryPoint: {

		address: entryPoint07Address,

		version: "0.7",

	},

});

Create the signer

MetaMask Smart Accounts can work with a variety of signing algorithms such as ECDSA, passkeys, and multisig.

For example, to create a signer based on a private key:

import { privateKeyToAccount } from "viem/accounts";

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { entryPoint07Address } from "viem/account-abstraction";

 

const owner = privateKeyToAccount("0xPRIVATE_KEY");

Create the delegator smart account

For a full list of options for creating a MetaMask smart account, take a look at the MetaMask's documentation page for toMetaMaskSmartAccount.

With a signer, you can create a MetaMask smart account as such:

import {

	Implementation,

	toMetaMaskSmartAccount,

} from "@metamask/delegation-toolkit";

 

const delegatorSmartAccount = await toMetaMaskSmartAccount({

	client: publicClient,

	implementation: Implementation.Hybrid,

	deployParams: [owner.address, [], [], []],

	deploySalt: "0x",

	signatory: { account: owner },

});

 

Create the smart account client

const smartAccountClient = createSmartAccountClient({

	account: delegatorSmartAccount,

	chain: sepolia,

	paymaster: paymasterClient,

	bundlerTransport: http(

		"https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY",

	),

	userOperation: {

		estimateFeesPerGas: async () =>

			(await paymasterClient.getUserOperationGasPrice()).fast,

	},

});

Send a transaction

Transactions using permissionless.js simply wrap around user operations. This means you can switch to permissionless.js from your existing viem EOA codebase with minimal-to-no changes.

const txHash = await smartAccountClient.sendTransaction({

	to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",

	value: parseEther("0.1"),

});

This also means you can also use viem Contract instances to transact without any modifications.

const nftContract = getContract({

	address: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",

	abi: tokenAbi,

	client: {

		public: publicClient,

		wallet: smartAccountClient,

	},

});

 

const txHash = await nftContract.write.mint([

	"0x_MY_ADDRESS_TO_MINT_TOKENS",

	parseEther("1"),

]);

You can also send an array of transactions in a single batch.

const userOpHash = await smartAccountClient.sendUserOperation({

	calls: [

		{

			to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",

			value: parseEther("0.1"),

			data: "0x",

		},

		{

			to: "0x1440ec793aE50fA046B95bFeCa5aF475b6003f9e",

			value: parseEther("0.1"),

			data: "0x1234",

		},

	],

});

Delegate Account

A delegate account is an account that receives the delegation from the delegator account to perform actions on behalf of the delegator account. To create a delegate account, we will follow the following steps:

Create a delegate signer

Create the delegate smart account

Create a delegation using delegator smart account

Sign the delegation

Send transactions using delegate smart account with signed delegation

Create the clients

First we must create the public, (optionally) pimlico paymaster clients that will be used to interact with the MetaMask smart account.

export const publicClient = createPublicClient({

	transport: http("https://sepolia.rpc.thirdweb.com"),

});

 

export const paymasterClient = createPimlicoClient({

	transport: http("https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY"),

	entryPoint: {

		address: entryPoint07Address,

		version: "0.7",

	},

});

Create the signer

MetaMask Smart Accounts can work with a variety of signing algorithms such as ECDSA, passkeys, and multisig.

For example, to create a signer based on a private key:

const delegateSigner = privateKeyToAccount("0xPRIVATE_KEY");

Create the delegate smart account

For a full list of options for creating a MetaMask smart account, take a look at the MetaMask's documentation page for toMetaMaskSmartAccount.

With a delegate signer, you can create a MetaMask delegate account as such:

const delegateSmartAccount = await toMetaMaskSmartAccount({

	client: publicClient,

	implementation: Implementation.Hybrid,

	deployParams: [delegateSigner.address, [], [], []],

	deploySalt: "0x",

	signatory: { account: delegateSigner },

});

Create a delegation

This example passes an empty caveats array, which means the delegate can perform any action on the delegator's behalf. We recommend restricting the delegation by adding caveat enforcers.

import { createDelegation } from "@metamask/delegation-toolkit";

 

const delegation = createDelegation({

	to: delegateSmartAccount.address,

	from: delegatorSmartAccount.address,

	caveats: [],

});

Sign the delegation

const signature = await delegatorSmartAccount.signDelegation({

	delegation,

});

 

const signedDelegation = {

	...delegation,

	signature,

};

Create the smart account client

const delegateSmartAccountClient = createSmartAccountClient({

	account: delegateSmartAccount,

	chain: sepolia,

	paymaster: paymasterClient,

	bundlerTransport: http(

		"https://api.pimlico.io/v2/sepolia/rpc?apikey=API_KEY",

	),

	userOperation: {

		estimateFeesPerGas: async () =>

			(await paymasterClient.getUserOperationGasPrice()).fast,

	},

});

Send transactions using signed delegation

import { DelegationManager } from "@metamask/delegation-toolkit/contracts";

import { SINGLE_DEFAULT_MODE } from "@metamask/delegation-toolkit/utils";

import { createExecution } from "@metamask/delegation-toolkit";

 

const delegations = [signedDelegation];

 

// Actual execution to be performed by the delegate account

const executions = [

	createExecution({

		target: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",

		callData: encodeFunctionData({

			abi: tokenAbi,

			functionName: "mint",

			args: ["0x_MY_ADDRESS_TO_MINT_TOKENS", parseEther("1")],

		}),

	}),

];

 

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({

	delegations: [delegations],

	modes: [SINGLE_DEFAULT_MODE],

	executions: [executions],

});

 

const txHash = await delegateSmartAccountClient.sendTransaction({

	calls: [

		{

			to: delegateSmartAccount.address,

			data: redeemDelegationCalldata,

		},

	],

});

have you also learn from metamask ofc docs:

# Configure the Smart Accounts Kit

The Smart Accounts Kit is highly configurable, providing support for custom [bundlers and paymasters](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/#configure-the-bundler).

You can also configure the [toolkit environment](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/#optional-configure-the-toolkit-environment) to interact with the [Delegation Framework](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-framework).

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Configure the bundler​

The toolkit uses Viem's Account Abstraction API to configure custom bundlers and paymasters.

This provides a robust and flexible foundation for creating and managing [MetaMask Smart Accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/).

See Viem's [account abstraction documentation](https://viem.sh/account-abstraction) for more information on the API's features, methods, and best practices.

To use the bundler and paymaster clients with the toolkit, create instances of these clients and configure them as follows:

```

import {

  createPaymasterClient,

  createBundlerClient,

} from "viem/account-abstraction";

import { http } from "viem";

import { sepolia as chain } from "viem/chains"; 

// Replace these URLs with your actual bundler and paymaster endpoints.

const bundlerUrl = "https://your-bundler-url.com";

const paymasterUrl = "https://your-paymaster-url.com";

// The paymaster is optional.

const paymasterClient = createPaymasterClient({

  transport: http(paymasterUrl),

});

const bundlerClient = createBundlerClient({

  transport: http(bundlerUrl),

  paymaster: paymasterClient,

  chain,

});

```

Replace the bundler and paymaster URLs with your bundler and paymaster endpoints.

For example, you can use endpoints from [Pimlico](https://docs.pimlico.io/references/bundler), [Infura](https://docs.metamask.io/services/), or [ZeroDev](https://docs.zerodev.app/meta-infra/intro).

Providing a paymaster is optional when configuring your bundler client. However, if you choose not to use a paymaster, the smart contract account must have enough funds to pay gas fees.

## (Optional) Configure the toolkit environment​

The toolkit environment (`SmartAccountsEnvironment`) defines the contract addresses necessary for interacting with the [Delegation Framework](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-framework) on a specific network.

It serves several key purposes:

- It provides a centralized configuration for all the contract addresses required by the Delegation Framework.

- It enables easy switching between different networks (for example, Mainnet and testnet) or custom deployments.

- It ensures consistency across different parts of the application that interact with the Delegation Framework.

### Resolve the environment​

When you create a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/), the toolkit automatically

resolves the environment based on the version it requires and the chain configured.

If no environment is found for the specified chain, it throws an error.

```

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { delegatorSmartAccount } from "./config.ts";

const environment: SmartAccountsEnvironment = delegatorSmartAccount.environment; 

```

See the changelog of the toolkit version you are using (in the left sidebar) for supported chains.

Alternatively, you can use the [getSmartAccountsEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#getsmartaccountsenvironment) function to resolve the environment.

This function is especially useful if your delegator is not a smart account when

creating a [redelegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-types).

```

import { 

  getSmartAccountsEnvironment, 

  SmartAccountsEnvironment, 

} from "@metamask/smart-accounts-kit"; 

// Resolves the SmartAccountsEnvironment for Sepolia

const environment: SmartAccountsEnvironment = getSmartAccountsEnvironment(11155111);

```

### Deploy a custom environment​

You can deploy the contracts using any method, but the toolkit provides a convenient [deployDelegatorEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#deploydelegatorenvironment) function. This function simplifies deploying the Delegation Framework contracts to your desired EVM chain.

This function requires a Viem [Public Client](https://viem.sh/docs/clients/public), [Wallet Client](https://viem.sh/docs/clients/wallet), and [Chain](https://viem.sh/docs/glossary/types#chain)

to deploy the contracts and resolve the `SmartAccountsEnvironment`.

Your wallet must have a sufficient native token balance to deploy the contracts.

```

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { deployDeleGatorEnvironment } from "@metamask/smart-accounts-kit/utils";

const environment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain

);

```

You can also override specific contracts when calling `deployDelegatorEnvironment`.

For example, if you've already deployed the `EntryPoint` contract on the target chain, you can pass the contract address to the function.

```

// The config.ts is the same as in the previous example.

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { deployDeleGatorEnvironment } from "@metamask/smart-accounts-kit/utils";

const environment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain,

+ {

+   EntryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032"

+ }

);

```

Once the contracts are deployed, you can use them to override the environment.

### Override the environment​

To override the environment, the toolkit provides an [overrideDeployedEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#overridedeployedenvironment) function to resolve

`SmartAccountsEnvironment` with specified contracts for the given chain and contract version.

```

// The config.ts is the same as in the previous example.

import { walletClient, publicClient } from "./config.ts";

import { sepolia as chain } from "viem/chains";

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { 

  overrideDeployedEnvironment,

  deployDeleGatorEnvironment 

} from "@metamask/smart-accounts-kit";

const environment: SmartAccountsEnvironment = await deployDeleGatorEnvironment(

  walletClient, 

  publicClient, 

  chain

);

overrideDeployedEnvironment(

  chain.id,

  "1.3.0",

  environment,

);

```

If you've already deployed the contracts using a different method, you can create a `DelegatorEnvironment` instance with the required contract addresses, and pass it to the function.

```

- import { walletClient, publicClient } from "./config.ts";

- import { sepolia as chain } from "viem/chains";

import { SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { 

  overrideDeployedEnvironment,

- deployDeleGatorEnvironment

} from "@metamask/smart-accounts-kit";

- const environment: SmartAccountsEnvironment = await deployDeleGatorEnvironment(

-  walletClient, 

-  publicClient, 

-  chain

- );

+ const environment: SmartAccountsEnvironment = {

+  SimpleFactory: "0x124..",

+  // ...

+  implementations: {

+    // ...

+  },

+ };

overrideDeployedEnvironment(

  chain.id,

  "1.3.0",

  environment

);

```

Make sure to specify the Delegation Framework version required by the toolkit.

See the changelog of the toolkit version you are using (in the left sidebar) for its required Framework version.

# Create a smart account

You can enable users to create a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) directly in your dapp.

This page provides examples of using [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) with Viem Core SDK to create different types of smart accounts with different signature schemes.

An account's supported *signatories* can sign data on behalf of the smart account.

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Create a Hybrid smart account​

A Hybrid smart account supports both an externally owned account (EOA) owner and any number of passkey (WebAuthn) signers.

You can create a Hybrid smart account with the following types of signers.

### Create a Hybrid smart account with an Account signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount), and Viem's [privateKeyToAccount and generatePrivateKey](https://viem.sh/docs/accounts/local/privateKeyToAccount), to create a Hybrid smart account with a signer from a randomly generated private key:

```

import { publicClient } from "./client.ts"

import { account } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [account.address, [], [], []],

  deploySalt: "0x",

  signer: { account },

});

```

### Create a Hybrid smart account with a Wallet Client signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) to create a Hybrid smart account with a Wallet Client signer:

```

import { publicClient } from "./client.ts"

import { walletClient } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const addresses = await walletClient.getAddresses();

const owner = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [owner, [], [], []],

  deploySalt: "0x",

  signer: { walletClient },

});

```

### Create a Hybrid smart account with a passkey signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [toWebAuthnAccount](https://viem.sh/account-abstraction/accounts/webauthn) to create a Hybrid smart account with a passkey (WebAuthn) signer:

To work with WebAuthn, install the [Ox SDK](https://oxlib.sh/).

```

import { publicClient } from "./client.ts"

import { webAuthnAccount, credential } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

import { Address, PublicKey } from "ox";

import { toHex } from "viem";

// Deserialize compressed public key

const publicKey = PublicKey.fromHex(credential.publicKey);

// Convert public key to address

const owner = Address.fromPublicKey(publicKey);

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [owner, [toHex(credential.id)], [publicKey.x], [publicKey.y]],

  deploySalt: "0x",

  signer: { webAuthnAccount, keyId: toHex(credential.id) },

});

```

## Create a Multisig smart account​

A [Multisig smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#multisig-smart-account) supports multiple EOA signers with a configurable threshold for execution.

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) to create a Multsig smart account with a combination of account signers and Wallet Client signers:

```

import { publicClient } from "./client.ts";

import { account, walletClient } from "./signers.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const owners = [ account.address, walletClient.address ];

const signer = [ { account }, { walletClient } ];

const threshold = 2n

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.MultiSig,

  deployParams: [owners, threshold],

  deploySalt: "0x",

  signer,

});

```

The number of signers in the signatories must be at least equal to the threshold for valid signature generation.

## Create a Stateless 7702 smart account​

A [Stateless 7702 smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#stateless-7702-smart-account) represents an EOA that has been upgraded to support MetaMask Smart Accounts

functionality as defined by [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702).

This implementation does not handle the upgrade process; see the [EIP-7702 quickstart](https://docs.metamask.io/smart-accounts-kit/get-started/smart-account-quickstart/eip7702/) to learn how to upgrade.

You can create a Stateless 7702 smart account with the following types of signatories.

### Create a Stateless 7702 smart account with an account signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [privateKeyToAccount](https://viem.sh/docs/accounts/local/privateKeyToAccount) to create a Stateless 7702 smart account with a signer from a private key:

```

import { publicClient } from "./client.ts";

import { account } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Stateless7702,

  address: account.address // Address of the upgraded EOA

  signer: { account },

});

```

### Create a Stateless 7702 smart account with a Wallet Client signer​

Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) to create a Stateless 7702 smart account with a Wallet Client signer:

```

import { publicClient } from "./client.ts";

import { walletClient } from "./signer.ts";

import { 

  Implementation, 

  toMetaMaskSmartAccount,

} from "@metamask/smart-accounts-kit";

const addresses = await walletClient.getAddresses();

const address = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Stateless7702,

  address, // Address of the upgraded EOA

  signer: { walletClient },

});

```

## Next steps​

With a MetaMask smart account, you can perform the following functions:

- In conjunction with [Viem Account Abstraction clients](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/), [deploy the smart account](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/deploy-smart-account/)

and [send user operations](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-user-operation/).

- [Create delegations](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/) that can be used to grant specific rights and permissions to other accounts.

Smart accounts that create delegations are called *delegator accounts*.

# Deploy a smart account

You can deploy MetaMask Smart Accounts in two different ways. You can either deploy a smart account automatically when sending

the first user operation, or manually deploy the account.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Deploy with the first user operation​

When you send the first user operation from a smart account, the Smart Accounts Kit checks whether the account is already deployed. If the account

is not deployed, the toolkit adds the `initCode` to the user operation to deploy the account within the

same operation. Internally, the `initCode` is encoded using the `factory` and `factoryData`.

```

import { bundlerClient, smartAccount } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001"),

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas

});

```

## Deploy manually​

To deploy a smart account manually, call the [getFactoryArgs](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#getfactoryargs)

method from the smart account to retrieve the `factory` and `factoryData`. This allows you to use a relay account to sponsor the deployment without needing a paymaster.

The `factory` represents the contract address responsible for deploying the smart account, while `factoryData` contains the

calldata that will be executed by the `factory` to deploy the smart account.

The relay account can be either an externally owned account (EOA) or another smart account. This example uses an EOA.

```

import { walletClient, smartAccount } from "./config.ts";

const { factory, factoryData } = await smartAccount.getFactoryArgs();

// Deploy smart account using relay account.

const hash = await walletClient.sendTransaction({

  to: factory,

  data: factoryData,

})

```

## Next steps​

- Learn more about [sending user operations](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-user-operation/).

- To sponsor gas for end users, see how to [send a gasless transaction](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-gasless-transaction/).

# Send a user operation

User operations are the [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) counterpart to traditional blockchain transactions.

They incorporate significant enhancements that improve user experience and provide greater

flexibility in account management and transaction execution.

Viem's Account Abstraction API allows a developer to specify an array of `Calls` that will be executed as a user operation via Viem's [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation) method.

The MetaMask Smart Accounts Kit encodes and executes the provided calls.

User operations are not directly sent to the network.

Instead, they are sent to a bundler, which validates, optimizes, and aggregates them before network submission.

See [Viem's Bundler Client](https://viem.sh/account-abstraction/clients/bundler) for details on how to interact with the bundler.

If a user operation is sent from a MetaMask smart account that has not been deployed, the toolkit configures the user operation to automatically deploy the account.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Send a user operation​

The following is a simplified example of sending a user operation using Viem Core SDK. Viem Core SDK offers more granular control for developers who require it.

In the example, a user operation is created with the necessary gas limits.

This user operation is passed to a bundler instance, and the `EntryPoint` address is retrieved from the client.

```

import { bundlerClient, smartAccount } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001")

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas

});

```

### Estimate fee per gas​

Different bundlers have different ways to estimate `maxFeePerGas` and `maxPriorityFeePerGas`, and can reject requests with insufficient values.

The following example updates the previous example to estimate the fees.

This example uses constant values, but the [Hello Gator example](https://github.com/MetaMask/hello-gator) uses Pimlico's Alto bundler,

which fetches user operation gas price using the RPC method [pimlico_getUserOperationPrice](https://docs.pimlico.io/infra/bundler/endpoints/pimlico_getUserOperationGasPrice).

To estimate the gas fee for Pimlico's bundler, install the [permissionless.js SDK](https://docs.pimlico.io/references/permissionless/).

```

+ import { createPimlicoClient } from "permissionless/clients/pimlico";

import { parseEther } from "viem";

import { bundlerClient, smartAccount } from "./config.ts" // The config.ts is the same as in the previous example.

- const maxFeePerGas = 1n;

- const maxPriorityFeePerGas = 1n;

+ const pimlicoClient = createPimlicoClient({

+   transport: http("https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>"), // You can get the API Key from the Pimlico dashboard.

+ });

+

+ const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("1")

    }

  ],

-  maxFeePerGas,

-  maxPriorityFeePerGas

+  ...fee

});

```

### Wait for the transaction receipt​

After submitting the user operation, it's crucial to wait for the receipt to ensure that it has been successfully included in the blockchain. Use the `waitForUserOperationReceipt` method provided by the bundler client.

```

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { bundlerClient, smartAccount } from "./config.ts" // The config.ts is the same as in the previous example.

const pimlicoClient = createPimlicoClient({

  transport: http("https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>"), // You can get the API Key from the Pimlico dashboard.

});

const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("1")

    }

  ],

  ...fee

});

+ const { receipt } = await bundlerClient.waitForUserOperationReceipt({

+   hash: userOperationHash

+ });

+

+ console.log(receipt.transactionHash);

```

## Next steps​

To sponsor gas for end users, see how to [send a gasless transaction](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/send-gasless-transaction/).

# Send a gasless transaction

MetaMask Smart Accounts support gas sponsorship, which simplifies onboarding by abstracting gas fees away from end users.

You can use any paymaster service provider, such as [Pimlico](https://docs.pimlico.io/references/paymaster) or [ZeroDev](https://docs.zerodev.app/meta-infra/rpcs), or plug in your own custom paymaster.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a MetaMask smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/)

## Send a gasless transaction​

The following example demonstrates how to use Viem's [Paymaster Client](https://viem.sh/account-abstraction/clients/paymaster) to send gasless transactions.

You can provide the paymaster client using the paymaster property in the [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation#paymaster-optional) method, or in the [Bundler Client](https://viem.sh/account-abstraction/clients/bundler#paymaster-optional).

In this example, the paymaster client is passed to the `sendUserOperation` method.

```

import { bundlerClient, smartAccount, paymasterClient } from "./config.ts";

import { parseEther } from "viem";

// Appropriate fee per gas must be determined for the specific bundler being used.

const maxFeePerGas = 1n;

const maxPriorityFeePerGas = 1n;

const userOperationHash = await bundlerClient.sendUserOperation({

  account: smartAccount,

  calls: [

    {

      to: "0x1234567890123456789012345678901234567890",

      value: parseEther("0.001")

    }

  ],

  maxFeePerGas,

  maxPriorityFeePerGas,

  paymaster: paymasterClient,

});

```

# Generate a multisig signature

The Smart Accounts Kit supports [Multisig smart accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/#multisig-smart-account),

allowing you to add multiple externally owned accounts (EOA)

signers with a configurable execution threshold. When the threshold

is greater than 1, you can collect signatures from the required signers

and use the [aggregateSignature](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#aggregatesignature) function to combine them

into a single aggregated signature.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a Multisig smart account.](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/#create-a-multisig-smart-account)

## Generate a multisig signature​

The following example configures a Multisig smart account with two different signers: Alice

and Bob. The account has a threshold of 2, meaning that signatures from

both parties are required for any execution.

```

import { 

  bundlerClient, 

  aliceSmartAccount, 

  bobSmartAccount,

  aliceAccount,

  bobAccount,

} from "./config.ts";

import { aggregateSignature } from "@metamask/smart-accounts-kit";

const userOperation = await bundlerClient.prepareUserOperation({

  account: aliceSmartAccount,

  calls: [

    {

      target: zeroAddress,

      value: 0n,

      data: "0x",

    }

  ]

});

const aliceSignature = await aliceSmartAccount.signUserOperation(userOperation);

const bobSignature = await bobSmartAccount.signUserOperation(userOperation);

const aggregatedSignature = aggregateSignature({

  signatures: [{

    signer: aliceAccount.address,

    signature: aliceSignature,

    type: "ECDSA",

  }, {

    signer: bobAccount.address,

    signature: bobSignature,

    type: "ECDSA",

  }],

});

```

# Perform executions on a smart account's behalf

[Delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/) is the ability for a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) to grant permission to another account to perform executions on its behalf.

In this guide, you'll create a delegator account (Alice) and a delegate account (Bob), and grant Bob permission to perform executions on Alice's behalf.

You'll complete the delegation lifecycle (create, sign, and redeem a delegation).

## Prerequisites​

[Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

## Steps​

### 1. Create a Public Client​

Create a [Viem Public Client](https://viem.sh/docs/clients/public) using Viem's `createPublicClient` function.

You will configure Alice's account (the delegator) and the Bundler Client with the Public Client, which you can use to query the signer's account state and interact with smart contracts.

```

import { createPublicClient, http } from "viem"

import { sepolia as chain } from "viem/chains"

const publicClient = createPublicClient({

  chain,

  transport: http(),

})

```

### 2. Create a Bundler Client​

Create a [Viem Bundler Client](https://viem.sh/account-abstraction/clients/bundler) using Viem's `createBundlerClient` function.

You can use the bundler service to estimate gas for user operations and submit transactions to the network.

```

import { createBundlerClient } from "viem/account-abstraction"

const bundlerClient = createBundlerClient({

  client: publicClient,

  transport: http("https://your-bundler-rpc.com"),

})

```

### 3. Create a delegator account​

Create an account to represent Alice, the delegator who will create a delegation.

The delegator must be a MetaMask smart account; use the toolkit's [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) method to create the delegator account.

A Hybrid smart account is a flexible smart account implementation that supports both an externally owned account (EOA) owner and any number of P256 (passkey) signers.

This examples configures a [Hybrid smart account with an Account signer](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/#create-a-hybrid-smart-account-with-an-account-signer):

```

import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

import { privateKeyToAccount } from "viem/accounts"

const delegatorAccount = privateKeyToAccount("0x...")

const delegatorSmartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [delegatorAccount.address, [], [], []],

  deploySalt: "0x",

  signer: { account: delegatorAccount },

})

```

See [how to configure other smart account types](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/create-smart-account/).

### 4. Create a delegate account​

Create an account to represent Bob, the delegate who will receive the delegation. The delegate can be a smart account or an externally owned account (EOA):

```

import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

import { privateKeyToAccount } from "viem/accounts"

const delegateAccount = privateKeyToAccount("0x...")

const delegateSmartAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid, // Hybrid smart account

  deployParams: [delegateAccount.address, [], [], []],

  deploySalt: "0x",

  signer: { account: delegateAccount },

})

```

### 5. Create a delegation​

Create a [root delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#delegation-types) from Alice to Bob.

With a root delegation, Alice is delegating her own authority away, as opposed to *redelegating* permissions she received from a previous delegation.

Use the toolkit's [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation) method to create a root delegation. When creating

delegation, you need to configure the scope of the delegation to define the initial authority.

This example uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-transfer-scope) scope, allowing Alice to delegate to Bob the ability to spend her USDC, with a

specified limit on the total amount.

Before creating a delegation, ensure that the delegator account (in this example, Alice's account) has been deployed. If the account is not deployed, redeeming the delegation will fail.

```

import { createDelegation } from "@metamask/smart-accounts-kit"

import { parseUnits } from "viem"

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const delegation = createDelegation({

  to: delegateSmartAccount.address, // This example uses a delegate smart account

  from: delegatorSmartAccount.address,

  environment: delegatorSmartAccount.environment

  scope: {

    type: "erc20TransferAmount",

    tokenAddress,

    // 10 USDC 

    maxAmount: parseUnits("10", 6),

  },

})

```

### 6. Sign the delegation​

Sign the delegation with Alice's account, using the [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#signdelegation) method from `MetaMaskSmartAccount`. Alternatively, you can use the toolkit's [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#signdelegation) utility method. Bob will later use the signed delegation to perform actions on Alice's behalf.

```

const signature = await delegatorSmartAccount.signDelegation({

  delegation,

})

const signedDelegation = {

  ...delegation,

  signature,

}

```

### 7. Redeem the delegation​

Bob can now redeem the delegation. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on Alice's behalf.

To prepare the calldata for the redeem transaction, use the [redeemDelegations](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#redeemdelegations) method from `DelegationManager`.

Since Bob is redeeming a single delegation chain, use the [SingleDefault](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/#execution-modes) execution mode.

Bob can redeem the delegation by submitting a user operation if his account is a smart account, or a regular transaction if his account is an EOA. In this example, Bob transfers 1 USDC from Alice’s account to his own.

```

import { createExecution, ExecutionMode } from "@metamask/smart-accounts-kit"

import { DelegationManager } from "@metamask/smart-accounts-kit/contracts"

import { zeroAddress } from "viem"

import { callData } from "./config.ts"

const delegations = [signedDelegation]

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const executions = createExecution({ target: tokenAddress, callData })

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({

  delegations: [delegations],

  modes: [ExecutionMode.SingleDefault],

  executions: [executions],

})

const userOperationHash = await bundlerClient.sendUserOperation({

  account: delegateSmartAccount,

  calls: [

    {

      to: delegateSmartAccount.address,

      data: redeemDelegationCalldata,

    },

  ],

  maxFeePerGas: 1n,

  maxPriorityFeePerGas: 1n,

})

```

## Next steps​

- See [how to configure different scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/) to define the initial authority of a delegation.

- See [how to further refine the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

- See [how to disable a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/disable-delegation/) to revoke permissions.

# Use delegation scopes

When [creating a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/), you can configure a scope to define the delegation's initial authority and help prevent delegation misuse.

You can further constrain this initial authority by [adding caveats to a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/).

The Smart Accounts Kit currently supports three categories of scopes:

| Scope type | Description |

| --- | --- |

| Spending limit scopes | Restricts the spending of native, ERC-20, and ERC-721 tokens based on defined conditions. |

| Function call scope | Restricts the delegation to specific contract methods, contract addresses, or calldata. |

| Ownership transfer scope | Restricts the delegation to only allow ownership transfers, specifically the transferOwnership function for a specified contract. |

# Use spending limit scopes

Spending limit scopes define how much a delegate can spend in native, ERC-20, or ERC-721 tokens.

You can set transfer limits with or without time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## ERC-20 periodic scope​

This scope ensures a per-period limit for ERC-20 token transfers.

You set the amount, period, and start data.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day.

Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20PeriodTransfer",

    tokenAddress: "0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da",

    // USDC has 6 decimal places.

    periodAmount: parseUnits("10", 6),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 streaming scope​

This scopes ensures a linear streaming transfer limit for ERC-20 tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20Streaming",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    amountPerSecond: parseUnits("0.1", 6),

    initialAmount: parseUnits("10", 6),

    maxAmount: parseUnits("100", 6),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 transfer scope​

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions.

Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    maxAmount: parseUnits("10", 6),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-721 scope​

This scope limits the delegation to ERC-721 token transfers only.

For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer.

See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const delegation = createDelegation({

  scope: {

    type: "erc721Transfer",

    tokenAddress: "0x3fF528De37cd95b67845C1c55303e7685c72F319",

    tokenId: 1n,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token periodic scope​

This scope ensures a per-period limit for native token transfers.

You set the amount, period, and start date.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

Bob can transfer a total of 0.01 ETH per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenPeriodTransfer",

    periodAmount: parseEther("0.01"),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token streaming scope​

This scopes ensures a linear streaming transfer limit for native tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenStreaming",

    amountPerSecond: parseEther("0.001"),

    initialAmount: parseEther("0.01"),

    maxAmount: parseEther("0.1"),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token transfer scope​

This scope ensures that native token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

Bob may use the 0.1 ETH in a single transaction or make multiple transactions, as long as the total does not exceed 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

const delegation = createDelegation({

  scope: {

    type: "nativeTokenTransferAmount",

    maxAmount: parseEther("0.001"),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Use spending limit scopes

Spending limit scopes define how much a delegate can spend in native, ERC-20, or ERC-721 tokens.

You can set transfer limits with or without time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## ERC-20 periodic scope​

This scope ensures a per-period limit for ERC-20 token transfers.

You set the amount, period, and start data.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day.

Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20PeriodTransfer",

    tokenAddress: "0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da",

    // USDC has 6 decimal places.

    periodAmount: parseUnits("10", 6),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 streaming scope​

This scopes ensures a linear streaming transfer limit for ERC-20 tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "erc20Streaming",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    amountPerSecond: parseUnits("0.1", 6),

    initialAmount: parseUnits("10", 6),

    maxAmount: parseUnits("100", 6),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-20 transfer scope​

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions.

Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers.

See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseUnits } from "viem";

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    // USDC has 6 decimal places.

    maxAmount: parseUnits("10", 6),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## ERC-721 scope​

This scope limits the delegation to ERC-721 token transfers only.

For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer.

See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const delegation = createDelegation({

  scope: {

    type: "erc721Transfer",

    tokenAddress: "0x3fF528De37cd95b67845C1c55303e7685c72F319",

    tokenId: 1n,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token periodic scope​

This scope ensures a per-period limit for native token transfers.

You set the amount, period, and start date.

At the start of each new period, the allowance resets.

For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

Bob can transfer a total of 0.01 ETH per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startDate should be in seconds.

const startDate = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenPeriodTransfer",

    periodAmount: parseEther("0.01"),

    periodDuration: 86400,

    startDate,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token streaming scope​

This scopes ensures a linear streaming transfer limit for native tokens.

Token transfers are blocked until the defined start timestamp.

At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, Alice creates delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

// startTime should be in seconds.

const startTime = Math.floor(Date.now() / 1000);

const delegation = createDelegation({

  scope: {

    type: "nativeTokenStreaming",

    amountPerSecond: parseEther("0.001"),

    initialAmount: parseEther("0.01"),

    maxAmount: parseEther("0.1"),

    startTime,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Native token transfer scope​

This scope ensures that native token transfers are limited to a predefined maximum amount.

This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions.

For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

Bob may use the 0.1 ETH in a single transaction or make multiple transactions, as long as the total does not exceed 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`).

You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure

`allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and

optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified.

See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

import { parseEther } from "viem";

const delegation = createDelegation({

  scope: {

    type: "nativeTokenTransferAmount",

    maxAmount: parseEther("0.001"),

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Use the ownership transfer scope

The ownership transfer scope restricts a delegation to ownership transfer calls only.

For example, Alice has deployed a smart contract, and she delegates to Bob the ability to transfer ownership of that contract.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

## Ownership transfer scope​

This scope requires a `contractAddress`, which represents the address of the deployed contract.

Internally, this scope uses the [ownershipTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#ownershiptransfer) caveat enforcer.

See the [ownership transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#ownership-transfer-scope) for more details.

```

import { createDelegation } from "@metamask/smart-accounts-kit";

const contractAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

const delegation = createDelegation({

  scope: {

    type: "ownershipTransfer",

    contractAddress,

  },

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

See [how to further constrain the authority of a delegation](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/constrain-scope/) using caveat enforcers.

# Constrain a delegation scope

[Delegation scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/) define the delegation's initial authority and help prevent delegation misuse.

You can further constrain these scopes and limit the delegation's authority by applying [caveat enforcers](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/caveat-enforcers/).

## Prerequisites​

[Configure a delegation scope.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/)

## Apply a caveat enforcer​

For example, Alice creates a delegation with an [ERC-20 transfer scope](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-transfer-scope) that allows Bob to spend up to 10 USDC.

If Alice wants to further restrict the scope to limit Bob's delegation to be valid for only seven days,

she can apply the [timestamp](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#timestamp) caveat enforcer.

The following example creates a delegation using [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation), applies the ERC-20 transfer scope with a spending limit of 10 USDC, and applies the `timestamp` caveat enforcer to restrict the delegation's validity to a seven-day period:

```

import { createDelegation } from "@metamask/smart-accounts-kit";

// Convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// Seven days after current time.

const beforeThreshold = currentTime + 604800;

const caveats = [{

  type: "timestamp",

  afterThreshold: currentTime,

  beforeThreshold, 

}];

const delegation = createDelegation({

  scope: {

    type: "erc20TransferAmount",

    tokenAddress: "0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92",

    maxAmount: 10000n,

  },

  // Apply caveats to the delegation.

  caveats,

  to: delegateAccount,

  from: delegatorAccount,

  environment: delegatorAccount.environment,

});

```

## Next steps​

- See the [caveats reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/) for the full list of caveat types and their parameters.

- For more specific or custom control, you can also [create custom caveat enforcers](https://docs.metamask.io/tutorials/create-custom-caveat-enforcer/)

and apply them to delegations.

# Check the delegation state

When using [spending limit delegation scopes](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/) or relevant [caveat enforcers](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/),

you might need to check the remaining transferrable amount in a delegation.

For example, if a delegation allows a user to spend 10 USDC per week and they have already spent 10 - n USDC in the current period,

you can determine how much of the allowance is still available for transfer.

Use the `CaveatEnforcerClient` to check the available balances for specific scopes or caveats.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Create a delegator account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#3-create-a-delegator-account)

- [Create a delegate account.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/#4-create-a-delegate-account)

- [Create a delegation with an ERC-20 periodic scope.](https://docs.metamask.io/smart-accounts-kit/guides/delegation/use-delegation-scopes/spending-limit/#erc-20-periodic-scope)

## Create a CaveatEnforcerClient​

To check the delegation state, create a [CaveatEnforcerClient](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/).

This client allows you to interact with the caveat enforcers of the delegation, and read the required state.

```

import { environment, publicClient as client } from './config.ts'

import { createCaveatEnforcerClient } from '@metamask/smart-accounts-kit'

const caveatEnforcerClient = createCaveatEnforcerClient({

  environment,

  client,

})

```

## Read the caveat enforcer state​

This example uses the [getErc20PeriodTransferEnforcerAvailableAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/#geterc20periodtransferenforceravailableamount) method to read the state and retrieve the remaining amount for the current transfer period.

```

import { delegation } './config.ts'

// Returns the available amount for current period. 

const { availableAmount } = await caveatEnforcerClient.getErc20PeriodTransferEnforcerAvailableAmount({

  delegation,

})

```

## Next steps​

See the [Caveat Enforcer Client reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/) for the full list of available methods.

# Perform executions on a MetaMask user's behalf

[Advanced Permissions (ERC-7115)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) are fine-grained permissions that your dapp can request from a MetaMask user to execute transactions on their

behalf. For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course

of a month. Once the permission is granted, your dapp can use the allocated 10 USDC each day to

purchase ETH directly from the MetaMask user's account.

In this guide, you'll request an ERC-20 periodic transfer permission from a MetaMask user to transfer 1 USDC every day on their behalf.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Install MetaMask Flask 13.5.0 or later.](https://docs.metamask.io/snaps/get-started/install-flask/)

### 1. Set up a Wallet Client​

Set up a [Viem Wallet Client](https://viem.sh/docs/clients/wallet) using Viem's `createWalletClient` function. This client will

help you interact with MetaMask Flask.

Then, extend the Wallet Client functionality using `erc7715ProviderActions`. These actions enable you to request Advanced Permissions from the user.

```

import { createWalletClient, custom } from "viem";

import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";

const walletClient = createWalletClient({

  transport: custom(window.ethereum),

}).extend(erc7715ProviderActions());

```

### 2. Set up a Public Client​

Set up a [Viem Public Client](https://viem.sh/docs/clients/public) using Viem's `createPublicClient` function.

This client will help you query the account state and interact with the blockchain network.

```

import { createPublicClient, http } from "viem";

import { sepolia as chain } from "viem/chains";

 

const publicClient = createPublicClient({

  chain,

  transport: http(),

});

```

### 3. Set up a session account​

Set up a session account which can either be a smart account or an externally owned account (EOA)

to request Advanced Permissions. The requested permissions are granted to the session account, which

is responsible for executing transactions on behalf of the user.

```

import { privateKeyToAccount } from "viem/accounts";

import { 

  toMetaMaskSmartAccount, 

  Implementation 

} from "@metamask/smart-accounts-kit";

const privateKey = "0x...";

const account = privateKeyToAccount(privateKey);

const sessionAccount = await toMetaMaskSmartAccount({

  client: publicClient,

  implementation: Implementation.Hybrid,

  deployParams: [account.address, [], [], []],

  deploySalt: "0x",

  signer: { account },

});

```

### 4. Check the EOA account code​

Advanced Permissions support the automatic upgrading of a MetaMask user's account to a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/),

when using MetaMask Flask version 13.9.0 or later. For earlier versions, you must ensure that the

user is upgraded to a smart account before requesting Advanced Permissions.

If the user has not yet been upgraded, you can handle the upgrade [programmatically](https://docs.metamask.io/wallet/how-to/send-transactions/send-batch-transactions/#about-atomic-batch-transactions) or ask the

user to [switch to a smart account manually](https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account/#how-to-switch-to-a-metamask-smart-account).

MetaMask's Advanced Permissions (ERC-7115) implementation requires the user to be upgraded to a MetaMask

Smart Account because, under the hood, you're requesting a signature for an [ERC-7710 delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/).

ERC-7710 delegation is one of the core features supported only by MetaMask Smart Accounts.

```

import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

import { sepolia as chain } from "viem/chains";

const addresses = await walletClient.requestAddresses();

const address = addresses[0];

// Get the EOA account code

const code = await publicClient.getCode({

  address,

});

if (code) {

  // The address to which EOA has delegated. According to EIP-7702, 0xef0100 || address

  // represents the delegation. 

  // 

  // You need to remove the first 8 characters (0xef0100) to get the delegator address.

  const delegatorAddress = `0x${code.substring(8)}`;

  const statelessDelegatorAddress = getSmartAccountsEnvironment(chain.id)

  .implementations

  .EIP7702StatelessDeleGatorImpl;

  // If account is not upgraded to MetaMask smart account, you can

  // either upgrade programmatically or ask the user to switch to a smart account manually.

  const isAccountUpgraded = delegatorAddress.toLowerCase() === statelessDelegatorAddress.toLowerCase();

}

```

### 5. Request Advanced Permissions​

Request Advanced Permissions from the user using the Wallet Client's `requestExecutionPermissions` action.

In this example, you'll request an

[ERC-20 periodic permission](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/#erc-20-periodic-permission).

See the [requestExecutionPermissions](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#requestexecutionpermissions) API reference for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

// Since current time is in seconds, we need to convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // The requested permissions will granted to the

      // session account.

      address: sessionAccount.address,

    },

  },

  permission: {

    type: "erc20-token-periodic",

    data: {

      tokenAddress,

      // 1 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6

      periodAmount: parseUnits("10", 6),

      // 1 day in seconds

      periodDuration: 86400,

      justification?: "Permission to transfer 1 USDC every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

### 6. Set up a Viem client​

Set up a Viem client depending on your session account type.

For a smart account, set up a [Viem Bundler Client](https://viem.sh/account-abstraction/clients/bundler)

using Viem's `createBundlerClient` function. This lets you use the bundler service

to estimate gas for user operations and submit transactions to the network.

For an EOA, set up a [Viem Wallet Client](https://viem.sh/docs/clients/wallet)

using Viem's `createWalletClient` function. This lets you send transactions directly to the network.

The toolkit provides public actions for both of the clients which can be used to redeem Advanced Permissions, and execute transactions on a user's behalf.

```

import { createBundlerClient } from "viem/account-abstraction";

import { erc7710BundlerActions } from "@metamask/smart-accounts-kit/actions";

const bundlerClient = createBundlerClient({

  client: publicClient,

  transport: http("https://your-bundler-rpc.com"),

  // Allows you to use the same Bundler Client as paymaster.

  paymaster: true

}).extend(erc7710BundlerActions());

```

### 7. Redeem Advanced Permissions​

The session account can now redeem the permissions. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on the user's behalf.

To redeem the permissions, use the client action based on your session account type.

A smart account uses the Bundler Client's `sendUserOperationWithDelegation` action,

and an EOA uses the Wallet Client's `sendTransactionWithDelegation` action.

See the [sendUserOperationWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/bundler-client/#senduseroperationwithdelegation) and [sendTransactionWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#sendtransactionwithdelegation) API reference for more information.

```

import { calldata } from "./config.ts";

// These properties must be extracted from the permission response.

const permissionsContext = grantedPermissions[0].context;

const delegationManager = grantedPermissions[0].signerMeta.delegationManager;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// Calls without permissionsContext and delegationManager will be executed 

// as a normal user operation.

const userOperationHash = await bundlerClient.sendUserOperationWithDelegation({

  publicClient,

  account: sessionAccount,

  calls: [

    {

      to: tokenAddress,

      data: calldata,

      permissionsContext,

      delegationManager,

    },

  ],

  // Appropriate values must be used for fee-per-gas. 

  maxFeePerGas: 1n,

  maxPriorityFeePerGas: 1n,

});

```

## Next steps​

See how to configure different [ERC-20 token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/) and

[native token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/native-token/).

# Use ERC-20 token permissions

[Advanced Permissions (ERC-7715)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) supports ERC-20 token permission types that allow you to request fine-grained

permissions for ERC-20 token transfers with time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a session account.](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/#3-set-up-a-session-account)

## ERC-20 periodic permission​

This permission type ensures a per-period limit for ERC-20 token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 10 USDC on their behalf each day. The dapp can transfer a total of

10 USDC per day; the limit resets at the beginning of the next day.

See the [ERC-20 periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-periodic-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "erc20-token-periodic",

    data: {

      tokenAddress,

      // 10 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6.

      periodAmount: parseUnits("10", 6),

      // 1 day in seconds.

      periodDuration: 86400,

      justification?: "Permission to transfer 1 USDC every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

## ERC-20 stream permission​

This permission type ensures a linear streaming transfer limit for ERC-20 tokens. Token transfers are blocked until the

defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the

configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.1 USDC per second, starting with an initial amount

of 1 USDC, up to a maximum of 2 USDC.

See the [ERC-20 stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-stream-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseUnits } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

// USDC address on Ethereum Sepolia.

const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "erc20-token-stream",

    data: {

      tokenAddress,

      // 0.1 USDC in WEI format. Since USDC has 6 decimals, 0.1 * 10^6.

      amountPerSecond: parseUnits("0.1", 6),

      // 1 USDC in WEI format. Since USDC has 6 decimals, 1 * 10^6.

      initialAmount: parseUnits("1", 6),

      // 2 USDC in WEI format. Since USDC has 6 decimals, 2 * 10^6.

      maxAmount: parseUnits("2", 6),

      startTime: currentTime,

      justification: "Permission to use 0.1 USDC per second",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

# Use native token permissions

[Advanced Permissions (ERC-7115)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/) supports native token permission types that allow you to request fine-grained

permissions for native token transfers with time-based (periodic) or streaming conditions, depending on your use case.

## Prerequisites​

- [Install and set up the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/get-started/install/)

- [Configure the Smart Accounts Kit.](https://docs.metamask.io/smart-accounts-kit/guides/configure-toolkit/)

- [Create a session account.](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/#3-set-up-a-session-account)

## Native token periodic permission​

This permission type ensures a per-period limit for native token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 0.001 ETH on their behalf each day. The dapp can transfer a total of

0.001 USDC per day; the limit resets at the beginning of the next day.

See the [native token periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-periodic-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseEther } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "native-token-periodic",

    data: {

      // 0.001 ETH in wei format.

      periodAmount: parseEther("0.001"),

      // 1 hour in seconds.

      periodDuration: 86400,

      startTime: currentTime,

      justification: "Permission to use 0.001 ETH every day",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

## Native token stream permission​

This permission type ensures a linear streaming transfer limit for native tokens. Token transfers are blocked until the

defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the

configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.0001 ETH per second, starting with an initial amount

of 0.1 ETH, up to a maximum of 1 ETH.

See the [native token stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-stream-permission) for more information.

```

import { sepolia as chain } from "viem/chains";

import { parseEther } from "viem";

import { walletClient } from "./client.ts"

// Since current time is in seconds, convert milliseconds to seconds.

const currentTime = Math.floor(Date.now() / 1000);

// 1 week from now.

const expiry = currentTime + 604800;

const grantedPermissions = await walletClient.requestExecutionPermissions([{

  chainId: chain.id,

  expiry,

  signer: {

    type: "account",

    data: {

      // Session account created as a prerequisite.

      //

      // The requested permissions will granted to the

      // session account.

      address: sessionAccountAddress,

    },

  },

  permission: {

    type: "native-token-stream",

    data: {

      // 0.0001 ETH in wei format.

      amountPerSecond: parseEther("0.0001"),

      // 0.1 ETH in wei format.

      initialAmount: parseEther("0.1"),

      // 1 ETH in wei format.

      maxAmount: parseEther("1"),

      startTime: currentTime,

      justification: "Permission to use 0.0001 ETH per second",

    },

  },

  isAdjustmentAllowed: true,

}]);

```

# Send your first gasless transaction

A paymaster is a vital component in the ERC-4337 standard, responsible for covering transaction costs on behalf of the user. There are various types of paymasters, such as gasless paymasters, ERC-20 paymasters, and more.

In this guide, we'll talk about how you can use the Pimlico gasless Paymaster with Web3Auth Account Abstraction Provider to sponsor the transaction for your users without requiring the user to pay gas fees.

For those who want to skip straight to the code, you can find it on [GitHub](https://github.com/Web3Auth/web3auth-examples/tree/main/other/smart-account-example).

## Prerequisites​

- Pimlico Account: Since we'll be using the Pimlico paymaster, you'll need to have an API key from Pimlico. You can get a free API key from [Pimlico Dashboard](https://dashboard.pimlico.io/).

- Web3Auth Dashboard: If you haven't already, sign up on the Web3Auth platform. It is free and gives you access to the Web3Auth's base plan. Head to Web3Auth's documentation page for detailed [instructions on setting up the Web3Auth Dashboard](https://docs.metamask.io/embedded-wallets/dashboard/).

- Web3Auth PnP Web SDK: This guide assumes that you already know how to integrate the PnP Web SDK in your project. If not, you can learn how to [integrate Web3Auth in your Web app](https://docs.metamask.io/embedded-wallets/sdk/react/).

## Integrate AccountAbstractionProvider​

Once, you have set up the Web3Auth Dashboard, and created a new project, it's time to integrate Web3Auth Account Abstraction Provider in your Web application. For the implementation, we'll use the [@web3auth/account-abstraction-provider](https://www.npmjs.com/package/@web3auth/account-abstraction-provider). The provider simplifies the entire process by managing the complex logic behind configuring the account abstraction provider, bundler, and preparing user operations.

If you are already using the Web3Auth Pnp SDK in your project, you just need to configure the AccountAbstractionProvider with the paymaster details, and pass it to the Web3Auth instance. No other changes are required.

### Installation​

```

npm install --save @web3auth/account-abstraction-provider

```

### Configure Paymaster​

The AccountAbstractionProvider requires specific configurations to function correctly. One key configuration is the paymaster. Web3Auth supports custom paymaster configurations, allowing you to deploy your own paymaster and integrate it with the provider.

You can choose from a variety of paymaster services available in the ecosystem. In this guide, we'll be configuring the Pimlico's paymaster. However, it's important to note that paymaster support is not limited to the Pimlico, giving you the flexibility to integrate any compatible paymaster service that suits your requirements.

For the simplicity, we have only use `SafeSmartAccount`, but you choose your favorite smart account provider from the available ones. [Learn how to configure the smart account](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/smart-accounts/).

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from '@web3auth/account-abstraction-provider'

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: '0xaa36a7',

  rpcTarget: 'https://rpc.sepolia.org',

  displayName: 'Ethereum Sepolia Testnet',

  blockExplorerUrl: 'https://sepolia.etherscan.io',

  ticker: 'ETH',

  tickerName: 'Ethereum',

  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',

}

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

    smartAccountInit: new SafeSmartAccount(),

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

})

```

## Configure Web3Auth​

Once you have configured your `AccountAbstractionProvider`, you can now plug it in your Web3Auth Modal/No Modal instance. If you are using the external wallets like MetaMask, Coinbase, etc, you can define whether you want to use the AccountAbstractionProvider, or EthereumPrivateKeyProvider by setting the `useAAWithExternalWallet` in `IWeb3AuthCoreOptions`.

If you are setting `useAAWithExternalWallet` to `true`, it'll create a new Smart Account for your user, where the signer/creator of the Smart Account would be the external wallet.

If you are setting `useAAWithExternalWallet` to `false`, it'll skip creating a new Smart Account, and directly use the external wallet to sign the transactions.

```

import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

import { Web3Auth } from "@web3auth/modal";

const privateKeyProvider = new EthereumPrivateKeyProvider({

  // Use the chain config we declared earlier

  config: { chainConfig },

});

const web3auth = new Web3Auth({

  clientId: "YOUR_WEB3AUTH_CLIENT_ID", // Pass your Web3Auth Client ID, ideally using an environment variable

  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,

  privateKeyProvider,

  // Use the account abstraction provider we configured earlier

  accountAbstractionProvider

  // This will allow you to use EthereumPrivateKeyProvider for

  // external wallets, while use the AccountAbstractionProvider

  // for Web3Auth embedded wallets.

  useAAWithExternalWallet: false,

});

```

## Configure Signer​

The Web3Auth Smart Account feature is compatible with popular signer SDKs, including wagmi, ethers, and viem. You can choose your preferred package to configure the signer.

You can retreive the provider to configure the signer from Web3Auth instance.

Wagmi does not require any special configuration to use the signer with smart accounts. Once you have set up your Web3Auth provider and connected your wallet, Wagmi's hooks (such as useSigner or useAccount) will automatically use the smart account as the signer. You can interact with smart accounts using Wagmi just like you would with a regular EOA (Externally Owned Account) signer—no additional setup is needed.

```

import { createWalletClient } from 'viem'

// Use your Web3Auth instance to retreive the provider.

const provider = web3auth.provider

const walletClient = createWalletClient({

  transport: custom(provider),

})

```

## Send a transaction​

Developers can use their preferred signer or Wagmi hooks to initiate on-chain transactions, while Web3Auth manages the creation and submission of the UserOperation. Only the `to`, `data`, and `value` fields need to be provided. Any additional parameters will be ignored and automatically overridden.

To ensure reliable execution, the bundler client sets maxFeePerGas and maxPriorityFeePerGas values. If custom values are required, developers can use the [Viem's BundlerClient](https://viem.sh/account-abstraction/clients/bundler#bundler-client) to manually construct and send the user operation.

Since Smart Accounts are deployed smart contracts, the user's first transaction also triggers the on-chain deployment of their wallet.

```

import { useSendTransaction } from 'wagmi'

const { data: hash, sendTransaction } = useSendTransaction()

// Convert 1 ether to WEI format

const value = web3.utils.toWei(1)

sendTransaction({ to: 'DESTINATION_ADDRESS', value, data: '0x' })

const {

  data: receipt,

  isLoading: isConfirming,

  isSuccess: isConfirmed,

} = useWaitForTransactionReceipt({

  hash,

})

```

## Conclusion​

Voila, you have successfully sent your first gasless transaction using the Pimlico paymaster with Web3Auth Account Abstraction Provider. To learn more about advance features of the Account Abstraction Provider like performing batch transactions, using ERC-20 paymaster you can refer to the [Account Abstraction Provider](https://docs.metamask.io/embedded-wallets/sdk/react/) documentation.

# Smart Accounts

Effortlessly create and manage smart accounts for your users with just a few lines of code, using our Smart Account feature. Smart accounts offer enhanced control and programmability, enabling powerful features that traditional wallets can't provide.

**Key features of Smart Accounts include:**

- **Gas Abstraction:** Cover transaction fees for users, or allow users to pay for their own transactions using ERC-20 tokens.

- **Batch Transactions:** Perform multiple transactions in a single call.

- **Automated Transactions:** Allow users to automate actions, like swapping ETH to USDT when ETH hits a specific price.

- **Custom Spending Limits:** Allow users to set tailored spending limits.

> For more information about ERC-4337 and its components, check out our detailed blog post.

For more information about ERC-4337 and its components, [check out our detailed blog post](https://blog.web3auth.io/an-ultimate-guide-to-web3-wallets-externally-owned-account-and-smart-contract-wallet/#introduction-to-eip-4337).

Our smart account integration streamlines your setup, allowing you to create and manage smart accounts using your favorite libraries like Viem, Ethers, and Wagmi. You don't need to rely on third-party packages to effortlessly create ERC-4337 compatible Smart Contract Wallets (SCWs), giving users the ability to perform batch transactions and efficiently manage gas sponsorship.

This is a paid feature and the minimum [pricing plan](https://web3auth.io/pricing.html) to use this

SDK in a production environment is the **Growth Plan**. You can use this feature in Web3Auth

Sapphire Devnet network for free.

## Enabling Smart Accounts​

To enable this feature, you need to configure Smart Accounts from your project in the [Web3Auth Developer Dashboard](https://dashboard.web3auth.io/).

### Dashboard Configuration​

To enable Smart Accounts, navigate to the Smart Accounts section in the Web3Auth dashboard, and enable the "Set up Smart Accounts" toggle. Web3Auth currently supports [MetaMaskSmartAccount](https://docs.gator.metamask.io/how-to/create-delegator-account#create-a-metamasksmartaccount) as a Smart Account provider.

## Installation​

To use native account abstraction, you'll need to install the

[@web3auth/account-abstraction-provider](https://www.npmjs.com/package/@web3auth/account-abstraction-provider),

which allows you to create and interact with Smart Contract Wallets (SCWs). This provider simplifies

the entire process by managing the complex logic behind configuring the account abstraction

provider, bundler, and preparing user operations.

```

npm install --save @web3auth/account-abstraction-provider

```

## Configure​

When instantiating the Account Abstraction Provider, you can pass configuration objects to the

constructor. These configuration options allow you to select the desired Account Abstraction (AA)

provider, as well as configure the bundler and paymaster, giving you flexibility and control over

the provider.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

Please note this is the important step for setting the Web3Auth account abstraction provider.

- [Configure Smart Account provider](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#configure-smart-account-provider)

- [Configure Bundler](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#configure-bundler)

- [Configure Sponsored Paymaster](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#sponsored-paymaster)

- [Configure ERC-20 Paymaster](https://docs.metamask.io/embedded-wallets/sdk/react-native/advanced/smart-accounts#erc-20-paymaster)

## Configure Smart Account Provider​

Web3Auth offers the flexibility to choose your preferred Account Abstraction (AA) provider.

Currently, we support Safe, Kernel, Biconomy, and Trust.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Configure Bundler​

Web3Auth enables you to configure your bundler and define the paymaster context. The bundler

aggregates the UserOperations and submits them on-chain via a global entry point contract.

Bundler support is not limited to the examples below—you can use any bundler of your choice.

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Configure Paymaster​

You can configure the paymaster of your choice to sponsor gas fees for your users, along with the paymaster context. The paymaster context lets you set additional parameters, such as choosing the token for ERC-20 paymasters, defining gas policies, and more.

### Sponsored Paymaster​

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    smartAccountInit: new SafeSmartAccount(),

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

### ERC-20 Paymaster​

When using an ERC-20 paymaster, ensure you include the approval transaction, as Web3Auth does not

handle the approval internally.

For Pimlico, you can specify the token you want to use in the paymasterContext. If you want to set

up sponsorship policies, you can define those in the paymasterContext as well.

[Checkout the supported tokens for ERC-20 Paymaster on Pimlico](https://docs.pimlico.io/infra/paymaster/erc20-paymaster/supported-tokens).

```

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from "@web3auth/account-abstraction-provider";

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: "0xaa36a7",

  rpcTarget: "https://rpc.sepolia.org",

  displayName: "Ethereum Sepolia Testnet",

  blockExplorerUrl: "https://sepolia.etherscan.io",

  ticker: "ETH",

  tickerName: "Ethereum",

  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",

};

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

      paymasterContext: {

        token: "SUPPORTED_TOKEN_CONTRACT_ADDRESS",

      },

    },

    smartAccountInit: new SafeSmartAccount(),

    paymasterConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`,

    },

  },

});

```

## Set up​

### Configure Web3Auth Instance​

```

import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider'

import {

  AccountAbstractionProvider,

  SafeSmartAccount,

} from '@web3auth/account-abstraction-provider'

import Web3Auth, { WEB3AUTH_NETWORK } from '@web3auth/react-native-sdk'

import * as WebBrowser from '@toruslabs/react-native-web-browser'

import EncryptedStorage from 'react-native-encrypted-storage'

import { CHAIN_NAMESPACES } from '@web3auth/base'

const chainConfig = {

  chainNamespace: CHAIN_NAMESPACES.EIP155,

  chainId: '0xaa36a7',

  rpcTarget: 'https://rpc.sepolia.org',

  displayName: 'Ethereum Sepolia Testnet',

  blockExplorerUrl: 'https://sepolia.etherscan.io',

  ticker: 'ETH',

  tickerName: 'Ethereum',

  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',

}

const accountAbstractionProvider = new AccountAbstractionProvider({

  config: {

    chainConfig,

    bundlerConfig: {

      // Get the pimlico API Key from dashboard.pimlico.io

      url: `https://api.pimlico.io/v2/11155111/rpc?apikey=${pimlicoAPIKey}`,

    },

    smartAccountInit: new SafeSmartAccount(),

  },

})

const privateKeyProvider = new EthereumPrivateKeyProvider({

  config: { chainConfig },

})

const web3auth = new Web3Auth(WebBrowser, EncryptedStorage, {

  clientId,

  redirectUrl,

  network: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET, // or other networks

  privateKeyProvider,

  accountAbstractionProvider: aaProvider,

})

```

### Configure Signer​

The Web3Auth Smart Account feature is compatible with popular signer SDKs, including wagmi, ethers,

and viem. You can choose your preferred package to configure the signer.

You can retreive the provider to configure the signer from Web3Auth instance.

Wagmi does not require any special configuration to use the signer with smart accounts. Once you

have set up your Web3Auth provider and connected your wallet, Wagmi's hooks (such as useSigner or

useAccount) will automatically use the smart account as the signer. You can interact with smart

accounts using Wagmi just like you would with a regular EOA (Externally Owned Account) signer—no

additional setup is needed.

```

import { createWalletClient } from "viem";

// Use your Web3Auth instance to retreive the provider.

const provider = web3auth.provider;

const walletClient = createWalletClient({

  transport: custom(provider),

});

```

## Smart Account Address​

Once the signers or Wagmi configuration is set up, it can be used to retrieve the user's Smart

Account address.

```

import { useAccount } from "wagmi";

const { address } = useAccount();

const smartAccountAddress = address;

```

## Send Transaction​

Developers can use their preferred signer or Wagmi hooks to initiate on-chain transactions, while

Web3Auth manages the creation and submission of the UserOperation. Only the `to`, `data`, and

`value` fields need to be provided. Any additional parameters will be ignored and automatically

overridden.

To ensure reliable execution, the bundler client sets maxFeePerGas and maxPriorityFeePerGas values.

If custom values are required, developers can use the

[Viem's BundlerClient](https://viem.sh/account-abstraction/clients/bundler#bundler-client) to

manually construct and send the user operation.

Since Smart Accounts are deployed smart contracts, the user's first transaction also triggers the

on-chain deployment of their wallet.

```

import { useSendTransaction } from "wagmi";

const { data: hash, sendTransaction } = useSendTransaction();

// Convert 1 ether to WEI format

const value = web3.utils.toWei(1);

sendTransaction({ to: "DESTINATION_ADDRESS", value, data: "0x" });

const {

  data: receipt,

  isLoading: isConfirming,

  isSuccess: isConfirmed,

} = useWaitForTransactionReceipt({

  hash,

});

```

## Advanced Smart Account Operations​

To learn more about supported transaction methods, and how to perform batch transactions, [checkout our detailed documentation of AccountAbstractionProvider](https://docs.metamask.io/embedded-wallets/sdk/react/).

# Advanced Permissions (ERC-7715)

The Smart Accounts Kit supports Advanced Permissions ([ERC-7715](https://eips.ethereum.org/EIPS/eip-7715)), which lets you request fine-grained permissions from a MetaMask user to execute transactions on their behalf.

For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course of a month.

Once the permission is granted, your dapp can use the allocated 10 USDC each day to purchase ETH directly from the MetaMask user's account.

Advanced Permissions eliminate the need for users to approve every transaction, which is useful for highly interactive dapps.

It also enables dapps to execute transactions for users without an active wallet connection.

This feature requires [MetaMask Flask 13.5.0](https://docs.metamask.io/snaps/get-started/install-flask/) or later.

## ERC-7715 technical overview​

[ERC-7715](https://eips.ethereum.org/EIPS/eip-7715) defines a JSON-RPC method `wallet_grantPermissions`.

Dapps can use this method to request a wallet to grant the dapp permission to execute transactions on a user's behalf.

`wallet_grantPermissions` requires a `signer` parameter, which identifies the entity requesting or managing the permission.

Common signer implementations include wallet signers, single key and multisig signers, and account signers.

The Smart Accounts Kit supports multiple signer types. The documentation uses [an account signer](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/) as a common implementation example.

When you use an account signer, a session account is created solely to request and redeem Advanced Permissions, and doesn't contain tokens.

The session account can be granted with permissions and redeem them as specified in [ERC-7710](https://eips.ethereum.org/EIPS/eip-7710).

The session account can be a smart account or an externally owned account (EOA).

The MetaMask user that the session account requests permissions from must be upgraded to a [MetaMask smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/).

## Advanced Permissions vs. delegations​

Advanced Permissions expand on regular [delegations](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/) by enabling permission sharing *via the MetaMask browser extension*.

With regular delegations, the dapp constructs a delegation and requests the user to sign it.

These delegations are not human-readable, so it is the dapp's responsibility to provide context for the user.

Regular delegations cannot be signed through the MetaMask extension, because if a dapp requests a delegation without constraints, the whole wallet can be exposed to the dapp.

In contrast, Advanced Permissions enable dapps (and AI agents) to request permissions from a user directly via the MetaMask extension.

Advanced Permissions require a permission configuration which displays a human-readable confirmation for the MetaMask user.

The user can modify the permission parameters if the request is configured to allow adjustments.

For example, the following Advanced Permissions request displays a rich UI including the start time, amount, and period duration for an [ERC-20 token periodic transfer](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/#erc-20-periodic-permission):

## Advanced Permissions lifecycle​

The Advanced Permissions lifecycle is as follows:

1. **Set up a session account** - Set up a session account to execute transactions on behalf of the MetaMask user.

It can be a [smart account](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) or an externally owned account (EOA).

2. **Request permissions** - Request permissions from the user.

The Smart Accounts Kit supports [ERC-20 token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/erc20-token/) and

[native token permissions](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/native-token/).

3. **Redeem permissions** - Once the permission is granted, the session account can redeem the permission, executing on the user's behalf.

See [how to perform executions on a MetaMask user's behalf](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/) to get started with the Advanced Permissions lifecycle.