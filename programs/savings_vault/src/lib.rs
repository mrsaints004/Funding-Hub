use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("HSnBJMRi1uipcnGeSRcM7kCD1DegertD93CgtKmn18tN");

#[program]
pub mod savings_vault {
    use super::*;

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        vault_id: [u8; 8],
        term_slots: u64,
        apy_bps: u16,
    ) -> Result<()> {
        require!(term_slots > 0, VaultError::InvalidTerm);
        require!(apy_bps <= 10_000, VaultError::InvalidApy);

        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.vault_id = vault_id;
        vault.deposit_mint = ctx.accounts.deposit_mint.key();
        vault.reward_mint = ctx.accounts.reward_mint.key();
        vault.vault_token_account = ctx.accounts.vault_token_account.key();
        vault.reward_vault = ctx.accounts.reward_vault.key();
        vault.term_slots = term_slots;
        vault.apy_bps = apy_bps;
        vault.total_deposited = 0;
        vault.bump = ctx.bumps.vault;

        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::InvalidAmount);

        let vault = &ctx.accounts.vault;
        require_keys_eq!(vault.deposit_mint, ctx.accounts.user_token_account.mint, VaultError::MintMismatch);

        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;

        let clock = Clock::get()?;
        let deposit = &mut ctx.accounts.deposit;
        deposit.vault = vault.key();
        deposit.owner = ctx.accounts.user.key();
        deposit.amount = deposit
            .amount
            .checked_add(amount)
            .ok_or(VaultError::MathOverflow)?;
        deposit.start_slot = clock.slot;
        deposit.unlock_slot = clock
            .slot
            .checked_add(vault.term_slots)
            .ok_or(VaultError::MathOverflow)?;
        deposit.claimed = false;

        let vault_mut = &mut ctx.accounts.vault;
        vault_mut.total_deposited = vault_mut
            .total_deposited
            .checked_add(amount)
            .ok_or(VaultError::MathOverflow)?;

        deposit.bump = ctx.bumps.deposit;

        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let vault = &ctx.accounts.vault;
        let deposit = &mut ctx.accounts.deposit;

        require!(!deposit.claimed, VaultError::AlreadyClaimed);
        require_keys_eq!(deposit.owner, ctx.accounts.user.key(), VaultError::Unauthorized);
        require_keys_eq!(deposit.vault, vault.key(), VaultError::VaultMismatch);

        let clock = Clock::get()?;
        require!(clock.slot >= deposit.unlock_slot, VaultError::VaultLocked);

        let principal = deposit.amount;
        let reward = calculate_reward(principal, vault.apy_bps, vault.term_slots, SLOTS_PER_YEAR_ESTIMATE)?;

        let signer_seeds: &[&[&[u8]]] = &[
            &[
                Vault::SEED_PREFIX,
                vault.authority.as_ref(),
                &vault.vault_id,
                &[vault.bump],
            ]
        ];

        let transfer_principal = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_principal, principal)?;

        if reward > 0 {
            let transfer_reward = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.reward_vault.to_account_info(),
                    to: ctx.accounts.user_reward_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            );
            token::transfer(transfer_reward, reward)?;
        }

        deposit.claimed = true;

        Ok(())
    }
}

fn calculate_reward(amount: u64, apy_bps: u16, term_slots: u64, slots_per_year: u64) -> Result<u64> {
    if apy_bps == 0 || term_slots == 0 {
        return Ok(0);
    }
    let amount_u128 = amount as u128;
    let apy = apy_bps as u128;
    let term_ratio = term_slots as u128;
    let yearly = slots_per_year.max(1) as u128;

    let reward = amount_u128
        .checked_mul(apy)
        .and_then(|val| val.checked_mul(term_ratio))
        .and_then(|val| val.checked_div(10_000))
        .and_then(|val| val.checked_div(yearly))
        .ok_or(VaultError::MathOverflow)?;

    Ok(reward as u64)
}

pub const SLOTS_PER_YEAR_ESTIMATE: u64 = 63_072_000; // approx slots in a year at 0.5s per slot

#[derive(Accounts)]
#[instruction(vault_id: [u8; 8])]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = Vault::LEN,
        seeds = [Vault::SEED_PREFIX, authority.key().as_ref(), &vault_id],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub deposit_mint: Account<'info, Mint>,
    pub reward_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = deposit_mint,
        associated_token::authority = vault
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = reward_mint,
        associated_token::authority = vault
    )]
    pub reward_vault: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [Vault::SEED_PREFIX, vault.authority.as_ref(), &vault.vault_id],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init_if_needed,
        payer = user,
        space = DepositReceipt::LEN,
        seeds = [DepositReceipt::SEED_PREFIX, vault.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub deposit: Account<'info, DepositReceipt>,
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ VaultError::Unauthorized,
        constraint = user_token_account.mint == vault.deposit_mint @ VaultError::MintMismatch
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = vault_token_account.key() == vault.vault_token_account @ VaultError::VaultMismatch
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [Vault::SEED_PREFIX, vault.authority.as_ref(), &vault.vault_id],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [DepositReceipt::SEED_PREFIX, vault.key().as_ref(), user.key().as_ref()],
        bump = deposit.bump
    )]
    pub deposit: Account<'info, DepositReceipt>,
    #[account(
        mut,
        constraint = vault_token_account.key() == vault.vault_token_account @ VaultError::VaultMismatch
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = reward_vault.key() == vault.reward_vault @ VaultError::VaultMismatch
    )]
    pub reward_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ VaultError::Unauthorized,
        constraint = user_token_account.mint == vault.deposit_mint @ VaultError::MintMismatch
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = user_reward_account.owner == user.key() @ VaultError::Unauthorized,
        constraint = user_reward_account.mint == vault.reward_mint @ VaultError::MintMismatch
    )]
    pub user_reward_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Vault {
    pub authority: Pubkey,
    pub vault_id: [u8; 8],
    pub deposit_mint: Pubkey,
    pub reward_mint: Pubkey,
    pub vault_token_account: Pubkey,
    pub reward_vault: Pubkey,
    pub term_slots: u64,
    pub apy_bps: u16,
    pub total_deposited: u64,
    pub bump: u8,
    pub reserved: [u8; 5],
}

impl Vault {
    pub const LEN: usize = 8 // discriminator
        + 32
        + 8
        + 32
        + 32
        + 32
        + 32
        + 8
        + 2
        + 8
        + 1
        + 5;
    pub const SEED_PREFIX: &'static [u8] = b"vault";
}

#[account]
pub struct DepositReceipt {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub start_slot: u64,
    pub unlock_slot: u64,
    pub claimed: bool,
    pub bump: u8,
    pub reserved: [u8; 7],
}

impl DepositReceipt {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 7;
    pub const SEED_PREFIX: &'static [u8] = b"deposit";
}

#[error_code]
pub enum VaultError {
    #[msg("Invalid term")]
    InvalidTerm,
    #[msg("Invalid APY")]
    InvalidApy,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Mint mismatch")]
    MintMismatch,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Deposit already claimed")]
    AlreadyClaimed,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Deposit still locked")]
    VaultLocked,
    #[msg("Vault mismatch")]
    VaultMismatch,
    #[msg("Bump missing")]
    BumpNotFound,
}
