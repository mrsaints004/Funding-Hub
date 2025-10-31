use anchor_lang::prelude::*;

declare_id!("6pCiN5ZUf5GCY3hJ8YiWL27apECaobGPLVVsSi51rrUq");

#[program]
pub mod governance {
    use super::*;

    pub fn create_realm(
        ctx: Context<CreateRealm>,
        name_seed: [u8; 8],
        voting_mint: Pubkey,
        min_quorum: u64,
        approval_threshold: u64,
        voting_period_slots: u64,
        dao_address: Option<Pubkey>,
    ) -> Result<()> {
        require!(approval_threshold <= 10_000, GovernanceError::InvalidThreshold);
        require!(min_quorum <= 10_000, GovernanceError::InvalidQuorum);
        require!(voting_period_slots > 0, GovernanceError::InvalidVotingPeriod);

        let realm = &mut ctx.accounts.realm;
        realm.authority = ctx.accounts.authority.key();
        realm.name_seed = name_seed;
        realm.voting_mint = voting_mint;
        realm.min_quorum = min_quorum;
        realm.approval_threshold = approval_threshold;
        realm.voting_period_slots = voting_period_slots;
        realm.dao_address = dao_address.unwrap_or(Pubkey::default());
        realm.bump = ctx.bumps.realm;
        realm.proposal_count = 0;

        Ok(())
    }

    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        proposal_id: u64,
        metadata_uri: Pubkey,
        voting_start_slot: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        require!(voting_start_slot >= clock.slot, GovernanceError::VotingAlreadyStarted);

        let realm = &mut ctx.accounts.realm;

        let proposal = &mut ctx.accounts.proposal;
        proposal.realm = realm.key();
        proposal.proposer = ctx.accounts.proposer.key();
        proposal.metadata_uri = metadata_uri;
        proposal.proposal_id = proposal_id;
        proposal.voting_start_slot = voting_start_slot;
        proposal.voting_end_slot = voting_start_slot
            .checked_add(realm.voting_period_slots)
            .ok_or(GovernanceError::MathOverflow)?;
        proposal.status = ProposalStatus::Pending;
        proposal.yes_votes = 0;
        proposal.no_votes = 0;
        proposal.bump = ctx.bumps.proposal;

        realm.proposal_count = realm
            .proposal_count
            .checked_add(1)
            .ok_or(GovernanceError::MathOverflow)?;

        Ok(())
    }

    pub fn cast_vote(ctx: Context<CastVote>, support: bool, weight: u64) -> Result<()> {
        require!(weight > 0, GovernanceError::InvalidWeight);

        let proposal = &mut ctx.accounts.proposal;
        let realm = &ctx.accounts.realm;
        require_keys_eq!(proposal.realm, realm.key(), GovernanceError::RealmMismatch);

        let clock = Clock::get()?;
        require!(clock.slot >= proposal.voting_start_slot, GovernanceError::VotingNotOpen);
        require!(clock.slot <= proposal.voting_end_slot, GovernanceError::VotingClosed);

        // If realm is linked to a DAO, verify voter has DAO membership
        // This can be checked by verifying the voter holds the DAO's pass NFT
        // For now, we'll allow the weight parameter to represent voting power
        // In production, this should be verified against token holdings

        let vote_record = &mut ctx.accounts.vote_record;
        require!(vote_record.weight == 0, GovernanceError::AlreadyVoted);

        vote_record.proposal = proposal.key();
        vote_record.voter = ctx.accounts.voter.key();
        vote_record.support = support;
        vote_record.weight = weight;
        vote_record.bump = ctx.bumps.vote_record;

        if support {
            proposal.yes_votes = proposal
                .yes_votes
                .checked_add(weight)
                .ok_or(GovernanceError::MathOverflow)?;
        } else {
            proposal.no_votes = proposal
                .no_votes
                .checked_add(weight)
                .ok_or(GovernanceError::MathOverflow)?;
        }

        Ok(())
    }

    pub fn finalize_proposal(ctx: Context<FinalizeProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let realm = &ctx.accounts.realm;
        require_keys_eq!(proposal.realm, realm.key(), GovernanceError::RealmMismatch);

        let clock = Clock::get()?;
        require!(clock.slot > proposal.voting_end_slot, GovernanceError::VotingNotEnded);
        require!(proposal.status == ProposalStatus::Pending, GovernanceError::ProposalClosed);

        let total_votes = proposal
            .yes_votes
            .checked_add(proposal.no_votes)
            .ok_or(GovernanceError::MathOverflow)?;

        let meets_quorum = total_votes >= realm.min_quorum;

        if !meets_quorum {
            proposal.status = ProposalStatus::Defeated;
            return Ok(());
        }

        let approval_ratio = proposal
            .yes_votes
            .checked_mul(10_000)
            .ok_or(GovernanceError::MathOverflow)?
            .checked_div(total_votes.max(1))
            .ok_or(GovernanceError::MathOverflow)?;

        proposal.status = if approval_ratio >= realm.approval_threshold {
            ProposalStatus::Succeeded
        } else {
            ProposalStatus::Defeated
        };

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name_seed: [u8; 8])]
pub struct CreateRealm<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = Realm::LEN,
        seeds = [Realm::SEED_PREFIX, authority.key().as_ref(), &name_seed],
        bump
    )]
    pub realm: Account<'info, Realm>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(proposal_id: u64, _metadata_uri: Pubkey, _voting_start_slot: u64)]
pub struct CreateProposal<'info> {
    #[account(mut)]
    pub proposer: Signer<'info>,
    #[account(
        mut,
        has_one = authority @ GovernanceError::Unauthorized,
        seeds = [Realm::SEED_PREFIX, realm.authority.as_ref(), &realm.name_seed],
        bump = realm.bump
    )]
    pub realm: Account<'info, Realm>,
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = proposer,
        space = Proposal::LEN,
        seeds = [Proposal::SEED_PREFIX, realm.key().as_ref(), &proposal_id.to_le_bytes()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account(
        mut,
        seeds = [Realm::SEED_PREFIX, realm.authority.as_ref(), &realm.name_seed],
        bump = realm.bump
    )]
    pub realm: Account<'info, Realm>,
    #[account(
        mut,
        seeds = [Proposal::SEED_PREFIX, realm.key().as_ref(), &proposal.proposal_id.to_le_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,
    #[account(
        init,
        payer = voter,
        space = VoteRecord::LEN,
        seeds = [VoteRecord::SEED_PREFIX, proposal.key().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeProposal<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority @ GovernanceError::Unauthorized,
        seeds = [Realm::SEED_PREFIX, realm.authority.as_ref(), &realm.name_seed],
        bump = realm.bump
    )]
    pub realm: Account<'info, Realm>,
    #[account(
        mut,
        seeds = [Proposal::SEED_PREFIX, realm.key().as_ref(), &proposal.proposal_id.to_le_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,
}

#[account]
pub struct Realm {
    pub authority: Pubkey,
    pub voting_mint: Pubkey,
    pub dao_address: Pubkey,
    pub name_seed: [u8; 8],
    pub min_quorum: u64,
    pub approval_threshold: u64,
    pub voting_period_slots: u64,
    pub proposal_count: u64,
    pub bump: u8,
    pub reserved: [u8; 7],
}

impl Realm {
    pub const LEN: usize = 8 // discriminator
        + 32 // authority
        + 32 // voting_mint
        + 32 // dao_address
        + 8  // name_seed
        + 8  // min_quorum
        + 8  // approval_threshold
        + 8  // voting_period_slots
        + 8  // proposal_count
        + 1  // bump
        + 7; // reserved
    pub const SEED_PREFIX: &'static [u8] = b"realm";

}

#[account]
pub struct Proposal {
    pub realm: Pubkey,
    pub proposer: Pubkey,
    pub metadata_uri: Pubkey,
    pub proposal_id: u64,
    pub voting_start_slot: u64,
    pub voting_end_slot: u64,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub status: ProposalStatus,
    pub bump: u8,
    pub reserved: [u8; 7],
}

impl Proposal {
    pub const LEN: usize = 8
        + 32
        + 32
        + 32
        + 8
        + 8
        + 8
        + 8
        + 8
        + 1
        + 7;
    pub const SEED_PREFIX: &'static [u8] = b"proposal";
}

#[account]
pub struct VoteRecord {
    pub proposal: Pubkey,
    pub voter: Pubkey,
    pub support: bool,
    pub weight: u64,
    pub bump: u8,
    pub reserved: [u8; 7],
}

impl VoteRecord {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 1 + 7;
    pub const SEED_PREFIX: &'static [u8] = b"vote";
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum ProposalStatus {
    Pending = 0,
    Succeeded = 1,
    Defeated = 2,
}

#[error_code]
pub enum GovernanceError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid threshold")]
    InvalidThreshold,
    #[msg("Invalid quorum")]
    InvalidQuorum,
    #[msg("Invalid voting period")]
    InvalidVotingPeriod,
    #[msg("Voting has already started")]
    VotingAlreadyStarted,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid weight")]
    InvalidWeight,
    #[msg("Voting not open")]
    VotingNotOpen,
    #[msg("Voting closed")]
    VotingClosed,
    #[msg("Duplicate vote")]
    AlreadyVoted,
    #[msg("Voting not ended")]
    VotingNotEnded,
    #[msg("Proposal already closed")]
    ProposalClosed,
    #[msg("Realm mismatch")]
    RealmMismatch,
    #[msg("Bump missing")]
    BumpNotFound,
}
