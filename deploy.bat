@echo off
REM Solana Contract Deployment Script for Windows
REM This script helps you deploy your contracts to Solana devnet

echo =========================================
echo Solana Contract Deployment Script
echo =========================================
echo.

REM Check if Solana CLI is installed
where solana >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Solana CLI not found
    echo Install from: https://docs.solana.com/cli/install-solana-cli-tools
    pause
    exit /b 1
)

REM Check if Anchor is installed
where anchor >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Anchor not found
    echo Install from: https://www.anchor-lang.com/docs/installation
    pause
    exit /b 1
)

echo [OK] All required tools found
echo.

REM Configure Solana for devnet
echo Configuring Solana for devnet...
solana config set --url devnet

REM Check if deployer keypair exists
if not exist "%USERPROFILE%\.config\solana\deployer.json" (
    echo Creating new deployer keypair...
    solana-keygen new --outfile "%USERPROFILE%\.config\solana\deployer.json"
)

solana config set --keypair "%USERPROFILE%\.config\solana\deployer.json"

echo.
echo Getting deployer address...
for /f "tokens=*" %%i in ('solana address') do set DEPLOYER_ADDRESS=%%i
echo Deployer address: %DEPLOYER_ADDRESS%
echo.

REM Check balance
echo Checking SOL balance...
for /f "tokens=1" %%i in ('solana balance') do set BALANCE=%%i
echo Current balance: %BALANCE% SOL
echo.

REM Request airdrops if balance is low
echo Note: If balance is low, please run these commands manually:
echo   solana airdrop 2
echo   (repeat 5 times or until you have 10+ SOL)
echo.
pause

echo.
echo Building contracts...
anchor clean
anchor build

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed
    echo Please fix the errors above and try again
    pause
    exit /b 1
)

echo [OK] Build successful
echo.

REM Extract program IDs
echo =========================================
echo Program IDs (SAVE THESE!):
echo =========================================
echo.

echo FUNDING_HUB:
for /f "tokens=*" %%i in ('solana-keygen pubkey target\deploy\funding_hub-keypair.json') do set FUNDING_HUB_ID=%%i
echo %FUNDING_HUB_ID%
echo.

echo DAO_PASS:
for /f "tokens=*" %%i in ('solana-keygen pubkey target\deploy\dao_pass-keypair.json') do set DAO_PASS_ID=%%i
echo %DAO_PASS_ID%
echo.

echo GOVERNANCE:
for /f "tokens=*" %%i in ('solana-keygen pubkey target\deploy\governance-keypair.json') do set GOVERNANCE_ID=%%i
echo %GOVERNANCE_ID%
echo.

echo SAVINGS_VAULT:
for /f "tokens=*" %%i in ('solana-keygen pubkey target\deploy\savings_vault-keypair.json') do set SAVINGS_VAULT_ID=%%i
echo %SAVINGS_VAULT_ID%
echo.

echo =========================================
echo.

echo IMPORTANT: Update declare_id^(^) in all 4 contracts with the IDs above
echo.
echo Files to update:
echo   - programs\funding_hub\src\lib.rs (line 9)
echo   - programs\dao_pass\src\lib.rs (line 5)
echo   - programs\governance\src\lib.rs (line 3)
echo   - programs\savings_vault\src\lib.rs (line 5)
echo.
echo Press any key once you've updated all 4 files...
pause

echo.
echo Rebuilding with updated program IDs...
anchor build

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Rebuild failed
    echo Make sure you updated the program IDs correctly
    pause
    exit /b 1
)

echo.
echo =========================================
echo Deploying to Solana devnet...
echo This may take 5-10 minutes...
echo =========================================
echo.

anchor deploy --provider.cluster devnet

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Deployment failed
    pause
    exit /b 1
)

echo.
echo =========================================
echo DEPLOYMENT SUCCESSFUL!
echo =========================================
echo.

REM Create .env.local
echo Creating .env.local file...
(
echo # Solana Network
echo NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
echo NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
echo.
echo # Deployed Program IDs
echo NEXT_PUBLIC_FUNDING_HUB_PROGRAM=%FUNDING_HUB_ID%
echo NEXT_PUBLIC_DAO_PASS_PROGRAM=%DAO_PASS_ID%
echo NEXT_PUBLIC_GOVERNANCE_PROGRAM=%GOVERNANCE_ID%
echo NEXT_PUBLIC_SAVINGS_VAULT_PROGRAM=%SAVINGS_VAULT_ID%
) > .env.local

echo [OK] .env.local created
echo.

echo =========================================
echo DEPLOYMENT COMPLETE!
echo =========================================
echo.
echo Your program IDs:
echo   Funding Hub:   %FUNDING_HUB_ID%
echo   DAO Pass:      %DAO_PASS_ID%
echo   Governance:    %GOVERNANCE_ID%
echo   Savings Vault: %SAVINGS_VAULT_ID%
echo.
echo Next steps:
echo   1. Test your contracts via the frontend
echo   2. Run: npm run dev
echo   3. Open: http://localhost:3000
echo   4. Make sure Phantom wallet is set to DEVNET
echo.
echo View your programs on Solana Explorer:
echo   https://explorer.solana.com/address/%FUNDING_HUB_ID%?cluster=devnet
echo.
echo Happy testing!
echo.
pause
