#!/bin/bash

# Solana Contract Deployment Script
# This script helps you deploy your contracts to Solana devnet

set -e  # Exit on any error

echo "========================================="
echo "Solana Contract Deployment Script"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required tools are installed
echo "Checking required tools..."

if ! command -v solana &> /dev/null; then
    echo -e "${RED}ERROR: Solana CLI not found${NC}"
    echo "Install from: https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi

if ! command -v anchor &> /dev/null; then
    echo -e "${RED}ERROR: Anchor not found${NC}"
    echo "Install from: https://www.anchor-lang.com/docs/installation"
    exit 1
fi

echo -e "${GREEN}✓ All required tools found${NC}"
echo ""

# Configure Solana for devnet
echo "Configuring Solana for devnet..."
solana config set --url devnet

# Check if deployer keypair exists
if [ ! -f ~/.config/solana/deployer.json ]; then
    echo -e "${YELLOW}Creating new deployer keypair...${NC}"
    solana-keygen new --outfile ~/.config/solana/deployer.json
fi

solana config set --keypair ~/.config/solana/deployer.json

DEPLOYER_ADDRESS=$(solana address)
echo -e "${GREEN}Deployer address: $DEPLOYER_ADDRESS${NC}"
echo ""

# Check balance
BALANCE=$(solana balance | awk '{print $1}')
echo "Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 10" | bc -l) )); then
    echo -e "${YELLOW}Balance is low. Requesting airdrops...${NC}"
    for i in {1..5}; do
        echo "Airdrop attempt $i/5..."
        solana airdrop 2 || true
        sleep 2
    done
    BALANCE=$(solana balance | awk '{print $1}')
    echo "New balance: $BALANCE SOL"
fi

if (( $(echo "$BALANCE < 10" | bc -l) )); then
    echo -e "${RED}ERROR: Insufficient balance. Need at least 10 SOL${NC}"
    echo "Try manual airdrop: https://faucet.solana.com/"
    exit 1
fi

echo ""

# Clean and build
echo "Building contracts..."
anchor clean
anchor build

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Build failed${NC}"
    echo "Please fix the errors above and try again"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Extract program IDs
echo "========================================="
echo "Program IDs (save these!):"
echo "========================================="
echo ""
echo "FUNDING_HUB:"
FUNDING_HUB_ID=$(solana-keygen pubkey target/deploy/funding_hub-keypair.json)
echo $FUNDING_HUB_ID
echo ""

echo "DAO_PASS:"
DAO_PASS_ID=$(solana-keygen pubkey target/deploy/dao_pass-keypair.json)
echo $DAO_PASS_ID
echo ""

echo "GOVERNANCE:"
GOVERNANCE_ID=$(solana-keygen pubkey target/deploy/governance-keypair.json)
echo $GOVERNANCE_ID
echo ""

echo "SAVINGS_VAULT:"
SAVINGS_VAULT_ID=$(solana-keygen pubkey target/deploy/savings_vault-keypair.json)
echo $SAVINGS_VAULT_ID
echo ""

echo "========================================="
echo ""

# Ask user to confirm they've updated the program IDs
echo -e "${YELLOW}IMPORTANT:${NC} Have you updated the declare_id!() in all 4 contracts with the IDs above?"
echo "Files to update:"
echo "  - programs/funding_hub/src/lib.rs (line 9)"
echo "  - programs/dao_pass/src/lib.rs (line 5)"
echo "  - programs/governance/src/lib.rs (line 3)"
echo "  - programs/savings_vault/src/lib.rs (line 5)"
echo ""
read -p "Press Enter once you've updated all 4 files, or Ctrl+C to exit..."

echo ""
echo "Rebuilding with updated program IDs..."
anchor build

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Rebuild failed${NC}"
    echo "Make sure you updated the program IDs correctly"
    exit 1
fi

echo ""
echo "========================================="
echo "Deploying to Solana devnet..."
echo "This may take 5-10 minutes..."
echo "========================================="
echo ""

anchor deploy --provider.cluster devnet

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Deployment failed${NC}"
    exit 1
fi

echo ""
echo "========================================="
echo -e "${GREEN}✓ DEPLOYMENT SUCCESSFUL!${NC}"
echo "========================================="
echo ""

# Verify deployments
echo "Verifying deployments..."
echo ""

for PROGRAM_ID in "$FUNDING_HUB_ID" "$DAO_PASS_ID" "$GOVERNANCE_ID" "$SAVINGS_VAULT_ID"; do
    echo "Checking $PROGRAM_ID..."
    solana program show $PROGRAM_ID --url devnet
    echo ""
done

# Create .env.local
echo "Creating .env.local file..."
cat > .env.local << EOF
# Solana Network
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com

# Deployed Program IDs
NEXT_PUBLIC_FUNDING_HUB_PROGRAM=$FUNDING_HUB_ID
NEXT_PUBLIC_DAO_PASS_PROGRAM=$DAO_PASS_ID
NEXT_PUBLIC_GOVERNANCE_PROGRAM=$GOVERNANCE_ID
NEXT_PUBLIC_SAVINGS_VAULT_PROGRAM=$SAVINGS_VAULT_ID
EOF

echo -e "${GREEN}✓ .env.local created${NC}"
echo ""

echo "========================================="
echo "DEPLOYMENT COMPLETE!"
echo "========================================="
echo ""
echo "Your program IDs:"
echo "  Funding Hub:   $FUNDING_HUB_ID"
echo "  DAO Pass:      $DAO_PASS_ID"
echo "  Governance:    $GOVERNANCE_ID"
echo "  Savings Vault: $SAVINGS_VAULT_ID"
echo ""
echo "Next steps:"
echo "  1. Test your contracts via the frontend"
echo "  2. Run: npm run dev"
echo "  3. Open: http://localhost:3000"
echo "  4. Make sure Phantom wallet is set to DEVNET"
echo ""
echo "View your programs on Solana Explorer:"
echo "  https://explorer.solana.com/address/$FUNDING_HUB_ID?cluster=devnet"
echo ""
echo -e "${GREEN}Happy testing! 🚀${NC}"
