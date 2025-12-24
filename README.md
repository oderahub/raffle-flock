# STX Raffle

Provably fair lottery system built with **Clarity 4** (Epoch 3.3) and **Next.js 15.1.0**.

**🔗 Built with WalletConnect SDK for seamless Stacks wallet integration.**

## Features

- ✅ Create raffles with time-based endings (uses `stacks-block-time`)
- ✅ Buy multiple tickets
- ✅ Provably fair winner selection
- ✅ 2% platform fee on prize pool
- ✅ **WalletConnect SDK integration** with QR code modal support

## Wallet Integration

This project uses **WalletConnect v2 SignClient** for wallet connectivity:

- **QR Code Modal**: Scan with Xverse, Leather, or any WalletConnect-enabled Stacks wallet
- **Session Persistence**: Wallet stays connected across page refreshes
- **Multi-Wallet Support**: Works with 600+ wallets via WalletConnect protocol
- **Transaction Signing**: Uses `stacks_contractCall` RPC method for contract interactions
- **Project ID Required**: Get yours at [cloud.walletconnect.com](https://cloud.walletconnect.com)

**Dependencies:**
- `@walletconnect/sign-client` - Core WalletConnect v2 client
- `@walletconnect/qrcode-modal` - QR code display for mobile wallet scanning
- `@walletconnect/types`, `@walletconnect/utils`, `@walletconnect/encoding` - Supporting libraries

## Clarity 4 Features Used

- `stacks-block-time` - Real Unix timestamps for raffle timing
- `to-ascii` - Convert principals to strings for logging

## Quick Start

### 1. Test Contract

```bash
clarinet check
clarinet console
```

### 2. Deploy Contract

```bash
clarinet deployments generate --mainnet
clarinet deployments apply -p mainnet
```

### 3. Configure WalletConnect

1. Visit [WalletConnect Cloud](https://cloud.walletconnect.com) and create an account
2. Create a new project
3. Copy your Project ID
4. Create `frontend/.env.local`:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_CONTRACT_ADDRESS=SP_YOUR_DEPLOYED_ADDRESS
NEXT_PUBLIC_CONTRACT_NAME=raffle
```

**Note:** See `frontend/.env.example` for a template.

### 4. Run Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Deploy to Vercel

```bash
cd frontend
vercel --prod
```

## Contract Functions

| Function | Description |
|----------|-------------|
| `create-raffle` | Create new raffle with duration in seconds |
| `buy-tickets` | Buy tickets for a raffle |
| `draw-winner` | Draw winner after raffle ends |
| `cancel-raffle` | Cancel raffle (creator only, no tickets sold) |

## Fee Structure

- **Platform Fee:** 2% of prize pool on winner draw

## Tech Stack

### Smart Contract
- Clarity 4 (Epoch 3.3)
- Clarinet

### Frontend
- Next.js 15.1.0
- React 19.0.0
- TypeScript 5.7.2
- TailwindCSS 3.4.17

### Wallet Integration (WalletConnect)
- **@walletconnect/sign-client** 2.13.0 - SignClient for session management
- **@walletconnect/qrcode-modal** 1.8.0 - QR code modal UI
- **@walletconnect/types** 2.13.0 - TypeScript types
- **@walletconnect/utils** 2.13.0 - Utility functions
- **@walletconnect/encoding** 1.0.2 - Encoding helpers

### Stacks Integration
- **@stacks/transactions** 6.17.0 - Transaction building and Clarity value serialization
- **@stacks/network** 6.17.0 - Network configuration

## Stacks Builder Challenge

Built for **Stacks Builder Challenge Week 3** showcasing:
- ✅ **WalletConnect SDK integration** for wallet connectivity
- ✅ Clarity 4 time-based features (`stacks-block-time`)
- ✅ Full-stack dApp architecture on Stacks
- ✅ Production-ready raffle system

## License

MIT
