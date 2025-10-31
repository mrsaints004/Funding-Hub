use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};
use mpl_token_metadata::ID as TOKEN_METADATA_ID;

declare_id!("B8gKYNx3LGJVpsAzY72ufrNJj6WZVf8KTodiz1Mex62u");

#[program]
pub mod funding_hub {
    use super::*;

    pub fn initialize_project(
        ctx: Context<InitializeProject>,
        project_id: u64,
        target_amount: u64,
        deadline_ts: i64,
        project_name: String,
        badge_symbol: String,
        badge_uri: String,
    ) -> Result<()> {
        // Validate string lengths to prevent DoS attacks
        require!(project_name.len() <= 100, FundingError::NameTooLong);
        require!(badge_symbol.len() <= 10, FundingError::SymbolTooLong);
        require!(badge_uri.len() <= 200, FundingError::UriTooLong);

        require!(target_amount > 0, FundingError::InvalidAmount);

        let clock = Clock::get()?;
        require!(deadline_ts > clock.unix_timestamp, FundingError::InvalidDeadline);

        require_keys_eq!(
            ctx.accounts.token_metadata_program.key(),
            TOKEN_METADATA_ID,
            FundingError::MetadataProgramMismatch
        );

        let project_id_bytes = project_id.to_le_bytes();

        let project = &mut ctx.accounts.project;
        project.project_id = project_id;
        project.project_id_seed = project_id_bytes;
        project.authority = ctx.accounts.authority.key();
        project.mint = ctx.accounts.mint.key();
        project.badge_mint = ctx.accounts.badge_mint.key();
        project.vault = ctx.accounts.project_vault.key();
        project.target_amount = target_amount;
        project.deadline_ts = deadline_ts;
        project.total_pledged = 0;
        project.status = ProjectStatus::Active;
        project.bump = ctx.bumps.project;
        let bump = project.bump;
        let project_id_bytes = project.project_id_seed;
        let authority_pubkey = project.authority;

        // Create metadata using mpl-token-metadata v4 API
        let metadata_ix = mpl_token_metadata::instructions::CreateV1 {
            metadata: ctx.accounts.badge_metadata.key(),
            master_edition: None,
            mint: (ctx.accounts.badge_mint.key(), true),
            authority: ctx.accounts.project.key(),
            payer: ctx.accounts.authority.key(),
            update_authority: (ctx.accounts.project.key(), true),
            system_program: ctx.accounts.system_program.key(),
            sysvar_instructions: anchor_lang::solana_program::sysvar::instructions::ID,
            spl_token_program: Some(ctx.accounts.token_program.key()),
        }
        .instruction(mpl_token_metadata::instructions::CreateV1InstructionArgs {
            name: project_name,
            symbol: badge_symbol,
            uri: badge_uri,
            seller_fee_basis_points: 0,
            creators: None,
            primary_sale_happened: false,
            is_mutable: true,
            token_standard: mpl_token_metadata::types::TokenStandard::NonFungible,
            collection: None,
            uses: None,
            collection_details: None,
            rule_set: None,
            decimals: Some(0),
            print_supply: None,
        });

        let signer_seeds: &[&[&[u8]]] = &[
            &[
                Project::SEED_PREFIX,
                authority_pubkey.as_ref(),
                &project_id_bytes,
                &[bump],
            ]
        ];

        let account_infos = [
            ctx.accounts.badge_metadata.to_account_info(),
            ctx.accounts.badge_mint.to_account_info(),
            ctx.accounts.project.to_account_info(),
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.sysvar_instructions.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ];

        invoke_signed(&metadata_ix, &account_infos, signer_seeds)?;

        Ok(())
    }

    pub fn pledge(ctx: Context<Pledge>, amount: u64) -> Result<()> {
        require!(amount > 0, FundingError::InvalidAmount);

        let project = &mut ctx.accounts.project;
        require!(
            matches!(project.status, ProjectStatus::Active),
            FundingError::ProjectNotActive
        );

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp < project.deadline_ts,
            FundingError::ProjectEnded
        );

        require_keys_eq!(
            ctx.accounts.donor_token_account.mint,
            project.mint,
            FundingError::MintMismatch
        );

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.donor_token_account.to_account_info(),
                to: ctx.accounts.project_vault.to_account_info(),
                authority: ctx.accounts.donor.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount)?;

        let should_mint_badge = ctx.accounts.donor_badge_account.amount == 0;
        let project_id_seed = project.project_id_seed;
        let project_authority = project.authority;
        let project_bump = project.bump;

        project.total_pledged = project
            .total_pledged
            .checked_add(amount)
            .ok_or(FundingError::MathOverflow)?;

        drop(project);

        if should_mint_badge {
            let signer_seeds: &[&[&[u8]]] = &[
                &[
                    Project::SEED_PREFIX,
                    project_authority.as_ref(),
                    &project_id_seed,
                    &[project_bump],
                ]
            ];

            let mint_badge_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.badge_mint.to_account_info(),
                    to: ctx.accounts.donor_badge_account.to_account_info(),
                    authority: ctx.accounts.project.to_account_info(),
                },
                signer_seeds,
            );
            token::mint_to(mint_badge_ctx, 1)?;
        }

        Ok(())
    }

    pub fn finalize_project(ctx: Context<FinalizeProject>) -> Result<()> {
        let project = &mut ctx.accounts.project;
        require!(
            matches!(project.status, ProjectStatus::Active),
            FundingError::ProjectAlreadyClosed
        );

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= project.deadline_ts
                || project.total_pledged >= project.target_amount,
            FundingError::ProjectStillRunning
        );

        project.status = if project.total_pledged >= project.target_amount {
            ProjectStatus::Successful
        } else {
            ProjectStatus::Failed
        };

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, FundingError::InvalidAmount);

        let project = &ctx.accounts.project;
        require!(
            matches!(project.status, ProjectStatus::Successful),
            FundingError::ProjectNotSuccessful
        );
        require!(
            ctx.accounts.project_vault.amount >= amount,
            FundingError::VaultBalanceTooLow
        );

        let project_id_bytes = project.project_id_seed;
        let bump = [project.bump];
        let signer_seeds: &[&[&[u8]]] = &[
            &[
                Project::SEED_PREFIX,
                project.authority.as_ref(),
                &project_id_bytes,
                &bump,
            ]
        ];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.project_vault.to_account_info(),
                to: ctx.accounts.authority_token_account.to_account_info(),
                authority: ctx.accounts.project.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi_ctx, amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(project_id: u64)]
pub struct InitializeProject<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = Project::LEN,
        seeds = [Project::SEED_PREFIX, authority.key().as_ref(), &project_id.to_le_bytes()],
        bump
    )]
    pub project: Account<'info, Project>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = project
    )]
    pub project_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = project,
        mint::freeze_authority = project
    )]
    pub badge_mint: Account<'info, Mint>,
    /// CHECK: Created via Metaplex CPI
    #[account(mut)]
    pub badge_metadata: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// CHECK: Metaplex Token Metadata program
    pub token_metadata_program: UncheckedAccount<'info>,
    pub rent: Sysvar<'info, Rent>,
    /// CHECK: Sysvar Instructions
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub sysvar_instructions: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Pledge<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,
    #[account(
        mut,
        constraint = donor_token_account.owner == donor.key() @ FundingError::Unauthorized
    )]
    pub donor_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [Project::SEED_PREFIX, project.authority.as_ref(), project.project_id_seed.as_ref()],
        bump
    )]
    pub project: Account<'info, Project>,
    #[account(
        mut,
        constraint = project_vault.key() == project.vault @ FundingError::VaultMismatch
    )]
    pub project_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = project.badge_mint @ FundingError::MintMismatch
    )]
    pub badge_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = donor,
        associated_token::mint = badge_mint,
        associated_token::authority = donor
    )]
    pub donor_badge_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FinalizeProject<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority @ FundingError::Unauthorized,
        seeds = [Project::SEED_PREFIX, project.authority.as_ref(), project.project_id_seed.as_ref()],
        bump
    )]
    pub project: Account<'info, Project>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority @ FundingError::Unauthorized,
        seeds = [Project::SEED_PREFIX, project.authority.as_ref(), project.project_id_seed.as_ref()],
        bump
    )]
    pub project: Account<'info, Project>,
    #[account(
        mut,
        constraint = project_vault.key() == project.vault @ FundingError::VaultMismatch
    )]
    pub project_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = authority_token_account.mint == project.mint @ FundingError::MintMismatch,
        constraint = authority_token_account.owner == authority.key()
    )]
    pub authority_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Project {
    pub project_id: u64,
    pub project_id_seed: [u8; 8],
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub badge_mint: Pubkey,
    pub vault: Pubkey,
    pub target_amount: u64,
    pub deadline_ts: i64,
    pub total_pledged: u64,
    pub status: ProjectStatus,
    pub bump: u8,
    pub reserved: [u8; 6],
}

impl Project {
    pub const LEN: usize = 8 // discriminator
        + 8 // project_id
        + 8 // project_id_seed
        + 32 // authority
        + 32 // mint
        + 32 // badge_mint
        + 32 // vault
        + 8 // target_amount
        + 8 // deadline_ts
        + 8 // total_pledged
        + 1 // status
        + 1 // bump
        + 6; // reserved padding
    pub const SEED_PREFIX: &'static [u8] = b"project";
}

#[derive(
    AnchorSerialize,
    AnchorDeserialize,
    Clone,
    Copy,
    PartialEq,
    Eq,
)]
#[repr(u8)]
pub enum ProjectStatus {
    Active = 0,
    Successful = 1,
    Failed = 2,
}

impl Default for ProjectStatus {
    fn default() -> Self {
        ProjectStatus::Active
    }
}

#[error_code]
pub enum FundingError {
    #[msg("Provided amount is invalid")]
    InvalidAmount,
    #[msg("Deadline must be in the future")]
    InvalidDeadline,
    #[msg("Project is not active")]
    ProjectNotActive,
    #[msg("Project funding period has ended")]
    ProjectEnded,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("You are not authorized to perform this action")]
    Unauthorized,
    #[msg("Project is still running")]
    ProjectStillRunning,
    #[msg("Project already closed")]
    ProjectAlreadyClosed,
    #[msg("Project was not successful")]
    ProjectNotSuccessful,
    #[msg("Vault balance is too low")]
    VaultBalanceTooLow,
    #[msg("Token mint mismatch")]
    MintMismatch,
    #[msg("Vault account mismatch")]
    VaultMismatch,
    #[msg("Expected PDA bump not found")]
    BumpNotFound,
    #[msg("Token metadata program mismatch")]
    MetadataProgramMismatch,
    #[msg("Project name too long (max 100 characters)")]
    NameTooLong,
    #[msg("Badge symbol too long (max 10 characters)")]
    SymbolTooLong,
    #[msg("Badge URI too long (max 200 characters)")]
    UriTooLong,
}
