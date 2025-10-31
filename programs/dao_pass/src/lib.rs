use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

declare_id!("Dz9WAiHQDGLK8K8puZosdUux3UAJMRTKTfWJFqRve4Dk");

#[program]
pub mod dao_pass {
    use super::*;

    pub fn initialize_dao(
        ctx: Context<InitializeDao>,
        name_seed: [u8; 8],
        sponsor_mint: Pubkey,
        max_relay_spend: u64,
    ) -> Result<()> {
        require!(max_relay_spend > 0, DaoError::InvalidLimit);

        let dao = &mut ctx.accounts.dao;
        dao.authority = ctx.accounts.authority.key();
        dao.pass_mint = ctx.accounts.pass_mint.key();
        dao.sponsor_mint = sponsor_mint;
        dao.sponsor_vault = ctx.accounts.sponsor_vault.key();
        dao.max_relay_spend = max_relay_spend;
        dao.relay_epoch = Clock::get()?.slot;
        dao.relay_spent = 0;
        dao.total_members = 0;
        dao.bump = ctx.bumps.dao;
        dao.name_seed = name_seed;

        Ok(())
    }

    pub fn issue_pass(ctx: Context<IssuePass>) -> Result<()> {
        let dao_bump;
        let dao_authority;
        let dao_name_seed;
        let dao_key;

        {
            let dao = &mut ctx.accounts.dao;
            require_keys_eq!(dao.pass_mint, ctx.accounts.pass_mint.key(), DaoError::MintMismatch);

            dao_bump = dao.bump;
            dao_authority = dao.authority;
            dao_name_seed = dao.name_seed;
            dao_key = dao.key();
        } // dao mutable borrow ends here

        let signer_seeds: &[&[&[u8]]] = &[
            &[
                Dao::SEED_PREFIX,
                dao_authority.as_ref(),
                &dao_name_seed,
                &[dao_bump],
            ]
        ];

        let mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.pass_mint.to_account_info(),
                to: ctx.accounts.member_pass_account.to_account_info(),
                authority: ctx.accounts.dao.to_account_info(),
            },
            signer_seeds,
        );

        token::mint_to(mint_ctx, 1)?;

        let member = &mut ctx.accounts.member;
        if member.membership_mint == Pubkey::default() {
            // This is a NEW member
            member.dao = dao_key;
            member.owner = ctx.accounts.member_wallet.key();
            member.membership_mint = ctx.accounts.pass_mint.key();
            member.member_pass_account = ctx.accounts.member_pass_account.key();
            member.joined_ts = Clock::get()?.unix_timestamp;

            // Only increment count for NEW members
            let dao = &mut ctx.accounts.dao;
            dao.total_members = dao
                .total_members
                .checked_add(1)
                .ok_or(DaoError::MathOverflow)?;
        }

        // Always increment mint count (tracks how many passes this member got)
        member.mint_count = member
            .mint_count
            .checked_add(1)
            .ok_or(DaoError::MathOverflow)?;

        Ok(())
    }

    pub fn configure_sponsor(ctx: Context<ConfigureSponsor>, new_cap: u64) -> Result<()> {
        require!(new_cap > 0, DaoError::InvalidLimit);

        let dao = &mut ctx.accounts.dao;
        dao.max_relay_spend = new_cap;
        dao.sponsor_vault = ctx.accounts.sponsor_vault.key();

        Ok(())
    }

    pub fn record_relay_spend(ctx: Context<RecordRelaySpend>, spend: u64) -> Result<()> {
        require!(spend > 0, DaoError::InvalidSpend);

        let dao = &mut ctx.accounts.dao;
        let clock = Clock::get()?;

        if clock.slot.saturating_sub(dao.relay_epoch) > RELAY_EPOCH_SLOTS {
            dao.relay_epoch = clock.slot;
            dao.relay_spent = 0;
        }

        dao.relay_spent = dao
            .relay_spent
            .checked_add(spend)
            .ok_or(DaoError::MathOverflow)?;
        require!(dao.relay_spent <= dao.max_relay_spend, DaoError::RelayBudgetExceeded);

        Ok(())
    }
}

pub const RELAY_EPOCH_SLOTS: u64 = 432_000; // ~12 hours on Solana (~0.4s per slot)

#[derive(Accounts)]
#[instruction(name_seed: [u8; 8])]
pub struct InitializeDao<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = Dao::LEN,
        seeds = [Dao::SEED_PREFIX, authority.key().as_ref(), &name_seed],
        bump
    )]
    pub dao: Account<'info, Dao>,
    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = dao,
        mint::freeze_authority = dao
    )]
    pub pass_mint: Account<'info, Mint>,
    /// CHECK: Sponsor vault can be any account controlled by the DAO authority
    pub sponsor_vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct IssuePass<'info> {
    pub authority: Signer<'info>,
    #[account(mut)]
    pub member_wallet: Signer<'info>,
    #[account(
        mut,
        has_one = authority @ DaoError::Unauthorized,
        seeds = [Dao::SEED_PREFIX, dao.authority.as_ref(), &dao.name_seed],
        bump = dao.bump
    )]
    pub dao: Account<'info, Dao>,
    #[account(mut)]
    pub pass_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = member_wallet,
        space = Member::LEN,
        seeds = [Member::SEED_PREFIX, dao.key().as_ref(), member_wallet.key().as_ref()],
        bump
    )]
    pub member: Account<'info, Member>,
    #[account(
        init_if_needed,
        payer = member_wallet,
        associated_token::mint = pass_mint,
        associated_token::authority = member_wallet
    )]
    pub member_pass_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ConfigureSponsor<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority @ DaoError::Unauthorized,
        seeds = [Dao::SEED_PREFIX, dao.authority.as_ref(), &dao.name_seed],
        bump = dao.bump
    )]
    pub dao: Account<'info, Dao>,
    /// CHECK: Verified via metadata off-chain / CPI
    pub sponsor_vault: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct RecordRelaySpend<'info> {
    #[account(
        mut,
        has_one = authority @ DaoError::Unauthorized,
        seeds = [Dao::SEED_PREFIX, dao.authority.as_ref(), &dao.name_seed],
        bump = dao.bump
    )]
    pub dao: Account<'info, Dao>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Dao {
    pub authority: Pubkey,
    pub pass_mint: Pubkey,
    pub sponsor_mint: Pubkey,
    pub sponsor_vault: Pubkey,
    pub max_relay_spend: u64,
    pub relay_spent: u64,
    pub relay_epoch: u64,
    pub total_members: u32,
    pub bump: u8,
    pub name_seed: [u8; 8],
    pub reserved: [u8; 7],
}

impl Dao {
    pub const LEN: usize = 8  // discriminator
        + 32  // authority
        + 32  // pass_mint
        + 32  // sponsor_mint
        + 32  // sponsor_vault
        + 8   // max_relay_spend
        + 8   // relay_spent
        + 8   // relay_epoch
        + 4   // total_members
        + 1   // bump
        + 8   // name_seed
        + 7;  // reserved
    pub const SEED_PREFIX: &'static [u8] = b"dao";

}

#[account]
pub struct Member {
    pub dao: Pubkey,
    pub owner: Pubkey,
    pub membership_mint: Pubkey,
    pub member_pass_account: Pubkey,
    pub joined_ts: i64,
    pub mint_count: u64,
    pub reserved: [u8; 16],
}

impl Member {
    pub const LEN: usize = 8 // discriminator
        + 32 // dao
        + 32 // owner
        + 32 // membership_mint
        + 32 // pass account
        + 8  // joined_ts
        + 8  // mint_count
        + 16; // reserved
    pub const SEED_PREFIX: &'static [u8] = b"member";
}

#[error_code]
pub enum DaoError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid limit")]
    InvalidLimit,
    #[msg("Invalid spend amount")]
    InvalidSpend,
    #[msg("Relay budget exceeded")]
    RelayBudgetExceeded,
    #[msg("Mint mismatch")]
    MintMismatch,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Bump missing")]
    BumpNotFound,
}
